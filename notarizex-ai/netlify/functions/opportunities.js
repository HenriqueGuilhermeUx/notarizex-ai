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
  return fetch(url + '/rest/v1/' + path, { ...options, headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key, ...(options.headers || {}) } });
}
async function auth(botId, token) {
  const r = await supabase('website_bots?bot_id=eq.' + encodeURIComponent(botId) + '&client_token=eq.' + encodeURIComponent(token) + '&select=bot_id');
  const rows = r.ok ? await r.json() : [];
  return rows.length > 0;
}
function status(v) {
  const s = clean(v).toLowerCase();
  const allowed = ['novo', 'agendado', 'executado', 'retorno_futuro', 'reativacao', 'indicacao', 'perdido', 'contatado'];
  return allowed.includes(s) ? s : 'novo';
}
function contactToLead(c) {
  return {
    id: 'imp-' + c.id,
    raw_id: c.id,
    imported: true,
    bot_id: c.bot_id,
    source_channel: 'importado',
    origin: 'importado',
    name: c.name,
    phone: c.phone,
    email: c.email,
    interest: c.interest || c.notes || 'Contato importado',
    intent: 'reativacao',
    lead_temperature: 'warm',
    pipeline_status: c.pipeline_status || 'reativacao',
    owner_notes: c.notes,
    created_at: c.created_at
  };
}
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const action = clean(body.action);
    const botId = clean(body.botId);
    const token = clean(body.clientToken);
    if (!botId || !token) return reply(400, { success: false, error: 'botId e clientToken obrigatorios.' });
    if (!(await auth(botId, token))) return reply(403, { success: false, error: 'Acesso nao autorizado.' });

    if (action === 'list') {
      const a = await supabase('smartbot_leads?bot_id=eq.' + encodeURIComponent(botId) + '&order=created_at.desc&limit=200');
      const b = await supabase('smartbot_imported_contacts?bot_id=eq.' + encodeURIComponent(botId) + '&order=created_at.desc&limit=300');
      const leads = a.ok ? await a.json() : [];
      const contacts = b.ok ? await b.json() : [];
      return reply(200, { success: true, leads: leads.concat(contacts.map(contactToLead)) });
    }

    if (action === 'update') {
      const id = clean(body.leadId || body.id);
      if (!id) return reply(400, { success: false, error: 'leadId obrigatorio.' });
      const imported = id.startsWith('imp-') || body.imported === true;
      const realId = imported ? id.replace('imp-', '') : id;
      const patch = { pipeline_status: status(body.status || body.pipelineStatus) };
      if (!imported) patch.last_action_at = new Date().toISOString();
      if (body.returnAt !== undefined && !imported) patch.return_at = body.returnAt || null;
      if (body.notes !== undefined) imported ? patch.notes = clean(body.notes) : patch.owner_notes = clean(body.notes);
      if (body.serviceName !== undefined && !imported) patch.service_name = clean(body.serviceName);
      const table = imported ? 'smartbot_imported_contacts' : 'smartbot_leads';
      const r = await supabase(table + '?id=eq.' + encodeURIComponent(realId) + '&bot_id=eq.' + encodeURIComponent(botId), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error(await r.text());
      return reply(200, { success: true, lead: await r.json() });
    }
    return reply(400, { success: false, error: 'Acao invalida.' });
  } catch (error) { return reply(500, { success: false, error: error.message }); }
};
