'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MENU, ANSWERS, STOP_REPLY, KYC_STEP_PROMPT, isNexa, isGenericGreeting,
  isMenuReply, isStopRequest, resolveReactiveTurn
} = require('../netlify/functions/lib/nexa-reactive-onboarding');

const botId = 'site-nexa-20260923-live';
const decide = (message, overrides={}) => resolveReactiveTurn({
  botId, message, hasExistingInbox:false,latestOutbound:'',humanPending:false,
  ...overrides
});

test('only the Nexa bot receives the new routing',()=>{
  assert.equal(isNexa(botId),true);
  assert.equal(isNexa('site-other-bot'),false);
  assert.equal(resolveReactiveTurn({botId:'another',message:'oi',hasExistingInbox:false}),null);
});

test('first generic greeting opens a short menu, not the sales funnel',()=>{
  for (const greeting of ['Oi', 'Olá!', 'bom dia', 'boa tarde', 'oi Nexa']) {
    const result=decide(greeting);
    assert.equal(result.handled,true);
    assert.equal(result.reply,MENU);
    assert.equal(result.reason,'requested_menu');
    assert.equal(result.handoffRequested,false);
  }
  assert.equal(isMenuReply(MENU),true);
  assert.equal(isGenericGreeting('Olá, preciso de ajuda com uma operação'),false);
});

test('non-KYC issue goes to existing AI, but Didit errors receive safe instructions',()=>{
  assert.equal(decide('Minha transação não aparece no extrato'),null);
  const kyc=decide('Minha sessão de identificação expirou');
  assert.equal(kyc.handled,true);
  assert.equal(kyc.reason,'kyc_difficulty_didit_error');
  assert.equal(kyc.reply,KYC_STEP_PROMPT);
  assert.match(kyc.reply,/Qual situação descreve melhor o problema/);
  assert.equal(kyc.handoffRequested,false);
});

test('do not repeat menu for an existing client who says hello',()=>{
  assert.equal(decide('oi',{hasExistingInbox:true}),null);
  assert.equal(decide('menu',{hasExistingInbox:true}).reply,MENU);
  assert.equal(decide('opções',{hasExistingInbox:true}).reply,MENU);
});

test('number selection requires a previously presented menu',()=>{
  assert.equal(decide('2',{hasExistingInbox:true}),null);
  for (let choice=1;choice<=6;choice++) {
    const result=decide(String(choice),{hasExistingInbox:true,latestOutbound:MENU});
    assert.equal(result.handled,true);
    assert.equal(result.reason,'selected_menu_option');
    assert.ok(result.reply.length>50);
  }
});

test('identity guidance is through the official secure account, not WhatsApp CPF',()=>{
  const result=decide('2',{hasExistingInbox:true,latestOutbound:MENU});
  assert.ok(result.reply.includes('Didit'));
  assert.ok(result.reply.includes('Não envie CPF'));
  assert.equal(result.handoffRequested,undefined);
  assert.ok(!result.reply.includes('chave Pix'));
});

test('deposit issues and human requests are escalated, not sold',()=>{
  for (const v of ['4','6']){
    const result=decide(v,{hasExistingInbox:true,latestOutbound:MENU});
    assert.equal(result.handoffRequested,true);
    assert.equal(result.intent,'handoff');
    assert.equal(result.reply.includes('CPF'),true);
  }
  const human=decide('quero falar com atendente',{hasExistingInbox:true});
  assert.equal(human.handoffRequested,true);
});

test('human pending conversations are handed off silently',()=>{
  const r=decide('Ainda não responderam?',{
    hasExistingInbox:true,humanPending:true,latestOutbound:MENU,
  });
  assert.equal(r.handled,true);
  assert.equal(r.reply,null);
  assert.equal(r.handoffRequested,true);
});

test('accidentally sent CPF is not reflected in a response',()=>{
  const sample='Meu CPF é 123.456.789-09, quero ajuda';
  const r=decide(sample);
  assert.equal(r.reason,'unsafe_identifier');
  assert.equal(r.reply.includes('123'),false);
  assert.equal(r.reply.includes('CPF'),true);
});

test('SAIR / STOP are exact requests, never substring interpretations',()=>{
  for(const msg of ['SAIR','stop','Parar!','descadastrar',
    'cancelar mensagens','não quero receber avisos','unsubscribe']) {
    assert.equal(isStopRequest(msg),true,msg);
  }
  for(const msg of ['Quero sair da minha conta','Minha operação não para',
    'Pode me ajudar a cancelar minha operação?','sair com cartão','parar de perder dinheiro']) {
    assert.equal(isStopRequest(msg),false,msg);
  }
});

test('SAIR overrides human pending, requests no marketing and is Nexa-only',()=>{
  const result=decide('SAIR',{humanPending:true,hasExistingInbox:true});
  assert.equal(result.reason,'whatsapp_opt_out');
  assert.equal(result.reply,STOP_REPLY);
  assert.equal(result.handoffRequested,false);
  assert.equal(result.intent,'opt_out');
  assert.match(result.reply,/Registramos seu pedido/);
  assert.doesNotMatch(result.reply,/Pix|USDC|compra|depósito/i);
  assert.equal(resolveReactiveTurn({
    botId:'other',message:'SAIR',hasExistingInbox:true,humanPending:true,
  }),null);
});

