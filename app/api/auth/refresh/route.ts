import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withCors, withRateLimit } from '@/lib/auth/middleware';
import { JWTService } from '@/lib/auth/jwt';

// Validation schema for refresh token requests
const refreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required').optional(),
    rememberMe: z.boolean().optional().default(false),
});

const handler = withCors(
    withRateLimit(5, 60 * 1000)( // 5 requests per minute (more restrictive for refresh)
        async (req: NextRequest): Promise<NextResponse> => {
            try {
                // Only allow POST requests
                if (req.method !== 'POST') {
                    return NextResponse.json(
                        { error: 'Method not allowed' },
                        { status: 405 }
                    );
                }

                // Parse and validate request body
                let body = {};
                try {
                    body = await req.json();
                } catch {
                    // Body is optional for refresh requests
                }

                const validatedBody = refreshSchema.parse(body);

                // Get refresh token from cookie first (preferred method)
                let refreshToken = req.cookies.get('refresh_token')?.value;

                // Fall back to request body if no cookie
                if (!refreshToken && validatedBody.refreshToken) {
                    refreshToken = validatedBody.refreshToken;
                }

                if (!refreshToken) {
                    return NextResponse.json(
                        { error: 'Refresh token required' },
                        { status: 401 }
                    );
                }

                // Get request metadata
                const userAgent = req.headers.get('user-agent') || 'unknown';
                const ipAddress = req.headers.get('x-forwarded-for') || req.ip || 'unknown';

                // Create device fingerprint (user agent + IP hash for additional security)
                const deviceFingerprint = Buffer.from(
                    `${userAgent}:${Buffer.from(ipAddress).toString('base64').slice(0, 8)}`
                ).toString('base64').slice(0, 32);

                // Refresh the tokens with enhanced security
                const tokenPair = await JWTService.refreshTokens(
                    refreshToken,
                    deviceFingerprint,
                    ipAddress,
                    userAgent
                );

                // Set response with enhanced security headers
                const response = NextResponse.json({
                    tokenPair,
                    timestamp: new Date().toISOString(),
                });

                // Configure cookie security
                const isSecure = process.env.NODE_ENV === 'production';
                const sameSite = isSecure ? 'strict' : 'lax';

                // Set access token cookie (accessible to JavaScript for API calls)
                response.cookies.set('access_token', tokenPair.accessToken, {
                    httpOnly: false, // Required for client-side access
                    secure: isSecure,
                    sameSite,
                    maxAge: tokenPair.expiresIn,
                    path: '/',
                });

                // Set refresh token cookie (HttpOnly for security)
                const refreshMaxAge = validatedBody.rememberMe
                    ? 30 * 24 * 60 * 60  // 30 days if remember me
                    : 7 * 24 * 60 * 60;   // 7 days default

                response.cookies.set('refresh_token', tokenPair.refreshToken, {
                    httpOnly: true, // Prevent XSS attacks
                    secure: isSecure,
                    sameSite,
                    maxAge: refreshMaxAge,
                    path: '/',
                });

                // Add security headers
                response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                response.headers.set('Pragma', 'no-cache');
                response.headers.set('Expires', '0');

                return response;

            } catch (error) {
                console.error('Token refresh error:', error);

                // Clear all auth cookies on any refresh error
                const clearCookies = (response: NextResponse) => {
                    const isSecure = process.env.NODE_ENV === 'production';
                    const sameSite = isSecure ? 'strict' : 'lax';

                    ['access_token', 'refresh_token'].forEach(cookieName => {
                        response.cookies.set(cookieName, '', {
                            httpOnly: cookieName === 'refresh_token',
                            secure: isSecure,
                            sameSite,
                            maxAge: 0,
                            path: '/',
                        });
                    });
                };

                if (error instanceof z.ZodError) {
                    const response = NextResponse.json(
                        {
                            error: 'Validation failed',
                            details: error.errors.map(err => ({
                                field: err.path.join('.'),
                                message: err.message
                            }))
                        },
                        { status: 400 }
                    );
                    clearCookies(response);
                    return response;
                }

                if (error instanceof Error) {
                    if (error.message.includes('expired')) {
                        const response = NextResponse.json(
                            {
                                error: 'Refresh token expired. Please log in again.',
                                code: 'TOKEN_EXPIRED',
                                requiresLogin: true
                            },
                            { status: 401 }
                        );
                        clearCookies(response);
                        return response;
                    }

                    if (error.message.includes('invalid') ||
                        error.message.includes('not found') ||
                        error.message.includes('verification failed')) {
                        const response = NextResponse.json(
                            {
                                error: 'Invalid refresh token',
                                code: 'INVALID_TOKEN',
                                requiresLogin: true
                            },
                            { status: 401 }
                        );
                        clearCookies(response);
                        return response;
                    }

                    if (error.message.includes('not active') ||
                        error.message.includes('revoked')) {
                        const response = NextResponse.json(
                            {
                                error: 'Session has been revoked. Please log in again.',
                                code: 'SESSION_REVOKED',
                                requiresLogin: true
                            },
                            { status: 401 }
                        );
                        clearCookies(response);
                        return response;
                    }
                }

                const response = NextResponse.json(
                    {
                        error: 'Token refresh failed. Please try logging in again.',
                        code: 'REFRESH_FAILED',
                        requiresLogin: true
                    },
                    { status: 500 }
                );
                clearCookies(response);
                return response;
            }
        }
    )
);

export { handler as POST };