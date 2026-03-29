import nodemailer from 'nodemailer';

export const sendEmail = async (to, subject, html, text) => {
    const mailUser = process.env.GOOGLE_USER_EMAIL?.trim();

    const mailPass = process.env.GOOGLE_APP_PASSWORD?.replace(/\s+/g, '');

    if (!mailUser || !mailPass) {
        throw new Error('Email configuration missing. Set GOOGLE_USER_EMAIL and GOOGLE_APP_PASSWORD in backend environment variables.');
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        family: 4,
        auth: {
            user: process.env.GOOGLE_USER_EMAIL,
            pass: process.env.GOOGLE_APP_PASSWORD,
        },
    });

    try {
        await transporter.verify();

        const mailOptions = {
            from: mailUser,
            to,
            subject,
            html,
            text: text || 'Please use an HTML-supported email client to view this message.',

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