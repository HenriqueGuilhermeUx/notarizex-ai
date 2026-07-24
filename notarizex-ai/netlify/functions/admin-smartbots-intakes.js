const crypto = require('crypto');
const fetch = require('node-fetch');

const VALID_STATUSES = new Set([
  'pending_setup',
  'reviewing',
  'waiting_customer',
  'building',
  'testing',
  'active',
  'paused',
  'cancelled'
]);

function clean(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function reply(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function secureEquals(received, expected) {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function supabase(path, options = {}) {
  const baseUrl = clean(process.env.SUPABASE_URL, 500).replace(/\/$/, '');
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !apiKey) throw new Error('Supabase não configurado.');

  return fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {})
    }
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return reply(405, { success: false, error: 'method_not_allowed' });
  }

  const expectedKey = process.env.SMARTBOTS_ADMIN_API_KEY;
  const receivedKey = event.headers?.['x-admin-key'] || event.headers?.['X-Admin-Key'];
  if (!expectedKey || !secureEquals(receivedKey, expectedKey)) {
    return reply(401, { success: false, error: 'unauthorized' });
  }

  try {
    const params = event.queryStringParameters || {};
    const requestedStatus = clean(params.status, 40);
    const limit = Math.max(1, Math.min(Number(params.limit) || 50, 100));

    if (requestedStatus && !VALID_STATUSES.has(requestedStatus)) {
      return reply(422, { success: false, error: 'invalid_status' });
    }

    const filters = [
      'select=*',
      'order=created_at.desc',
      `limit=${limit}`
    ];
    if (requestedStatus) filters.push(`status=eq.${encodeURIComponent(requestedStatus)}`);

    const result = await supabase(`partner_smartbots_intakes?${filters.join('&')}`, { method: 'GET' });
    if (!result.ok) throw new Error(await result.text());

    const intakes = await result.json();
    return reply(200, { success: true, total: intakes.length, intakes });
  } catch (error) {
    console.error('[Admin Intakes]', error);
    return reply(500, { success: false, error: 'internal_error' });
  }
};
