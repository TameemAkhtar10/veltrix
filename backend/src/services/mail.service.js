import nodemailer from 'nodemailer';

export const sendEmail = async (to, subject, html, text) => {
    const mailUser = process.env.GOOGLE_USER_EMAIL?.trim();
    const mailPass = process.env.GOOGLE_APP_PASSWORD?.replace(/\s+/g, '');

    if (!mailUser || !mailPass) {
        throw new Error('Email configuration missing.');
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        family: 4,
        auth: {
            user: mailUser,
            pass: mailPass,
        },
    });

    try {
        const details = await transporter.sendMail({
            from: mailUser,
            to,
            subject,
            html,
            text: text || '',
        });
        console.log('Email sent:', details.messageId);
        return details;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};