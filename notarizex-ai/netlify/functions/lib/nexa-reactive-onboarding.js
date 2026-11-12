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

// Short, reactive troubleshooting. The last outbound prompt is the only
// conversation context: never interpret an arbitrary digit as a KYC answer.
const KYC_STEP_PROMPT = [
  'Vou ajudar a identificar onde a verificação parou. Qual situação descreve melhor o problema?',
  '*1* — Não encontro a verificação',
  '*2* — Clico, mas a Didit não abre',
  '*3* — A Didit abre, mas ocorre um erro de câmera/documento',
  '*4* — Já fiz e estou aguardando análise',
  'Responda só com o número. Não envie CPF, documentos, fotos ou códigos.'
].join('\n');

function isKycStepPrompt(value) {
  const text=String(value||'');
  return text.includes('Qual situação descreve melhor o problema?') &&
    text.includes('*1* — Não encontro a verificação') &&
    text.includes('*4* — Já fiz e estou aguardando análise');
}

const KYC_STEPS = Object.freeze({
  '1': {intent:'duvida',reply:'Entendi. Entre em '+PORTAL+' com sua conta e procure a etapa de verificação de identidade. Não precisa depositar para iniciar. Se o botão continuar ausente, escreva "atendente" para registrarmos a falha. Não envie dados pessoais aqui.'},
  '2': {intent:'handoff',handoffRequested:true,reply:'Obrigado por explicar. Se você clica e a Didit não abre, pode ser uma falha técnica. Registrei a dificuldade para acompanhamento da equipe. Por enquanto, não tente repetidamente e não envie documentos ou links de verificação neste chat.'},
  '3': {intent:'duvida',reply:'Se a Didit abre, mas a câmera não funciona, confira a permissão de câmera do navegador ou aplicativo e tente somente pelo fluxo oficial em '+PORTAL+'. Se aparecer um erro diferente ou persistir, escreva "atendente". Não envie fotos ou documentos por WhatsApp.'},
  '4': {intent:'handoff',handoffRequested:true,reply:'Obrigado. Se já concluiu a verificação, acompanhe o status no portal '+PORTAL+'. Registrei seu pedido para a equipe verificar o andamento pelos canais internos. Não repita o procedimento nem envie seus documentos por mensagem.'}
});

const ANSWERS = Object.freeze({
  '1': {
    intent: 'duvida',
    reply: 'Seu cadastro e a recuperação de acesso são feitos no portal oficial: '+PORTAL+'. Se já criou sua conta, faça login e procure a etapa de identidade (Didit). Não é necessário depositar para começar. Se a verificação não aparecer, conte onde parou em '+FEEDBACK+'. Nunca envie dados pessoais, senhas ou códigos por aqui.'
  },
  '2': {
    intent: 'duvida',
    reply: KYC_STEP_PROMPT
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
      // A safety warning must never clear a pending human support request.
      handled:true,intent:humanPending?'handoff':'duvida',
      handoffRequested:Boolean(humanPending),reason:'unsafe_identifier',
      reply:humanPending?null:'Por segurança, não envie CPF, e-mail, senha, código ou documento por aqui. Use a conta autenticada em '+PORTAL+'. Se precisar, escreva "atendente" para receber orientação segura.'
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

  // Resolve digits only after our specific KYC question. The main menu
  // has precedence only when it was actually the latest outbound message.
  if (isKycStepPrompt(latestOutbound) && /^[1-4]$/.test(normalized)) {
    return {handled:true,...KYC_STEPS[normalized],reason:'selected_kyc_step'};
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
  // A vague error should trigger one focused question, not another long
  // generic explanation. A concrete camera/review/access issue keeps its
  // established safe reply and escalation semantics.
  if (topic==='didit_error') return {
    handled:true,reply:KYC_STEP_PROMPT,intent:'duvida',
    handoffRequested:false,reason:'kyc_difficulty_didit_error'
  };
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

module.exports = { NEXA_BOT_ID, MENU, ANSWERS, STOP_REPLY, KYC_STEP_PROMPT, KYC_STEPS,
  isNexa, isGenericGreeting, isKycStepPrompt, isMenuReply, isStopRequest, resolveReactiveTurn };
