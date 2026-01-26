const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

    try {
        const { plan, customerName, customerEmail } = JSON.parse(event.body);

        if (!plan || !customerName || !customerEmail) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Plano, nome e e-mail são obrigatórios.' }) 
            };
        }

        // Definir preços dos planos
        const planPrices = {
            'Básico': 99.00,
            'Pro': 249.00
        };

        const price = planPrices[plan];
        if (!price) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Plano inválido.' }) 
            };
        }

        // Criar preferência de pagamento no Mercado Pago
        const preferenceData = {
            items: [{
                title: `SmartBots - Plano ${plan}`,
                description: `Assinatura mensal do plano ${plan} do SmartBots`,
                quantity: 1,
                currency_id: 'BRL',
                unit_price: price
            }],
            payer: {
                name: customerName,
                email: customerEmail
            },
            back_urls: {
                success: 'https://smartbots.club/sucesso',
                failure: 'https://smartbots.club/falha',
                pending: 'https://smartbots.club/pendente'
            },
            auto_return: 'approved',
            statement_descriptor: 'SMARTBOTS',
            external_reference: `${plan}-${Date.now( )}`,
            notification_url: 'https://smartbots.club/.netlify/functions/payment-webhook'
        };

        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
            },
            body: JSON.stringify(preferenceData )
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro ao criar preferência no Mercado Pago:', errorText);
            throw new Error('Falha ao criar link de pagamento.');
        }

        const preference = await response.json();
        console.log('Link de pagamento criado:', preference.init_point);

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                paymentUrl: preference.init_point,
                preferenceId: preference.id
            })
        };

    } catch (error) {
        console.error('Erro na função create-payment:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
