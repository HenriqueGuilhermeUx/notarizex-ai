// Temporary, fail-closed Telegram webhook bootstrap for Nexa Theo.
// Fires only during 9 Nov 2026 UTC evening; no customer messages or broadcasts.
// Netlify scheduled functions cannot be invoked via public URL.
const TARGET_SITE_ID = '293da4ea-5e3f-4bee-8954-b15fcf6c3d82';
const EXPECTED_USERNAME = 'NexaTheoBot';
const EXPECTED_WEBHOOK = 'https://smartbots.club/.netlify/functions/nexa-telegram-webhook';
const WINDOW_START = Date.parse('2026-11-09T20:00:00Z');
const WINDOW_END = Date.parse('2026-11-10T00:00:00Z');

export async function bootstrap({env=process.env,fetchImpl=fetch,now=new Date()}={}) {
  const when = new Date(now).getTime();
  if (!Number.isFinite(when) || when < WINDOW_START || when >= WINDOW_END)
    return {status:'outside_activation_window'};
  if (env.SITE_ID !== TARGET_SITE_ID)
    return {status:'wrong_site'};
  if (env.NEXA_TELEGRAM_ENABLED !== 'true')
    return {status:'disabled'};
  const token = String(env.NEXA_TELEGRAM_BOT_TOKEN || '');
  const secret = String(env.NEXA_TELEGRAM_WEBHOOK_SECRET || '');
  if (!/^\d{5,20}:[A-Za-z0-9_-]{20,}$/.test(token) ||
      !/^[A-Za-z0-9_-]{32,64}$/.test(secret))
    return {status:'invalid_credentials_format'};

  // Never include token, secret or provider response text in logs or results.
  async function api(method,body={}) {
    const url='https://api.telegram.org/bot'+token+'/'+method;
    const response=await fetchImpl(url,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(10000)
    });
    if(!response || response.ok!==true) return {ok:false};
    const answer=await response.json();
    if(answer?.ok!==true) return {ok:false};
    return {ok:true,result:answer.result};
  }

  try {
    const me=await api('getMe');
    if(!me.ok) return {status:'getme_failed'};
    if(me.result?.is_bot!==true || me.result?.username!==EXPECTED_USERNAME)
      return {status:'bot_identity_mismatch'};

    const current=await api('getWebhookInfo');
    if(!current.ok || typeof current.result?.url!=='string')
      return {status:'webhook_info_unavailable'};
    const active=current.result.url;
    // Fail closed: never overwrite a different existing endpoint.
    if(active && active!==EXPECTED_WEBHOOK)
      return {status:'existing_webhook_conflict'};
    if(active===EXPECTED_WEBHOOK)
      return {status:'already_registered'};

    const set=await api('setWebhook',{
      url:EXPECTED_WEBHOOK,
      secret_token:secret,
      allowed_updates:['message'],
      drop_pending_updates:false
    });
    if(!set.ok || set.result!==true)
      return {status:'setwebhook_rejected'};
    const verified=await api('getWebhookInfo');
    if(!verified.ok || verified.result?.url!==EXPECTED_WEBHOOK)
      return {status:'verification_failed'};
    return {status:'registered'};
  }catch {
    return {status:'provider_request_failed'};
  }
}

export default async function scheduledBootstrap() {
  const result=await bootstrap();
  // Status codes only. Never log the request URLs (which contain bot token).
  console.info('nexa_telegram_bootstrap',result.status);
}

export const config = {
  schedule: '*/5 20-23 9 11 *'
};
