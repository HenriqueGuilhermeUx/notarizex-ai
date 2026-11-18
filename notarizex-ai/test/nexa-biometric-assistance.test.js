'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyKycDifficulty,kycFrictionReply}=require('../netlify/functions/lib/nexa-kyc-assistance');
const {resolveReactiveTurn}=require('../netlify/functions/lib/nexa-reactive-onboarding');
const {resolveTelegramTurn}=require('../netlify/functions/lib/nexa-telegram-support');

const wa=(message,other={})=>resolveReactiveTurn({
  botId:'site-nexa-20260923-live',message,hasExistingInbox:true,
  latestOutbound:'',humanPending:false,...other,
});
const words=[
  'Boa noite aqui quem fala precisa de uma ajuda estou precisando de cadastrar biometria pra poder entrar no aplicativo do Nexa e não estão conseguindo',
  'Não consigo fazer a biometria no app Nexa',
  'Falha ao cadastrar reconhecimento facial'
];
test('real-world biometric phrases route into safe actionable handoff on WhatsApp and Telegram',()=>{
  for(const message of words){
    assert.equal(classifyKycDifficulty(message),'biometric_setup',message);
    const w=wa(message),t=resolveTelegramTurn({message});
    assert.equal(w.reason,'kyc_difficulty_biometric_setup');
    assert.equal(w.intent,'handoff');
    assert.equal(w.handoffRequested,true);
    assert.equal(t.reason,'kyc_difficulty_biometric_setup');
    assert.equal(t.kind,'handoff');
    assert.equal(t.category,'kyc');
    assert.equal(w.reply,t.reply);
    assert.match(w.reply,/\(1\) não consigo entrar/);
    assert.match(w.reply,/\(4\) câmera\/rosto não funciona/);
    assert.match(w.reply,/trynexa\.com\.br\/portal\//);
    assert.match(w.reply,/Nunca envie selfie, CPF, documento/);
    assert.doesNotMatch(w.reply,/sua biometria foi aprovada|ticket aberto|reconheci sua conta/i);
  }
});
test('do not override current privacy, opt-out, other bots or pending human conversations',()=>{
  assert.equal(wa('SAIR').reason,'whatsapp_opt_out');
  assert.equal(wa('Meu CPF é 123.456.789-01').reason,'unsafe_identifier');
  assert.equal(resolveTelegramTurn({message:'Meu CPF é 123.456.789-01'}).reason,'unsafe_identifier');
  assert.equal(wa('Não consigo fazer biometria',{humanPending:true}).reason,'human_pending');
  assert.equal(resolveTelegramTurn({message:'Não consigo fazer biometria',humanPending:true}).reason,'human_pending');
  assert.equal(resolveReactiveTurn({botId:'outro',message:words[0]}),null);
});
test('maintain existing Didit camera, review, opt-out and account recovery classes',()=>{
  assert.equal(classifyKycDifficulty('A câmera da Didit não abre'),'camera');
  assert.equal(classifyKycDifficulty('Minha verificação está em análise'),'review');
  assert.equal(classifyKycDifficulty('Não consigo entrar na conta'),'access');
  assert.equal(classifyKycDifficulty('Minha biometria foi reprovada'),'review');
  assert.equal(kycFrictionReply('biometric_setup').includes('não repita sessões indiscriminadamente'),true);
});
