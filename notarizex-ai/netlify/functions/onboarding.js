const fetch = require('node-fetch');
const crypto = require('crypto');
const cheerio = require('cheerio');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function parseUploadedFile(dataUrl) {
  if (!dataUrl) return null;
  const raw = String(dataUrl);
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const size = Buffer.from(match[2], 'base64').length;
  return { mime: match[1], base64: match[2], size };
}

async function scrapeWebsite(website) {
  const url = clean(website);
  if (!url || !/^https?:\/\//i.test(url)) return { status: 'not_provided', text: '', chars: 0 };

  try {
    const res = await fetch(url, { timeout: 12000, headers: { 'User-Agent': 'SmartBotsKnowledgeBot/1.0' } });
    if (!res.ok) return { status: `failed_${res.status}`, text: '', chars: 0 };

    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe, canvas').remove();

    const title = clean($('title').first().text());
    const description = clean($('meta[name="description"]').attr('content'));
    const headings = $('h1,h2,h3').map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 40).join('\n');
    const body = clean($('body').text()).slice(0, 18000);
    const text = [`Título: ${title}`, `Descrição: ${description}`, `Tópicos:\n${headings}`, `Conteúdo:\n${body}`].join('\n\n');

    return { status: 'ok', text, chars: text.length };
  } catch (error) {
    return { status: 'failed_' + error.message.slice(0, 80), text: '', chars: 0 };
  }
}

async function createPaymentLink({ botId, ownerName, ownerEmail, companyName }) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return null;

  const preference = {
    items: [{ title: `SmartBots - Bot para Site - ${companyName}`, description: 'Assinatura mensal SmartBots.club', quantity: 1, currency_id: 'BRL', unit_price: 79 }],
    payer: { name: ownerName, email: ownerEmail },
    back_urls: {
      success: `https://smartbots.club/dashboard-cliente.html?bot_id=${encodeURIComponent(botId)}&payment=success`,
      failure: 'https://smartbots.club/?payment=failure',
      pending: 'https://smartbots.club/?payment=pending'
    },
    auto_return: 'approved',
    statement_descriptor: 'SMARTBOTS',
    external_reference: `site:${botId}`,
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

async function saveWebsiteBot(record) {
  const baseUrl = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !apiKey) throw new Error('Supabase não configurado.');

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
    const fileName = clean(data.fileName || '');
    const uploaded = parseUploadedFile(data.fileData || data.pdfFile);

    if (!ownerName || !ownerEmail || !ownerWhatsApp || !companyName) {
      return reply(400, { success: false, error: 'Nome, e-mail, WhatsApp e empresa são obrigatórios.' });
    }

    if (uploaded && uploaded.size > 6 * 1024 * 1024) {
      return reply(400, { success: false, error: 'Arquivo muito grande. Envie PDF/documento de até 6MB nesta etapa.' });
    }

    const botId = `site-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const clientToken = `SB-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const scraped = await scrapeWebsite(website);
    const paymentLink = await createPaymentLink({ botId, ownerName, ownerEmail, companyName });

    const knowledgeText = [
      `Empresa: ${companyName}`,
      `Canal: Bot para Site`,
      `Site: ${website || 'não informado'}`,
      `Resumo informado pelo cliente:\n${businessDescription || 'não informado'}`,
      scraped.text ? `Conteúdo importado do site:\n${scraped.text}` : '',
      uploaded ? `Documento enviado pelo cliente: ${fileName || 'arquivo enviado'} (${uploaded.mime}, ${uploaded.size} bytes).` : ''
    ].filter(Boolean).join('\n\n---\n\n').slice(0, 50000);

    await saveWebsiteBot({
      bot_id: botId,
      client_token: clientToken,
      company_name: companyName,
      website,
      email: ownerEmail,
      owner_name: ownerName,
      owner_whatsapp: ownerWhatsApp,
      business_description: businessDescription,
      knowledge_text: knowledgeText,
      knowledge_status: scraped.status,
      uploaded_file_name: fileName || null,
      uploaded_file_mime: uploaded ? uploaded.mime : null,
      uploaded_file_size_bytes: uploaded ? uploaded.size : null,
      uploaded_file_base64: uploaded ? uploaded.base64 : null,
      plan: 'site',
      status: 'pending_payment',
      payment_link: paymentLink,
      created_at: new Date().toISOString()
    });

    return reply(200, {
      success: true,
      product: 'site',
      botId,
      clientToken,
      paymentLink,
      companyName,
      knowledgeStatus: scraped.status,
      scrapedChars: scraped.chars,
      uploadedFile: uploaded ? fileName : null,
      dashboardUrl: '/dashboard-cliente.html',
      message: 'Bot para Site criado com base inicial de conhecimento. Complete o pagamento para ativar.'
    });
  } catch (error) {
    return reply(500, { success: false, error: error.message || 'Erro ao criar Bot para Site' });
  }
};
