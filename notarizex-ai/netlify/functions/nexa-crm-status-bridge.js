'use strict';
const crypto = require('crypto');
const fetch = require('node-fetch');
const BOT_ID = 'site-nexa-20260923-live';
const json = (statusCode, body) => ({
  statusCode,
  headers: {'Content-Type':'application/json','Cache-Control':'no-store'},
  body: JSON.stringify(body)
});
function authorized(value, expected) {
  if (!value || !expected || expected.length < 32) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405,{error:'method_not_allowed'});
  const secret = process.env.NEXA_CRM_BRIDGE_TOKEN;
  const bearer = String(event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\\s+/i,'');
  if (!authorized(bearer, secret)) return json(401,{error:'unauthorized'});
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json(503,{error:'not_configured'});
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),4500);
  try {
    const endpoint = url.replace(/\\/+$/,'') + '/rest/v1/smartbot_whatsapp_config?bot_id=eq.' +
      encodeURIComponent(BOT_ID) + '&select=bot_id,provider,status,auto_reply,provider_message_webhook_status&limit=1';
    const response = await fetch(endpoint,{
      headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'},
      signal:controller.signal
    });
    if (!response.ok) return json(502,{error:'upstream_unavailable'});
    const rows = await response.json();
    const config = Array.isArray(rows) ? rows[0] : null;
    if (!config || config.bot_id !== BOT_ID) return json(404,{error:'bot_not_found'});
    return json(200,{
      success:true,connected:config.status==='connected',mode:'read_only',
      botId:BOT_ID,provider:config.provider,status:config.status,
      autoReply:config.auto_reply===true,webhookStatus:config.provider_message_webhook_status||null,
      customerIdentityLinked:false,messageSyncEnabled:false
    });
  } catch {
    return json(502,{error:'upstream_unavailable'});
  } finally { clearTimeout(timeout); }
};
