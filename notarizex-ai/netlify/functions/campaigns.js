const fetch = require('node-fetch');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

function reply(code, body) { return { statusCode: code, headers, body: JSON.stringify(body) }; }
function clean(v) { return String(v || '').trim(); }

async function supabase(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase nao configurado.');
  return fetch(url + '/rest/v1/' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key, ...(options.headers || {}) }
  });
}

async function getBot(botId, token) {
  const r = await supabase('website_bots?bot_id=eq.' + encodeURIComponent(botId) + '&client_token=eq.' + encodeURIComponent(token) + '&select=bot_id,company_name');
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}

function message(type, company) {
  if (type === 'indicacao') {
    return 'Oi, tudo bem? Aqui é da ' + company + '. Ficamos muito felizes com a sua confiança no nosso atendimento. Você conhece alguém que também poderia precisar da nossa ajuda? Se lembrar de alguém, pode me passar o nome e o WhatsApp por aqui que nossa equipe cuida do contato com carinho.';
  }
  return 'Oi, tudo bem? Aqui é da ' + company + '. Vi aqui que você já demonstrou interesse anteriormente e queria saber se ainda faz sentido conversarmos sobre isso. Posso te ajudar a retomar esse assunto ou prefere que eu avise alguém da equipe para falar com você?';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const botId = clean(body.botId);
    const token = clean(body.clientToken);
    const type = clean(body.campaignType || 'reativacao');
    const bot = await getBot(botId, token);
    if (!bot) return reply(403, { success: false, error: 'Acesso nao autorizado.' });
    const record = {
      bot_id: botId,
      name: clean(body.name || (type === 'indicacao' ? 'Indique e Ganhe' : 'Campanha de Reativação')),
      campaign_type: type,
      audience_count: Number(body.audienceCount || 0),
      suggested_message: clean(body.message) || message(type, bot.company_name || 'empresa'),
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const r = await supabase('smartbot_campaigns', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record) });
    if (!r.ok) throw new Error(await r.text());
    return reply(200, { success: true, campaign: await r.json() });
  } catch (error) {
    return reply(500, { success: false, error: error.message });
  }
};
