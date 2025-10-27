import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { PasswordService } from '@/lib/auth/password';
import { withCors, withRateLimit } from '@/lib/auth/middleware';

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

                // Generate password reset token
                // Note: This will throw an error if user doesn't exist, but for security
                // we might want to always return success to prevent user enumeration
                try {
                    const resetToken = await PasswordService.generatePasswordResetToken(email);

                    // TODO: Send email with reset token
                    // For now, we'll just return the token in development
                    const isDevelopment = process.env.NODE_ENV !== 'production';

                    if (isDevelopment) {
                        // In development, return the reset token for testing
                        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;

                        console.log('Password reset link (development only):', resetUrl);

                        return NextResponse.json({
                            message: 'Password reset link sent to your email',
                            // Only in development
                            ...(isDevelopment && {
                                resetToken,
                                resetUrl
                            })
                        });
                    }

                    // In production, you would send an email here
                    // await sendPasswordResetEmail(email, resetToken);

                    return NextResponse.json({
                        message: 'Password reset link sent to your email'
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