export interface EmailConfig {
    provider: 'resend' | 'sendgrid' | 'ses' | 'smtp';
    apiKey?: string;
    fromEmail: string;
    fromName?: string;
    replyTo?: string;
}

export interface EmailTemplate {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
    replyTo?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
    }>;
}

export interface PasswordResetEmailData {
    userName: string;
    resetUrl: string;
    expiryHours: number;
}

export interface EmailVerificationEmailData {
    userName: string;
    verificationUrl: string;
    expiryHours: number;
}

export abstract class EmailService {
    protected config: EmailConfig;

    constructor(config: EmailConfig) {
        this.config = config;
    }

    /**
     * Send an email
     */
    abstract sendEmail(template: EmailTemplate): Promise<{ success: boolean; messageId?: string; error?: string }>;

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(to: string, data: PasswordResetEmailData): Promise<{ success: boolean; error?: string }> {
        const template = this.getPasswordResetTemplate(to, data);
        const result = await this.sendEmail(template);

        return {
            success: result.success,
            error: result.error,
        };
    }

    /**
     * Send email verification email
     */
    async sendEmailVerificationEmail(to: string, data: EmailVerificationEmailData): Promise<{ success: boolean; error?: string }> {
        const template = this.getEmailVerificationTemplate(to, data);
        const result = await this.sendEmail(template);

        return {
            success: result.success,
            error: result.error,
        };
    }

    /**
     * Generate password reset email template
     */
    protected getPasswordResetTemplate(to: string, data: PasswordResetEmailData): EmailTemplate {
        const { userName, resetUrl, expiryHours } = data;

        return {
            to,
            subject: 'Reset Your EPOP Platform Password',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .header h1 {
            color: white;
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            background: #fff;
            padding: 40px;
            border: 1px solid #e1e5e9;
            border-radius: 0 0 10px 10px;
        }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            transition: background-color 0.2s;
        }
        .button:hover {
            background: #5a6fd8;
        }
        .footer {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e1e5e9;
        }
        .security-note {
            background: #f8f9fa;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .expiry-warning {
            color: #dc3545;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Password Reset</h1>
    </div>

    <div class="content">
        <p>Hi ${userName},</p>

        <p>We received a request to reset your password for your EPOP Platform account. Click the button below to reset your password:</p>

        <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
        </div>

        <div class="security-note">
            <strong>Security Notice:</strong>
            <ul>
                <li>This link will expire in <span class="expiry-warning">${expiryHours} hours</span></li>
                <li>If you didn't request this password reset, please ignore this email</li>
                <li>Never share this link with anyone</li>
                <li>EPOP support will never ask for your password</li>
            </ul>
        </div>

        <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px;">${resetUrl}</p>

        <p>If you continue to have problems, please contact our support team.</p>

        <p>Best regards,<br>The EPOP Platform Team</p>
    </div>

    <div class="footer">
        <p>This is an automated message from EPOP Platform. Please do not reply to this email.</p>
        <p>© 2024 EPOP Platform. All rights reserved.</p>
    </div>
</body>
</html>
            `,
            text: `
Hi ${userName},

We received a request to reset your password for your EPOP Platform account.

Click here to reset your password: ${resetUrl}

This link will expire in ${expiryHours} hours.

Security Notice:
- If you didn't request this password reset, please ignore this email
- Never share this link with anyone
- EPOP support will never ask for your password

If you continue to have problems, please contact our support team.

Best regards,
The EPOP Platform Team
            `,
        };
    }

    /**
     * Generate email verification email template
     */
    protected getEmailVerificationTemplate(to: string, data: EmailVerificationEmailData): EmailTemplate {
        const { userName, verificationUrl, expiryHours } = data;

        return {
            to,
            subject: 'Verify Your EPOP Platform Email',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .header h1 {
            color: white;
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            background: #fff;
            padding: 40px;
            border: 1px solid #e1e5e9;
            border-radius: 0 0 10px 10px;
        }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            transition: background-color 0.2s;
        }
        .button:hover {
            background: #5a6fd8;
        }
        .footer {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e1e5e9;
        }
        .security-note {
            background: #f8f9fa;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>✉️ Email Verification</h1>
    </div>

    <div class="content">
        <p>Hi ${userName},</p>

        <p>Welcome to EPOP Platform! Please verify your email address to complete your registration.</p>

        <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email</a>
        </div>

        <div class="security-note">
            <strong>Important:</strong>
            <ul>
                <li>This verification link will expire in ${expiryHours} hours</li>
                <li>If you didn't create an account, please ignore this email</li>
            </ul>
        </div>

        <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px;">${verificationUrl}</p>

        <p>Best regards,<br>The EPOP Platform Team</p>
    </div>

    <div class="footer">
        <p>This is an automated message from EPOP Platform. Please do not reply to this email.</p>
        <p>© 2024 EPOP Platform. All rights reserved.</p>
    </div>
</body>
</html>
            `,
            text: `
Hi ${userName},

Welcome to EPOP Platform! Please verify your email address to complete your registration.

Click here to verify your email: ${verificationUrl}

This verification link will expire in ${expiryHours} hours.

If you didn't create an account, please ignore this email.

Best regards,
The EPOP Platform Team
            `,
        };
    }
}