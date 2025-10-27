import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withCors, withRateLimit } from '@/lib/auth/middleware';
import { JWTService } from '@/lib/auth/jwt';

const handler = withCors(
    withRateLimit(10, 60 * 1000)( // 10 requests per minute
        withAuth(async (req): Promise<NextResponse> => {
            try {
                const refreshToken = req.cookies.get('refresh_token')?.value;

                if (refreshToken) {
                    // Revoke the refresh token
                    await JWTService.revokeRefreshToken(refreshToken, req.user!.id);
                }

                // Clear cookies
                const response = NextResponse.json({
                    message: 'Logged out successfully'
                });

                response.cookies.set('access_token', '', {
                    httpOnly: false,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 0,
                    path: '/',
                });

                response.cookies.set('refresh_token', '', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 0,
                    path: '/',
                });

                return response;

            } catch (error) {
                console.error('Logout error:', error);

                // Even if there's an error, clear the cookies
                const response = NextResponse.json({
                    message: 'Logged out successfully'
                });

                response.cookies.set('access_token', '', {
                    httpOnly: false,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 0,
                    path: '/',
                });

                response.cookies.set('refresh_token', '', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 0,
                    path: '/',
                });

                return response;
            }
        })
    )
);

export { handler as POST };