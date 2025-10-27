import { EmailService, EmailConfig, EmailTemplate } from './service';

export class DevEmailService extends EmailService {
    async sendEmail(template: EmailTemplate): Promise<{ success: boolean; messageId?: string; error?: string }> {
        // In development, we just log the email and pretend it was sent successfully
        console.log('\n📧 === EMAIL SENT (Development Mode) ===');
        console.log(`To: ${Array.isArray(template.to) ? template.to.join(', ') : template.to}`);
        console.log(`From: ${template.from || this.config.fromEmail}`);
        console.log(`Subject: ${template.subject}`);
        console.log(`Reply-To: ${template.replyTo || this.config.replyTo || 'N/A'}`);
        console.log(`Attachments: ${template.attachments?.length || 0}`);

        if (template.text) {
            console.log('\n--- Text Version ---');
            console.log(template.text);
        }

        console.log('\n--- HTML Version ---');
        console.log(template.html);
        console.log('=== END EMAIL ===\n');

        return {
            success: true,
            messageId: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
    }
}