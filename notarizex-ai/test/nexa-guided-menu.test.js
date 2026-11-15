'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const menu=require('../netlify/functions/lib/nexa-guided-menu');
test('menu includes onboarding, KYC, first funding, financial support and human handoff',()=>{
  assert.equal(menu.HOME.length,6);
  assert.ok(menu.HOME.some(i=>i.id==='nexa:first_deposit'));
  assert.ok(menu.HOME.some(i=>i.id==='nexa:human'));
  assert.equal(menu.KYC.length,4);
});
test('click data only routes allowlisted commands',()=>{
  for(const row of [...menu.HOME,...menu.KYC])assert.equal(menu.resolveButtonPayload(row.id),row.command);
  assert.equal(menu.resolveButtonPayload('nexa:home'),'/menu');
  for(const attack of ['/send_money','nexa:transfer','nexa:consent_yes',null,{},'']) {
    assert.equal(menu.resolveButtonPayload(attack),null);
  }
});
test('telegram options have safe callback IDs and back navigation',()=>{
  const k=menu.telegramKeyboard('kyc');
  assert.equal(k.inline_keyboard.length,5);
  assert.equal(k.inline_keyboard[4][0].callback_data,'nexa:home');
  for(const row of k.inline_keyboard)for(const btn of row){
    assert.ok(btn.text.length<=50);
    assert.ok(btn.callback_data.length<=64);
  }
});
test('WhatsApp list specs never include authenticated personal data',()=>{
  const items=menu.whatsappList();
  assert.equal(items.length,6);
  for(const item of items)assert.ok(item.id.startsWith('nexa:'));
});
test('first-deposit guidance is optional and avoids unsafe solicitations',()=>{
  const s=menu.firstDepositGuidance();
  assert.match(s,/cotação, taxas e riscos/);
  assert.match(s,/não precisa depositar para concluir o KYC/);
  assert.doesNotMatch(s,/rendimento garantido|envie um pix|pague agora|chave pix:/i);
});
