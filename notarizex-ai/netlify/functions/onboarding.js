const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

    try {
        const fields = JSON.parse(event.body);
        const { name, whatsapp, email, fileData, fileName } = fields;

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
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders( ) },
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
            } )
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
                status: "1. Aguardando Pagamento"
            })
        });

        if (!supabaseResponse.ok) {
            const errorText = await supabaseResponse.text();
            console.error('Erro ao salvar no Supabase:', errorText);
            throw new Error(`Erro ao salvar no Supabase: ${errorText}`);
        }
        
        const savedData = await supabaseResponse.json();
        console.log('Dados salvos com sucesso no Supabase:', savedData);

        // ETAPA 4: Retornar sucesso
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: "Processo concluído com sucesso!", 
                assistantId: assistantObject.id 
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
