function valor(p){if(p==='Essencial')return 'R$49/mês';if(p==='Premium')return 'R$149/mês';return 'R$79/mês'}
function buildBilling(){var p=plan.value||'Profissional';var c=customer.value||'';var px=pix.value||'Informe a chave Pix da SmartBots';return 'Cobrança SmartBots\n\nCliente: '+c+'\nPlano: '+p+'\nValor: '+valor(p)+'\nPagamento: '+px+'\n\nApós o pagamento, envie o comprovante para ativarmos sua conta.'}
function refreshBilling(){msg.value=buildBilling()}
function copyBilling(){refreshBilling();navigator.clipboard.writeText(msg.value);alert('Cobrança copiada.')}
document.addEventListener('DOMContentLoaded',function(){var p=new URLSearchParams(location.search).get('plano');if(p)plan.value=p;document.body.addEventListener('input',refreshBilling);document.body.addEventListener('change',refreshBilling);refreshBilling()});
