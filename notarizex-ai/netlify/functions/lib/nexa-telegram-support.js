'use strict';

// Nexa-only Telegram support. Telegram chat IDs are NOT Nexa account identity.
// Never request personal documents, passwords, codes or payment credentials here.
const BOT_ID = 'site-nexa-20260923-live';
const {PORTAL,FEEDBACK,GENERAL,classifyKycDifficulty,kycFrictionReply}=require('./nexa-kyc-assistance');

const MENU = [
  'Olá! Eu sou o Theo, assistente de atendimento da Nexa. 👋',
  'Este canal não autentica sua conta nem movimenta recursos.',
  '',
  'Escolha uma opção:',
  '1 — Cadastro e acesso',
  '2 — Verificação de identidade (Didit)',
  '3 — Entender a conta Nexa',
  '4 — Ajuda com saldo ou uma operação',
  '5 — Falar com a equipe',
  '6 — Minha verificação não funcionou',
  '',
  'Comandos: /kyc, /problema_kyc, /humano, /avisos, /parar.',
  'Não envie CPF, selfie, documentos, senha ou código por aqui.'
].join('\n');

// Explicit commands prevent numeric answers being confused with the main menu.
const KYC_GUIDED = [
  'Vamos identificar a dificuldade na verificação de identidade:',
  '/kyc_botao — Não encontro a opção de verificar',
  '/kyc_abertura — Clico e a Didit não abre',
  '/kyc_camera — Problema de câmera ou documento',
  '/kyc_analise — Já concluí e aguardo análise',
  'A verificação começa dentro do portal autenticado: '+PORTAL,
  'Não envie CPF, foto, senha ou código por aqui.'
].join('\\n');

const KYC = GENERAL;
const HUMAN = 'Registrei seu pedido de atendimento para acompanhamento no SmartBots. A equipe precisa verificar sua identidade pelo portal oficial antes de consultar qualquer dado da conta. Não envie CPF, documentos, selfies ou senhas aqui.';
const PRIVACY = 'Registrei seu pedido relacionado à privacidade para acompanhamento humano. Não envie dados pessoais neste chat. A equipe deverá orientar uma validação segura pelo portal Nexa.';
const STOP = 'Você não receberá avisos proativos da Nexa pelo Telegram. Se precisar de ajuda, pode continuar conversando comigo. Para reativar apenas avisos de serviço, envie /avisos.';
const SERVICE_OPTIN = 'Você autorizou avisos de SERVIÇO da Nexa neste Telegram. Isso não autoriza ofertas financeiras, depósitos ou marketing. Você pode cancelar a qualquer momento com /parar. O envio automático permanece desativado nesta fase.';
const SENSITIVE = 'Por segurança, não compartilhe CPF, documentos, senhas ou códigos aqui. Acesse o portal Nexa para informações da sua conta: '+PORTAL;
const NO_IDENTITY = 'Este Telegram ainda não está vinculado à sua conta Nexa. Para ver informações pessoais, entre no portal oficial: '+PORTAL+'. Nunca informe senha ou CPF neste chat.';

