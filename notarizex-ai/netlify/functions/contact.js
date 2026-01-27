const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { RESEND_API_KEY } = process.env;

    try {
        const { name, company, whatsapp, email, message } = JSON.parse(event.body);

        console.log('[Contact] Nova solicitação empresarial de:', email);

        const emailContent = `
Nova Solicitação de Orçamento Empresarial!

Nome: ${name}
Empresa: ${company || 'Não informado'}
WhatsApp: ${whatsapp}
E-mail: ${email}
Mensagem: ${message}

---
Responda o mais rápido possível!
        `;

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'SmartBots <noreply@smartbots.club>',
                to: 'henriquecampos66@gmail.com',
                subject: `Solicitação Empresarial: ${name}`,
                text: emailContent
            })
        });

        if (!response.ok) {
            throw new Error('Falha ao enviar e-mail');
        }

        console.log('[Contact] E-mail enviado com sucesso');

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Solicitação enviada com sucesso!' })
        };

    } catch (error) {
        console.error('[Contact] Erro:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
