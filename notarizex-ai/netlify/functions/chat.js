const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

    try {
        const { botId, message, threadId } = JSON.parse(event.body);

        if (!botId || !message) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'botId e message são obrigatórios' })
            };
        }

        console.log('[Chat] Mensagem recebida para bot:', botId);

        // 1. BUSCAR ASSISTENTE ID DO BOT NO SUPABASE
        const botResponse = await fetch(`${SUPABASE_URL}/rest/v1/website_bots?bot_id=eq.${botId}&select=assistant_id,status`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!botResponse.ok) {
            throw new Error('Falha ao buscar bot no banco de dados');
        }

        const bots = await botResponse.json();
        if (bots.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Bot não encontrado' })
            };
        }

        const bot = bots[0];
        if (bot.status !== 'active') {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: 'Bot não está ativo. Verifique o status do pagamento.' })
            };
        }

        const assistantId = bot.assistant_id;

        // 2. CRIAR OU USAR THREAD EXISTENTE
        let currentThreadId = threadId;
        
        if (!currentThreadId) {
            const threadResponse = await fetch('https://api.openai.com/v1/threads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'assistants=v2'
                }
            });

            if (!threadResponse.ok) {
                throw new Error('Falha ao criar thread');
            }

            const threadData = await threadResponse.json();
            currentThreadId = threadData.id;
            console.log('[Chat] Thread criada:', currentThreadId);
        }

        // 3. ADICIONAR MENSAGEM DO USUÁRIO
        await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                role: 'user',
                content: message
            })
        });

        // 4. EXECUTAR ASSISTENTE
        const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                assistant_id: assistantId
            })
        });

        if (!runResponse.ok) {
            throw new Error('Falha ao executar assistente');
        }

        const runData = await runResponse.json();
        const runId = runData.id;

        // 5. AGUARDAR CONCLUSÃO (polling)
        let runStatus = 'in_progress';
        let attempts = 0;
        const maxAttempts = 30; // 30 segundos máximo

        while (runStatus === 'in_progress' || runStatus === 'queued') {
            if (attempts >= maxAttempts) {
                throw new Error('Timeout ao aguardar resposta do assistente');
            }

            await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo

            const statusResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'assistants=v2'
                }
            });

            const statusData = await statusResponse.json();
            runStatus = statusData.status;
            attempts++;

            console.log('[Chat] Status da execução:', runStatus, '- Tentativa:', attempts);
        }

        if (runStatus !== 'completed') {
            throw new Error(`Assistente retornou status: ${runStatus}`);
        }

        // 6. BUSCAR RESPOSTA DO ASSISTENTE
        const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages?limit=1`, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            }
        });

        if (!messagesResponse.ok) {
            throw new Error('Falha ao buscar mensagens');
        }

        const messagesData = await messagesResponse.json();
        const assistantMessage = messagesData.data[0];
        const reply = assistantMessage.content[0].text.value;

        console.log('[Chat] Resposta gerada com sucesso');

        // 7. SALVAR HISTÓRICO NO SUPABASE
        await fetch(`${SUPABASE_URL}/rest/v1/chat_history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                bot_id: botId,
                thread_id: currentThreadId,
                user_message: message,
                bot_reply: reply,
                created_at: new Date().toISOString()
            })
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                reply,
                threadId: currentThreadId
            })
        };

    } catch (error) {
        console.error('[Chat] Erro:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
