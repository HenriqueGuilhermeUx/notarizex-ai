const fetch = require('node-fetch');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

function response(body) {
  return { statusCode: 200, headers, body: JSON.stringify(body) };
}

function clean(value) {
  return String(value || '').trim();
}

function dbConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase não configurado');
  return { url, key };
}

async function supabase(tablePath, options = {}) {
  const { url, key } = dbConfig();
  return fetch(`${url}/rest/v1/${tablePath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
}

async function getBot(table, botId) {
  const res = await supabase(`${table}?bot_id=eq.${encodeURIComponent(botId)}&select=bot_id,client_token,owner_email,owner_name,company_name,status,payment_status,payment_id&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

async function updateBot(table, botId, data) {
  if (!botId) return false;
  const res = await supabase(`${table}?bot_id=eq.${encodeURIComponent(botId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    console.error(`[Payment Webhook] ${table} update:`, (await res.text()).slice(0, 500));
    return false;
  }
  const rows = await res.json();
  return rows.length > 0;
}

function parseReference(reference) {
  const ref = clean(reference);
  if (!ref) return { product: null, botId: null };
  if (ref.startsWith('site:')) return { product: 'site', botId: ref.slice(5) };
  if (ref.startsWith('whatsapp:')) return { product: 'whatsapp', botId: ref.slice(9) };
  if (ref.startsWith('site-')) return { product: 'site', botId: ref };
  if (ref.startsWith('whatsapp-')) return { product: 'whatsapp', botId: ref };
  return { product: null, botId: ref };
}

async function sendCredentials(bot, product) {
  if (!bot || !bot.owner_email || !bot.client_token || !process.env.RESEND_API_KEY) return false;

  const company = bot.company_name || 'seu SmartBot';
  const channelLabel = product === 'whatsapp' ? 'WhatsApp' : 'Site';
  const body = [
    `Olá${bot.owner_name ? `, ${bot.owner_name}` : ''}!`,
    '',
    `O pagamento do SmartBots para ${company} foi aprovado e o canal ${channelLabel} está liberado.`,
    '',
    `Bot ID: ${bot.bot_id}`,
    `Client Token: ${bot.client_token}`,
    '',
    'Guarde essas credenciais. Elas identificam o seu SmartBot e permitem acessar/configurar o Painel do Cliente.',
    '',
    'Painel: https://smartbots.club/dashboard',
    '',
    'SmartBots'
  ].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'SmartBots <noreply@smartbots.club>',
      to: bot.owner_email,
      subject: `SmartBots ativado - ${company}`,
      text: body
    })
  });

  if (!res.ok) {
    console.error('[Payment Webhook] Resend:', (await res.text()).slice(0, 500));
    return false;
  }
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const payload = JSON.parse(event.body || '{}');
    const paymentId = payload && payload.data && payload.data.id;
    if (!paymentId || !process.env.MERCADOPAGO_ACCESS_TOKEN) return response({ status: 'ignored' });

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` }
    });
    if (!paymentRes.ok) return response({ status: 'payment_not_found' });

    const payment = await paymentRes.json();
    if (payment.status !== 'approved') return response({ status: payment.status || 'not_approved' });

    const { product, botId } = parseReference(payment.external_reference);
    if (!botId) return response({ status: 'ignored_missing_reference' });

    let target = null;
    let resolvedProduct = product;

    if (product === 'site') {
      target = await getBot('website_bots', botId);
    } else if (product === 'whatsapp') {
      target = await getBot('whatsapp_bots', botId);
    } else {
      target = await getBot('website_bots', botId);
      if (target) resolvedProduct = 'site';
      if (!target) {
        target = await getBot('whatsapp_bots', botId);
        if (target) resolvedProduct = 'whatsapp';
      }
    }

    if (!target || !resolvedProduct) return response({ status: 'bot_not_found', botId });

    const paymentIdText = String(paymentId);
    const alreadyProcessed = target.payment_status === 'approved' && target.payment_id === paymentIdText;
    const data = {
      status: 'active',
      payment_status: 'approved',
      payment_id: paymentIdText,
      updated_at: new Date().toISOString()
    };

    let activated = false;
    if (resolvedProduct === 'site') {
      activated = await updateBot('website_bots', botId, data);
    }
    if (resolvedProduct === 'whatsapp') {
      const channelActivated = await updateBot('whatsapp_bots', botId, data);
      const canonicalActivated = await updateBot('website_bots', botId, data);
      activated = channelActivated || canonicalActivated;
    }

    let credentialsSent = false;
    if (activated && !alreadyProcessed) {
      const credentialSource = resolvedProduct === 'whatsapp'
        ? (await getBot('website_bots', botId)) || target
        : (await getBot('website_bots', botId)) || target;
      credentialsSent = await sendCredentials(credentialSource, resolvedProduct);
    }

    return response({
      status: activated ? 'activated' : 'activation_failed',
      product: resolvedProduct,
      botId,
      credentialsSent
    });
  } catch (error) {
    console.error('[Payment Webhook]', error.message);
    return response({ status: 'ok_with_error_logged' });
  }
};
