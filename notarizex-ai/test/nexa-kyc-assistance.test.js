'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {PORTAL,FEEDBACK,GENERAL,classifyKycDifficulty,kycFrictionReply}
  =require('../netlify/functions/lib/nexa-kyc-assistance');

test('general KYC guidance is actionable without any deposit or chat identity check',()=>{
  assert.match(GENERAL,/Didit/);
  assert.match(GENERAL,/não precisa depositar/i);
  assert.ok(GENERAL.includes(PORTAL));
  assert.ok(GENERAL.includes(FEEDBACK));
  assert.match(GENERAL,/CPF/);
  assert.doesNotMatch(GENERAL,/mande um pix|ganho garantido|pagamento para desbloquear/i);
});
test('Nexa login problems can be described without knowing the term KYC',()=>{
  for(const phrase of ['Não consigo entrar na Nexa','login não funciona','Não consegui entrar']){
    assert.equal(classifyKycDifficulty(phrase),'access',phrase);
  }
});
test('button missing, Didit error and camera trouble have different guidance',()=>{
  assert.equal(classifyKycDifficulty('Não encontrei a verificação de identidade'),'locate');
  assert.equal(classifyKycDifficulty('Onde fica o cadastro?'),'locate');
  assert.equal(classifyKycDifficulty('A Didit não abriu'),'didit_error');
  assert.equal(classifyKycDifficulty('Não consigo verificar identidade'),'didit_error');
  assert.equal(classifyKycDifficulty('Minha sessão de identificação expirou'),'didit_error');
  assert.equal(classifyKycDifficulty('Câmera não funciona na Didit'),'camera');
  for(const topic of ['locate','access','didit_error','camera']){
    const msg=kycFrictionReply(topic);
    assert.ok(msg.includes(PORTAL));
    assert.ok(msg.includes(FEEDBACK));
    assert.doesNotMatch(msg,/mande um pix|depósito obrigatório|envie seu CPF/i);
  }
});
test('approval review or rejection is not mistaken for normal onboarding',()=>{
  for(const phrase of [
    'Meu KYC foi rejeitado','Minha aprovação está pendente',
    'Identidade reprovada','Didit em análise'
  ])assert.equal(classifyKycDifficulty(phrase),'review',phrase);
  const message=kycFrictionReply('review');
  assert.match(message,/NÃO repita sessões/i);
  assert.doesNotMatch(message,/você foi aprovado|identidade aprovada com sucesso/i);
});
test('non-KYC unrelated messages never get rewritten as onboarding',()=>{
  for(const phrase of ['Meu Pix não caiu','quero parar mensagens',
    'oi','qual é o saldo','Preciso trocar USDC','não consigo comprar ingressos']){
    assert.equal(classifyKycDifficulty(phrase),null,phrase);
  }
});
test('there is no external redirect, credential request, or payment CTA in official links',()=>{
  for(const u of [PORTAL,FEEDBACK]){
    assert.equal(new URL(u).protocol,'https:');
    assert.equal(new URL(u).hostname,'trynexa.com.br');
  }
  for(const reply of [GENERAL,...['locate','access','didit_error','camera','review'].map(kycFrictionReply)]){
    assert.doesNotMatch(reply,/https?:\/\/(?!trynexa\.com\.br)/i);
    assert.doesNotMatch(reply,/envie\s+(?:a\s+)?senha|informe\s+seu\s+cpf|pagamento\s+obrigat[oó]rio/i);
  }
});
