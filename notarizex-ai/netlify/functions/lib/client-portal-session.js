const crypto = require('crypto');
const fetch = require('node-fetch');

const PURPOSE = 'client_portal_session';
const TTL_MS = 12 * 60 * 60 * 1000;

function clean(value) {
  return String(value || '').trim();
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

async function db(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role não configurado.');

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

async function rows(response, label) {
  if (!response.ok) throw new Error(`${label}: ${(await response.text()).slice(0, 700)}`);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : [];
}

async function createPortalSession(bot) {
  if (!bot || !bot.bot_id) throw new Error('SmartBot inválido para sessão do portal.');

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const response = await db('smartbot_connection_invites', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      bot_id: bot.bot_id,
      token_hash: hash(token),
      purpose: PURPOSE,
      expires_at: expiresAt,
      metadata: {
        flow: 'client_portal',
        companyName: bot.company_name || null
      }
    })
  });
  if (!response.ok) throw new Error(`Criar sessão do portal: ${(await response.text()).slice(0, 700)}`);

  return {
    portalToken: token,
    companyName: bot.company_name || 'SmartBot',
    expiresAt
  };
}

async function resolvePortalSession(portalToken) {
  const token = clean(portalToken);
  if (!token) return null;

  const invitations = await rows(
    await db(`smartbot_connection_invites?token_hash=eq.${encodeURIComponent(hash(token))}&purpose=eq.${PURPOSE}&select=id,bot_id,expires_at,revoked_at&limit=1`),
    'Validar sessão do portal'
  );
  const invitation = invitations[0];
  if (!invitation || invitation.revoked_at || new Date(invitation.expires_at).getTime() <= Date.now()) return null;

  const bots = await rows(
    await db(`website_bots?bot_id=eq.${encodeURIComponent(invitation.bot_id)}&select=*&limit=1`),
    'Carregar SmartBot da sessão'
  );
  const bot = bots[0] || null;
  if (!bot || !bot.client_token) return null;

  await db(`smartbot_connection_invites?id=eq.${encodeURIComponent(invitation.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_used_at: new Date().toISOString() })
  }).catch(() => null);

  return bot;
}

module.exports = {
  PURPOSE,
  createPortalSession,
  resolvePortalSession
};
