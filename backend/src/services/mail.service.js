import {Resend} from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to, subject, html, text) => {
    try {
        const response = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: to,
            subject: subject,
            html: html,
            text: text || '',
        });

        console.log('Email sent:', response?.id || response?.data?.id);
        return response;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};