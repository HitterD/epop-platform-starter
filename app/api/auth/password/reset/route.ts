import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PasswordService } from '@/lib/auth/password';
import { withCors, withRateLimit } from '@/lib/auth/middleware';

// Validation schema
const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const handler = withCors(
    withRateLimit(5, 15 * 60 * 1000)( // 5 requests per 15 minutes
        async (req: NextRequest): Promise<NextResponse> => {
            try {
                // Parse and validate request body
                const body = await req.json();
                const { token, newPassword } = resetPasswordSchema.parse(body);

                // Validate new password strength
                const passwordValidation = PasswordService.validatePasswordStrength(newPassword);
                if (!passwordValidation.isValid) {
                    return NextResponse.json(
                        {
                            error: 'Password does not meet security requirements',
                            details: passwordValidation.errors
                        },
                        { status: 400 }
                    );
                }

                // Reset the password
                await PasswordService.resetPassword(
                    token,
                    newPassword,
                    req.headers.get('x-forwarded-for') || req.ip || 'unknown',
                    req.headers.get('user-agent') || 'unknown'
                );

                return NextResponse.json({
                    message: 'Password reset successfully'
                });

            } catch (error) {
                console.error('Password reset error:', error);

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

                if (error instanceof Error) {
                    if (error.message.includes('Invalid or expired reset token')) {
                        return NextResponse.json(
                            { error: 'Invalid or expired reset token' },
                            { status: 400 }
                        );
                    }

                    if (error.message.includes('expired')) {
                        return NextResponse.json(
                            { error: 'Reset token has expired. Please request a new password reset.' },
                            { status: 400 }
                        );
                    }

                    if (error.message.includes('not found')) {
                        return NextResponse.json(
                            { error: 'Invalid reset token' },
                            { status: 400 }
                        );
                    }
                }

                return NextResponse.json(
                    { error: 'Password reset failed' },
                    { status: 500 }
                );
            }
        }
    )
);

export { handler as POST };