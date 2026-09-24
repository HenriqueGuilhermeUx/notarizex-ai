const crypto = require('crypto');
const fetch = require('node-fetch');

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
function reply(code, body) { return { statusCode: code, headers, body: JSON.stringify(body) }; }
function env(name) { return String(process.env[name] || '').trim(); }
function clean(v) { return String(v || '').trim(); }
function getCharge(body) { return body.charge || body.pixQrCode || body.pix || body.transaction || body; }
function safeEqual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function authorized(event) {
  const expected = env('WOOVI_WEBHOOK_SECRET');
  if (!expected) return true;
  const h = event.headers || {};
  const direct = clean(h['x-webhook-secret'] || h['X-Webhook-Secret']);
  if (safeEqual(direct, expected)) return true;
  const auth = clean(h.authorization || h.Authorization).replace(/^Bearer\s+/i, '');
  return safeEqual(auth, expected);
}
async function db(path, options = {}) {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase service role não configurado.');
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
async function rows(response, label) {
  if (!response.ok) throw new Error(`${label}: ${(await response.text()).slice(0, 600)}`);
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}
function isPaid(status, eventName) {
  return String(status || '').toUpperCase().includes('COMPLETED') || String(eventName || '').toUpperCase().includes('CHARGE_COMPLETED');
}
function add30Days(date) {
  return new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000);
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return reply(200, { success: true });
  try {
    if (!authorized(event)) return reply(403, { success: false, error: 'invalid webhook secret' });
    const body = JSON.parse(event.body || '{}');
    const charge = getCharge(body);
    const status = clean(charge.status || body.event || '');
    const correlationID = clean(charge.correlationID || body.correlationID || '');
    if (!correlationID) return reply(200, { success: true, ignored: 'missing correlationID' });
    if (!isPaid(status, body.event)) return reply(200, { success: true, ignored: status || 'not paid' });

    const existingRows = await rows(
      await db(`smartbot_subscriptions?woovi_correlation_id=eq.${encodeURIComponent(correlationID)}&select=*&limit=1`),
      'Localizar assinatura'
    );
    const existing = existingRows[0];
    if (!existing) return reply(200, { success: true, ignored: 'unknown correlationID' });

    const alreadyProcessed = existing.status === 'active' && existing.paid_at && String(existing.woovi_status || '').toUpperCase().includes('COMPLETED');
    if (alreadyProcessed) return reply(200, { success: true, alreadyProcessed: true, botId: existing.bot_id });

    const now = new Date();
    const previousEnd = existing.current_period_end ? new Date(existing.current_period_end) : null;
    const periodStart = previousEnd && previousEnd.getTime() > now.getTime() ? previousEnd : now;
    const periodEnd = add30Days(periodStart);
    const normalizedStatus = status || 'COMPLETED';

    const updated = await rows(
      await db(`smartbot_subscriptions?id=eq.${encodeURIComponent(existing.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'active',
          paid_at: now.toISOString(),
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          woovi_status: normalizedStatus,
          woovi_payload: body,
          updated_at: now.toISOString()
        })
      }),
      'Ativar assinatura'
    );

    const botPatch = await db(`website_bots?bot_id=eq.${encodeURIComponent(existing.bot_id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        billing_status: 'active',
        payment_status: 'paid',
        plan: existing.plan || 'completo',
        updated_at: now.toISOString()
      })
    });
    if (!botPatch.ok) throw new Error(`Atualizar billing do SmartBot: ${(await botPatch.text()).slice(0, 500)}`);

    return reply(200, {
      success: true,
      botId: existing.bot_id,
      status: 'active',
      currentPeriodEnd: periodEnd.toISOString(),
      subscription: updated[0] ? { id: updated[0].id, plan: updated[0].plan, amount_cents: updated[0].amount_cents } : null
    });
  } catch (error) {
    console.error('woovi-webhook', error);
    return reply(500, { success: false, error: error.message || 'webhook failure' });
  }
};
