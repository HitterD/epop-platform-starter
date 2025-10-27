import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { fcmTokens } from '@/db/schema';
import { withAuth, withCors, withRateLimit } from '@/lib/auth/middleware';

// Validation schema
const unregisterTokenSchema = z.object({
    token: z.string().min(1, 'FCM token is required'),
    platform: z.enum(['web', 'ios', 'android']).optional(),
});

const handler = withCors(
    withRateLimit(10, 60 * 1000)( // 10 requests per minute
        withAuth(async (req): Promise<NextResponse> => {
            try {
                const body = await req.json();
                const { token, platform } = unregisterTokenSchema.parse(body);

                const userId = req.user!.id;

                // Build query conditions
                const conditions = [
                    eq(fcmTokens.userId, userId),
                    eq(fcmTokens.token, token),
                ];

                if (platform) {
                    conditions.push(eq(fcmTokens.platform, platform));
                }

                // Update token to be inactive
                const result = await db
                    .update(fcmTokens)
                    .set({
                        isActive: false,
                        updatedAt: new Date(),
                    })
                    .where(and(...conditions));

                if (result.rowCount === 0) {
                    return NextResponse.json(
                        { error: 'FCM token not found or already inactive' },
                        { status: 404 }
                    );
                }

                return NextResponse.json({
                    message: 'FCM token unregistered successfully',
                });

            } catch (error) {
                console.error('FCM token unregistration error:', error);

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
                    { error: 'Failed to unregister FCM token' },
                    { status: 500 }
                );
            }
        })
    )
);

export { handler as POST };