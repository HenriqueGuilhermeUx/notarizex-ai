const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RECIPIENT_EMAIL = 'henriquecampos66@gmail.com';

    try {
        const fields = JSON.parse(event.body);
        const { name, email, whatsapp, company, message } = fields;

        if (!name || !email || !whatsapp) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Nome, e-mail e WhatsApp são obrigatórios.' }) 
            };
        }

        // Enviar e-mail via Resend
        const emailHtml = `
<h2>Nova solicitação de Plano Empresarial - SmartBots</h2>
<p><strong>Nome:</strong> ${name}</p>
<p><strong>E-mail:</strong> ${email}</p>
<p><strong>WhatsApp:</strong> ${whatsapp}</p>
<p><strong>Empresa:</strong> ${company || 'Não informado'}</p>
<p><strong>Mensagem:</strong></p>
<p>${message || 'Não informada'}</p>
<hr>
<p><small>Este e-mail foi enviado automaticamente pelo sistema SmartBots.</small></p>
        `;

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'SmartBots <contato@smartbots.club>',
                to: [RECIPIENT_EMAIL],
                subject: `SmartBots - Nova Solicitação Empresarial de ${name}`,
                html: emailHtml
            } )
        });

        if (!resendResponse.ok) {
            const errorText = await resendResponse.text();
            console.error('Erro ao enviar e-mail via Resend:', errorText);
            throw new Error('Falha ao enviar notificação por e-mail.');
        }

        console.log('E-mail de contato enviado com sucesso para:', RECIPIENT_EMAIL);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Solicitação enviada com sucesso!' })
        };

    } catch (error) {
        console.error('Erro na função contact:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

