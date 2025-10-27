import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { fcmTokens } from '@/db/schema';
import { withAuth, withCors } from '@/lib/auth/middleware';

const handler = withCors(
    withAuth(async (req): Promise<NextResponse> => {
        try {
            const userId = req.user!.id;

            // Get all active FCM tokens for the user
            const tokens = await db
                .select({
                    id: fcmTokens.id,
                    platform: fcmTokens.platform,
                    deviceInfo: fcmTokens.deviceInfo,
                    isActive: fcmTokens.isActive,
                    createdAt: fcmTokens.createdAt,
                    updatedAt: fcmTokens.updatedAt,
                })
                .from(fcmTokens)
                .where(eq(fcmTokens.userId, userId));

            return NextResponse.json({
                tokens,
                count: tokens.length,
            });

        } catch (error) {
            console.error('Get FCM tokens error:', error);

            return NextResponse.json(
                { error: 'Failed to retrieve FCM tokens' },
                { status: 500 }
            );
        }
    })
);

export { handler as GET };