import { Resend } from 'resend';
import { EmailService, EmailConfig, EmailTemplate } from './service';
import { DevEmailService } from './dev-provider';

export class ResendEmailService extends EmailService {
    private client: Resend;

    constructor(config: EmailConfig & { apiKey: string }) {
        super(config);
        this.client = new Resend(config.apiKey);
    }

    async sendEmail(template: EmailTemplate): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            const result = await this.client.emails.send({
                from: template.from || `${this.config.fromName || 'EPOP Platform'} <${this.config.fromEmail}>`,
                to: Array.isArray(template.to) ? template.to : [template.to],
                subject: template.subject,
                html: template.html,
                text: template.text,
                replyTo: template.replyTo || this.config.replyTo,
                attachments: template.attachments?.map(att => ({
                    filename: att.filename,
                    content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
                    type: att.contentType,
                })),
            });

            if (result.error) {
                console.error('Resend API error:', result.error);
                return {
                    success: false,
                    error: result.error.message || 'Failed to send email via Resend',
                };
            }

            return {
                success: true,
                messageId: result.data?.id,
            };
        } catch (error) {
            console.error('Resend email error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }
}

/**
 * Create an email service instance based on configuration
 */
export function createEmailService(): EmailService {
    const provider = process.env.EMAIL_PROVIDER?.toLowerCase() || 'dev';
    const fromEmail = process.env.EMAIL_FROM_EMAIL || 'noreply@epop-platform.com';
    const fromName = process.env.EMAIL_FROM_NAME || 'EPOP Platform';

    // In development, use the dev provider
    if (process.env.NODE_ENV !== 'production') {
        return new DevEmailService({
            provider: 'smtp', // Dev service uses this as placeholder
            fromEmail,
            fromName,
        });
    }

    switch (provider) {
        case 'dev': {
            return new DevEmailService({
                provider: 'smtp', // Dev service uses this as placeholder
                fromEmail,
                fromName,
            });
        }
        case 'resend': {
            const apiKey = process.env.RESEND_API_KEY;
            if (!apiKey) {
                throw new Error('RESEND_API_KEY environment variable is required for Resend provider');
            }

            return new ResendEmailService({
                provider: 'resend',
                apiKey,
                fromEmail,
                fromName,
                replyTo: process.env.EMAIL_REPLY_TO,
            });
        }

        case 'sendgrid': {
            // TODO: Implement SendGrid provider
            throw new Error('SendGrid provider not yet implemented');
        }

        case 'ses': {
            // TODO: Implement AWS SES provider
            throw new Error('AWS SES provider not yet implemented');
        }

        case 'smtp': {
            // TODO: Implement SMTP provider
            throw new Error('SMTP provider not yet implemented');
        }

        default:
            throw new Error(`Unsupported email provider: ${provider}`);
    }
}