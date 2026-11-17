'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {answer}=require('../netlify/functions/lib/nexa-resolutive-support');
const {resolveReactiveTurn}=require('../netlify/functions/lib/nexa-reactive-onboarding');
const {resolveTelegramTurn}=require('../netlify/functions/lib/nexa-telegram-support');
const whatsapp=(message,extra={})=>resolveReactiveTurn({
  botId:'site-nexa-20260923-live',message,hasExistingInbox:true,
  latestOutbound:'',humanPending:false,...extra
});
const scenarios=[
  ['Como consulto meu extrato?','nexa_history_help','answer'],
  ['Como transferir USDC para outra carteira?','nexa_transfer_help','answer'],
  ['Posso conectar uma MetaMask?','nexa_external_wallet_help','answer'],
  ['Como cancelar o plano Premium?','nexa_plan_help','answer'],
  ['Meu app está travando na tela branca','nexa_technical_help','answer'],
  ['Não consigo gerar meu Pix de depósito','nexa_deposit_setup_blocked','handoff'],
  ['Paguei Pix mas não caiu','nexa_paid_deposit_uncredited','handoff'],
  ['Minha conta foi invadida','nexa_security_incident','handoff']
];
test('high-confidence support matches across active WhatsApp and Telegram',()=>{
  for(const [message,reason,kind] of scenarios){
    const wa=whatsapp(message),tg=resolveTelegramTurn({message});
    assert.equal(wa.handled,true,message);
    assert.equal(wa.reason,reason,message);
    assert.equal(tg.reason,reason,message);
    assert.equal(tg.kind,kind,message);
    assert.equal(wa.reply,tg.reply,message);
    assert.equal(wa.handoffRequested,kind==='handoff',message);
    assert.match(wa.reply,/trynexa.com.br\/portal\/|equipe pelos canais oficiais da Nexa/);
    assert.doesNotMatch(wa.reply,/seu saldo e|seu saldo é|fiz seu pix|aprovamos seu kyc|ganho garantido|mande pix/i);
  }
});
test('customer opt out, privacy, KYC and pending human support still take precedence',()=>{
  assert.equal(whatsapp('SAIR').reason,'whatsapp_opt_out');
  assert.equal(resolveTelegramTurn({message:'/parar'}).kind,'opt_out');
  assert.equal(whatsapp('Meu CPF é 123.456.789-01').reason,'unsafe_identifier');
  assert.equal(resolveTelegramTurn({message:'Meu CPF é 123.456.789-01'}).reason,'unsafe_identifier');
  assert.equal(whatsapp('Minha verificação Didit travou').reason,'kyc_difficulty_didit_error');
  assert.equal(resolveTelegramTurn({message:'Minha verificação Didit travou'}).kind,'answer');
  assert.equal(whatsapp('Meu Pix não caiu',{humanPending:true}).reason,'human_pending');
  assert.equal(resolveTelegramTurn({message:'Meu Pix não caiu',humanPending:true}).reason,'human_pending');
});
test('other SmartBots are not intercepted and unrelated prompts still use current flow',()=>{
  assert.equal(resolveReactiveTurn({botId:'other',message:'Como vejo extrato?'}),null);
  assert.equal(answer('Qual a previsão do tempo?'),null);
  assert.equal(whatsapp('Qual a previsão do tempo?'),null);
});
