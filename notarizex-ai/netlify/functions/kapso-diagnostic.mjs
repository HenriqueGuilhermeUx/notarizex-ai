function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function clean(value) {
  return String(value ?? '').trim();
}

function safeUrlState(rawUrl, expectedToken) {
  try {
    const u = new URL(rawUrl);
    const supplied = clean(u.searchParams.get('token'));
    return {
      host: u.host,
      path: u.pathname,
      https: u.protocol === 'https:',
      token_present: Boolean(supplied),
      token_matches: Boolean(expectedToken && supplied && supplied === expectedToken),
    };
  } catch {
    return { host: null, path: null, https: false, token_present: false, token_matches: false };
  }
}

async function supabaseRequest(path, options = {}) {
  const url = clean(Netlify.env.get('SUPABASE_URL'));
  const key = clean(Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) throw new Error('supabase_env_missing');
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

export default async (request) => {
  if (request.method !== 'GET') return json(405, { ok: false, error: 'method_not_allowed' });

  const phoneNumberId = clean(Netlify.env.get('KAPSO_PHONE_NUMBER_ID'));
  const kapsoApiKey = clean(Netlify.env.get('KAPSO_API_KEY'));
  const expectedToken = clean(Netlify.env.get('KAPSO_WEBHOOK_TOKEN'));

  const result = {
    ok: false,
    env: {
      kapso_api_key: Boolean(kapsoApiKey),
      kapso_phone_number_id: Boolean(phoneNumberId),
      kapso_webhook_token: Boolean(expectedToken),
      supabase_url: Boolean(clean(Netlify.env.get('SUPABASE_URL'))),
      supabase_service_role: Boolean(clean(Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY'))),
    },
    supabase: { reachable: false, audit_insert: false },
    kapso: { reachable: false, webhooks: [] },
  };

  try {
    const configResponse = await supabaseRequest(
      `smartbot_whatsapp_config?provider=eq.kapso&provider_phone_number_id=eq.${encodeURIComponent(phoneNumberId)}&select=bot_id,status,auto_reply,provider_phone_number_id&limit=1`
    );
    result.supabase.reachable = configResponse.ok;
    result.supabase.config_status = configResponse.status;
    if (configResponse.ok) {
      const rows = await configResponse.json();
      result.supabase.config_found = Boolean(rows[0]);
      result.supabase.bot_id = rows[0]?.bot_id || null;
      result.supabase.connection_status = rows[0]?.status || null;
      result.supabase.auto_reply = rows[0]?.auto_reply === true;
    }

    const auditResponse = await supabaseRequest('smartbot_kapso_webhook_events', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        event_name: 'smartbots.diagnostic',
        idempotency_key: `diag-${Date.now()}`,
        is_batch: false,
        phone_number_id: phoneNumberId || null,
        status: 'diagnostic',
        payload: { source: 'netlify-kapso-diagnostic' },
      }),
    });
    result.supabase.audit_insert = auditResponse.ok;
    result.supabase.audit_status = auditResponse.status;
    if (!auditResponse.ok) result.supabase.audit_error = (await auditResponse.text()).slice(0, 500);
  } catch (error) {
    result.supabase.error = clean(error?.message || error);
  }

  try {
    if (!kapsoApiKey) throw new Error('kapso_api_key_missing');
    const response = await fetch('https://api.kapso.ai/platform/v1/whatsapp/webhooks?per_page=100', {
      headers: { 'X-API-Key': kapsoApiKey, accept: 'application/json' },
    });
    result.kapso.reachable = response.ok;
    result.kapso.status = response.status;
    if (!response.ok) {
      result.kapso.error = (await response.text()).slice(0, 500);
    } else {
      const body = await response.json();
      const webhooks = Array.isArray(body?.data) ? body.data : [];
      result.kapso.total = webhooks.length;
      result.kapso.webhooks = webhooks.map((w) => ({
        id: w.id,
        active: w.active === true,
        kind: w.kind || null,
        phone_number_id: w.phone_number_id || null,
        events: Array.isArray(w.events) ? w.events : [],
        payload_version: w.payload_version || null,
        endpoint: safeUrlState(w.url, expectedToken),
      }));
      result.kapso.matching_phone_webhooks = result.kapso.webhooks.filter(
        (w) => clean(w.phone_number_id) === phoneNumberId
      ).length;
      result.kapso.active_received_webhooks = result.kapso.webhooks.filter(
        (w) => clean(w.phone_number_id) === phoneNumberId && w.active && w.events.includes('whatsapp.message.received')
      ).length;
    }
  } catch (error) {
    result.kapso.error = clean(error?.message || error);
  }

  result.ok = Boolean(
    result.supabase.reachable &&
      result.supabase.audit_insert &&
      result.kapso.reachable &&
      result.kapso.active_received_webhooks > 0
  );

  return json(200, result);
};

export const config = {
  path: '/__sb-kapso-diag-9f7e2b',
};
