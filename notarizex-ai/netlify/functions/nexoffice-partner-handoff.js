const crypto = require('crypto');
const fetch = require('node-fetch');
const { createPortalSession } = require('./lib/client-portal-session');

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': 'https://smartbots.club',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

function reply(statusCode, body) { return { statusCode, headers, body: JSON.stringify(body) }; }
function clean(value, max = 0) { const s = String(value || '').trim(); return max ? s.slice(0, max) : s; }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
async function db(path, options = {}) {
  const url = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('supabase_service_not_configured');
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
}
async function rows(response, label) {
  if (!response.ok) throw new Error(`${label}:${response.status}:${(await response.text()).slice(0,500)}`);
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}
async function loadBot(botId) {
  return (await rows(await db(`website_bots?bot_id=eq.${encodeURIComponent(botId)}&select=*&limit=1`),'bot_lookup'))[0] || null;
}
async function createActivationInvite(botId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await rows(await db('smartbot_connection_invites', {
    method:'POST',
    headers:{Prefer:'return=representation'},
    body:JSON.stringify({
      bot_id:botId,
      token_hash:hash(token),
      purpose:'self_service_activation',
      expires_at:expiresAt,
      metadata:{source:'nexoffice_partner_handoff'}
    })
  }),'activation_invite_create');
  return { token, expiresAt };
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return {statusCode:204,headers,body:''};
  if (event.httpMethod !== 'POST') return reply(405,{success:false,error:'Method Not Allowed'});
  try {
    const body = JSON.parse(event.body || '{}');
    const token = clean(body.handoffToken,300);
    if (!token) return reply(422,{success:false,error:'handoff_token_required'});
    const invitations = await rows(await db(`smartbot_connection_invites?token_hash=eq.${encodeURIComponent(hash(token))}&purpose=eq.nexoffice_partner_handoff&select=id,bot_id,expires_at,revoked_at,completed_at&limit=1`),'handoff_lookup');
    const invite = invitations[0];
    if (!invite) return reply(404,{success:false,error:'handoff_invalid'});
    if (invite.revoked_at) return reply(410,{success:false,error:'handoff_revoked'});
    if (invite.completed_at) return reply(409,{success:false,error:'handoff_already_used'});
    if (new Date(invite.expires_at).getTime() <= Date.now()) return reply(410,{success:false,error:'handoff_expired'});

    const consumed = await rows(await db(`smartbot_connection_invites?id=eq.${encodeURIComponent(invite.id)}&completed_at=is.null&revoked_at=is.null`, {
      method:'PATCH',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify({completed_at:new Date().toISOString(),last_used_at:new Date().toISOString()})
    }),'handoff_consume');
    if (!consumed[0]) return reply(409,{success:false,error:'handoff_already_used'});

    const bot = await loadBot(invite.bot_id);
    if (!bot) return reply(404,{success:false,error:'smartbot_not_found'});

    if (bot.status === 'active') {
      const portalSession = await createPortalSession(bot);
      return reply(200,{success:true,destination:'portal',portalSession,redirectUrl:'/painel'});
    }

    const activation = await createActivationInvite(bot.bot_id);
    return reply(200,{success:true,destination:'activation',activationUrl:`/ativar?token=${encodeURIComponent(activation.token)}`,expiresAt:activation.expiresAt});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[NexOffice Partner Handoff]',message);
    return reply(500,{success:false,error:'handoff_failed'});
  }
};
