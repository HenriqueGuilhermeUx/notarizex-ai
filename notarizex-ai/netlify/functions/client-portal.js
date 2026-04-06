const fetch = require('node-fetch');

/**
 * client-portal.js — API do Portal Self-Service do Cliente
 *
 * Endpoints:
 *  - login:          Autentica cliente por email + token e retorna dados do bot
 *  - get_stats:      Retorna estatísticas do bot (conversas, mensagens, etc.)
 *  - get_history:    Retorna histórico de conversas paginado
 *  - update_config:  Atualiza configurações do assistente (nome, instruções, tom)
 *  - get_leads:      Retorna leads capturados pelo bot
 */

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const body = JSON.parse(event.body);
        const { action, email, clientToken, botId, config, page = 1, limit = 20 } = body;

        // ─────────────────────────────────────────────
        // AÇÃO: LOGIN
        // ─────────────────────────────────────────────
        if (action === 'login') {
            if (!email || !clientToken) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Email e token são obrigatórios' })
                };
            }

            // Buscar bot pelo email do cliente e token
            const botRes = await fetch(
                `${SUPABASE_URL}/rest/v1/website_bots?email=eq.${encodeURIComponent(email)}&client_token=eq.${clientToken}&select=*`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            );

            if (!botRes.ok) throw new Error('Falha ao verificar credenciais');

            const bots = await botRes.json();
            if (bots.length === 0) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Email ou token inválidos' })
                };
            }

            const bot = bots[0];

            // Buscar contagem de conversas
            const statsRes = await fetch(
                `${SUPABASE_URL}/rest/v1/chat_history?bot_id=eq.${bot.bot_id}&select=id`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'count=exact',
                        'Range': '0-0'
                    }
                }
            );

            const totalConversations = parseInt(statsRes.headers?.get('content-range')?.split('/')[1] || '0');

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    bot: {
                        botId: bot.bot_id,
                        companyName: bot.company_name,
                        website: bot.website,
                        status: bot.status,
                        plan: bot.plan,
                        createdAt: bot.created_at,
                        assistantId: bot.assistant_id,
                        vectorStoreId: bot.vector_store_id
                    },
                    stats: {
                        totalConversations
                    }
                })
            };
        }

        // Para as demais ações, validar botId + clientToken
        if (!botId || !clientToken) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'botId e clientToken são obrigatórios' })
            };
        }

        // Autenticar
        const authRes = await fetch(
            `${SUPABASE_URL}/rest/v1/website_bots?bot_id=eq.${botId}&client_token=eq.${clientToken}&select=assistant_id,status,company_name,vector_store_id`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        const authBots = authRes.ok ? await authRes.json() : [];
        if (authBots.length === 0) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Acesso não autorizado' })
            };
        }

        const authBot = authBots[0];

        // ─────────────────────────────────────────────
        // AÇÃO: ESTATÍSTICAS
        // ─────────────────────────────────────────────
        if (action === 'get_stats') {
            // Total de conversas
            const totalRes = await fetch(
                `${SUPABASE_URL}/rest/v1/chat_history?bot_id=eq.${botId}&select=id`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'count=exact',
                        'Range': '0-0'
                    }
                }
            );
            const total = parseInt(totalRes.headers?.get('content-range')?.split('/')[1] || '0');

            // Conversas dos últimos 7 dias
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const weekRes = await fetch(
                `${SUPABASE_URL}/rest/v1/chat_history?bot_id=eq.${botId}&created_at=gte.${sevenDaysAgo}&select=id`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'count=exact',
                        'Range': '0-0'
                    }
                }
            );
            const weekTotal = parseInt(weekRes.headers?.get('content-range')?.split('/')[1] || '0');

            // Usuários únicos
            const uniqueRes = await fetch(
                `${SUPABASE_URL}/rest/v1/chat_history?bot_id=eq.${botId}&select=user_identifier`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            );
            const allHistory = uniqueRes.ok ? await uniqueRes.json() : [];
            const uniqueUsers = new Set(allHistory.map(h => h.user_identifier).filter(Boolean)).size;

            // Arquivos de treinamento
            const filesRes = await fetch(
                `${SUPABASE_URL}/rest/v1/bot_training_files?bot_id=eq.${botId}&status=eq.active&select=id`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'count=exact',
                        'Range': '0-0'
                    }
                }
            );
            const totalFiles = parseInt(filesRes.headers?.get('content-range')?.split('/')[1] || '0');

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    totalConversations: total,
                    conversationsThisWeek: weekTotal,
                    uniqueUsers,
                    trainingFiles: totalFiles,
                    botStatus: authBot.status
                })
            };
        }

        // ─────────────────────────────────────────────
        // AÇÃO: HISTÓRICO DE CONVERSAS
        // ─────────────────────────────────────────────
        if (action === 'get_history') {
            const offset = (page - 1) * limit;
            const histRes = await fetch(
                `${SUPABASE_URL}/rest/v1/chat_history?bot_id=eq.${botId}&order=created_at.desc&limit=${limit}&offset=${offset}`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'count=exact'
                    }
                }
            );

            const history = histRes.ok ? await histRes.json() : [];
            const totalCount = parseInt(histRes.headers?.get('content-range')?.split('/')[1] || '0');

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    history,
                    pagination: {
                        page,
                        limit,
                        total: totalCount,
                        totalPages: Math.ceil(totalCount / limit)
                    }
                })
            };
        }

        // ─────────────────────────────────────────────
        // AÇÃO: ATUALIZAR CONFIGURAÇÕES DO ASSISTENTE
        // ─────────────────────────────────────────────
        if (action === 'update_config') {
            if (!config) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'config é obrigatório' })
                };
            }

            const { botName, instructions, tone, language } = config;

            // Montar instruções personalizadas
            const toneMap = {
                formal: 'Use linguagem formal e profissional.',
                friendly: 'Use linguagem amigável e descontraída, como se fosse um amigo ajudando.',
                technical: 'Use linguagem técnica e precisa, com detalhes quando necessário.',
                sales: 'Seja persuasivo e focado em conversão. Destaque benefícios e crie urgência de forma natural.'
            };

            const langMap = {
                pt: 'Responda sempre em português brasileiro.',
                en: 'Always respond in English.',
                es: 'Responde siempre en español.'
            };

            const customInstructions = [
                instructions || '',
                toneMap[tone] || '',
                langMap[language] || langMap['pt']
            ].filter(Boolean).join('\n\n');

            // Atualizar assistente na OpenAI
            const updateRes = await fetch(`https://api.openai.com/v1/assistants/${authBot.assistant_id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'assistants=v2'
                },
                body: JSON.stringify({
                    name: botName || authBot.company_name,
                    instructions: customInstructions
                })
            });

            if (!updateRes.ok) {
                const err = await updateRes.text();
                throw new Error('Falha ao atualizar assistente: ' + err);
            }

            // Salvar configuração no Supabase
            await fetch(`${SUPABASE_URL}/rest/v1/website_bots?bot_id=eq.${botId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    bot_name: botName,
                    bot_tone: tone,
                    bot_language: language,
                    updated_at: new Date().toISOString()
                })
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Configurações do bot atualizadas com sucesso!'
                })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Ação desconhecida: ${action}` })
        };

    } catch (error) {
        console.error('[ClientPortal] Erro:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