test('Didit problems are answered immediately without unsolicited offers',()=>{
  const scenarios=[
    ['Não encontrei a verificação de identidade','locate',false],
    ['Não consigo verificar identidade','didit_error',false],
    ['Minha aprovação está pendente','review',true],
    ['Problema com a câmera na Didit','camera',false],
    ['Não consigo entrar na Nexa','access',false]
  ];
  for(const [phrase,topic,human] of scenarios){
    const r=decide(phrase,{hasExistingInbox:true});
    assert.equal(r.reason,'kyc_difficulty_'+topic,phrase);
    assert.equal(r.handoffRequested,human);
    if(topic==='didit_error') assert.equal(r.reply,KYC_STEP_PROMPT);
    else assert.match(r.reply,/trynexa.com.br\/portal\//);
    assert.doesNotMatch(r.reply,/mande um pix|rendimento garantido/i);
  }
  assert.match(decide('2',{hasExistingInbox:true,latestOutbound:MENU}).reply,/ajuda-verificacao.html/);
  assert.equal(decide('Minha verificação não abriu',{humanPending:true,hasExistingInbox:true}).reply,null);
});

test('sensitive details are intercepted before the generic AI, menu or handoff',()=>{
  for(const phrase of [
    'CPF 123.456.789-09 menu',
    'Meu e-mail exemplo@dominio.com é este',
    'senha: minhaSenhaSecreta'
  ]){
    const r=decide(phrase,{hasExistingInbox:true});
    assert.equal(r.reason,'unsafe_identifier',phrase);
    assert.equal(r.reply.includes('123.456'),false);
    assert.equal(r.reply.includes('exemplo@'),false);
  }
  const src=require('node:fs').readFileSync(
    require('node:path').join(__dirname,'../netlify/functions/kapso-webhook.js'),'utf8'
  );
  assert.ok(src.includes('await upsertInbox(cfg.bot_id,item.phone,item.name,safeInbound,intent,inboxStatus)'),
    'Nexa inbox preview must be redacted before being saved');
  assert.ok(src.includes('saveInbound(cfg.bot_id,inbox,item.phone,item.name,safeInbound'));
});

test('sensitive text never clears a previously requested human handoff',()=>{
  const r=decide('Meu CPF 123.456.789-09',{hasExistingInbox:true,humanPending:true});
  assert.equal(r.handled,true);
  assert.equal(r.reason,'unsafe_identifier');
  assert.equal(r.handoffRequested,true);
  assert.equal(r.intent,'handoff');
  assert.equal(r.reply,null);
  assert.equal(r.reply?.includes('123.456.789-09'),undefined);
});

test('webhook requires durable database acknowledgement before STOP confirmation',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const webhook=fs.readFileSync(path.join(__dirname,'../netlify/functions/kapso-webhook.js'),'utf8');
  const table=fs.readFileSync(path.join(__dirname,'../sql/20261108_nexa_whatsapp_suppression.sql'),'utf8');
  assert.ok(webhook.includes('await recordNexaOptOut(cfg.bot_id,item.phone,providerId)'));
  assert.ok(webhook.includes("resolution=ignore-duplicates,return=minimal"));
  assert.ok(webhook.includes('if(!response.ok)'));
  assert.ok(table.includes('ENABLE ROW LEVEL SECURITY'));
  assert.ok(table.includes('REVOKE ALL ON TABLE'));
  assert.ok(table.includes('PRIMARY KEY (bot_id, contact_phone)'));
  assert.doesNotMatch(webhook,/sendTemplate|sendBulk|sendMarketing|broadcast/i);
});

test('no menu reply contains exchange solicitations, promises or payment instructions',()=>{
  for (const msg of [MENU,...Object.values(ANSWERS).map(item=>item.reply)]){
    assert.doesNotMatch(msg,/rendimento garantido|mande um pix|depositar agora|transfira valores|ganho certo|chave pix:/i);
  }
});

test('KYC stage follow-up continues without repeating the menu or demanding private data',()=>{
  const first=decide('Não consigo verificar minha identidade',{hasExistingInbox:true});
  assert.equal(first.reply,KYC_STEP_PROMPT);
  for (const [number,handoff] of [['1',false],['2',true],['3',false],['4',true]]) {
    const r=decide(number,{hasExistingInbox:true,latestOutbound:KYC_STEP_PROMPT});
    assert.equal(r.reason,'selected_kyc_step');
    assert.equal(Boolean(r.handoffRequested),handoff);
    assert.ok(r.reply.length>60);
    assert.doesNotMatch(r.reply,/envie seu cpf|mande sua selfie|depósito obrigatório/i);
  }
  // Digits without the expected preceding prompt must never guess a stage.
  assert.equal(decide('2',{hasExistingInbox:true}),null);
  assert.equal(decide('2',{hasExistingInbox:true,latestOutbound:MENU}).reason,'selected_menu_option');
  assert.equal(decide('2',{hasExistingInbox:true,latestOutbound:KYC_STEP_PROMPT,humanPending:true}).reply,null);
});
