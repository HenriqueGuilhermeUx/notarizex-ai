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

async function updateBot(table, botId, data) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !botId) return false;

  const res = await fetch(`${url}/rest/v1/${table}?bot_id=eq.${encodeURIComponent(botId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=representation'
    },
    body: JSON.stringify(data)
  });
  return res.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const payload = JSON.parse(event.body || '{}');
    const paymentId = payload && payload.data && payload.data.id;
    if (!paymentId || !process.env.MERCADOPAGO_ACCESS_TOKEN) return response({ status: 'ignored' });

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` }
    });
    if (!paymentRes.ok) return response({ status: 'payment_not_found' });

    const payment = await paymentRes.json();
    if (payment.status !== 'approved') return response({ status: payment.status || 'not_approved' });

    const reference = String(payment.external_reference || '');
    const parts = reference.split(':');
    const product = parts[0];
    const botId = parts[1] || reference;
    const data = { status: 'active', payment_status: 'approved', payment_id: String(paymentId), updated_at: new Date().toISOString() };

    if (product === 'site') await updateBot('website_bots', botId, data);
    if (product === 'whatsapp') await updateBot('whatsapp_bots', botId, data);

    return response({ status: 'activated', product, botId });
  } catch (error) {
    console.error('[Payment Webhook]', error.message);
    return response({ status: 'ok_with_error_logged' });
  }
};
