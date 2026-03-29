import nodemailer from 'nodemailer';

export const sendEmail = async (to, subject, html, text) => {
    const transporter = nodemailer.createTransport({
        host: process.env.BREVO_SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
            user: process.env.BREVO_SMTP_USER,
            pass: process.env.BREVO_SMTP_PASS,
        },
    });

    try {
        const result = await transporter.sendMail({
            from: process.env.BREVO_SENDER_EMAIL,
            to: to,
            subject: subject,
            html: html,
            text: text || '',
        });

        console.log('Email sent:', result.messageId);
        return result;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};