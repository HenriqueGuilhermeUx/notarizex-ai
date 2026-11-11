'use strict';

// Public, informational guidance only: neither messaging channel authenticates
// a Nexa account or initiates a Didit verification / financial operation.
const PORTAL='https://trynexa.com.br/portal/';
const FEEDBACK='https://trynexa.com.br/ajuda-verificacao.html';
const GUIDE='https://trynexa.com.br/insights/primeira-utilizacao-nexa.html';

function normalize(value) {
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
}

const GENERAL = [
  'Sua verificação de identidade (Didit) começa no portal oficial: '+PORTAL,
  '1. Entre na sua conta Nexa.',
  '2. Localize a etapa de identidade e autorize a verificação.',
  '3. Continue no ambiente seguro da Didit e acompanhe o resultado no portal.',
  'Você NÃO precisa depositar nem ativar a carteira para começar o KYC.',
  'Se não conseguir avançar, conte onde parou (pesquisa opcional, sem dados pessoais): '+FEEDBACK,
  'Precisa de ajuda humana? Escreva "atendente".',
  'Não envie CPF, fotos, selfies, documentos, senhas ou códigos pelo chat.'
].join('\n');

const REPLIES=Object.freeze({
  locate: 'Não encontrou o início da verificação? Entre em '+PORTAL+
    ', faça login e procure a etapa de identidade (Didit). Você não precisa depositar ou ativar a carteira antes. Se a etapa não aparecer, relate a dificuldade sem dados pessoais: '+FEEDBACK+
    '. Se preferir ajuda humana, escreva "atendente".',
  access: 'Não conseguiu entrar na Nexa? Use somente '+PORTAL+
    ' e o fluxo de recuperação de acesso disponível nessa página. Não mande senha, códigos ou CPF aqui. Se continuar travado, conte o motivo geral em '+FEEDBACK+
    ' ou escreva "atendente" para pedir ajuda.',
  didit_error: 'Se a Didit não abriu, travou ou informou erro, volte ao portal '+PORTAL+
    ' e consulte sua etapa de identidade. Não compartilhe link de sessão, foto, documento nem código no chat. Conte o problema em '+FEEDBACK+
    ' ou escreva "atendente" para solicitar acompanhamento.',
  camera: 'Se encontrou dificuldade com câmera, documento ou selfie na Didit, revise as permissões da câmera no dispositivo e tente novamente somente pelo fluxo oficial iniciado em '+PORTAL+
    '. Não envie fotos ou documentos aqui. Informe apenas a categoria do problema em '+FEEDBACK+
    ' ou peça "atendente".',
  review: 'Se sua identidade já está em análise, foi recusada ou está aguardando aprovação, NÃO repita sessões nem pague para liberar a conta. Consulte o status somente em '+PORTAL+
    '. Para revisão individual, solicite um atendente; o chat não tem acesso ao seu KYC e não pode aprová-lo.'
});

function classifyKycDifficulty(value) {
  const m=normalize(value);
  if(!m) return null;
  const context=/\b(?:kyc|didit|identidade|identificacao|verificacao|verificar|biometria|selfie|cadastro)\b/.test(m);
  if(!context) return null;
  if(/\b(?:aprovacao|aprovado|reprovad|rejeitad|recusad|em analise|aguardando analise|status pendente|demora para aprovar)\b/.test(m))
    return 'review';
  if(/\b(?:camera|selfie|foto|imagem|documento|permissao da camera)\b/.test(m))
    return 'camera';
  if(/\b(?:nao consigo entrar|nao entro|nao consegui entrar|login|acesso|senha esquecida|esqueci a senha)\b/.test(m))
    return 'access';
  if(/\b(?:nao encontrei|nao acho|onde fica|onde comeco|como comeco|nao aparece|sumiu o botao|sem botao|botao nao aparece)\b/.test(m))
    return 'locate';
  if(/\b(?:erro|travou|travado|falha|expirou|expirada|nao abriu|nao abre|nao funciona|nao funcionou|nao carrega|nao consigo iniciar)\b/.test(m))
    return 'didit_error';
  return null;
}

function kycFrictionReply(topic) { return REPLIES[topic]||GENERAL; }

module.exports={PORTAL,FEEDBACK,GUIDE,GENERAL,REPLIES,normalize,
  classifyKycDifficulty,kycFrictionReply};
