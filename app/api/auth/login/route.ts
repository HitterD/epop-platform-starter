import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { PasswordService } from '@/lib/auth/password';
import { JWTService } from '@/lib/auth/jwt';
import { withCors, withRateLimit } from '@/lib/auth/middleware';

// Validation schema
const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional().default(false),
});

const handler = withCors(
    withRateLimit(5, 15 * 60 * 1000)( // 5 attempts per 15 minutes
        async (req: NextRequest): Promise<NextResponse> => {
            try {
                // Parse and validate request body
                const body = await req.json();
                const { email, password, rememberMe } = loginSchema.parse(body);

                // Find user by email
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, email.toLowerCase()))
                    .limit(1);

                if (!user) {
                    // Don't reveal that user doesn't exist for security
                    return NextResponse.json(
                        { error: 'Invalid email or password' },
                        { status: 401 }
                    );
                }

                // Check if user is locked out
                const isLocked = await PasswordService.isUserLocked(user.id);
                if (isLocked) {
                    return NextResponse.json(
                        {
                            error: 'Account temporarily locked due to too many failed login attempts. Please try again later.',
                            code: 'ACCOUNT_LOCKED'
                        },
                        { status: 423 }
                    );
                }

                // Verify password
                const isPasswordValid = await PasswordService.verifyPassword(password, user.passwordHash);

                if (!isPasswordValid) {
                    // Record failed login attempt
                    const ipAddress = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
                    const userAgent = req.headers.get('user-agent') || 'unknown';

                    await PasswordService.recordFailedLogin(user.id, ipAddress, userAgent);

                    return NextResponse.json(
                        { error: 'Invalid email or password' },
                        { status: 401 }
                    );
                }

                // Check if account is active
                if (user.status !== 'ACTIVE') {
                    return NextResponse.json(
                        {
                            error: 'Account is not active',
                            code: 'ACCOUNT_INACTIVE'
                        },
                        { status: 403 }
                    );
                }

                // Reset failed login attempts
                const ipAddress = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
                const userAgent = req.headers.get('user-agent') || 'unknown';

                await PasswordService.resetFailedLoginAttempts(user.id, ipAddress, userAgent);

                // Generate tokens
                const deviceFingerprint = userAgent;
                const tokenPair = await JWTService.createTokenPair(
                    user.id,
                    deviceFingerprint,
                    ipAddress,
                    userAgent
                );

                // Update user data
                await db
                    .update(users)
                    .set({
                        lastLoginAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(users.id, user.id));

                // Set response
                const response = NextResponse.json({
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        emailVerified: user.emailVerified,
                        avatarUrl: user.avatarUrl,
                    },
                    tokenPair,
                });

                // Set secure cookies
                const isSecure = process.env.NODE_ENV === 'production';
                const sameSite = isSecure ? 'strict' : 'lax';

                response.cookies.set('access_token', tokenPair.accessToken, {
                    httpOnly: false, // Client needs to read this for API calls
                    secure: isSecure,
                    sameSite,
                    maxAge: tokenPair.expiresIn,
                    path: '/',
                });

                // Set refresh token with longer expiry if "remember me" is checked
                const refreshMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30 days or 7 days

                response.cookies.set('refresh_token', tokenPair.refreshToken, {
                    httpOnly: true, // HTTP-only for security
                    secure: isSecure,
                    sameSite,
                    maxAge: refreshMaxAge,
                    path: '/',
                });

                return response;

            } catch (error) {
                console.error('Login error:', error);

                if (error instanceof z.ZodError) {
                    return NextResponse.json(
                        {
                            error: 'Validation failed',
                            details: error.errors.map(err => ({
                                field: err.path.join('.'),
                                message: err.message
                            }))
                        },
                        { status: 400 }
                    );
                }

                return NextResponse.json(
                    { error: 'Login failed' },
                    { status: 500 }
                );
            }
        }
    )
);

export { handler as POST };