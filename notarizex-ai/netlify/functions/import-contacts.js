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

async function auth(botId, token) {
  const r = await supabase('website_bots?bot_id=eq.' + encodeURIComponent(botId) + '&client_token=eq.' + encodeURIComponent(token) + '&select=bot_id');
  const rows = r.ok ? await r.json() : [];
  return rows.length > 0;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const botId = clean(body.botId);
    const token = clean(body.clientToken);
    const contacts = Array.isArray(body.contacts) ? body.contacts.slice(0, 300) : [];
    if (!botId || !token) return reply(400, { success: false, error: 'botId e clientToken obrigatorios.' });
    if (!(await auth(botId, token))) return reply(403, { success: false, error: 'Acesso nao autorizado.' });
    const records = contacts.map(c => ({
      bot_id: botId,
      name: clean(c.name || c.nome),
      phone: clean(c.phone || c.whatsapp || c.telefone),
      email: clean(c.email),
      interest: clean(c.interest || c.interesse || c.servico),
      notes: clean(c.notes || c.obs || c.observacao),
      origin: 'csv',
      pipeline_status: 'reativacao',
      created_at: new Date().toISOString()
    })).filter(c => c.name || c.phone || c.email);
    if (!records.length) return reply(400, { success: false, error: 'Nenhum contato valido.' });
    const r = await supabase('smartbot_imported_contacts', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(records) });
    if (!r.ok) throw new Error(await r.text());
    return reply(200, { success: true, imported: await r.json() });
  } catch (error) {
    return reply(500, { success: false, error: error.message });
  }
};
