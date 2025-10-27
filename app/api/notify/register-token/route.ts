import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { fcmTokens } from '@/db/schema';
import { withAuth, withCors, withRateLimit } from '@/lib/auth/middleware';

// Validation schema
const registerTokenSchema = z.object({
    token: z.string().min(1, 'FCM token is required'),
    platform: z.enum(['web', 'ios', 'android']),
    deviceInfo: z.object({
        userAgent: z.string().optional(),
        deviceId: z.string().optional(),
        model: z.string().optional(),
        osVersion: z.string().optional(),
        appVersion: z.string().optional(),
    }).optional(),
});

const handler = withCors(
    withRateLimit(10, 60 * 1000)( // 10 requests per minute
        withAuth(async (req): Promise<NextResponse> => {
            try {
                const body = await req.json();
                const { token, platform, deviceInfo } = registerTokenSchema.parse(body);

                const userId = req.user!.id;
                const userAgent = req.headers.get('user-agent') || 'unknown';
                const ipAddress = req.headers.get('x-forwarded-for') || req.ip || 'unknown';

                // Check if token already exists for this user
                const [existingToken] = await db
                    .select()
                    .from(fcmTokens)
                    .where(
                        and(
                            eq(fcmTokens.userId, userId),
                            eq(fcmTokens.token, token)
                        )
                    )
                    .limit(1);

                if (existingToken) {
                    // Update existing token
                    await db
                        .update(fcmTokens)
                        .set({
                            platform,
                            deviceInfo: {
                                ...deviceInfo,
                                userAgent,
                            },
                            isActive: true,
                            updatedAt: new Date(),
                        })
                        .where(eq(fcmTokens.id, existingToken.id));

                    return NextResponse.json({
                        message: 'FCM token updated successfully',
                        tokenId: existingToken.id,
                    });
                }

                // Deactivate all existing tokens for the same platform for this user
                // (this prevents duplicate notifications)
                await db
                    .update(fcmTokens)
                    .set({
                        isActive: false,
                        updatedAt: new Date(),
                    })
                    .where(
                        and(
                            eq(fcmTokens.userId, userId),
                            eq(fcmTokens.platform, platform)
                        )
                    );

                // Insert new FCM token
                const [newToken] = await db
                    .insert(fcmTokens)
                    .values({
                        userId,
                        token,
                        platform,
                        deviceInfo: {
                            ...deviceInfo,
                            userAgent,
                            ipAddress,
                            registeredAt: new Date().toISOString(),
                        },
                        isActive: true,
                    })
                    .returning({
                        id: fcmTokens.id,
                        platform: fcmTokens.platform,
                        createdAt: fcmTokens.createdAt,
                    });

                return NextResponse.json({
                    message: 'FCM token registered successfully',
                    tokenId: newToken.id,
                });

            } catch (error) {
                console.error('FCM token registration error:', error);

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
                    { error: 'Failed to register FCM token' },
                    { status: 500 }
                );
            }
        })
    )
);

export { handler as POST };