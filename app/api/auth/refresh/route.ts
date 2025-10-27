import { NextRequest, NextResponse } from 'next/server';
import { withCors, withRateLimit } from '@/lib/auth/middleware';
import { JWTService } from '@/lib/auth/jwt';

const handler = withCors(
    withRateLimit(10, 60 * 1000)( // 10 requests per minute
        async (req: NextRequest): Promise<NextResponse> => {
            try {
                // Get refresh token from cookie or request body
                let refreshToken = req.cookies.get('refresh_token')?.value;

                if (!refreshToken && req.method === 'POST') {
                    const body = await req.json();
                    refreshToken = body.refreshToken;
                }

                if (!refreshToken) {
                    return NextResponse.json(
                        { error: 'Refresh token required' },
                        { status: 401 }
                    );
                }

                const deviceFingerprint = req.headers.get('user-agent') || 'unknown';
                const ipAddress = req.headers.get('x-forwarded-for') || req.ip || 'unknown';

                // Refresh the tokens
                const tokenPair = await JWTService.refreshTokens(
                    refreshToken,
                    deviceFingerprint,
                    ipAddress,
                    deviceFingerprint
                );

                // Set response
                const response = NextResponse.json({
                    tokenPair,
                });

                // Update cookies
                const isSecure = process.env.NODE_ENV === 'production';
                const sameSite = isSecure ? 'strict' : 'lax';

                response.cookies.set('access_token', tokenPair.accessToken, {
                    httpOnly: false,
                    secure: isSecure,
                    sameSite,
                    maxAge: tokenPair.expiresIn,
                    path: '/',
                });

                response.cookies.set('refresh_token', tokenPair.refreshToken, {
                    httpOnly: true,
                    secure: isSecure,
                    sameSite,
                    maxAge: 7 * 24 * 60 * 60, // 7 days
                    path: '/',
                });

                return response;

            } catch (error) {
                console.error('Token refresh error:', error);

                if (error instanceof Error) {
                    if (error.message.includes('expired')) {
                        // Clear expired cookies
                        const response = NextResponse.json(
                            { error: 'Refresh token expired', code: 'TOKEN_EXPIRED' },
                            { status: 401 }
                        );

                        response.cookies.set('refresh_token', '', {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'strict',
                            maxAge: 0,
                            path: '/',
                        });

                        return response;
                    }

                    if (error.message.includes('invalid') || error.message.includes('not found')) {
                        return NextResponse.json(
                            { error: 'Invalid refresh token' },
                            { status: 401 }
                        );
                    }
                }

                return NextResponse.json(
                    { error: 'Token refresh failed' },
                    { status: 500 }
                );
            }
        }
    )
);

export { handler as POST };