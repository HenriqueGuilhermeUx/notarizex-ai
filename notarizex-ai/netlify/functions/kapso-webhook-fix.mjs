function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function clean(value) {
  return String(value ?? '').trim();
}

function sanitizeUrl(rawUrl, expectedToken) {
  try {
    const url = new URL(rawUrl);
    const supplied = clean(url.searchParams.get('token'));
    return {
      host: url.host,
      path: url.pathname,
      https: url.protocol === 'https:',
      token_present: Boolean(supplied),
      token_matches: Boolean(expectedToken && supplied && supplied === expectedToken),
    };
  } catch {
    return { host: null, path: null, https: false, token_present: false, token_matches: false };
  }
}

async function kapso(path, options = {}) {
  const apiKey = clean(Netlify.env.get('KAPSO_API_KEY'));
  if (!apiKey) throw new Error('kapso_api_key_missing');
  return fetch(`https://api.kapso.ai${path}`, {
    ...options,
    headers: {
      'X-API-Key': apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

export default async (request) => {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  const phoneNumberId = clean(Netlify.env.get('KAPSO_PHONE_NUMBER_ID'));
  const token = clean(Netlify.env.get('KAPSO_WEBHOOK_TOKEN'));
  if (!phoneNumberId || !token) return json(500, { ok: false, error: 'required_env_missing' });

  const desiredUrl = `https://smartbots.club/.netlify/functions/kapso-webhook?token=${encodeURIComponent(token)}`;

  try {
    const listResponse = await kapso('/platform/v1/whatsapp/webhooks?per_page=100');
    if (!listResponse.ok) {
      return json(502, { ok: false, stage: 'list', status: listResponse.status });
    }

    const listBody = await listResponse.json();
    const webhooks = Array.isArray(listBody?.data) ? listBody.data : [];
    const target = webhooks.find(
      (item) => clean(item?.phone_number_id) === phoneNumberId && item?.kind === 'kapso'
    );
    if (!target?.id) return json(404, { ok: false, error: 'matching_webhook_not_found' });

    const patchResponse = await kapso(
      `/platform/v1/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}/webhooks/${encodeURIComponent(target.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          whatsapp_webhook: {
            url: desiredUrl,
            active: true,
            payload_version: 'v2',
          },
        }),
      }
    );

    const patchText = await patchResponse.text();
    if (!patchResponse.ok) {
      return json(502, {
        ok: false,
        stage: 'patch',
        status: patchResponse.status,
        error: patchText.slice(0, 300),
      });
    }

    const verifyResponse = await kapso('/platform/v1/whatsapp/webhooks?per_page=100');
    if (!verifyResponse.ok) {
      return json(502, { ok: false, stage: 'verify_list', status: verifyResponse.status });
    }
    const verifyBody = await verifyResponse.json();
    const verified = (Array.isArray(verifyBody?.data) ? verifyBody.data : []).find(
      (item) => item?.id === target.id
    );
    const endpoint = sanitizeUrl(verified?.url, token);
    const events = Array.isArray(verified?.events) ? verified.events : [];
    const ok = Boolean(
      verified?.active === true &&
      verified?.payload_version === 'v2' &&
      events.includes('whatsapp.message.received') &&
      endpoint.host === 'smartbots.club' &&
      endpoint.path === '/.netlify/functions/kapso-webhook' &&
      endpoint.token_matches
    );

    return json(ok ? 200 : 409, {
      ok,
      webhook_id: target.id,
      active: verified?.active === true,
      payload_version: verified?.payload_version || null,
      has_received_event: events.includes('whatsapp.message.received'),
      endpoint,
    });
  } catch (error) {
    return json(500, { ok: false, error: clean(error?.message || error) });
  }
};

export const config = {
  path: '/__sb-kapso-fix-4d81c6',
};
