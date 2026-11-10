// Read-only, temporary diagnostics for Nexa Theo Telegram.
// Exposes only status categories; never a token, secret, chat ID or Telegram response body.
// Explicitly expires on 11 Nov 2026 UTC; not a general-purpose proxy.
const SITE_ID='293da4ea-5e3f-4bee-8954-b15fcf6c3d82';
const USERNAME='NexaTheoBot';
const WEBHOOK='https://smartbots.club/.netlify/functions/nexa-telegram-webhook';
const DEADLINE=Date.parse('2026-11-11T00:00:00Z');
const SAFE_HEADERS={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, max-age=0',
  'X-Robots-Tag':'noindex, nofollow',
  'Access-Control-Allow-Origin':'https://smartbots.club'
};
function reply(code,status,extra={}) {
  return {statusCode:code,headers:SAFE_HEADERS,
    body:JSON.stringify({status,...extra})};
}
async function telegram(token,method,fetchImpl) {
  try {
    const response=await fetchImpl('https://api.telegram.org/bot'+token+'/'+method,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:'{}',
      signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)return null;
    const json=await response.json();
    return json?.ok===true?json.result:null;
  }catch {
    return null;
  }
}
export async function inspect({env=process.env,fetchImpl=fetch,now=Date.now(),siteId,deployContext}={}) {
  if(now>=DEADLINE)return {code:410,status:'expired'};
  const s=siteId||env.SITE_ID||env.NETLIFY_SITE_ID;
  if(s!==SITE_ID || deployContext!=='production')
    return {code:404,status:'not_available'};
  if(env.NEXA_TELEGRAM_ENABLED!=='true')
    return {code:200,status:'disabled'};
  const token=String(env.NEXA_TELEGRAM_BOT_TOKEN||'');
  const secret=String(env.NEXA_TELEGRAM_WEBHOOK_SECRET||'');
  if(!/^\d{5,20}:[A-Za-z0-9_-]{20,}$/.test(token) ||
     !/^[A-Za-z0-9_-]{32,64}$/.test(secret))
    return {code:200,status:'credentials_not_validated'};
  const me=await telegram(token,'getMe',fetchImpl);
  if(!me)return {code:200,status:'telegram_identity_unavailable'};
  if(me.is_bot!==true || me.username!==USERNAME)
    return {code:200,status:'wrong_bot'};
  const info=await telegram(token,'getWebhookInfo',fetchImpl);
  if(!info)return {code:200,status:'telegram_webhook_info_unavailable'};
  const current=String(info.url||'');
  const registration=current===WEBHOOK?'registered':current?'different_endpoint':'not_registered';
  return {code:200,status:'bot_verified',webhook:registration,
    pending_updates:Number.isInteger(info.pending_update_count)?Math.max(0,info.pending_update_count):null,
    has_recent_delivery_error:!!info.last_error_date};
}
export default async function handler(request,context) {
  if(request?.method!=='GET'){
    const r=reply(405,'method_not_allowed');
    return new Response(r.body,{status:r.statusCode,headers:r.headers});
  }
  const result=await inspect({siteId:context?.site?.id,deployContext:context?.deploy?.context});
  const {code,status,...extra}=result;
  const response=reply(code,status,extra);
  return new Response(response.body,{status:response.statusCode,headers:response.headers});
}
export const config={
  // This is public only for diagnostic status, with per-IP request limiting.
  rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:3}
};
