const crypto = require('crypto');
const fetch = require('node-fetch');

const ALLOWED_STATUS = 'pending_setup';
const MAX_BODY_BYTES = 128 * 1024;

function clean(value, maxLength = 1000) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

function normalizeEmail(value) {
  return clean(value, 254).toLowerCase();
}

function normalizePhone(value) {
  return clean(value, 30).replace(/[^\d+]/g, '');
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function response(statusCode, body, origin = '') {
  const configuredOrigins = clean(process.env.MODO_ALLOWED_ORIGINS, 2000)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const allowOrigin = origin && configuredOrigins.includes(origin) ? origin : '';
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Partner-Key, Idempotency-Key'
  };

  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin;

  return {
    statusCode,
    headers,
    body: statusCode === 204 ? '' : JSON.stringify(body)
  };
}

function secureEquals(received, expected) {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getSupabaseConfig() {
  const baseUrl = clean(process.env.SUPABASE_URL, 500).replace(/\/$/, '');
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !apiKey) throw new Error('Supabase não configurado para a integração Modo.');
  return { baseUrl, apiKey };
}

async function supabase(path, options = {}) {
  const { baseUrl, apiKey } = getSupabaseConfig();
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

function buildFingerprint(payload) {
  return crypto
    .createHash('sha256')
    .update([
      payload.partner,
      payload.plan,
      payload.businessName.toLowerCase(),
      payload.email,
      payload.phone
    ].join('|'))
    .digest('hex');
}

function sanitizePayload(data) {
  return {
    partner: clean(data.partner, 30).toLowerCase(),
    plan: clean(data.plan, 30).toLowerCase(),
    businessName: clean(data.businessName, 160),
    ownerName: clean(data.ownerName, 160),
    email: normalizeEmail(data.email),
    phone: normalizePhone(data.phone),
    instagram: clean(data.instagram, 160),
    website: clean(data.website, 500),
    segment: clean(data.segment, 160),
    services: clean(data.services, 5000),
    openingHours: clean(data.openingHours, 2500),
    faq: clean(data.faq, 10000),
    prices: clean(data.prices, 5000),
    welcomeMessage: clean(data.welcomeMessage, 1500),
    googleReviewLink: clean(data.googleReviewLink, 500),
    notes: clean(data.notes, 5000),
    dataProcessingAccepted: data.dataProcessingAccepted === true
  };
}

function validate(payload) {
  const errors = [];

  if (payload.partner !== 'modo') errors.push({ field: 'partner', message: 'Deve ser modo.' });
  if (payload.plan !== 'presenca') errors.push({ field: 'plan', message: 'Deve ser presenca.' });

  for (const field of ['businessName', 'ownerName', 'email', 'phone', 'segment']) {
    if (!payload[field]) errors.push({ field, message: 'Campo obrigatório.' });
  }

  if (payload.email && !validEmail(payload.email)) {
    errors.push({ field: 'email', message: 'E-mail inválido.' });
  }

  if (payload.phone && payload.phone.replace(/\D/g, '').length < 10) {
    errors.push({ field: 'phone', message: 'Telefone inválido.' });
  }

  if (!payload.dataProcessingAccepted) {
    errors.push({ field: 'dataProcessingAccepted', message: 'O consentimento é obrigatório.' });
  }

  return errors;
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return response(204, null, origin);
  }

  if (event.httpMethod !== 'POST') {
    return response(405, { success: false, error: 'method_not_allowed' }, origin);
  }

  try {
    const expectedKey = process.env.MODO_PARTNER_API_KEY;
    const receivedKey = event.headers?.['x-partner-key'] || event.headers?.['X-Partner-Key'];

    if (!expectedKey) {
      console.error('[Modo Intake] MODO_PARTNER_API_KEY ausente.');
      return response(500, { success: false, error: 'server_configuration_error' }, origin);
    }

    if (!secureEquals(receivedKey, expectedKey)) {
      return response(401, { success: false, error: 'unauthorized_partner' }, origin);
    }

    const rawBody = event.body || '';
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      return response(413, { success: false, error: 'payload_too_large' }, origin);
    }

    let data;
    try {
      data = JSON.parse(rawBody || '{}');
    } catch {
      return response(400, { success: false, error: 'invalid_json' }, origin);
    }

    const payload = sanitizePayload(data);
    const errors = validate(payload);
    if (errors.length) {
      return response(422, { success: false, error: 'validation_error', fields: errors }, origin);
    }

    const headerIdempotencyKey = clean(
      event.headers?.['idempotency-key'] || event.headers?.['Idempotency-Key'],
      200
    );
    const idempotencyKey = headerIdempotencyKey || buildFingerprint(payload);

    const existingResponse = await supabase(
      `partner_smartbots_intakes?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status&limit=1`,
      { method: 'GET' }
    );

    if (!existingResponse.ok) {
      throw new Error(`Falha ao verificar duplicidade: ${await existingResponse.text()}`);
    }

    const existing = await existingResponse.json();
    if (existing.length) {
      return response(200, {
        success: true,
        duplicate: true,
        intakeId: existing[0].id,
        status: existing[0].status
      }, origin);
    }

    const now = new Date().toISOString();
    const record = {
      partner: 'modo',
      plan: 'presenca',
      product: 'smartbots_assisted',
      status: ALLOWED_STATUS,
      business_name: payload.businessName,
      owner_name: payload.ownerName,
      email: payload.email,
      phone: payload.phone,
      instagram: payload.instagram || null,
      website: payload.website || null,
      segment: payload.segment,
      services: payload.services || null,
      opening_hours: payload.openingHours || null,
      faq: payload.faq || null,
      prices: payload.prices || null,
      welcome_message: payload.welcomeMessage || null,
      google_review_link: payload.googleReviewLink || null,
      notes: payload.notes || null,
      consent_accepted: true,
      consent_accepted_at: now,
      idempotency_key: idempotencyKey,
      source: 'modo_onboarding',
      raw_payload: data,
      created_at: now,
      updated_at: now
    };

    const insertResponse = await supabase('partner_smartbots_intakes', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(record)
    });

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();
      if (insertResponse.status === 409 || errorText.includes('duplicate key')) {
        const duplicateResponse = await supabase(
          `partner_smartbots_intakes?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status&limit=1`,
          { method: 'GET' }
        );
        const duplicate = duplicateResponse.ok ? await duplicateResponse.json() : [];
        return response(200, {
          success: true,
          duplicate: true,
          intakeId: duplicate[0]?.id || null,
          status: duplicate[0]?.status || ALLOWED_STATUS
        }, origin);
      }
      throw new Error(`Falha ao salvar solicitação: ${errorText}`);
    }

    const created = await insertResponse.json();
    const intake = created[0];

    return response(201, {
      success: true,
      duplicate: false,
      intakeId: intake.id,
      status: intake.status,
      nextStep: 'A equipe SmartBots recebeu os dados para iniciar a implantação assistida.'
    }, origin);
  } catch (error) {
    console.error('[Modo Intake]', error);
    return response(500, {
      success: false,
      error: 'internal_error',
      message: 'Não foi possível registrar a solicitação.'
    }, origin);
  }
};
