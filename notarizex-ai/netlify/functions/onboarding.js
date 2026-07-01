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

    return reply(200, {
      success: true,
      product: 'site',
      botId,
      clientToken,
      companyName,
      website,
      businessDescription,
      dashboardUrl: '/dashboard-cliente.html',
      message: 'Bot para Site criado. Use o token para acessar o painel.'
    });
  } catch (error) {
    return reply(500, { success: false, error: error.message || 'Erro ao criar Bot para Site' });
  }
};
