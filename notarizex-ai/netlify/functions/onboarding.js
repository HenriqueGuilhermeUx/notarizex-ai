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

async function saveWebsiteBot(record) {
  const baseUrl = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !apiKey) return null;

  const response = await fetch(`${baseUrl}/rest/v1/website_bots`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Prefer: 'return=representation'
    },
    body: JSON.stringify(record)
  });

  if (!response.ok) throw new Error('Falha ao salvar Bot para Site: ' + await response.text());
  return response.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });

  try {
    const data = JSON.parse(event.body || '{}');
    const ownerName = clean(data.ownerName || data.name);
    const ownerEmail = clean(data.ownerEmail || data.email).toLowerCase();
    const ownerWhatsApp = clean(data.ownerWhatsApp || data.whatsapp);
    const companyName = clean(data.companyName || data.company || ownerName);
    const website = clean(data.website);
    const businessDescription = clean(data.businessDescription || data.description || '');

    if (!ownerName || !ownerEmail || !ownerWhatsApp || !companyName) {
      return reply(400, { success: false, error: 'Nome, e-mail, WhatsApp e empresa são obrigatórios.' });
    }

    const botId = `site-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const clientToken = `SB-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    await saveWebsiteBot({
      bot_id: botId,
      client_token: clientToken,
      company_name: companyName,
      website,
      email: ownerEmail,
      owner_name: ownerName,
      owner_whatsapp: ownerWhatsApp,
      business_description: businessDescription,
      plan: 'site',
      status: 'pending_payment',
      created_at: new Date().toISOString()
    });

    return reply(200, {
      success: true,
      product: 'site',
      botId,
      clientToken,
      companyName,
      dashboardUrl: '/dashboard-cliente.html',
      message: 'Bot para Site criado. Use o token para acessar o painel.'
    });
  } catch (error) {
    return reply(500, { success: false, error: error.message || 'Erro ao criar Bot para Site' });
  }
};
