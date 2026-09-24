const crypto = require('crypto');
const fetch = require('node-fetch');
const { createPortalSession } = require('./lib/client-portal-session');

const PURPOSE = 'client_portal_login';
const LOGIN_TTL_MS = 20 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const ALLOWED_NEXT = new Set(['/dashboard','/dashboard-cliente.html','/operacao','/operacao-cliente.html','/agenda-pro.html','/assinatura.html','/assinar']);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST',
  'Cache-Control': 'no-store'
};

function reply(statusCode, body) { return { statusCode, headers, body: JSON.stringify(body) }; }
function clean(value) { return String(value || '').trim(); }
function normalizeEmail(value) { return clean(value).toLowerCase(); }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function safeNext(value) { const next = clean(value); return ALLOWED_NEXT.has(next) ? next : '/dashboard-cliente.html'; }

async function db(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role não configurado.');
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, ...(options.headers || {}) }
  });
}

async function rows(response, label) {
  if (!response.ok) throw new Error(`${label}: ${(await response.text()).slice(0, 700)}`);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : [];
}

async function sendLoginEmail(email, companyName, accessUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Envio de e-mail não configurado.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: 'SmartBots <smartbots@auth.f-insight.org>',
        to: email,
        subject: `Acesse o painel da ${companyName}`,
        text: `Seu acesso seguro ao SmartBots está pronto.\n\nAbra o link abaixo para continuar na ${companyName}:\n\n${accessUrl}\n\nO link é de uso único e expira em 20 minutos. Se você não solicitou este acesso, ignore esta mensagem.`
      })
    });
    if (!response.ok) throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
  } finally { clearTimeout(timer); }
}

async function requestLogin(email, nextPath) {
  const bots = await rows(
    await db(`website_bots?or=(email.eq.${encodeURIComponent(email)},owner_email.eq.${encodeURIComponent(email)})&select=*&order=created_at.desc&limit=1`),
    'Buscar SmartBot por e-mail'
  );
  const bot = bots[0];
  if (!bot) return;

  const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const recent = await rows(
    await db(`smartbot_connection_invites?bot_id=eq.${encodeURIComponent(bot.bot_id)}&purpose=eq.${PURPOSE}&created_at=gte.${encodeURIComponent(since)}&revoked_at=is.null&select=id&limit=1`),
    'Verificar limite de acesso'
  );
  if (recent.length) return;

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + LOGIN_TTL_MS).toISOString();
  const destination = safeNext(nextPath);
  const invite = await db('smartbot_connection_invites', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      bot_id: bot.bot_id,
      token_hash: hash(token),
      purpose: PURPOSE,
      expires_at: expiresAt,
      metadata: { flow: 'client_portal_email_login', email, next: destination }
    })
  });
  if (!invite.ok) throw new Error(`Criar link de acesso: ${(await invite.text()).slice(0, 700)}`);

  const accessUrl = `https://smartbots.club/portal-login.html?access=${encodeURIComponent(token)}&next=${encodeURIComponent(destination)}`;
  await sendLoginEmail(email, bot.company_name || 'seu negócio', accessUrl);
}

async function consumeLogin(token) {
  const invitations = await rows(
    await db(`smartbot_connection_invites?token_hash=eq.${encodeURIComponent(hash(token))}&purpose=eq.${PURPOSE}&select=id,bot_id,expires_at,completed_at,revoked_at&limit=1`),
    'Validar link de acesso'
  );
  const invitation = invitations[0];
  if (!invitation || invitation.revoked_at || invitation.completed_at || new Date(invitation.expires_at).getTime() <= Date.now()) return null;

  const bots = await rows(await db(`website_bots?bot_id=eq.${encodeURIComponent(invitation.bot_id)}&select=*&limit=1`), 'Carregar SmartBot');
  const bot = bots[0];
  if (!bot) return null;

  const now = new Date().toISOString();
  const used = await db(`smartbot_connection_invites?id=eq.${encodeURIComponent(invitation.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ completed_at: now, last_used_at: now })
  });
  if (!used.ok) throw new Error(`Concluir link de acesso: ${(await used.text()).slice(0, 700)}`);
  return createPortalSession(bot);
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const action = clean(body.action);
    if (action === 'request') {
      const email = normalizeEmail(body.email);
      if (!email || !email.includes('@')) return reply(400, { success: false, error: 'Informe um e-mail válido.' });
      try { await requestLogin(email, body.next); }
      catch (error) { console.error('[Client Portal Login] request:', error.message); }
      return reply(200, { success: true, message: 'Se este e-mail estiver vinculado a um SmartBot, enviaremos um link seguro de acesso.' });
    }
    if (action === 'consume') {
      const loginToken = clean(body.loginToken);
      if (!loginToken) return reply(400, { success: false, error: 'Link de acesso ausente.' });
      const portalSession = await consumeLogin(loginToken);
      if (!portalSession) return reply(401, { success: false, error: 'Este link é inválido, já foi usado ou expirou. Solicite um novo acesso.' });
      return reply(200, { success: true, portalSession });
    }
    return reply(400, { success: false, error: 'Ação inválida.' });
  } catch (error) {
    console.error('[Client Portal Login]', error);
    return reply(500, { success: false, error: 'Não foi possível concluir o acesso agora.' });
  }
};
