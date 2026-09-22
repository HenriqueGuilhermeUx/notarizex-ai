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

function clean(value) {
  return String(value || '').trim();
}

async function db(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase não configurado.');

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
    provider: c.provider || 'manual',
    phone: c.phone || '',
    businessName: c.business_name || companyName || '',
    greeting: c.greeting || '',
    awayMessage: c.away_message || '',
    humanMessage: c.human_message || '',
    autoReply: c.auto_reply === true,
    status: c.status || 'pending',
    connected: c.status === 'connected' && Boolean(c.provider_phone_number_id),
    providerPhoneNumberId: c.provider_phone_number_id || null,
    connectedAt: c.connected_at || null
  };
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

    if (action === 'save') {
      const isConnected = existing && existing.status === 'connected' && Boolean(existing.provider_phone_number_id);
      const provider = existing?.provider || 'manual';
      const webhookUrl = provider === 'kapso'
        ? 'https://smartbots.club/.netlify/functions/kapso-webhook'
        : 'https://smartbots.club/.netlify/functions/whatsapp-webhook';

      const patch = {
        bot_id: botId,
        mode: clean(body.mode) || existing?.mode || 'assisted',
        provider,
        phone: clean(body.phone) || existing?.phone || null,
        business_name: clean(body.businessName) || existing?.business_name || bot.company_name,
        greeting: clean(body.greeting),
        away_message: clean(body.awayMessage),
        human_message: clean(body.humanMessage),
        auto_reply: isConnected ? body.autoReply === true : false,
        webhook_url: webhookUrl,
        status: existing?.status || 'pending',
        updated_at: new Date().toISOString()
      };

      let saveRes;
      if (existing) {
        saveRes = await db(`smartbot_whatsapp_config?id=eq.${encodeURIComponent(existing.id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(patch)
        });
      } else {
        saveRes = await db('smartbot_whatsapp_config', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(patch)
        });
      }

      const saved = await rows(saveRes, 'Salvar configuração WhatsApp');
      const config = publicConfig(saved[0], bot.company_name);
      return reply(200, {
        success: true,
        config,
        message: config.connected
          ? 'Configuração salva. O WhatsApp conectado continuará usando este mesmo Brain.'
          : 'Preferências salvas. A conexão do número ainda precisa ser concluída pelo fluxo seguro do provedor.'
      });
    }

    return reply(200, {
      success: true,
      config: publicConfig(existing, bot.company_name),
      connection: {
        providerManaged: true,
        note: 'Identificadores do provedor não podem ser definidos pelo navegador do cliente. Eles são associados somente após validação do provedor para evitar sequestro de números.'
      }
    });
  } catch (error) {
    console.error('[WhatsAppConfig]', error.message);
    return reply(500, { success: false, error: error.message || 'Falha ao configurar WhatsApp.' });
  }
};
