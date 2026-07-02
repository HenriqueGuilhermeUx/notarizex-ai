const fetch = require('node-fetch');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST',
  'Content-Type': 'application/json'
};

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function clean(value) {
  return String(value || '').trim();
}

async function supabase(path, options = {}) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase não configurado.');

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(options.headers || {})
    }
  });
}

async function countRows(path) {
  const res = await supabase(path, { headers: { Prefer: 'count=exact', Range: '0-0' } });
  return parseInt(res.headers?.get('content-range')?.split('/')[1] || '0');
}

async function getBotByToken(botId, clientToken) {
  const res = await supabase(`website_bots?bot_id=eq.${encodeURIComponent(botId)}&client_token=eq.${encodeURIComponent(clientToken)}&select=*`);
  const rows = res.ok ? await res.json() : [];
  return rows[0] || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method Not Allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, email, clientToken, botId, config, page = 1, limit = 20 } = body;

    if (action === 'login') {
      if (!email || !clientToken) return reply(400, { error: 'Email e token são obrigatórios' });

      const botRes = await supabase(`website_bots?or=(email.eq.${encodeURIComponent(email)},owner_email.eq.${encodeURIComponent(email)})&client_token=eq.${encodeURIComponent(clientToken)}&select=*`);
      if (!botRes.ok) throw new Error('Falha ao verificar credenciais');

      const bots = await botRes.json();
      if (!bots.length) return reply(401, { error: 'Email ou token inválidos' });

      const bot = bots[0];
      const totalConversations = await countRows(`chat_history?bot_id=eq.${encodeURIComponent(bot.bot_id)}&select=id`);

      return reply(200, {
        success: true,
        bot: {
          botId: bot.bot_id,
          companyName: bot.company_name,
          website: bot.website,
          status: bot.status,
          plan: bot.plan,
          createdAt: bot.created_at,
          assistantId: bot.assistant_id,
          vectorStoreId: bot.vector_store_id,
          botName: bot.bot_name,
          botTone: bot.bot_tone,
          botLanguage: bot.bot_language,
          knowledgeStatus: bot.knowledge_status,
          uploadedFileName: bot.uploaded_file_name
        },
        stats: { totalConversations }
      });
    }

    if (!botId || !clientToken) return reply(400, { error: 'botId e clientToken são obrigatórios' });

    const authBot = await getBotByToken(botId, clientToken);
    if (!authBot) return reply(403, { error: 'Acesso não autorizado' });

    if (action === 'get_stats') {
      const total = await countRows(`chat_history?bot_id=eq.${encodeURIComponent(botId)}&select=id`);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weekTotal = await countRows(`chat_history?bot_id=eq.${encodeURIComponent(botId)}&created_at=gte.${sevenDaysAgo}&select=id`);
      const totalFiles = await countRows(`bot_training_files?bot_id=eq.${encodeURIComponent(botId)}&status=eq.active&select=id`);
      const leads = await countRows(`smartbot_leads?bot_id=eq.${encodeURIComponent(botId)}&select=id`);

      const uniqueRes = await supabase(`chat_history?bot_id=eq.${encodeURIComponent(botId)}&select=user_identifier`);
      const allHistory = uniqueRes.ok ? await uniqueRes.json() : [];
      const uniqueUsers = new Set(allHistory.map(h => h.user_identifier).filter(Boolean)).size;

      return reply(200, {
        totalConversations: total,
        conversationsThisWeek: weekTotal,
        uniqueUsers,
        trainingFiles: totalFiles,
        leads,
        botStatus: authBot.status,
        knowledgeStatus: authBot.knowledge_status || 'pending',
        uploadedFileName: authBot.uploaded_file_name || null
      });
    }

    if (action === 'get_history') {
      const offset = (Number(page) - 1) * Number(limit);
      const histRes = await supabase(`chat_history?bot_id=eq.${encodeURIComponent(botId)}&order=created_at.desc&limit=${limit}&offset=${offset}`, {
        headers: { Prefer: 'count=exact' }
      });
      const history = histRes.ok ? await histRes.json() : [];
      const totalCount = parseInt(histRes.headers?.get('content-range')?.split('/')[1] || '0');
      return reply(200, { history, pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) } });
    }

    if (action === 'get_leads') {
      const leadsRes = await supabase(`smartbot_leads?bot_id=eq.${encodeURIComponent(botId)}&order=created_at.desc&limit=100`);
      const leads = leadsRes.ok ? await leadsRes.json() : [];
      return reply(200, { success: true, leads });
    }

    if (action === 'update_config') {
      if (!config) return reply(400, { error: 'config é obrigatório' });

      const botName = clean(config.botName || authBot.company_name);
      const tone = clean(config.tone || 'friendly');
      const language = clean(config.language || 'pt');
      const instructions = clean(config.instructions || '');
      const segment = clean(config.segment || '');
      const goals = Array.isArray(config.goals) ? config.goals.join(', ') : clean(config.goals || '');

      const knowledgeNote = [
        authBot.knowledge_text || authBot.business_description || '',
        '\n\n---\n\nConfiguração de inteligência do bot:',
        segment ? `Segmento: ${segment}` : '',
        goals ? `Objetivos: ${goals}` : '',
        instructions ? `Regras e instruções: ${instructions}` : ''
      ].filter(Boolean).join('\n');

      const patchRes = await supabase(`website_bots?bot_id=eq.${encodeURIComponent(botId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          bot_name: botName,
          bot_tone: tone,
          bot_language: language,
          business_description: instructions || authBot.business_description,
          knowledge_text: knowledgeNote.slice(0, 50000),
          updated_at: new Date().toISOString()
        })
      });

      if (!patchRes.ok) throw new Error('Falha ao salvar configurações: ' + await patchRes.text());

      return reply(200, {
        success: true,
        message: 'Configurações salvas. O bot já usará essas informações nas próximas respostas.'
      });
    }

    return reply(400, { error: `Ação desconhecida: ${action}` });
  } catch (error) {
    console.error('[ClientPortal] Erro:', error.message);
    return reply(500, { error: error.message });
  }
};
