const fetch = require('node-fetch');
const crypto = require('crypto');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

function clean(value) {
  return String(value || '').trim();
}

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

async function saveWhatsappBot(record) {
  const baseUrl = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !apiKey) return null;

  const response = await fetch(`${baseUrl}/rest/v1/whatsapp_bots`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Prefer: 'return=representation'
    },
    body: JSON.stringify(record)
  });

  if (!response.ok) throw new Error('Falha ao salvar Bot WhatsApp: ' + await response.text());
  return response.json();
}

async function createPaymentLink({ botId, ownerName, ownerEmail, companyName }) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return null;

  const preference = {
    items: [{ title: `SmartBots - Bot WhatsApp - ${companyName}`, description: 'Assinatura mensal SmartBots.club', quantity: 1, currency_id: 'BRL', unit_price: 129 }],
    payer: { name: ownerName, email: ownerEmail },
    back_urls: {
      success: `https://smartbots.club?payment=success&bot_id=${encodeURIComponent(botId)}`,
      failure: 'https://smartbots.club/?payment=failure',
      pending: 'https://smartbots.club/?payment=pending'
    },
    auto_return: 'approved',
    statement_descriptor: 'SMARTBOTS',
    external_reference: `whatsapp:${botId}`,
    notification_url: 'https://smartbots.club/.netlify/functions/payment-webhook'
  };

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
    body: JSON.stringify(preference)
  });

  if (!response.ok) throw new Error('Falha ao criar pagamento: ' + await response.text());
  const data = await response.json();
  return data.init_point || data.sandbox_init_point || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });

  try {
    const data = JSON.parse(event.body || '{}');
    const ownerName = clean(data.ownerName);
    const ownerEmail = clean(data.ownerEmail).toLowerCase();
    const ownerWhatsApp = clean(data.ownerWhatsApp);
    const companyName = clean(data.companyName);
    const website = clean(data.website);
    const businessDescription = clean(data.businessDescription);

    if (!ownerName || !ownerEmail || !ownerWhatsApp || !companyName || !businessDescription) {
      return reply(400, { success: false, error: 'Nome, e-mail, WhatsApp, empresa e descrição são obrigatórios.' });
    }

    const botId = `whatsapp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const clientToken = `SBW-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const paymentLink = await createPaymentLink({ botId, ownerName, ownerEmail, companyName });

    await saveWhatsappBot({
      bot_id: botId,
      client_token: clientToken,
      owner_name: ownerName,
      owner_email: ownerEmail,
      owner_whatsapp: ownerWhatsApp,
      company_name: companyName,
      website,
      business_description: businessDescription,
      status: 'pending_payment',
      payment_link: paymentLink,
      created_at: new Date().toISOString()
    });

    return reply(200, {
      success: true,
      product: 'whatsapp',
      botId,
      clientToken,
      paymentLink,
      message: 'Bot WhatsApp criado. Complete o pagamento para ativar.'
    });
  } catch (error) {
    console.error('[WhatsApp Onboarding] Erro:', error.message);
    return reply(500, { success: false, error: error.message || 'Erro ao criar Bot WhatsApp' });
  }
};
