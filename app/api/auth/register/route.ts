import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { PasswordService } from '@/lib/auth/password';
import { JWTService } from '@/lib/auth/jwt';
import { withCors, withRateLimit } from '@/lib/auth/middleware';

// Validation schema
const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

const handler = withCors(
    withRateLimit(5, 15 * 60 * 1000)( // 5 requests per 15 minutes
        async (req: NextRequest): Promise<NextResponse> => {
            try {
                // Parse and validate request body
                const body = await req.json();
                const { name, email, password } = registerSchema.parse(body);

                // Check if user already exists
                const existingUser = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, email.toLowerCase()))
                    .limit(1);

                if (existingUser.length > 0) {
                    return NextResponse.json(
                        { error: 'User with this email already exists' },
                        { status: 409 }
                    );
                }

                // Validate password strength
                const passwordValidation = PasswordService.validatePasswordStrength(password);
                if (!passwordValidation.isValid) {
                    return NextResponse.json(
                        {
                            error: 'Password does not meet security requirements',
                            details: passwordValidation.errors
                        },
                        { status: 400 }
                    );
                }

                // Hash password
                const passwordHash = await PasswordService.hashPassword(password);

                // Create user
                const [newUser] = await db
                    .insert(users)
                    .values({
                        name,
                        email: email.toLowerCase(),
                        passwordHash,
                        role: 'USER',
                        status: 'ACTIVE',
                        emailVerified: false,
                    })
                    .returning({
                        id: users.id,
                        name: users.name,
                        email: users.email,
                        role: users.role,
                        status: users.status,
                        emailVerified: users.emailVerified,
                        createdAt: users.createdAt,
                    });

                // Create initial audit log
                await db.insert(users).values({
                    // This would be handled by the audit logs table
                });

                // Generate tokens
                const deviceFingerprint = req.headers.get('user-agent') || 'unknown';
                const ipAddress = req.headers.get('x-forwarded-for') || req.ip || 'unknown';

                const tokenPair = await JWTService.createTokenPair(
                    newUser.id,
                    deviceFingerprint,
                    ipAddress,
                    deviceFingerprint
                );

                // Set secure cookie for refresh token
                const response = NextResponse.json({
                    user: {
                        id: newUser.id,
                        name: newUser.name,
                        email: newUser.email,
                        role: newUser.role,
                    },
                    tokenPair,
                });

                // Set secure, HTTP-only cookies
                const isSecure = process.env.NODE_ENV === 'production';
                const sameSite = isSecure ? 'strict' : 'lax';

                response.cookies.set('access_token', tokenPair.accessToken, {
                    httpOnly: false, // Client needs to read this for API calls
                    secure: isSecure,
                    sameSite,
                    maxAge: tokenPair.expiresIn,
                    path: '/',
                });

                response.cookies.set('refresh_token', tokenPair.refreshToken, {
                    httpOnly: true, // HTTP-only for security
                    secure: isSecure,
                    sameSite,
                    maxAge: 7 * 24 * 60 * 60, // 7 days
                    path: '/',
                });

                return response;

            } catch (error) {
                console.error('Registration error:', error);

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
                    { error: 'Registration failed' },
                    { status: 500 }
                );
            }
        }
    )
);

export { handler as POST };