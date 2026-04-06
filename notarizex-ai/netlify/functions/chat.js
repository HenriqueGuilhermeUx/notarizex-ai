const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

    try {
        const { botId, message, threadId, userIdentifier } = JSON.parse(event.body);

        if (!botId || !message) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'botId e message são obrigatórios' })
            };
        }

        console.log('[Chat] Mensagem recebida para bot:', botId);

        // 1. BUSCAR ASSISTENTE ID DO BOT NO SUPABASE
        const botResponse = await fetch(`${SUPABASE_URL}/rest/v1/website_bots?bot_id=eq.${botId}&select=assistant_id,status,company_name`, {
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

        // 2. MEMÓRIA DE LONGO PRAZO — Buscar histórico anterior do usuário
        let memoryContext = '';
        if (userIdentifier) {
            try {
                console.log('[Chat] Buscando memória de longo prazo para:', userIdentifier);

                // Buscar últimas 10 conversas do usuário com este bot
                const historyResponse = await fetch(
                    `${SUPABASE_URL}/rest/v1/chat_history?bot_id=eq.${botId}&user_identifier=eq.${encodeURIComponent(userIdentifier)}&order=created_at.desc&limit=10`,
                    {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        }
                    }
                );

                if (historyResponse.ok) {
                    const history = await historyResponse.json();

                    if (history.length > 0) {
                        // Montar contexto de memória com conversas anteriores
                        const pastConversations = history
                            .reverse() // Ordenar do mais antigo para o mais recente
                            .map(h => `[${new Date(h.created_at).toLocaleDateString('pt-BR')}] Usuário: ${h.user_message}\nBot: ${h.bot_reply}`)
                            .join('\n\n');

                        memoryContext = `\n\n--- MEMÓRIA DE CONVERSAS ANTERIORES ---\nEste usuário já conversou com você antes. Use este histórico para personalizar a resposta:\n\n${pastConversations}\n--- FIM DA MEMÓRIA ---\n`;

                        console.log('[Chat] Memória carregada:', history.length, 'conversas anteriores');
                    }
                }
            } catch (memoryError) {
                // Não bloquear a conversa se a memória falhar
                console.warn('[Chat] Falha ao carregar memória:', memoryError.message);
            }
        }

        // 3. CRIAR OU USAR THREAD EXISTENTE
        // Se temos userIdentifier, tentar reutilizar thread existente para continuidade
        let currentThreadId = threadId;

        if (!currentThreadId && userIdentifier) {
            // Buscar thread existente ativa para este usuário
            try {
                const threadLookup = await fetch(
                    `${SUPABASE_URL}/rest/v1/chat_history?bot_id=eq.${botId}&user_identifier=eq.${encodeURIComponent(userIdentifier)}&order=created_at.desc&limit=1&select=thread_id`,
                    {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        }
                    }
                );

                if (threadLookup.ok) {
                    const threadData = await threadLookup.json();
                    if (threadData.length > 0 && threadData[0].thread_id) {
                        // Verificar se a thread ainda é recente (menos de 24h)
                        const lastConv = await fetch(
                            `${SUPABASE_URL}/rest/v1/chat_history?bot_id=eq.${botId}&user_identifier=eq.${encodeURIComponent(userIdentifier)}&order=created_at.desc&limit=1`,
                            {
                                headers: {
                                    'apikey': SUPABASE_ANON_KEY,
                                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                                }
                            }
                        );
                        const lastData = await lastConv.json();
                        if (lastData.length > 0) {
                            const lastTime = new Date(lastData[0].created_at);
                            const hoursSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);
                            if (hoursSince < 24) {
                                currentThreadId = threadData[0].thread_id;
                                console.log('[Chat] Thread reutilizada:', currentThreadId);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[Chat] Não foi possível reutilizar thread:', e.message);
            }
        }

        if (!currentThreadId) {
            // Criar nova thread com contexto de memória se disponível
            const threadBody = memoryContext
                ? {
                    messages: [{
                        role: 'user',
                        content: memoryContext + '\nAgora responda a nova mensagem do usuário.'
                    }]
                  }
                : {};

            const threadResponse = await fetch('https://api.openai.com/v1/threads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'assistants=v2'
                },
                body: JSON.stringify(threadBody)
            });

            if (!threadResponse.ok) {
                throw new Error('Falha ao criar thread');
            }

            const threadData = await threadResponse.json();
            currentThreadId = threadData.id;
            console.log('[Chat] Nova thread criada:', currentThreadId);
        }

        // 4. ADICIONAR MENSAGEM DO USUÁRIO
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

        // 5. EXECUTAR ASSISTENTE
        const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                assistant_id: assistantId,
                additional_instructions: memoryContext
                    ? `CONTEXTO DE MEMÓRIA DO USUÁRIO: ${userIdentifier} já conversou com você antes. Use o histórico para personalizar a resposta e criar continuidade.`
                    : undefined
            })
        });

        if (!runResponse.ok) {
            throw new Error('Falha ao executar assistente');
        }

        const runData = await runResponse.json();
        const runId = runData.id;

        // 6. AGUARDAR CONCLUSÃO (polling com backoff)
        let runStatus = 'in_progress';
        let attempts = 0;
        const maxAttempts = 30;

        while (runStatus === 'in_progress' || runStatus === 'queued') {
            if (attempts >= maxAttempts) {
                throw new Error('Timeout ao aguardar resposta do assistente');
            }

            // Backoff progressivo: 1s, 1s, 2s, 2s, 3s...
            const delay = attempts < 4 ? 1000 : Math.min(3000, 1000 * Math.ceil(attempts / 2));
            await new Promise(resolve => setTimeout(resolve, delay));

            const statusResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'assistants=v2'
                }
            });

            const statusData = await statusResponse.json();
            runStatus = statusData.status;
            attempts++;

            console.log('[Chat] Status:', runStatus, '- Tentativa:', attempts);
        }

        if (runStatus !== 'completed') {
            throw new Error(`Assistente retornou status: ${runStatus}`);
        }

        // 7. BUSCAR RESPOSTA DO ASSISTENTE
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

        // 8. SALVAR HISTÓRICO NO SUPABASE (com user_identifier para memória futura)
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
                user_identifier: userIdentifier || null,
                user_message: message,
                bot_reply: reply,
                created_at: new Date().toISOString()
            })
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                reply,
                threadId: currentThreadId,
                hasMemory: !!memoryContext
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
