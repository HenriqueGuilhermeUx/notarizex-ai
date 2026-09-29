const agent = require('./lib/scheduling-agent');
const core = require('./lib/scheduling-core');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-SmartBots-Internal-Key',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

async function legacyBot(botId, clientToken) {
  if (!botId || !clientToken) return null;
  const response = await core.db(`website_bots?bot_id=eq.${encodeURIComponent(botId)}&client_token=eq.${encodeURIComponent(clientToken)}&select=bot_id&limit=1`);
  if (!response.ok) return null;
  return (await response.json())[0] || null;
}

async function authenticate(event, body) {
  const internalKey = process.env.SMARTBOTS_INTERNAL_KEY;
  const suppliedKey = event.headers?.['x-smartbots-internal-key'] || event.headers?.['X-SmartBots-Internal-Key'];
  if (internalKey && suppliedKey === internalKey && body.botId) return true;
  const botId = core.clean(body.botId, 160);
  const clientToken = core.clean(body.clientToken, 300);
  return Boolean(await legacyBot(botId, clientToken));
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    if (!await authenticate(event, body)) return reply(403, { success: false, error: 'Credencial invalida' });
    const result = await agent.handle(body);
    return reply(200, { success: true, ...result });
  } catch (error) {
    console.error('scheduling-agent', error);
    const message = error.message || 'Erro interno';
    const status = /obrigatorio|invalido|indisponivel|nao encontrado/i.test(message) ? 400 : 500;
    return reply(status, { success: false, error: message });
  }
};
