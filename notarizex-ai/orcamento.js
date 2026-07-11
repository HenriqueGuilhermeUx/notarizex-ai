function buildQuote(){msg.value='Olá, '+(cliente.value||'!')+'\n\nSegue orçamento para: '+(servico.value||'[serviço]')+'\nValor: '+(valor.value||'[valor]')+'\n\n'+(obs.value||'')+'\n\nPosso seguir com esse atendimento?'}
function copyQuote(){buildQuote();navigator.clipboard.writeText(msg.value);alert('Orçamento copiado')}
document.addEventListener('DOMContentLoaded',function(){document.body.addEventListener('input',buildQuote);buildQuote()});
