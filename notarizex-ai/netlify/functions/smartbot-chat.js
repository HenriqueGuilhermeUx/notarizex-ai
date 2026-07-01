const fetch = require('node-fetch');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

function clean(value) {
  return String(value || '').trim();
}

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

async function db(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase não configurado.');
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
}

async function findBot(botId, channel) {
  const tables = channel === 'whatsapp' ? ['whatsapp_bots', 'website_bots'] : ['website_bots', 'whatsapp_bots'];
  for (const table of tables) {
    const res = await db(`${table}?bot_id=eq.${encodeURIComponent(botId)}&select=*&limit=1`);
    if (res.ok) {
      const rows = await res.json();
      if (rows[0]) return rows[0];
    }
  }
  return null;
}

function detectIntent(message) {
  const text = message.toLowerCase();
  if (/preço|valor|orçamento|proposta|quanto custa|contratar/.test(text)) return 'orcamento';
  if (/agenda|agendar|marcar|consulta|reunião|horário|disponibilidade/.test(text)) return 'agendamento';
  if (/retorno|voltar|acompanhar|follow|cobrar/.test(text)) return 'follow_up';
  if (/reclama|problema|ninguém|demora|insatisfeito/.test(text)) return 'satisfacao';
  return 'duvida';
}

function extractPhone(message) {
  const match = message.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/);
  return match ? match[0] : null;
}

function extractEmail(message) {
  const match = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

function replyFromBusiness({ bot, message, intent }) {
  const company = bot.company_name || 'nossa empresa';
  const knowledge = clean(bot.knowledge_text || bot.business_description || '').slice(0, 1200);
  const base = knowledge ? `Pelo que sei sobre a ${company}: ${knowledge.slice(0, 420)}...` : `Sou o assistente virtual da ${company}.`;

  if (intent === 'orcamento') return `${base}\n\nPara te orientar melhor e não te passar algo genérico, me diga: qual serviço/produto você procura, qual sua urgência e qual melhor WhatsApp para retorno?`;
  if (intent === 'agendamento') return `${base}\n\nPosso ajudar com o agendamento. Me informe seu nome, melhor WhatsApp, serviço desejado e dois horários/dias de preferência.`;
  if (intent === 'follow_up') return `${base}\n\nPerfeito. Vou registrar esse retorno. Me diga seu nome, WhatsApp e quando você quer ser chamado novamente.`;
  if (intent === 'satisfacao') return `Sinto muito por isso. Vou priorizar seu atendimento. Me envie seu nome, melhor WhatsApp e um resumo do que aconteceu para a equipe retornar com urgência.`;
  return `${base}\n\nMe diga um pouco mais sobre o que você precisa. Se quiser, já envie seu nome e WhatsApp para a equipe dar continuidade.`;
}

async function saveHistory({ botId, visitorId, message, botReply }) {
  await db('chat_history', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ bot_id: botId, user_identifier: visitorId, user_message: message, bot_response: botReply, bot_reply: botReply, created_at: new Date().toISOString() })
  }).catch(() => null);
}

async function saveLead({ botId, channel, message, intent, botReply }) {
  const phone = extractPhone(message);
  const email = extractEmail(message);
  const shouldSave = phone || email || ['orcamento', 'agendamento', 'follow_up', 'satisfacao'].includes(intent);
  if (!shouldSave) return;

  await db('smartbot_leads', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      bot_id: botId,
      source_channel: channel,
      email,
      phone,
      interest: message.slice(0, 500),
      intent,
      lead_temperature: intent === 'duvida' ? 'warm' : 'hot',
      next_action: 'Retornar contato, qualificar necessidade e avançar próximo passo.',
      conversation_summary: `Cliente: ${message}\nBot: ${botReply}`,
      created_at: new Date().toISOString()
    })
  }).catch(() => null);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Method Not Allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const botId = clean(body.botId || body.bot_id);
    const message = clean(body.message);
    const visitorId = clean(body.visitorId || body.visitor_id || 'visitor-' + Date.now());
    const channel = clean(body.channel || 'site');
    if (!botId || !message) return json(400, { success: false, error: 'botId e message são obrigatórios.' });

    const bot = await findBot(botId, channel);
    if (!bot) return json(404, { success: false, error: 'Bot não encontrado.' });

    const intent = detectIntent(message);
    const botReply = replyFromBusiness({ bot, message, intent });
    await saveHistory({ botId, visitorId, message, botReply });
    await saveLead({ botId, channel, message, intent, botReply });

    return json(200, { success: true, reply: botReply, intent, botId, visitorId });
  } catch (error) {
    return json(500, { success: false, error: error.message || 'Erro no SmartBot' });
  }
};
