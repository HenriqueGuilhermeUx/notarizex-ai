const fetch = require('node-fetch');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

const plans = {
  site: { title: 'SmartBots - Bot para Site', price: 79 },
  whatsapp: { title: 'SmartBots - Bot WhatsApp', price: 129 },
  'Bot para Site': { title: 'SmartBots - Bot para Site', price: 79 },
  'Bot WhatsApp': { title: 'SmartBots - Bot WhatsApp', price: 129 },
  'Básico': { title: 'SmartBots - Bot para Site', price: 79 },
  Pro: { title: 'SmartBots - Bot WhatsApp', price: 129 }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const { plan, customerName, customerEmail, botId } = JSON.parse(event.body || '{}');
    if (!plan || !customerName || !customerEmail) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Plano, nome e e-mail são obrigatórios.' }) };
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Mercado Pago não configurado.' }) };

    const selected = plans[plan];
    if (!selected) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Plano inválido.' }) };

    const ref = botId ? `${plan}:${botId}` : `${plan}:${Date.now()}`;
    const preferenceData = {
      items: [{ title: selected.title, description: 'Assinatura mensal SmartBots.club', quantity: 1, currency_id: 'BRL', unit_price: selected.price }],
      payer: { name: customerName, email: customerEmail },
      back_urls: { success: 'https://smartbots.club?payment=success', failure: 'https://smartbots.club?payment=failure', pending: 'https://smartbots.club?payment=pending' },
      auto_return: 'approved',
      statement_descriptor: 'SMARTBOTS',
      external_reference: ref,
      notification_url: 'https://smartbots.club/.netlify/functions/payment-webhook'
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
      body: JSON.stringify(preferenceData)
    });

    if (!response.ok) throw new Error('Falha ao criar link de pagamento: ' + await response.text());
    const preference = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify({ paymentUrl: preference.init_point || preference.sandbox_init_point, preferenceId: preference.id, amount: selected.price }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
