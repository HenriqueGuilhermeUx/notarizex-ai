const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { OPENAI_API_KEY, AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME } = process.env;

    try {
        const fields = JSON.parse(event.body);
        const { name, whatsapp, email, fileData, fileName } = fields;

        if (!name || !whatsapp || !email || !fileData || !fileName) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Todos os campos são obrigatórios.' }) };
        }

        // ETAPA 1: Upload do arquivo para a OpenAI
        const fileBuffer = Buffer.from(fileData, 'base64');
        const form = new FormData();
        form.append('purpose', 'assistants');
        form.append('file', fileBuffer, { filename: fileName });

        const fileUploadResponse = await fetch('https://api.openai.com/v1/files', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders( ) },
            body: form
        });

        if (!fileUploadResponse.ok) throw new Error(`Erro no upload para OpenAI: ${await fileUploadResponse.text()}`);
        const fileObject = await fileUploadResponse.json();
        
        // ETAPA 2: Criar o Assistente de IA
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

        if (!assistantResponse.ok) throw new Error(`Erro ao criar assistente: ${await assistantResponse.text()}`);
        const assistantObject = await assistantResponse.json();

        // ETAPA 3: Salvar os dados no Airtable
        const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME )}`;
        const airtableResponse = await fetch(airtableUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`
            },
            body: JSON.stringify({
                records: [{
                    fields: {
                        "Nome": name,
                        "WhatsApp": whatsapp,
                        "Email": email,
                        "Assistant ID": assistantObject.id,
                        "Status": "1. Aguardando Pagamento"
                    }
                }]
            })
        });

        if (!airtableResponse.ok) throw new Error(`Erro ao salvar no Airtable: ${await airtableResponse.text()}`);

        // ETAPA 4: Retornar sucesso
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Processo concluído com sucesso!", assistantId: assistantObject.id })
        };

    } catch (error) {
        console.error('Erro na função onboarding:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
