const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, RESEND_API_KEY, MERCADOPAGO_ACCESS_TOKEN } = process.env;

    try {
        const data = JSON.parse(event.body);
        const { ownerName, ownerEmail, ownerWhatsApp, companyName, website, businessDescription, pdfFile } = data;

        console.log('[WhatsApp Onboarding] Iniciando criação de bot para:', companyName);

        // 1. GERAR BOT ID ÚNICO
        const botId = `whatsapp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 2. CRIAR ASSISTENTE NA OPENAI
        const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                name: `Bot WhatsApp - ${companyName}`,
                instructions: `Você é um assistente virtual inteligente da empresa ${companyName}.

Seu papel é atender clientes via WhatsApp de forma profissional, amigável e eficiente.

INFORMAÇÕES DA EMPRESA:
${businessDescription}

Website: ${website}

INSTRUÇÕES:
- Seja sempre cordial e use emojis quando apropriado
- Responda de forma clara e objetiva
- Se não souber algo, seja honesto e ofereça alternativas
- Sempre termine oferecendo ajuda adicional
- Use as informações dos arquivos anexados para responder sobre produtos/serviços
- Mantenha as respostas concisas (máximo 3-4 linhas no WhatsApp)

FORMATO DAS RESPOSTAS:
- Use quebras de linha para facilitar leitura
- Emojis são bem-vindos mas não exagere
- Seja direto e objetivo`,
                model: 'gpt-4o-mini',
                tools: [{ type: 'file_search' }]
            })
        });

        if (!assistantResponse.ok) {
            const error = await assistantResponse.json();
            throw new Error(`Falha ao criar assistente: ${JSON.stringify(error)}`);
        }

        const assistant = await assistantResponse.json();
        const assistantId = assistant.id;

        console.log('[WhatsApp Onboarding] Assistente criado:', assistantId);

        // 3. PROCESSAR PDF (se fornecido)
        let fileIds = [];

        if (pdfFile) {
            // PDF vem como base64
            const pdfBuffer = Buffer.from(pdfFile.split(',')[1], 'base64');
            
            const formData = new FormData();
            formData.append('file', pdfBuffer, {
                filename: 'catalogo.pdf',
                contentType: 'application/pdf'
            });
            formData.append('purpose', 'assistants');

            const fileResponse = await fetch('https://api.openai.com/v1/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    ...formData.getHeaders()
                },
                body: formData
            });

            if (!fileResponse.ok) {
                const error = await fileResponse.json();
                throw new Error(`Falha ao fazer upload do PDF: ${JSON.stringify(error)}`);
            }

            const fileData = await fileResponse.json();
            fileIds.push(fileData.id);

            console.log('[WhatsApp Onboarding] PDF enviado:', fileData.id);

            // Anexar arquivo ao assistente
            await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'assistants=v2'
                },
                body: JSON.stringify({
                    tool_resources: {
                        file_search: {
                            vector_store_ids: [],
                            vector_stores: [{
                                file_ids: fileIds
                            }]
                        }
                    }
                })
            });
        }

        // 4. GERAR LINK DE PAGAMENTO (MERCADO PAGO)
        const preferenceResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                items: [{
                    title: `SmartBots - Bot para WhatsApp - ${companyName}`,
                    description: 'Atendimento inteligente 24/7 via WhatsApp',
                    quantity: 1,
                    currency_id: 'BRL',
                    unit_price: 129.00
                }],
                payer: {
                    name: ownerName,
                    email: ownerEmail,
                    phone: {
                        number: ownerWhatsApp
                    }
                },
                back_urls: {
                    success: `https://smartbots.club?payment=success&bot_id=${botId}`,
                    failure: `https://smartbots.club?payment=failure`,
                    pending: `https://smartbots.club?payment=pending`
                },
                auto_return: 'approved',
                external_reference: botId,
                notification_url: `https://smartbots.club/.netlify/functions/payment-webhook`
            })
        });

        if (!preferenceResponse.ok) {
            const error = await preferenceResponse.json();
            throw new Error(`Falha ao criar preferência de pagamento: ${JSON.stringify(error)}`);
        }

        const preference = await preferenceResponse.json();
        const paymentLink = preference.init_point;

        console.log('[WhatsApp Onboarding] Link de pagamento gerado');

        // 5. SALVAR NO SUPABASE
        const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_bots`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                bot_id: botId,
                owner_name: ownerName,
                owner_email: ownerEmail,
                owner_whatsapp: ownerWhatsApp,
                company_name: companyName,
                website: website,
                business_description: businessDescription,
                assistant_id: assistantId,
                file_ids: fileIds.join(','),
                phone_number: '', // Será preenchido após pagamento
                payment_link: paymentLink,
                status: 'pending_payment',
                created_at: new Date().toISOString()
            })
        });

        if (!insertResponse.ok) {
            const error = await insertResponse.json();
            throw new Error(`Falha ao salvar no banco: ${JSON.stringify(error)}`);
        }

        console.log('[WhatsApp Onboarding] Bot salvo no banco de dados');

        // 6. ENVIAR EMAIL DE CONFIRMAÇÃO
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'SmartBots <noreply@smartbots.club>',
                to: ownerEmail,
                subject: '🤖 Seu Bot para WhatsApp está quase pronto!',
                html: `
                    <h2>Olá, ${ownerName}!</h2>
                    <p>Seu bot para WhatsApp da empresa <strong>${companyName}</strong> foi criado com sucesso! 🎉</p>
                    
                    <h3>Próximos Passos:</h3>
                    <ol>
                        <li><strong>Efetue o pagamento</strong> de R$ 129,00/mês</li>
                        <li><strong>Configure seu número</strong> do WhatsApp Business</li>
                        <li><strong>Comece a atender</strong> seus clientes 24/7!</li>
                    </ol>
                    
                    <p>
                        <a href="${paymentLink}" style="background: #00FF88; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                            Pagar Agora (R$ 129,00/mês)
                        </a>
                    </p>
                    
                    <p><strong>ID do Bot:</strong> ${botId}</p>
                    
                    <p>Após o pagamento, você receberá instruções de como conectar seu WhatsApp Business.</p>
                    
                    <p>Dúvidas? Responda este email!</p>
                    
                    <p>Atenciosamente,<br><strong>Equipe SmartBots</strong></p>
                `
            })
        });

        console.log('[WhatsApp Onboarding] Email enviado');

        // 7. RETORNAR SUCESSO
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                botId,
                paymentLink,
                message: 'Bot criado com sucesso! Efetue o pagamento para ativar.'
            })
        };

    } catch (error) {
        console.error('[WhatsApp Onboarding] Erro:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
