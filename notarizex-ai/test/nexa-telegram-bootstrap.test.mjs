import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrap,config} from '../netlify/functions/nexa-telegram-bootstrap.mjs';

const BASE = Object.freeze({
  SITE_ID:'293da4ea-5e3f-4bee-8954-b15fcf6c3d82',
  NEXA_TELEGRAM_ENABLED:'true',
  NEXA_TELEGRAM_BOT_TOKEN:'123456789:AAaabbccDDeeff112233445566778899',
  NEXA_TELEGRAM_WEBHOOK_SECRET:'safe_telegram_webhook_secret_test_12345'
});
const NOW='2026-11-10T19:30:00Z';
const URL='https://smartbots.club/.netlify/functions/nexa-telegram-webhook';
const response=result=>({ok:true,json:async()=>({ok:true,result})});
function fake(initialUrl='') {
  const calls=[];
  let webhook=initialUrl;
  const fetchImpl=async(url,options)=>{
    const method=url.split('/').at(-1);
    calls.push({method,options});
    if(method==='getMe')return response({is_bot:true,username:'NexaTheoBot'});
    if(method==='getWebhookInfo')return response({url:webhook});
    if(method==='setWebhook') {
      const body=JSON.parse(options.body);
      webhook=body.url;
      return response(true);
    }
    throw new Error('unexpected API method');
  };
  return {calls,fetchImpl};
}
test('cron is date-scoped, UTC and stops after 10 Nov',()=>{
  assert.equal(config.schedule,'*/5 19-23 10 11 *');
});
test('disabled or wrong site cannot contact Telegram',async()=>{
  const f=fake();
  assert.equal((await bootstrap({env:{...BASE,SITE_ID:'wrong'},now:NOW,fetchImpl:f.fetchImpl})).status,'wrong_site');
  assert.equal((await bootstrap({env:{...BASE,NEXA_TELEGRAM_ENABLED:'false'},now:NOW,fetchImpl:f.fetchImpl})).status,'disabled');
  assert.equal(f.calls.length,0);
});
test('outside window never calls provider',async()=>{
  const f=fake();
  assert.equal((await bootstrap({env:BASE,now:'2026-11-11T00:00:00Z',fetchImpl:f.fetchImpl})).status,'outside_activation_window');
  assert.equal(f.calls.length,0);
});
test('malformed credentials stop before API request',async()=>{
  const f=fake();
  const env={...BASE,NEXA_TELEGRAM_BOT_TOKEN:'not_a_token'};
  assert.equal((await bootstrap({env,now:NOW,fetchImpl:f.fetchImpl})).status,'invalid_credentials_format');
  assert.equal(f.calls.length,0);
});
test('different Telegram bot is rejected before setWebhook',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return response({is_bot:true,username:'SomeoneElseBot'})};
  const r=await bootstrap({env:BASE,now:NOW,fetchImpl});
  assert.equal(r.status,'bot_identity_mismatch');
  assert.equal(calls,1);
});
test('existing foreign webhook is never overwritten',async()=>{
  const f=fake('https://another.example.org/hook');
  const r=await bootstrap({env:BASE,now:NOW,fetchImpl:f.fetchImpl});
  assert.equal(r.status,'existing_webhook_conflict');
  assert.equal(f.calls.some(x=>x.method==='setWebhook'),false);
});
test('correct existing webhook re-applies the configured secret',async()=>{
  const f=fake(URL);
  const r=await bootstrap({env:BASE,now:NOW,fetchImpl:f.fetchImpl});
  assert.equal(r.status,'secret_reconfirmed');
  assert.deepEqual(f.calls.map(x=>x.method),['getMe','getWebhookInfo','setWebhook','getWebhookInfo']);
  assert.equal(JSON.parse(f.calls.find(x=>x.method==='setWebhook').options.body).secret_token,BASE.NEXA_TELEGRAM_WEBHOOK_SECRET);
});
test('empty webhook is set only for Nexa endpoint with secret and message updates',async()=>{
  const f=fake();
  const r=await bootstrap({env:BASE,now:NOW,fetchImpl:f.fetchImpl});
  assert.equal(r.status,'registered');
  assert.deepEqual(f.calls.map(x=>x.method),['getMe','getWebhookInfo','setWebhook','getWebhookInfo']);
  const body=JSON.parse(f.calls.find(x=>x.method==='setWebhook').options.body);
  assert.equal(body.url,URL);
  assert.equal(body.secret_token,BASE.NEXA_TELEGRAM_WEBHOOK_SECRET);
  assert.deepEqual(body.allowed_updates,['message']);
  assert.equal(body.drop_pending_updates,false);
  assert.equal(JSON.stringify(r).includes(BASE.NEXA_TELEGRAM_BOT_TOKEN),false);
  assert.equal(JSON.stringify(r).includes(BASE.NEXA_TELEGRAM_WEBHOOK_SECRET),false);
});
test('network errors return sanitized status, not sensitive URLs',async()=>{
  const r=await bootstrap({env:BASE,now:NOW,fetchImpl:async()=>{throw new Error('url with private bot token')}});
  assert.deepEqual(r,{status:'provider_request_failed'});
});

test('yesterday is not eligible for registration',async()=>{
  const f=fake();
  const r=await bootstrap({env:BASE,now:'2026-11-09T23:30:00Z',fetchImpl:f.fetchImpl});
  assert.equal(r.status,'outside_activation_window');
  assert.equal(f.calls.length,0);
});
