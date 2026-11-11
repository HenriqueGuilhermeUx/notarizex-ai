'use strict';

/**
 * The Nexa WhatsApp channel is reactive support only.
 * It must never authenticate a financial customer from a phone number,
 * collect a CPF or initiate a purchase, Pix payment or deposit.
 */
const NEXA_BOT_ID = 'site-nexa-20260923-live';
const {PORTAL,FEEDBACK,GENERAL,classifyKycDifficulty,kycFrictionReply}=require('./nexa-kyc-assistance');

const MENU = [
  'Olá! Sou o *Theo*, assistente virtual da Nexa. 👋',
  '',
  'Como posso ajudar?',
  '*1* — Cadastro e acesso à conta',
  '*2* — Verificação de identidade (Didit)',
  '*3* — Entender como funciona a Nexa',
  '*4* — Problema com depósito, saldo ou operação',
  '*5* — Nexa PJ e atendimento empresarial',
  '*6* — Falar com a equipe',
  '',
  'Responda com um número ou escreva sua dúvida normalmente.',
  'Por segurança, não envie CPF, documentos, senhas ou códigos por aqui.'
].join('\n');

const ANSWERS = Object.freeze({
  '1': {
    intent: 'duvida',
    reply: 'Seu cadastro e a recuperação de acesso são feitos no portal oficial: '+PORTAL+'. Se já criou sua conta, faça login e procure a etapa de identidade (Didit). Não é necessário depositar para começar. Se a verificação não aparecer, conte onde parou em '+FEEDBACK+'. Nunca envie dados pessoais, senhas ou códigos por aqui.'
  },
  '2': {
    intent: 'duvida',
    reply: GENERAL
  },
  '3': {
    intent: 'duvida',
    reply: 'A Nexa oferece uma experiência para acompanhar sua carteira e conhecer funcionalidades disponíveis no aplicativo e no site oficial. Para saber o que está habilitado na sua conta, consulte a área autenticada em https://trynexa.com.br. Posso explicar os passos gerais de cadastro ou navegação.'
  },
  '4': {
    intent: 'handoff',
    handoffRequested: true,
    reply: 'Entendi. Vou sinalizar à equipe que você precisa de ajuda com uma operação ou saldo. Não tenho acesso à sua conta neste WhatsApp. Para sua segurança, não envie CPF, comprovantes, chaves Pix, senhas ou códigos aqui; consulte também o histórico na área autenticada.'
  },
  '5': {
    intent: 'duvida',
    reply: 'A Nexa PJ reúne soluções de conta e gestão empresarial. Você encontra informações em https://trynexa.com.br/pj. Sua dúvida é sobre cadastro da empresa ou sobre funcionalidades da plataforma?'
  },
  '6': {
    intent: 'handoff',
    handoffRequested: true,
    reply: 'Certo. Registrei sua solicitação para atendimento pela equipe Nexa. Você pode explicar o assunto de forma geral, mas não envie CPF, documentos, senhas, códigos ou dados de operações neste chat.'
  }
});

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function isNexa(botId) {
  return String(botId || '') === NEXA_BOT_ID;
}

const STOP_REPLY = 'Certo. Registramos seu pedido para não receber novos avisos proativos da Nexa pelo WhatsApp. Você ainda pode nos chamar aqui para pedir ajuda. Para sua segurança, nunca envie CPF, documentos, senhas ou códigos por mensagem.';

function isStopRequest(value) {
  const input = normalize(value).replace(/[.!?,;:]+$/g, '').trim();
  return /^(sair|stop|parar|descadastrar|cancelar mensagens|cancelar avisos|nao quero receber mensagens|nao quero receber avisos|parar mensagens|unsubscribe)$/.test(input);
}

function isGenericGreeting(value) {
  const text = normalize(value).replace(/[!?.,:;]+/g, '').trim();
  return /^(oi+|ola+|oie+|alo|bom dia|boa tarde|boa noite|ola theo|oi theo|oi nexa|ola nexa|tudo bem|hey|hello|iniciar|start)$/.test(text);
}

function isMenuReply(value) {
  const text = String(value || '');
  return text.includes('Como posso ajudar?') &&
    text.includes('*1* — Cadastro') &&
    text.includes('*6* — Falar com a equipe');
}

function resolveReactiveTurn({botId, message, hasExistingInbox, latestOutbound, humanPending}) {
  if (!isNexa(botId)) return null;
  const input = String(message || '').trim();
  const normalized = normalize(input);
  if (!input) return null;

  // A direct stop request always overrides an ongoing human-handoff state.
  // The caller must durably persist the suppression BEFORE sending this reply.
  if (isStopRequest(input)) {
    return {handled:true,reply:STOP_REPLY,intent:'opt_out',
      handoffRequested:false,reason:'whatsapp_opt_out'};
  }

  // Always intercept accidentally submitted personal identifiers before
  // calling the generic AI or persisting chat content. No account lookup.
  if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(input) ||
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(input) ||
      /\b(?:senha|password|codigo de verificacao|codigo de acesso|otp)\s*(?:[:=]|(?:e|é)\s*)\s*\S+/i.test(input)) {
    return {
      handled:true,intent:'duvida',handoffRequested:false,reason:'unsafe_identifier',
      reply:'Por segurança, não envie CPF, e-mail, senha, código ou documento por aqui. Use a conta autenticada em '+PORTAL+'. Se precisar, escreva "atendente" para receber orientação segura.'
    };
  }

  // A pending human handoff is not a signal to keep talking automatically.
  if (humanPending) {
    return {handled:true,reply:null,intent:'handoff',handoffRequested:true,reason:'human_pending'};
  }

  if (/\b(?:menu|opcoes|opcao de atendimento|voltar ao inicio)\b/.test(normalized) ||
      (!hasExistingInbox && isGenericGreeting(input))) {
    return {handled:true,reply:MENU,intent:'duvida',handoffRequested:false,reason:'requested_menu'};
  }

  if (isMenuReply(latestOutbound) && /^[1-6]$/.test(normalized)) {
    return {handled:true, ...ANSWERS[normalized], reason:'selected_menu_option'};
  }

  if (/\b(?:atendente humano|falar com humano|falar com atendente|pessoa da equipe|quero atendente)\b/.test(normalized)) {
    return {handled:true,...ANSWERS['6'],reason:'requested_human'};
  }

  // Frequent KYC problems are answered consistently on both channels.
  // Human review is routed to an agent and no KYC status is invented.
  const topic=classifyKycDifficulty(input);
  if (topic) return {
    handled:true,
    reply:kycFrictionReply(topic),
    intent:topic==='review'?'handoff':'duvida',
    handoffRequested:topic==='review',
    reason:'kyc_difficulty_'+topic
  };

  // Free-form non-KYC messages continue to the existing AI and human escalation path.
  return null;
}

module.exports = { NEXA_BOT_ID, MENU, ANSWERS, STOP_REPLY, isNexa, isGenericGreeting,
  isMenuReply, isStopRequest, resolveReactiveTurn };
