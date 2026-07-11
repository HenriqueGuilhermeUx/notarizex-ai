var T={
primeiro:'Olá! Tudo bem? Recebi seu contato e posso te ajudar. Me diga seu nome, o que você precisa e o melhor WhatsApp para retorno.',
orcamento:'Perfeito. Para montar o orçamento, me confirme por favor: serviço desejado, urgência, cidade/bairro e melhor horário para falar.',
follow:'Olá! Passando para saber se ainda faz sentido avançarmos com o atendimento/orçamento. Posso te ajudar com alguma dúvida?',
pos:'Olá! Como foi sua experiência com nosso atendimento? Sua opinião é muito importante para melhorarmos.',
indicacao:'Que bom ter atendido você. Se conhecer alguém que também precise, pode indicar nosso contato? Vamos atender com a mesma atenção.',
reativacao:'Olá! Faz um tempo que não falamos. Quer que eu veja uma nova condição/horário para você?'
};
function showMsg(){msg.value=T[tipo.value]||''}
function copyMsg(){navigator.clipboard.writeText(msg.value);alert('Mensagem copiada')}
document.addEventListener('DOMContentLoaded',showMsg);
