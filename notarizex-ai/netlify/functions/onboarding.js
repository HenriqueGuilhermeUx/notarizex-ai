const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, RESEND_API_KEY } = process.env;
    const RECIPIENT_EMAIL = 'henriquecampos66@gmail.com';

    try {
        const fields = JSON.parse(event.body);
        const { name, whatsapp, email, plan, fileData, fileName } = fields;

        if (!name || !whatsapp || !email || !fileData || !fileName) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Todos os campos são obrigatórios.' }) };
        }

        // ETAPA 1: Upload do arquivo para a OpenAI
        console.log('Iniciando upload do arquivo para OpenAI...');
        const fileBuffer = Buffer.from(fileData, 'base64');
        const form = new FormData();
        form.append('purpose', 'assistants');
        form.append('file', fileBuffer, { filename: fileName });

        const fileUploadResponse = await fetch('https://api.openai.com/v1/files', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
            body: form
        });

        if (!fileUploadResponse.ok) {
            const errorText = await fileUploadResponse.text();
            console.error('Erro no upload para OpenAI:', errorText);
            throw new Error(`Erro no upload para OpenAI: ${errorText}`);
        }
        const fileObject = await fileUploadResponse.json();
        console.log('Arquivo enviado com sucesso. File ID:', fileObject.id);
        
        // ETAPA 2: Criar o Assistente de IA
        console.log('Criando assistente na OpenAI...');
        const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                name: `Assistente para ${name}`,
                instructions: "Você é um atendente de WhatsApp especialista. Use o conhecimento do arquivo fornecido para responder às perguntas dos clientes de forma precisa e amigável.",
                model: "gpt-4o-mini",
                tools: [{ type: "file_search" }],
                tool_resources: { file_search: { vector_store_ids: [fileObject.id] } }
            })
        });

        if (!assistantResponse.ok) {
            const errorText = await assistantResponse.text();
            console.error('Erro ao criar assistente:', errorText);
            throw new Error(`Erro ao criar assistente: ${errorText}`);
        }
        const assistantObject = await assistantResponse.json();
        console.log('Assistente criado com sucesso. Assistant ID:', assistantObject.id);

        // ETAPA 3: Salvar os dados no Supabase
        console.log('Salvando dados no Supabase...');
        const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                nome: name,
                whatsapp: whatsapp,
                email: email,
                assistant_id: assistantObject.id,
                status: '1. Aguardando Pagamento',
                plano: plan || 'Não especificado'
            })
        });

        if (!supabaseResponse.ok) {
            const errorText = await supabaseResponse.text();
            console.error('Erro ao salvar no Supabase:', errorText);
            throw new Error(`Erro ao salvar no Supabase: ${errorText}`);
        }
        
        const savedData = await supabaseResponse.json();
        console.log('Dados salvos com sucesso no Supabase:', savedData);

        // ETAPA 4: Criar link de pagamento no Mercado Pago
        console.log('Criando link de pagamento...');
        const paymentResponse = await fetch(`${event.headers.origin || 'https://smartbots.club'}/.netlify/functions/create-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plan: plan,
                customerName: name,
                customerEmail: email
            })
        });

        let paymentUrl = null;
        if (paymentResponse.ok) {
            const paymentData = await paymentResponse.json();
            paymentUrl = paymentData.paymentUrl;
            console.log('Link de pagamento criado:', paymentUrl);
        } else {
            console.warn('Falha ao criar link de pagamento, continuando sem ele...');
        }

        // ETAPA 5: Enviar notificação por e-mail via Resend
        console.log('Enviando notificação por e-mail...');
        const emailHtml = `
<h2>Novo cadastro no SmartBots!</h2>
<p><strong>Nome:</strong> ${name}</p>
<p><strong>WhatsApp:</strong> ${whatsapp}</p>
<p><strong>E-mail:</strong> ${email}</p>
<p><strong>Plano:</strong> ${plan || 'Não especificado'}</p>
<p><strong>Assistant ID:</strong> ${assistantObject.id}</p>
<p><strong>Arquivo:</strong> ${fileName}</p>
${paymentUrl ? `<p><strong>Link de Pagamento:</strong> <a href="${paymentUrl}">${paymentUrl}</a></p>` : ''}
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
                from: 'SmartBots <onboarding@smartbots.club>',
                to: [RECIPIENT_EMAIL],
                subject: `SmartBots - Novo Cadastro: ${name} (${plan || 'Plano não especificado'})`,
                html: emailHtml
            })
        });

        if (!resendResponse.ok) {
            const errorText = await resendResponse.text();
            console.error('Erro ao enviar e-mail via Resend:', errorText);
            console.warn('Continuando sem notificação por e-mail...');
        } else {
            console.log('E-mail de notificação enviado com sucesso!');
        }

        // ETAPA 6: Retornar sucesso com link de pagamento
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: "Processo concluído com sucesso!", 
                assistantId: assistantObject.id,
                paymentUrl: paymentUrl
            })
        };

    } catch (error) {
        console.error('Erro na função onboarding:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
