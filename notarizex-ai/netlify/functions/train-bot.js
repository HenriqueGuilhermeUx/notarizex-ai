const fetch = require('node-fetch');
const FormData = require('form-data');

/**
 * train-bot.js — Self-Service de Treinamento da IA
 *
 * Permite que o cliente adicione novos documentos (PDF, TXT) ao seu bot
 * sem precisar recriar o assistente do zero.
 *
 * Ações disponíveis:
 *  - upload_file: Faz upload de um novo PDF/TXT e adiciona ao vector store do assistente
 *  - list_files:  Lista todos os arquivos vinculados ao bot
 *  - remove_file: Remove um arquivo do vector store do assistente
 *  - retrain:     Recria o vector store com todos os arquivos atuais (limpeza completa)
 */

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

    try {
        const body = JSON.parse(event.body);
        const { action, botId, clientToken, fileData, fileName, fileId } = body;

        if (!botId || !clientToken) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'botId e clientToken são obrigatórios' })
            };
        }

        // 1. AUTENTICAR CLIENTE — verificar se o token bate com o bot
        const botRes = await fetch(
            `${SUPABASE_URL}/rest/v1/website_bots?bot_id=eq.${botId}&client_token=eq.${clientToken}&select=assistant_id,status,company_name,vector_store_id`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (!botRes.ok) throw new Error('Falha ao verificar autenticação');

        const bots = await botRes.json();
        if (bots.length === 0) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: 'Token inválido ou bot não encontrado' })
            };
        }

        const bot = bots[0];
        if (bot.status !== 'active') {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: 'Bot não está ativo' })
            };
        }

        const assistantId = bot.assistant_id;
        let vectorStoreId = bot.vector_store_id;

        console.log('[TrainBot] Ação:', action, '| Bot:', botId, '| Empresa:', bot.company_name);

        // ─────────────────────────────────────────────
        // AÇÃO: LISTAR ARQUIVOS
        // ─────────────────────────────────────────────
        if (action === 'list_files') {
            const filesRes = await fetch(
                `${SUPABASE_URL}/rest/v1/bot_training_files?bot_id=eq.${botId}&order=created_at.desc`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            );

            const files = filesRes.ok ? await filesRes.json() : [];
            return {
                statusCode: 200,
                body: JSON.stringify({ files })
            };
        }

        // ─────────────────────────────────────────────
        // AÇÃO: UPLOAD DE ARQUIVO
        // ─────────────────────────────────────────────
        if (action === 'upload_file') {
            if (!fileData || !fileName) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'fileData e fileName são obrigatórios para upload' })
                };
            }

            // Validar tipo de arquivo
            const allowedExtensions = ['.pdf', '.txt', '.docx', '.md'];
            const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
            if (!allowedExtensions.includes(ext)) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: `Tipo de arquivo não suportado. Use: ${allowedExtensions.join(', ')}` })
                };
            }

            // Validar tamanho (máx 20MB)
            const fileSizeBytes = Buffer.from(fileData, 'base64').length;
            if (fileSizeBytes > 20 * 1024 * 1024) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Arquivo muito grande. Máximo: 20MB' })
                };
            }

            console.log('[TrainBot] Fazendo upload do arquivo:', fileName, `(${(fileSizeBytes / 1024).toFixed(1)}KB)`);

            // Upload para OpenAI Files
            const fileBuffer = Buffer.from(fileData, 'base64');
            const formData = new FormData();
            formData.append('purpose', 'assistants');
            formData.append('file', fileBuffer, { filename: fileName });

            const uploadRes = await fetch('https://api.openai.com/v1/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    ...formData.getHeaders()
                },
                body: formData
            });

            if (!uploadRes.ok) {
                const err = await uploadRes.text();
                throw new Error('Falha no upload para OpenAI: ' + err);
            }

            const uploadData = await uploadRes.json();
            const openaiFileId = uploadData.id;
            console.log('[TrainBot] Arquivo enviado para OpenAI:', openaiFileId);

            // Garantir que existe um Vector Store para este assistente
            if (!vectorStoreId) {
                console.log('[TrainBot] Criando novo Vector Store...');
                const vsRes = await fetch('https://api.openai.com/v1/vector_stores', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'OpenAI-Beta': 'assistants=v2'
                    },
                    body: JSON.stringify({
                        name: `VS-${bot.company_name}-${botId}`,
                        file_ids: [openaiFileId]
                    })
                });

                if (!vsRes.ok) throw new Error('Falha ao criar Vector Store');
                const vsData = await vsRes.json();
                vectorStoreId = vsData.id;
                console.log('[TrainBot] Vector Store criado:', vectorStoreId);

                // Vincular Vector Store ao Assistente
                await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'OpenAI-Beta': 'assistants=v2'
                    },
                    body: JSON.stringify({
                        tool_resources: {
                            file_search: { vector_store_ids: [vectorStoreId] }
                        }
                    })
                });

                // Salvar vector_store_id no Supabase
                await fetch(`${SUPABASE_URL}/rest/v1/website_bots?bot_id=eq.${botId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({ vector_store_id: vectorStoreId })
                });

            } else {
                // Adicionar arquivo ao Vector Store existente
                console.log('[TrainBot] Adicionando arquivo ao Vector Store existente:', vectorStoreId);
                const addRes = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'OpenAI-Beta': 'assistants=v2'
                    },
                    body: JSON.stringify({ file_id: openaiFileId })
                });

                if (!addRes.ok) {
                    const err = await addRes.text();
                    throw new Error('Falha ao adicionar arquivo ao Vector Store: ' + err);
                }
            }

            // Registrar arquivo no Supabase para controle
            await fetch(`${SUPABASE_URL}/rest/v1/bot_training_files`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    bot_id: botId,
                    openai_file_id: openaiFileId,
                    file_name: fileName,
                    file_size_bytes: fileSizeBytes,
                    status: 'active',
                    created_at: new Date().toISOString()
                })
            });

            console.log('[TrainBot] Arquivo adicionado com sucesso ao bot');

            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: `Arquivo "${fileName}" adicionado com sucesso! O bot já está aprendendo com o novo conteúdo.`,
                    openaiFileId,
                    vectorStoreId
                })
            };
        }

        // ─────────────────────────────────────────────
        // AÇÃO: REMOVER ARQUIVO
        // ─────────────────────────────────────────────
        if (action === 'remove_file') {
            if (!fileId) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'fileId é obrigatório para remoção' })
                };
            }

            // Buscar openai_file_id no Supabase
            const fileRes = await fetch(
                `${SUPABASE_URL}/rest/v1/bot_training_files?id=eq.${fileId}&bot_id=eq.${botId}&select=openai_file_id,file_name`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            );

            const files = fileRes.ok ? await fileRes.json() : [];
            if (files.length === 0) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Arquivo não encontrado' })
                };
            }

            const { openai_file_id, file_name } = files[0];

            // Remover do Vector Store
            if (vectorStoreId) {
                await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${openai_file_id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'OpenAI-Beta': 'assistants=v2'
                    }
                });
            }

            // Remover do registro no Supabase (soft delete)
            await fetch(`${SUPABASE_URL}/rest/v1/bot_training_files?id=eq.${fileId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ status: 'removed' })
            });

            console.log('[TrainBot] Arquivo removido:', file_name);

            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: `Arquivo "${file_name}" removido com sucesso do bot.`
                })
            };
        }

        return {
            statusCode: 400,
            body: JSON.stringify({ error: `Ação desconhecida: ${action}. Use: upload_file, list_files, remove_file` })
        };

    } catch (error) {
        console.error('[TrainBot] Erro:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
