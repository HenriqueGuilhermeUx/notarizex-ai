const fetch = require('node-fetch');
const OpenAI = require('openai');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

async function getRecentHistory(botId, visitorId) {
  const res = await db(`chat_history?bot_id=eq.${encodeURIComponent(botId)}&user_identifier=eq.${encodeURIComponent(visitorId)}&order=created_at.desc&limit=6`);
  if (!res.ok) return [];
  const rows = await res.json();
  return rows.reverse();
}

function detectIntent(message) {
  const text = message.toLowerCase();
  if (/preço|valor|orçamento|proposta|quanto custa|contratar|plano|mensalidade/.test(text)) return 'orcamento';
  if (/agenda|agendar|marcar|consulta|reunião|horário|disponibilidade|visita/.test(text)) return 'agendamento';
  if (/retorno|voltar|acompanhar|follow|cobrar|me chama|lembrar/.test(text)) return 'follow_up';
  if (/reclama|problema|ninguém|demora|insatisfeito|ruim|cancelar/.test(text)) return 'satisfacao';
  if (/humano|atendente|pessoa|vendedor|consultor|secretária|secretaria/.test(text)) return 'handoff';
  return 'duvida';
}

function extractPhone(text) {
  const match = String(text || '').match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/);
  return match ? match[0] : null;
}

function extractEmail(text) {
  const match = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

function nextAction(intent) {
  const map = {
    orcamento: 'Retornar contato, entender necessidade e enviar proposta/orçamento.',
    agendamento: 'Confirmar dados e avançar agendamento.',
    follow_up: 'Programar retorno e manter contexto da conversa.',
    satisfacao: 'Priorizar atendimento humano.',
    handoff: 'Encaminhar para atendimento humano.',
    duvida: 'Responder dúvida e conduzir para próximo passo.'
  };
  return map[intent] || map.duvida;
}

function fallbackReply({ bot, intent }) {
  const company = bot.company_name || 'nossa empresa';
  const knowledge = clean(bot.knowledge_text || bot.business_description || '').slice(0, 700);
  const base = knowledge ? `Pelo que sei sobre a ${company}: ${knowledge.slice(0, 360)}...` : `Sou o assistente virtual da ${company}.`;
  if (intent === 'orcamento') return `${base}\n\nPara te orientar melhor, me diga qual serviço você procura, qual sua urgência e qual melhor WhatsApp para retorno.`;
  if (intent === 'agendamento') return `${base}\n\nPosso ajudar com o agendamento. Me informe seu nome, melhor WhatsApp, serviço desejado e dois horários de preferência.`;
  if (intent === 'follow_up') return `${base}\n\nVou registrar esse retorno. Me diga seu nome, WhatsApp e quando você quer ser chamado novamente.`;
  if (intent === 'satisfacao') return `Sinto muito por isso. Vou priorizar seu atendimento. Me envie seu nome, melhor WhatsApp e um resumo do que aconteceu para a equipe retornar.`;
  if (intent === 'handoff') return `Claro. Para encaminhar para a equipe, me envie seu nome, WhatsApp e um resumo do que você precisa.`;
  return `${base}\n\nMe diga um pouco mais sobre o que você precisa. Se quiser, envie seu nome e WhatsApp para a equipe dar continuidade.`;
}

function systemPrompt(bot, channel, intent) {
  const company = bot.company_name || 'empresa cliente';
  const knowledge = clean(bot.knowledge_text || bot.business_description || '').slice(0, 26000);
  const tone = bot.bot_tone === 'formal' ? 'profissional' : bot.bot_tone === 'sales' ? 'consultivo e comercial' : bot.bot_tone === 'technical' ? 'técnico e objetivo' : 'amigável e direto';
  const lang = bot.bot_language === 'en' ? 'inglês' : bot.bot_language === 'es' ? 'espanhol' : 'português brasileiro';
  return `Você é o assistente virtual da empresa ${company}. Canal: ${channel}. Intenção detectada: ${intent}. Responda em ${lang}, com tom ${tone}. Use somente a base do negócio abaixo. Quando faltar informação, colete dados para retorno humano. Se houver intenção comercial, peça nome, WhatsApp/e-mail, necessidade e urgência. Seja objetivo, útil e conduza para o próximo passo. Base do negócio: ${knowledge || 'Base ainda incompleta.'}`;
}

async function aiReply({ bot, channel, message, intent, history }) {
  if (!process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [{ role: 'system', content: systemPrompt(bot, channel, intent) }];
  history.forEach(h => {
    if (h.user_message) messages.push({ role: 'user', content: String(h.user_message).slice(0, 1000) });
    if (h.bot_reply || h.bot_response) messages.push({ role: 'assistant', content: String(h.bot_reply || h.bot_response).slice(0, 1000) });
  });
  messages.push({ role: 'user', content: message });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.35,
    max_tokens: 520,
    messages
  });
  return clean(completion.choices?.[0]?.message?.content || '');
}

async function saveHistory({ botId, visitorId, message, botReply }) {
  await db('chat_history', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ bot_id: botId, thread_id: visitorId, user_identifier: visitorId, user_message: message, bot_response: botReply, bot_reply: botReply, created_at: new Date().toISOString() })
  }).catch(() => null);
}

async function saveLead({ botId, channel, message, intent, botReply }) {
  const phone = extractPhone(message);
  const email = extractEmail(message);
  const shouldSave = phone || email || ['orcamento', 'agendamento', 'follow_up', 'satisfacao', 'handoff'].includes(intent);
  if (!shouldSave) return;
  await db('smartbot_leads', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      bot_id: botId,
      source_channel: channel,
      email,
      phone,
      interest: message.slice(0, 700),
      intent,
      lead_temperature: ['orcamento', 'agendamento', 'satisfacao', 'handoff'].includes(intent) ? 'hot' : 'warm',
      next_action: nextAction(intent),
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
    const history = await getRecentHistory(botId, visitorId);
    let botReply = null;
    let aiUsed = false;
    try {
      botReply = await aiReply({ bot, channel, message, intent, history });
      aiUsed = Boolean(botReply);
    } catch (e) {
      console.error('[SmartBot AI fallback]', e.message);
    }
    if (!botReply) botReply = fallbackReply({ bot, intent });
    await saveHistory({ botId, visitorId, message, botReply });
    await saveLead({ botId, channel, message, intent, botReply });
    return json(200, { success: true, reply: botReply, intent, botId, visitorId, aiUsed });
  } catch (error) {
    console.error('[SmartBot Chat]', error.message);
    return json(500, { success: false, error: error.message || 'Erro no SmartBot' });
  }
};
