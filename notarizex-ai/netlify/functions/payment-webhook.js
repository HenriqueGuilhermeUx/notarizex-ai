const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

    try {
        const notification = JSON.parse(event.body);
        console.log('Notificação recebida do Mercado Pago:', notification);

        // Verificar se é uma notificação de pagamento
        if (notification.type === 'payment') {
            const paymentId = notification.data.id;

            // Buscar detalhes do pagamento
            const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
                }
            } );

            if (!paymentResponse.ok) {
                throw new Error('Falha ao buscar detalhes do pagamento.');
            }

            const payment = await paymentResponse.json();
            console.log('Detalhes do pagamento:', payment);

            // Verificar se o pagamento foi aprovado
            if (payment.status === 'approved') {
                const customerEmail = payment.payer.email;
                const externalReference = payment.external_reference;

                // Atualizar status no Supabase
                const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/clientes?email=eq.${customerEmail}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        status: '2. Pago - Aguardando QR Code',
                        payment_id: paymentId,
                        payment_status: 'approved'
                    })
                });

                if (!updateResponse.ok) {
                    console.error('Erro ao atualizar status no Supabase');
                } else {
                    console.log('Status atualizado no Supabase para:', customerEmail);
                }

                // Aqui você pode adicionar lógica para enviar o QR Code por WhatsApp
                // usando a Evolution API
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Webhook processado com sucesso' })
        };

    } catch (error) {
        console.error('Erro no webhook de pagamento:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
