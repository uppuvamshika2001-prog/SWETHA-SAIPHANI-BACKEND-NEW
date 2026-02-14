
import { config } from '../config/index.js';

export interface EmailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export class EmailService {
    async sendEmail(options: EmailOptions): Promise<void> {
        // In a real application, you would use nodemailer or a transactional email service (SendGrid, AWS SES, etc.)
        // For development, we'll log the email to the console.

        console.log('================================================================');
        console.log(`[Email Service] Sending email to: ${options.to}`);
        console.log(`[Subject]: ${options.subject}`);
        console.log('----------------------------------------------------------------');
        console.log(options.text);
        if (options.html) {
            console.log('[HTML Content provided but hidden in logs]');
        }
        console.log('================================================================');

        return Promise.resolve();
    }

    async sendWelcomeEmail(to: string, patientName: string, uhid: string, token: string): Promise<void> {
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${token}`;

        const subject = 'Welcome to Swetha Saiphani Clinics';
        const text = `
Hello ${patientName},

You have been successfully registered with Swetha Saiphani Clinics.
Client ID (UHID): ${uhid}

Your Patient Portal Account has been created.
To access your dashboard, view prescriptions, and medical records, please set your password by clicking the link below:

${resetLink}

If you did not request this, please ignore this email.

Best regards,
Swetha Saiphani Clinics Team
`;

        await this.sendEmail({ to, subject, text });
    }

    async sendStaffWelcomeEmail(to: string, staffName: string, role: string, token: string): Promise<void> {
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${token}`;

        // Format role for display (e.g., LAB_TECHNICIAN -> Lab Technician)
        const formattedRole = role.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        // Determine the login panel based on role
        const panelMap: { [key: string]: string } = {
            'ADMIN': 'Admin Portal',
            'DOCTOR': 'Doctor Portal',
            'RECEPTIONIST': 'Reception Portal',
            'PHARMACIST': 'Pharmacy Portal',
            'LAB_TECHNICIAN': 'Lab Portal'
        };
        const portalName = panelMap[role] || 'Staff Portal';

        const subject = `Welcome to Swetha Saiphani Clinics - ${formattedRole} Account`;
        const text = `
Hello ${staffName},

Welcome to Swetha Saiphani Clinics!

You have been registered as a ${formattedRole} in our system.

Your Staff Portal Account has been created.
You can access the ${portalName} using your email address as the username.

To set your password and activate your account, please click the link below:

${resetLink}

Once you set your password, you can log in to the ${portalName} at:
${process.env.FRONTEND_URL || 'http://localhost:8080'}/login

If you have any questions, please contact the hospital administration.

Best regards,
Swetha Saiphani Clinics Administration
`;

        await this.sendEmail({ to, subject, text });
    }
}

export const emailService = new EmailService();

