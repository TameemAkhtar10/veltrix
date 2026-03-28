import nodemailer from 'nodemailer';

export const sendEmail = async (to, subject, html, text) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GOOGLE_USER_EMAIL,
            pass: process.env.GOOGLE_APP_PASSWORD,
        },
    });
    try {
        const mailOptions = {
            from: process.env.GOOGLE_USER_EMAIL,
            to,
            subject,
            html,
            text,

        };
        let details = await transporter.sendMail(mailOptions);
        console.log('Email sent:', details);
        
        return details;
    }
    catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};