function normalize(value) {
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ').trim().toLowerCase();
}
function containsSensitive(value) {
  const t=String(value||'');
  return /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/.test(t) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(t) ||
    /\b(?:senha|password|codigo de acesso|codigo de verificacao|token otp|otp)\s*(?:[:=]|(?:e|é)\s*)\s*\S+/i.test(t) ||
    /\b(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/.test(t);
}
function resolveTelegramTurn({message, humanPending=false}) {
  const input=String(message||'').trim();
  const m=normalize(input);
  if (!input) return {reason:'empty',reply:null,kind:'ignore'};
  // Sensitive identifier handling precedes every other rule.
  if (containsSensitive(input)) return {reason:'unsafe_identifier',reply:SENSITIVE,kind:'answer',sensitive:true};
  if (/^(\/parar|\/stop|\/cancelar|parar|sair|stop)$/.test(m))
    return {reason:'telegram_opt_out',reply:STOP,kind:'opt_out'};
  if (/^(\/avisos|\/notificacoes)$/.test(m))
    return {reason:'service_notice_opt_in',reply:SERVICE_OPTIN,kind:'service_opt_in'};
  if (/^(\/start(?:\s+\w{1,50})?|\/ajuda|\/menu|menu|ajuda|oi|ola|oi nexa|ola nexa|oi nexa preciso de ajuda)$/.test(m))
    return {reason:'telegram_menu',reply:MENU,kind:'menu'};
  // If human support is queued, do not start a duplicate AI back-and-forth.
  if (humanPending) return {reason:'human_pending',reply:null,kind:'ignore'};
  if (/\b(?:lgpd|dados? nao apagados?|exclu(?:ir|sao) (?:meus? )?dados?|apagar (?:meus? )?dados?|privacidade|remocao de dados)\b/.test(m))
    return {reason:'privacy_handoff',reply:PRIVACY,kind:'handoff',category:'privacy'};
  if (/^(?:5|\/humano|\/atendente|\/suporte)$/.test(m) || /\b(?:atendente humano|falar com (?:atendente|pessoa|humano)|preciso de analise|quero um atendente)\b/.test(m))
    return {reason:'human_handoff',reply:HUMAN,kind:'handoff',category:'support'};
  if (/\b(?:preciso da provacao|preciso de aprovacao|aprovacao (?:do cadastro|da conta|do kyc|da identidade)|kyc nao aprova|didit expirou|sessao expirada|kyc travado)\b/.test(m) ||
     (/\b(?:kyc|didit|identidade|cadastro|verificacao)\b/.test(m) &&
      /\b(?:aprov|rejeit|recus|trav|erro|expir|demor|pendente|nao consigo)\b/.test(m)))
    return {reason:'kyc_handoff',reply:KYC+'\n\n'+HUMAN,kind:'handoff',category:'kyc'};
  if (m==='/kyc_botao') return {reason:'kyc_locate',reply:kycFrictionReply('locate'),kind:'answer'};
  if (m==='/kyc_abertura') return {reason:'kyc_opening_handoff',reply:'Entendi. Se você clica e a Didit não abre, registrei a dificuldade para atendimento da equipe. Não tente várias vezes nem envie links de sessão ou documentos. Para verificar o status, use '+PORTAL,kind:'handoff',category:'kyc'};
  if (m==='/kyc_camera') return {reason:'kyc_camera',reply:kycFrictionReply('camera'),kind:'answer'};
  if (m==='/kyc_analise') return {reason:'kyc_review_handoff',reply:kycFrictionReply('review')+'\\n\\n'+HUMAN,kind:'handoff',category:'kyc'};
  if (/^(?:6|\/problema_kyc|\/pesquisa_kyc)$/.test(m))
    return {reason:'kyc_difficulty_menu',reply:'Sua verificação não avançou? Você pode contar onde parou, sem dados pessoais: '+FEEDBACK+
      '\nSe preferir ajuda individual, escreva /humano. Para retomar, use: '+PORTAL,kind:'answer'};
  // Classify general KYC difficulties deterministically instead of inventing
  // a customer status: neither this chat nor WhatsApp authenticates identity.
  const topic=classifyKycDifficulty(input);
  if (topic) return topic==='review'
    ? {reason:'kyc_review_handoff',reply:kycFrictionReply(topic)+'\n\n'+HUMAN,kind:'handoff',category:'kyc'}
    : {reason:'kyc_difficulty_'+topic,reply:kycFrictionReply(topic),kind:'answer'};
  if (/^(?:1|\/conta|\/login)$/.test(m))
    return {reason:'account_help',reply:'Para cadastro, acesso e recuperação de senha, utilize exclusivamente o portal: '+PORTAL+'. Se encontrar um erro, descreva apenas a mensagem geral (sem dados pessoais).',kind:'answer'};
  if (/^(?:2|\/kyc|\/didit)$/.test(m))
    return {reason:'kyc_help',reply:KYC_GUIDED,kind:'answer'};
  if (/^(?:3|\/sobre)$/.test(m))
    return {reason:'about_nexa',reply:'A Nexa disponibiliza uma experiência digital para consultar sua carteira e serviços habilitados. Consulte o que está disponível para você no portal oficial: '+PORTAL+'.',kind:'answer'};
  if (/^(?:4|\/operacao|\/saldo)$/.test(m) ||
      (/\b(?:deposito|saldo|transferencia|pix|operacao)\b/.test(m) &&
       /\b(?:problema|nao caiu|nao recebi|erro|sumiu|travou|nao chegou)\b/.test(m)))
    return {reason:'financial_support_handoff',
      reply:'Vou registrar sua dificuldade para acompanhamento humano. Consulte o histórico no portal: '+PORTAL+'. Não envie Pix, chaves, extratos, documentos ou códigos aqui.',
      kind:'handoff',category:'financial_support'};
  if (/^(?:\/status|status)$/.test(m) || /\b(?:meu saldo|minha conta|meu kyc|meus dados)\b/.test(m))
    return {reason:'not_authenticated',reply:NO_IDENTITY,kind:'answer'};
  return {reason:'unresolved_to_human',reply:'Para ajudar com segurança, vou registrar sua dúvida para atendimento. Você também pode consultar sua conta no portal: '+PORTAL+'. Não envie dados pessoais aqui.',
    kind:'handoff',category:'general_support'};
}
module.exports={BOT_ID,PORTAL,MENU,KYC,KYC_GUIDED,HUMAN,PRIVACY,STOP,SERVICE_OPTIN,
  normalize,containsSensitive,resolveTelegramTurn};
