import test from 'node:test';
import assert from 'node:assert/strict';
import {inspect,config} from '../netlify/functions/nexa-theo-health.mjs';

const ENV={
  SITE_ID:'293da4ea-5e3f-4bee-8954-b15fcf6c3d82',
  NEXA_TELEGRAM_ENABLED:'true',
  NEXA_TELEGRAM_BOT_TOKEN:'123456789:AAaabbccDDeeff112233445566778899',
  NEXA_TELEGRAM_WEBHOOK_SECRET:'safe_telegram_webhook_secret_test_12345'
};
const TIME=Date.parse('2026-11-10T19:40:00Z');
const createFetch=(url='',options={})=>async requestUrl=>{
 const method=requestUrl.split('/').at(-1);
 if(method==='getMe')return {ok:true,json:async()=>({ok:true,result:{is_bot:true,username:'NexaTheoBot'}})};
 if(method==='getWebhookInfo')return {ok:true,json:async()=>({ok:true,result:{url,pending_update_count:0,...options}})};
 throw new Error('unknown method');
};
const run=(overrides={})=>inspect({env:ENV,siteId:ENV.SITE_ID,deployContext:'production',now:TIME,
 fetchImpl:createFetch('https://smartbots.club/.netlify/functions/nexa-telegram-webhook'),...overrides});

test('health endpoint rate-limits calls',()=>assert.equal(config.rateLimit.windowLimit,3));
test('expires after Nov10',async()=>assert.deepEqual(await run({now:Date.parse('2026-11-11T00:00:00Z')}),{code:410,status:'expired'}));
test('cannot run outside production SmartBots',async()=>{
 assert.equal((await run({siteId:'other'})).status,'not_available');
 assert.equal((await run({deployContext:'branch-deploy'})).status,'not_available');
});
test('does not call Telegram with missing credentials',async()=>{
 const result=await run({env:{...ENV,NEXA_TELEGRAM_BOT_TOKEN:''},fetchImpl:()=>{throw Error('should not call')}});
 assert.equal(result.status,'credentials_not_validated');
});
test('registered status is informational and redacted',async()=>{
 const result=await run();
 assert.deepEqual(result,{code:200,status:'bot_verified',webhook:'registered',pending_updates:0,has_recent_delivery_error:false});
 assert.equal(JSON.stringify(result).includes(ENV.NEXA_TELEGRAM_BOT_TOKEN),false);
 assert.equal(JSON.stringify(result).includes(ENV.NEXA_TELEGRAM_WEBHOOK_SECRET),false);
});
test('unregistered and foreign webhook are distinct statuses',async()=>{
 assert.equal((await run({fetchImpl:createFetch('')})).webhook,'not_registered');
 assert.equal((await run({fetchImpl:createFetch('https://other.example/path')})).webhook,'different_endpoint');
});
test('recent Telegram delivery failure is signaled only as boolean',async()=>{
 const r=await run({fetchImpl:createFetch('https://smartbots.club/.netlify/functions/nexa-telegram-webhook',
 {last_error_date:1794350000,last_error_message:'redacted error: token!'})});
 assert.equal(r.has_recent_delivery_error,true);
 assert.equal(JSON.stringify(r).includes('redacted error'),false);
});
