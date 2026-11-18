'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {resolveReactiveTurn,NEXA_BOT_ID}=require('../netlify/functions/lib/nexa-reactive-onboarding');
const webhook=fs.readFileSync(path.join(__dirname,'../netlify/functions/kapso-webhook.js'),'utf8');
test('routing metrics contain only fixed categories, no customer content or identity',()=>{
  const start=webhook.indexOf("if (isNexa) await recordUsage(cfg.bot_id,'nexa_support_routed'");
  assert.ok(start>0);
  const end=webhook.indexOf('  });',start);
  const event=webhook.slice(start,end+5);
  assert.match(event,/reason:plan\?\.reason\|\|'general_ai'/);
  assert.match(event,/humanHandoffRequested/);
  assert.match(event,/humanPendingBefore/);
  assert.doesNotMatch(event,/item\.text|item\.phone|item\.name|inbox\.id|message:/);
});
test('the prior message count is not assumed to mean delivered',()=>{
  assert.match(webhook,/if\(providerMessageId\) \{\s*await recordUsage\(cfg\.bot_id,'whatsapp_message_sent'/);
  assert.match(webhook,/nexa_support_reply_unconfirmed/);
});
test('an unresolved biometric problem is handed off but not asserted resolved',()=>{
  const p=resolveReactiveTurn({
    botId:NEXA_BOT_ID,message:'Nao consigo cadastrar biometria para entrar no aplicativo',
    hasExistingInbox:true,latestOutbound:'',humanPending:false,
  });
  assert.equal(p.handoffRequested,true);
  assert.equal(p.intent,'handoff');
  assert.match(p.reply,/não confirma seu cadastro|nao confirma seu cadastro/i);
});
