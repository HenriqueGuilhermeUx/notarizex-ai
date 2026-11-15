'use strict';
/**
 * Declarative, channel-neutral Nexa Theo support menu.
 * Native transport adapters may render these items as Telegram inline
 * keyboards or WhatsApp interactive lists after verifying provider support.
 * This module NEVER sends a message or infers account identity/consent.
 */
const HOME=Object.freeze([
  {id:'nexa:account',label:'Cadastro e acesso',command:'/conta'},
  {id:'nexa:kyc',label:'Verificar identidade',command:'/kyc'},
  {id:'nexa:first_deposit',label:'Primeiro depósito',command:'/primeiro_deposito'},
  {id:'nexa:deposit_help',label:'Problema com depósito',command:'/problema_deposito'},
  {id:'nexa:about',label:'Conhecer a Nexa',command:'/sobre'},
  {id:'nexa:human',label:'Falar com a equipe',command:'/humano'}
]);
const KYC=Object.freeze([
  {id:'nexa:kyc_missing',label:'Não encontro o botão',command:'/kyc_botao'},
  {id:'nexa:kyc_open',label:'Didit não abre',command:'/kyc_abertura'},
  {id:'nexa:kyc_camera',label:'Câmera/documento',command:'/kyc_camera'},
  {id:'nexa:kyc_review',label:'Aguardando análise',command:'/kyc_analise'}
]);
const VALID=new Map([...HOME,...KYC].map(i=>[i.id,i.command]));
function resolveAction(id) {
  return typeof id==='string' ? VALID.get(id)||null : null;
}
function telegramKeyboard(which='home') {
  const items=which==='kyc'?KYC:HOME;
  return {inline_keyboard:items.map(x=>[{text:x.label,callback_data:x.id}])
    .concat([[{text:'Voltar ao menu',callback_data:'nexa:home'}]])};
}
function whatsappList(which='home') {
  const items=which==='kyc'?KYC:HOME;
  // Transport-specific payload intentionally deferred until Kapso/Meta
  // support is validated; only allowlisted IDs and concise labels exposed.
  return items.map(({id,label})=>({id,title:label}));
}
function resolveButtonPayload(value) {
  if(value==='nexa:home')return '/menu';
  return resolveAction(value);
}
function firstDepositGuidance() {
  return 'Para conhecer seu primeiro depósito Pix/USDC, entre na conta autenticada em https://trynexa.com.br/portal/ e acesse Depósitos. Confira disponibilidade, cotação, taxas e riscos antes de decidir. Você não precisa depositar para concluir o KYC. Não compartilhe comprovantes, chaves Pix, senhas ou dados pessoais por chat. Se houver erro, escolha atendimento humano.';
}
module.exports={HOME,KYC,resolveAction,resolveButtonPayload,telegramKeyboard,whatsappList,firstDepositGuidance};
