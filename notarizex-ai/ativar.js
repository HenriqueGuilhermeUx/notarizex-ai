function getPlan(){var p=new URLSearchParams(location.search).get('plano');return p||'Profissional'}
function price(p){if(p==='Essencial')return 'R$49/mês';if(p==='Premium')return 'R$149/mês';return 'R$79/mês'}
function buildMsg(){var p=plan.value||getPlan();var c=company.value||'';var n=name.value||'';var ph=phone.value||'';return 'Olá! Quero ativar a SmartBots.\n\nPlano: '+p+' - '+price(p)+'\nEmpresa: '+c+'\nNome: '+n+'\nWhatsApp: '+ph+'\n\nPodem me enviar as instruções de pagamento e ativação?'}
function refresh(){var m=buildMsg();msg.value=m;wa.href='https://wa.me/?text='+encodeURIComponent(m)}
function copyActivation(){refresh();navigator.clipboard.writeText(msg.value);alert('Pedido copiado.');}
document.addEventListener('DOMContentLoaded',function(){var p=getPlan();plan.value=p;['change','input'].forEach(function(ev){document.body.addEventListener(ev,refresh)});refresh()});
