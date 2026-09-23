const fetch = require('node-fetch');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function clean(value, max = 0) {
  const out = String(value || '').trim();
  return max ? out.slice(0, max) : out;
}

async function db(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

async function rows(res, label) {
  if (!res.ok) throw new Error(`${label}: ${(await res.text()).slice(0, 700)}`);
  const raw = await res.text();
  return raw ? JSON.parse(raw) : [];
}

async function kapso(path, options = {}) {
  const key = process.env.KAPSO_API_KEY;
  if (!key) throw new Error('Kapso não configurado.');
  const res = await fetch(`https://api.kapso.ai/platform/v1${path}`, {
    ...options,
    headers: {
      'X-API-Key': key,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const raw = await res.text();
  let json = {};
  try { json = raw ? JSON.parse(raw) : {}; } catch { json = { error: raw }; }
  if (!res.ok) throw new Error(`Kapso ${res.status}: ${clean(json.error || json.message || raw, 700)}`);
  return json;
}

async function auth(botId, token) {
  const q = `website_bots?bot_id=eq.${encodeURIComponent(botId)}&client_token=eq.${encodeURIComponent(token)}&select=bot_id,company_name&limit=1`;
  const data = await rows(await db(q), 'Validar SmartBot');
  return data[0] || null;
}

async function currentConfig(botId) {
  const q = `smartbot_whatsapp_config?bot_id=eq.${encodeURIComponent(botId)}&select=*&limit=1`;
  const data = await rows(await db(q), 'Carregar configuração WhatsApp');
  return data[0] || null;
}

function publicConfig(config, companyName) {
  const c = config || {};
  return {
    mode: c.mode || 'assisted',
    provider: c.provider || 'kapso',
    phone: c.phone || '',
    businessName: c.business_name || companyName || '',
    greeting: c.greeting || '',
    awayMessage: c.away_message || '',
    humanMessage: c.human_message || '',
    autoReply: c.auto_reply === true,
    status: c.status || 'pending',
    connected: c.status === 'connected' && Boolean(c.provider_phone_number_id),
    providerPhoneNumberId: c.provider_phone_number_id || null,
    providerCustomerId: c.provider_customer_id || null,
    providerWabaId: c.provider_waba_id || null,
    setupExpiresAt: c.provider_setup_expires_at || null,
    connectionType: c.connection_type || null,
    metaBillingMode: c.meta_billing_mode || 'customer_managed',
    connectionError: c.connection_error || null,
    connectedAt: c.connected_at || null,
    lastCheckedAt: c.connection_last_checked_at || null,
    lifecycleStatus: c.provider_lifecycle_status || null,
    messageWebhookStatus: c.provider_message_webhook_status || null
  };
}

async function saveConnection(bot, existing, patch) {
  const payload = {
    bot_id: bot.bot_id,
    provider: 'kapso',
    business_name: existing?.business_name || bot.company_name,
    webhook_url: 'https://smartbots.club/.netlify/functions/kapso-webhook',
    updated_at: new Date().toISOString(),
    ...patch
  };
  const res = existing
    ? await db(`smartbot_whatsapp_config?id=eq.${encodeURIComponent(existing.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload)
      })
    : await db('smartbot_whatsapp_config', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload)
      });
  return (await rows(res, 'Salvar conexão WhatsApp'))[0];
}

function webhookSecret() {
  const secret = clean(process.env.KAPSO_WEBHOOK_TOKEN);
  if (!secret) throw new Error('KAPSO_WEBHOOK_TOKEN não configurado.');
  return secret;
}

async function ensureProjectWebhook() {
  const target = 'https://smartbots.club/.netlify/functions/kapso-platform-webhook';
  const secret = webhookSecret();
  const listed = await kapso('/whatsapp/webhooks?per_page=100');
  const hooks = Array.isArray(listed.data) ? listed.data : [];
  const existing = hooks.find(h => !h.phone_number_id && h.kind === 'kapso' && h.active === true && clean(h.url) === target);
  if (existing) return existing;

  const created = await kapso('/whatsapp/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      whatsapp_webhook: {
        url: target,
        secret_key: secret,
        events: [
          'whatsapp.phone_number.created',
          'whatsapp.phone_number.deleted',
          'whatsapp.phone_number.offboarded',
          'whatsapp.phone_number.disconnected',
          'whatsapp.phone_number.reconnected'
        ],
        active: true,
        payload_version: 'v2'
      }
    })
  });
  return created.data;
}

async function ensureMessageWebhook(phoneNumberId) {
  const secret = webhookSecret();
  const target = `https://smartbots.club/.netlify/functions/kapso-webhook?token=${encodeURIComponent(secret)}`;
  const listed = await kapso(`/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}/webhooks?per_page=100`);
  const hooks = Array.isArray(listed.data) ? listed.data : [];
  const existing = hooks.find(h => h.kind === 'kapso' && h.active === true && clean(h.url) === target);
  if (existing) return existing;

  const created = await kapso(`/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}/webhooks`, {
    method: 'POST',
    body: JSON.stringify({
      whatsapp_webhook: {
        url: target,
        secret_key: secret,
        events: [
          'whatsapp.message.received',
          'whatsapp.message.sent',
          'whatsapp.message.delivered',
          'whatsapp.message.read',
          'whatsapp.message.failed'
        ],
        active: true,
        payload_version: 'v2'
      }
    })
  });
  return created.data;
}

async function findKapsoCustomer(botId) {
  const result = await kapso(`/customers?external_customer_id=${encodeURIComponent(botId)}&per_page=1`);
  return Array.isArray(result.data) ? result.data[0] || null : null;
}

async function validKapsoCustomer(customerId) {
  if (!customerId) return null;
  try {
    const result = await kapso(`/customers/${encodeURIComponent(customerId)}`);
    return result.data || null;
  } catch (_) {
    return null;
  }
}

async function ensureKapsoCustomer(bot, existing) {
  const byExternalId = await findKapsoCustomer(bot.bot_id);
  if (byExternalId?.id) return byExternalId.id;

  const legacyCandidate = await validKapsoCustomer(existing?.provider_customer_id);
  if (legacyCandidate?.id) return legacyCandidate.id;

  const created = await kapso('/customers', {
    method: 'POST',
    body: JSON.stringify({
      customer: {
        name: clean(bot.company_name, 200) || bot.bot_id,
        external_customer_id: bot.bot_id
      }
    })
  });
  const customer = created.data;
  if (!customer?.id) throw new Error('Kapso não retornou customer_id.');
  return customer.id;
}

function kapsoPhoneId(phone) {
  return clean(phone?.phone_number_id || phone?.id);
}

async function persistConnectedPhone(bot, existing, connected) {
  const phoneNumberId = kapsoPhoneId(connected);
  if (!phoneNumberId) throw new Error('Kapso retornou número conectado sem phone_number_id.');

  const now = new Date().toISOString();
  const messageWebhook = await ensureMessageWebhook(phoneNumberId);
  const saved = await saveConnection(bot, existing, {
    provider_phone_number_id: phoneNumberId,
    provider_waba_id: clean(connected.business_account_id) || existing?.provider_waba_id || null,
    phone: clean(connected.display_phone_number_normalized || connected.display_phone_number) || existing?.phone || null,
    business_name: existing?.business_name || clean(connected.verified_name || connected.display_name) || bot.company_name,
    status: 'connected',
    connected_at: existing?.connected_at || now,
    connection_last_checked_at: now,
    connection_error: null,
    connection_type: connected.is_coexistence === true ? 'coexistence' : (existing?.connection_type || 'dedicated'),
    provider_lifecycle_status: 'connected',
    provider_message_webhook_id: messageWebhook?.id || existing?.provider_message_webhook_id || null,
    provider_message_webhook_status: messageWebhook?.active === true ? 'active' : 'unknown',
    provider_message_webhook_checked_at: now,
    auto_reply: existing?.auto_reply === true
  });

  return {
    config: publicConfig(saved, bot.company_name),
    setupStatus: 'completed',
    phone: {
      displayPhoneNumber: connected.display_phone_number || connected.display_phone_number_normalized || saved.phone || null,
      verifiedName: connected.verified_name || connected.display_name || saved.business_name || null,
      qualityRating: connected.quality_rating || null,
      connectionType: connected.is_coexistence === true ? 'coexistence' : (saved.connection_type || 'dedicated')
    }
  };
}

async function startConnection(bot, existing) {
  if (existing?.status === 'connected' && existing?.provider_phone_number_id) {
    return { alreadyConnected: true, config: publicConfig(existing, bot.company_name) };
  }

  try {
    await ensureProjectWebhook();
  } catch (error) {
    console.error('[WhatsAppConfig] lifecycle webhook:', error.message);
  }

  const customerId = await ensureKapsoCustomer(bot, existing);
  let saved = existing;
  if (!existing || existing.provider_customer_id !== customerId || existing.provider !== 'kapso') {
    saved = await saveConnection(bot, existing, {
      provider_customer_id: customerId,
      status: 'connecting',
      auto_reply: false,
      connection_error: null,
      meta_billing_mode: 'customer_managed'
    });
  }

  const successUrl = 'https://smartbots.club/whatsapp-config.html?kapso=success';
  const failureUrl = 'https://smartbots.club/whatsapp-config.html?kapso=failed';
  const result = await kapso(`/customers/${encodeURIComponent(customerId)}/setup_links`, {
    method: 'POST',
    body: JSON.stringify({
      setup_link: {
        success_redirect_url: successUrl,
        failure_redirect_url: failureUrl,
        allowed_origins: ['https://smartbots.club'],
        allowed_connection_types: ['coexistence', 'dedicated'],
        meta_billing_mode: 'customer_managed',
        language: 'pt',
        provision_phone_number: false
      }
    })
  });

  const link = result.data || {};
  if (!link.id || !link.url) throw new Error('Kapso não retornou o link de conexão.');

  saved = await saveConnection(bot, saved, {
    provider_customer_id: customerId,
    provider_setup_link_id: link.id,
    provider_setup_expires_at: link.expires_at || null,
    status: 'connecting',
    auto_reply: false,
    connection_error: null,
    meta_billing_mode: 'customer_managed',
    connection_last_checked_at: new Date().toISOString()
  });

  return {
    alreadyConnected: false,
    setupUrl: link.url,
    expiresAt: link.expires_at || null,
    config: publicConfig(saved, bot.company_name)
  };
}

async function connectionStatus(bot, existing) {
  if (!existing) {
    return { config: publicConfig(null, bot.company_name), setupStatus: 'not_started' };
  }

  // Legacy-safe path: a number that is already connected is validated directly by
  // phone_number_id. It must never depend on a Setup Link/Customer created later.
  if (existing.status === 'connected' && existing.provider_phone_number_id) {
    try {
      const direct = await kapso(`/whatsapp/phone_numbers/${encodeURIComponent(existing.provider_phone_number_id)}`);
      const phone = direct.data || {};
      if (!kapsoPhoneId(phone)) phone.phone_number_id = existing.provider_phone_number_id;
      return await persistConnectedPhone(bot, existing, phone);
    } catch (error) {
      // A transient/provider lookup failure must not downgrade an already working number.
      return {
        config: publicConfig(existing, bot.company_name),
        setupStatus: 'connected_verification_pending',
        setupError: error.message
      };
    }
  }

  if (!existing.provider_customer_id) {
    return { config: publicConfig(existing, bot.company_name), setupStatus: 'not_started' };
  }

  const customerId = existing.provider_customer_id;
  const phones = await kapso(`/whatsapp/phone_numbers?customer_id=${encodeURIComponent(customerId)}&per_page=20`);
  const list = Array.isArray(phones.data) ? phones.data : [];
  const connected = list.find(p => String(p.status || '').toUpperCase() === 'CONNECTED') || list.find(p => p.messaging_enabled === true) || null;
  const now = new Date().toISOString();

  if (connected) {
    return persistConnectedPhone(bot, existing, connected);
  }

  let setupStatus = 'pending';
  let setupError = null;
  try {
    const links = await kapso(`/customers/${encodeURIComponent(customerId)}/setup_links`);
    const all = Array.isArray(links.data) ? links.data : [];
    const selected = all.find(l => l.id === existing.provider_setup_link_id) || all[0];
    if (selected) {
      setupStatus = selected.whatsapp_setup_status || selected.status || 'pending';
      setupError = selected.whatsapp_setup_error || null;
    }
  } catch (error) {
    setupError = error.message;
  }

  const saved = await saveConnection(bot, existing, {
    status: setupStatus === 'failed' ? 'connection_failed' : 'connecting',
    connection_last_checked_at: now,
    connection_error: setupError
  });

  return { config: publicConfig(saved, bot.company_name), setupStatus, setupError };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const botId = clean(body.botId);
    const clientToken = clean(body.clientToken);
    const action = clean(body.action || 'get');

    if (!botId || !clientToken) {
      return reply(400, { success: false, error: 'botId e clientToken são obrigatórios.' });
    }

    const bot = await auth(botId, clientToken);
    if (!bot) return reply(403, { success: false, error: 'Acesso negado.' });

    const existing = await currentConfig(botId);

    if (action === 'connect_start') {
      const result = await startConnection(bot, existing);
      return reply(200, { success: true, ...result });
    }

    if (action === 'connect_status') {
      const result = await connectionStatus(bot, existing);
      return reply(200, { success: true, ...result });
    }

    if (action === 'save') {
      const isConnected = existing && existing.status === 'connected' && Boolean(existing.provider_phone_number_id);
      const patch = {
        bot_id: botId,
        mode: clean(body.mode) || existing?.mode || 'assisted',
        provider: existing?.provider || 'kapso',
        phone: existing?.phone || null,
        business_name: clean(body.businessName, 200) || existing?.business_name || bot.company_name,
        greeting: clean(body.greeting, 2000),
        away_message: clean(body.awayMessage, 2000),
        human_message: clean(body.humanMessage, 2000),
        auto_reply: isConnected ? body.autoReply === true : false,
        webhook_url: 'https://smartbots.club/.netlify/functions/kapso-webhook',
        status: existing?.status || 'pending',
        updated_at: new Date().toISOString()
      };

      const saved = await saveConnection(bot, existing, patch);
      const config = publicConfig(saved, bot.company_name);
      return reply(200, {
        success: true,
        config,
        message: config.connected
          ? 'Configuração salva. O número conectado usa este mesmo Brain.'
          : 'Preferências salvas. Conclua a conexão segura do WhatsApp para ativar respostas.'
      });
    }

    return reply(200, {
      success: true,
      config: publicConfig(existing, bot.company_name),
      connection: {
        providerManaged: true,
        canStart: !existing?.provider_phone_number_id,
        metaBillingMode: 'customer_managed',
        allowedConnectionTypes: ['coexistence', 'dedicated'],
        note: 'A conexão é feita por setup link oficial da Kapso/Meta. O cliente nunca informa phone_number_id manualmente.'
      }
    });
  } catch (error) {
    console.error('[WhatsAppConfig]', error.message);
    return reply(500, { success: false, error: error.message || 'Falha ao configurar WhatsApp.' });
  }
};
