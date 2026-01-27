const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, RESEND_API_KEY, MERCADOPAGO_ACCESS_TOKEN } = process.env;

    try {
        const { name, whatsapp, email } = JSON.parse(event.body);

        console.log('[Staff Onboarding] Iniciando processo para:', email);

        // 1. Criar Assistente Staff na OpenAI
        const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                name: `Staff de ${name}`,
                instructions: `Você é o Staff, um assistente pessoal brasileiro que ajuda a gerenciar a vida do usuário. Você é proativo, organizado e sempre lembra o usuário de compromissos importantes. Suas áreas de atuação incluem: finanças, veículos, casa, família, profissional, saúde, eventos e investimentos. Seja informal, amigável e use expressões brasileiras.`,
                model: 'gpt-4o-mini',
                tools: [{ type: 'code_interpreter' }]
            })
        });

        if (!assistantResponse.ok) {
            throw new Error('Falha ao criar assistente Staff');
        }

        const assistantData = await assistantResponse.json();
        const assistantId = assistantData.id;
        console.log('[Staff Onboarding] Assistente criado:', assistantId);

        // 2. Criar link de pagamento no Mercado Pago (R$ 19,90)
        const paymentResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                items: [{
                    title: 'Staff - Assistente Pessoal de IA',
                    quantity: 1,
                    unit_price: 19.90,
                    currency_id: 'BRL'
                }],
                payer: { email, name },
                back_urls: {
                    success: 'https://smartbots.club/staff.html?status=success',
                    failure: 'https://smartbots.club/staff.html?status=failure',
                    pending: 'https://smartbots.club/staff.html?status=pending'
                },
                auto_return: 'approved',
                notification_url: 'https://smartbots.club/.netlify/functions/payment-webhook',
                external_reference: email
            })
        });

        if (!paymentResponse.ok) {
            throw new Error('Falha ao criar link de pagamento');
        }

        const paymentData = await paymentResponse.json();
        const paymentLink = paymentData.init_point;
        console.log('[Staff Onboarding] Link de pagamento criado:', paymentLink);

        // 3. Salvar no Supabase
        const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                name,
                whatsapp,
                email,
                plan: 'staff',
                assistant_id: assistantId,
                payment_link: paymentLink,
                status: '1. Aguardando Pagamento',
                created_at: new Date().toISOString()
            })
        });

        if (!supabaseResponse.ok) {
            console.error('[Staff Onboarding] Erro ao salvar no Supabase');
        } else {
            console.log('[Staff Onboarding] Cliente salvo no Supabase');
        }

        // 4. Enviar notificação por e-mail via Resend
        const emailContent = `
Novo cliente Staff cadastrado!

Nome: ${name}
WhatsApp: ${whatsapp}
E-mail: ${email}
Plano: Staff (R$ 19,90/mês)
Assistente ID: ${assistantId}
Link de Pagamento: ${paymentLink}

Status: Aguardando pagamento
        `;

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'SmartBots <noreply@smartbots.club>',
                to: 'henriquecampos66@gmail.com',
                subject: `Novo Cliente Staff: ${name}`,
                text: emailContent
            })
        });

        console.log('[Staff Onboarding] E-mail enviado');

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Staff ativado com sucesso!',
                assistantId,
                paymentLink
            })
        };

    } catch (error) {
        console.error('[Staff Onboarding] Erro:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
