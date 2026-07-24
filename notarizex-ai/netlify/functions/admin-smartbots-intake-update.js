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
  if (event.httpMethod !== 'PATCH' && event.httpMethod !== 'POST') {
    return reply(405, { success: false, error: 'method_not_allowed' });
  }

  const expectedKey = process.env.SMARTBOTS_ADMIN_API_KEY;
  const receivedKey = event.headers?.['x-admin-key'] || event.headers?.['X-Admin-Key'];
  if (!expectedKey || !secureEquals(receivedKey, expectedKey)) {
    return reply(401, { success: false, error: 'unauthorized' });
  }

  try {
    let data;
    try {
      data = JSON.parse(event.body || '{}');
    } catch {
      return reply(400, { success: false, error: 'invalid_json' });
    }

    const intakeId = clean(data.intakeId || data.id, 80);
    const status = clean(data.status, 40);
    const assignedTo = clean(data.assignedTo, 160);
    const internalNotes = clean(data.internalNotes, 10000);

    if (!intakeId) return reply(422, { success: false, error: 'intake_id_required' });
    if (status && !VALID_STATUSES.has(status)) {
      return reply(422, { success: false, error: 'invalid_status' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (Object.prototype.hasOwnProperty.call(data, 'assignedTo')) updates.assigned_to = assignedTo || null;
    if (Object.prototype.hasOwnProperty.call(data, 'internalNotes')) updates.internal_notes = internalNotes || null;

    if (Object.keys(updates).length === 1) {
      return reply(422, { success: false, error: 'no_changes' });
    }

    const result = await supabase(
      `partner_smartbots_intakes?id=eq.${encodeURIComponent(intakeId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(updates)
      }
    );

    if (!result.ok) throw new Error(await result.text());
    const updated = await result.json();
    if (!updated.length) return reply(404, { success: false, error: 'intake_not_found' });

    return reply(200, { success: true, intake: updated[0] });
  } catch (error) {
    console.error('[Admin Intake Update]', error);
    return reply(500, { success: false, error: 'internal_error' });
  }
};
