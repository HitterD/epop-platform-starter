import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { PasswordService } from '@/lib/auth/password';
import { withCors, withRateLimit } from '@/lib/auth/middleware';
import { createEmailService } from '@/lib/email/resend-provider';

// Validation schema
const requestResetSchema = z.object({
    email: z.string().email('Invalid email address'),
});

const handler = withCors(
    withRateLimit(3, 15 * 60 * 1000)( // 3 requests per 15 minutes
        async (req: NextRequest): Promise<NextResponse> => {
            try {
                // Parse and validate request body
                const body = await req.json();
                const { email } = requestResetSchema.parse(body);

                // Generate password reset token and send email
                try {
                    const ipAddress = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
                    const userAgent = req.headers.get('user-agent') || 'unknown';

                    const resetToken = await PasswordService.generatePasswordResetToken(
                        email,
                        ipAddress,
                        userAgent
                    );

                    // Create password reset URL
                    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;

                    // Get user details for email
                    const [user] = await db
                        .select({
                            name: users.name,
                            email: users.email,
                        })
                        .from(users)
                        .where(eq(users.email, email))
                        .limit(1);

                    if (user) {
                        // Send password reset email
                        const emailService = createEmailService();
                        const emailResult = await emailService.sendPasswordResetEmail(email, {
                            userName: user.name,
                            resetUrl,
                            expiryHours: 1,
                        });

                        if (!emailResult.success) {
                            console.error('Failed to send password reset email:', emailResult.error);

                            // In production, we might want to queue this for retry
                            // For now, we'll still return success to prevent user enumeration
                        }
                    }

                    const isDevelopment = process.env.NODE_ENV !== 'production';

                    return NextResponse.json({
                        message: 'Password reset link sent to your email',
                        // Only in development for testing
                        ...(isDevelopment && {
                            resetToken,
                            resetUrl,
                            debugInfo: {
                                userName: user?.name,
                                email: user?.email,
                            }
                        })
                    });

                } catch (error) {
                    // For security reasons, don't reveal if email exists or not
                    console.error('Password reset request error:', error);

                    return NextResponse.json({
                        message: 'If an account with this email exists, a password reset link has been sent'
                    });
                }

            } catch (error) {
                console.error('Password reset request error:', error);

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

                // Always return success to prevent user enumeration
                return NextResponse.json({
                    message: 'If an account with this email exists, a password reset link has been sent'
                });
            }
        }
    )
);

export { handler as POST };