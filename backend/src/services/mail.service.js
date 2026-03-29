export const sendEmail = async (to, subject, html, text) => {
    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
            },
            body: JSON.stringify({
                sender: {
                    email: process.env.BREVO_SENDER_EMAIL,
                    name: 'Veltrix',
                },
                to: [{ email: to }],
                subject: subject,
                htmlContent: html,
                textContent: text || '',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Brevo API error:', data);
            throw new Error('Failed to send email via Brevo API');
        }

        console.log('Email sent:', data.messageId);
        return data;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};