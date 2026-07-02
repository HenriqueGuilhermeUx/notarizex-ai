const fetch = require('node-fetch');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

function reply(code, body) {
  return { statusCode: code, headers, body: JSON.stringify(body) };
}

function clean(v) {
  return String(v || '').trim();
}

async function supabase(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase nao configurado.');
  return fetch(url + '/rest/v1/' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: 'Bearer ' + key,
      ...(options.headers || {})
    }
  });
}

async function auth(botId, token) {
  const path = 'website_bots?bot_id=eq.' + encodeURIComponent(botId) + '&client_token=eq.' + encodeURIComponent(token) + '&select=bot_id';
  const r = await supabase(path);
  const rows = r.ok ? await r.json() : [];
  return rows.length > 0;
}

function status(v) {
  const s = clean(v).toLowerCase();
  const allowed = ['novo', 'agendado', 'executado', 'retorno_futuro', 'reativacao', 'indicacao', 'perdido'];
  return allowed.includes(s) ? s : 'novo';
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
      const r = await supabase('smartbot_leads?bot_id=eq.' + encodeURIComponent(botId) + '&order=created_at.desc&limit=200');
      const leads = r.ok ? await r.json() : [];
      return reply(200, { success: true, leads });
    }

    if (action === 'update') {
      const id = clean(body.leadId || body.id);
      if (!id) return reply(400, { success: false, error: 'leadId obrigatorio.' });
      const patch = {
        pipeline_status: status(body.status || body.pipelineStatus),
        last_action_at: new Date().toISOString()
      };
      if (body.returnAt !== undefined) patch.return_at = body.returnAt || null;
      if (body.notes !== undefined) patch.owner_notes = clean(body.notes);
      if (body.serviceName !== undefined) patch.service_name = clean(body.serviceName);
      const r = await supabase('smartbot_leads?id=eq.' + encodeURIComponent(id) + '&bot_id=eq.' + encodeURIComponent(botId), {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch)
      });
      if (!r.ok) throw new Error(await r.text());
      return reply(200, { success: true, lead: await r.json() });
    }

    return reply(400, { success: false, error: 'Acao invalida.' });
  } catch (error) {
    return reply(500, { success: false, error: error.message });
  }
};
