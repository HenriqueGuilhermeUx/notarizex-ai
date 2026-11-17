'use strict';

// Shared editorial support answers for the already-operational Nexa Theo
// WhatsApp/Kapso and Telegram reactive adapters. Not customer identity or a
// financial system. Do not call providers or persist anything from here.
const PORTAL='https://trynexa.com.br/portal/';
const SAFE='Não envie CPF, senhas, códigos, documentos, comprovantes ou chaves privadas neste chat.';

function norm(text) {
  return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
}
function answer(message) {
  const m=norm(message);
  if (!m || m.length>1000) return null;
  const handoff=(reason,category,reply)=>({reason,kind:'handoff',category,reply:reply+' '+SAFE});
  const info=(reason,reply)=>({reason,kind:'answer',reply:reply+' '+SAFE});
  if (/golpe|fraude|roub|hack|phishing|acesso indevido|conta (?:foi )?invadida|operacao nao reconhecida|perdi o celular|suspeita de invasao/.test(m))
    return handoff('nexa_security_incident','security',
      'Se suspeitar de fraude ou acesso indevido, não confirme novas operações. Procure imediatamente a equipe pelos canais oficiais da Nexa e revise suas sessões na conta se ainda tiver acesso. Este bot não bloqueia transações nem consulta seu cadastro.');
  if (/nao consigo acessar|login bloqueado|conta bloqueada|recuperacao falhou/.test(m))
    return handoff('nexa_account_access_blocked','account_access',
      'Para recuperar o acesso, entre somente pelo portal oficial '+PORTAL+' e procure a recuperação de conta. Se não funcionar, solicite análise da equipe; este bot não desbloqueia usuários.');
  if (/pix|deposit/.test(m) && /paguei|pix enviado|ja transferi|enviei o pix|nao caiu|nao entrou|nao credit|sumiu|comprov/.test(m))
    return handoff('nexa_paid_deposit_uncredited','financial_support',
      'Se você já pagou e não recebeu o crédito, consulte o histórico em '+PORTAL+'. Não pague novamente apenas porque o crédito ainda não apareceu. Solicite acompanhamento pela equipe; este canal não confirma liquidação ou saldo.');
  if (/(?:pix|deposit)/.test(m) &&
      /nao consigo|nao gera|nao aparece|erro|trav|qrcode|qr code|chave pix/.test(m))
    return handoff('nexa_deposit_setup_blocked','financial_support',
      'Para gerar seu Pix, abra Depósitos na sua conta em '+PORTAL+' e confira a etapa de verificação. Use somente o QR Code exibido pela Nexa. Se a opção não aparecer, peça ajuda à equipe; não envie dinheiro a chaves recebidas por chat.');
  if (/extrato|historico|movimentac|comprovante|recibo/.test(m) &&
      /como|onde|consult|baix|ver|encontr/.test(m))
    return info('nexa_history_help',
      'Para consultar histórico, extrato e registros disponíveis, entre no portal '+PORTAL+' e abra a área de movimentações. Este canal não consegue consultar nem enviar seu extrato individual.');
  if (/transfer|enviar usdc|receber usdc|saque|retirar|retirada/.test(m) &&
      /como|onde|faco|posso|funciona|rede|taxa/.test(m))
    return info('nexa_transfer_help',
      'Consulte as opções habilitadas na sua conta em '+PORTAL+'. Antes de autorizar, confira destinatário, endereço, rede, taxas e limites; transferências em blockchain podem ser irreversíveis. Theo não movimenta fundos.');
  if (/metamask|coinbase wallet|trust wallet|rabby|wallet connect|carteira externa|conectar carteira/.test(m))
    return info('nexa_external_wallet_help',
      'Para conectar uma carteira externa, use somente a opção disponível dentro da Nexa em '+PORTAL+'. Confira rede e permissões antes de assinar; nunca compartilhe frase-semente. A disponibilidade depende da sua conta.');
  if (/premium|assinatura|cancelar plano|plano pago|mensalidade/.test(m))
    return info('nexa_plan_help',
      'Para consultar planos, condições, benefícios ou cancelamento, acesse sua conta em '+PORTAL+'. Confira os termos vigentes na interface; este canal não altera assinaturas nem consulta cobranças.');
  if (/app travando|app nao abre|tela branca|site fora|pagina nao carrega|erro no aplicativo|erro no app/.test(m))
    return info('nexa_technical_help',
      'Confira a conexão e tente abrir novamente o acesso oficial em '+PORTAL+'. Se persistir, informe à equipe somente qual tela apresentou erro e quando, sem dados sensíveis. Theo não verifica incidentes em tempo real.');
  return null; // Existing AI, KYC, menu and human queue must continue unchanged.
}
module.exports={answer,norm};
