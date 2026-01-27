const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { MERCADOPAGO_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

    try {
        const notification = JSON.parse(event.body);
        console.log('[Payment Webhook] Notificação recebida:', notification);

        // Mercado Pago envia notificações de diferentes tipos
        if (notification.type === 'payment') {
            const paymentId = notification.data.id;

            // Buscar detalhes do pagamento
            const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: {
                    'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
                }
            });

            if (!paymentResponse.ok) {
                throw new Error('Falha ao buscar detalhes do pagamento');
            }

            const paymentData = await paymentResponse.json();
            const { status, external_reference: customerEmail } = paymentData;

            console.log('[Payment Webhook] Status do pagamento:', status, 'Cliente:', customerEmail);

            // Se o pagamento foi aprovado, atualizar status no Supabase
            if (status === 'approved') {
                const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/clients?email=eq.${customerEmail}`, {
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
                        payment_status: 'approved',
                        updated_at: new Date().toISOString()
                    })
                });

                if (!updateResponse.ok) {
                    console.error('[Payment Webhook] Erro ao atualizar status no Supabase');
                } else {
                    console.log('[Payment Webhook] Status atualizado no Supabase para:', customerEmail);
                }

                // Aqui você pode adicionar lógica para enviar o QR Code por WhatsApp
                // usando a Evolution API ou Meta API
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Webhook processado com sucesso' })
        };

    } catch (error) {
        console.error('[Payment Webhook] Erro:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
