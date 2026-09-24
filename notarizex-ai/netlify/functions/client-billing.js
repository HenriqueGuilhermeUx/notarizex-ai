const crypto = require('crypto');
const fetch = require('node-fetch');
const { resolvePortalSession } = require('./lib/client-portal-session');
const { PLANS, FOUNDER_LIMIT } = require('./lib/commercial-plans');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://smartbots.club',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function env(name) {
  return String(process.env[name] || '').trim();
}

function apiBase() {
  return env('WOOVI_ENV') === 'sandbox' ? 'https://api.woovi-sandbox.com' : 'https://api.openpix.com.br';
}

async function db(path, options = {}) {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Billing database não configurado.');
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
  if (!response.ok) throw new Error(`${label}: ${(await response.text()).slice(0, 500)}`);
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

function publicSubscription(row) {
  if (!row) return null;
  const plan = row.plan === 'fundador' ? PLANS.fundador : PLANS.completo;
  return {
    status: row.status,
    planCode: plan.code,
    planName: plan.name,
    amountCents: row.amount_cents || plan.amountCents,
    billingCycle: row.billing_cycle || 'monthly',
    currentPeriodStart: row.current_period_start || null,
    currentPeriodEnd: row.current_period_end || null,
    paidAt: row.paid_at || null,
    paymentLink: row.woovi_payment_link || null,
    brCode: row.woovi_br_code || null,
    qrCodeImage: row.woovi_qr_code_image || null,
    providerStatus: row.woovi_status || null
  };
}

async function subscriptionFor(botId) {
  const result = await rows(
    await db(`smartbot_subscriptions?bot_id=eq.${encodeURIComponent(botId)}&select=*&limit=1`),
    'Carregar assinatura'
  );
  return result[0] || null;
}

async function founderSlots() {
  const result = await rows(
    await db('smartbot_subscriptions?plan=eq.fundador&select=bot_id,status'),
    'Consultar oferta de lançamento'
  );
  const reserved = new Set(
    result.filter(x => ['pending', 'active'].includes(String(x.status || '').toLowerCase())).map(x => x.bot_id)
  ).size;
  return { limit: FOUNDER_LIMIT, reserved, available: Math.max(0, FOUNDER_LIMIT - reserved) };
}

async function choosePlan(botId, existing) {
  if (existing && existing.plan === 'fundador') return PLANS.fundador;
  const slots = await founderSlots();
  if (slots.available > 0) return PLANS.fundador;
  return PLANS.completo;
}

function activePeriod(row) {
  if (!row || row.status !== 'active' || !row.current_period_end) return false;
  return new Date(row.current_period_end).getTime() > Date.now();
}

function reusablePending(row) {
  return Boolean(row && row.status === 'pending' && (row.woovi_payment_link || row.woovi_br_code));
}

async function saveSubscription(bot, existing, plan, correlationID, charge, raw) {
  const patch = {
    bot_id: bot.bot_id,
    company_name: bot.company_name || 'SmartBots',
    customer_email: bot.email || bot.owner_email || null,
    plan: plan.code,
    status: 'pending',
    amount_cents: plan.amountCents,
    billing_cycle: plan.billingCycle,
    woovi_correlation_id: correlationID,
    woovi_charge_id: charge.globalID || charge.chargeId || charge.id || '',
    woovi_payment_link: charge.paymentLinkUrl || '',
    woovi_qr_code_image: charge.qrCodeImage || '',
    woovi_br_code: charge.brCode || (charge.paymentMethods && charge.paymentMethods.pix && charge.paymentMethods.pix.brCode) || '',
    woovi_status: charge.status || 'ACTIVE',
    woovi_payload: raw,
    updated_at: new Date().toISOString()
  };

  let response;
  if (existing) {
    response = await db(`smartbot_subscriptions?id=eq.${encodeURIComponent(existing.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch)
    });
  } else {
    response = await db('smartbot_subscriptions', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch)
    });
  }
  return (await rows(response, 'Salvar assinatura'))[0];
}

async function createCharge(bot, existing) {
  if (activePeriod(existing)) {
    return { reused: true, active: true, subscription: publicSubscription(existing) };
  }
  if (reusablePending(existing)) {
    return { reused: true, active: false, subscription: publicSubscription(existing) };
  }

  const token = env('WOOVI_TOKEN') || env('OPENPIX_TOKEN');
  if (!token) throw new Error('Pagamento Pix temporariamente indisponível.');
  const plan = await choosePlan(bot.bot_id, existing);
  const correlationID = `sb_${bot.bot_id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const payload = {
    correlationID,
    value: plan.amountCents,
    comment: `${plan.name} — mensal`,
    customer: {
      name: bot.company_name || 'Cliente SmartBots',
      email: bot.email || bot.owner_email || ''
    }
  };

  const response = await fetch(`${apiBase()}/api/v1/charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Não foi possível gerar o Pix agora. Tente novamente em instantes.');
  const charge = raw.charge || raw;
  const saved = await saveSubscription(bot, existing, plan, correlationID, charge, raw);
  return { reused: false, active: false, subscription: publicSubscription(saved) };
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const bot = await resolvePortalSession(body.portalToken);
    if (!bot) return reply(401, { success: false, error: 'Sessão expirada. Entre novamente no painel.' });

    const existing = await subscriptionFor(bot.bot_id);
    if (body.action === 'status') {
      const slots = await founderSlots();
      const offered = existing && existing.plan === 'fundador' ? PLANS.fundador : (slots.available > 0 ? PLANS.fundador : PLANS.completo);
      return reply(200, {
        success: true,
        companyName: bot.company_name || 'SmartBot',
        subscription: publicSubscription(existing),
        offer: {
          planCode: offered.code,
          planName: offered.name,
          amountCents: offered.amountCents,
          regularAmountCents: PLANS.completo.amountCents,
          founderSlotsRemaining: slots.available,
          founderLimit: slots.limit,
          trialEndsAt: bot.trial_ends_at || null,
          billingStatus: bot.billing_status || null
        }
      });
    }

    if (body.action === 'create_pix') {
      const result = await createCharge(bot, existing);
      return reply(200, { success: true, ...result });
    }

    return reply(400, { success: false, error: 'Ação inválida.' });
  } catch (error) {
    console.error('client-billing', error);
    return reply(500, { success: false, error: error.message || 'Falha no billing.' });
  }
};
