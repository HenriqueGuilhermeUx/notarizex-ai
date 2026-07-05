async function loadSub(){
  var el=document.getElementById('status');
  if(!el)return;
  var s={};try{s=JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){}
  if(!s.botId){el.innerHTML='Entre no painel para ver sua assinatura. <a href="/login">Entrar</a>';return}
  try{
    var r=await fetch('/.netlify/functions/subscription-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken})});
    var j=await r.json();
    if(!j.success)throw new Error(j.error||'Erro');
    var x=j.subscription;
    var v=((x.amount_cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    el.innerHTML='Plano: '+(x.plan||'Profissional')+'<br>Valor: '+v+'/mês<br>Status: '+(x.status||'pending');
  }catch(e){el.textContent='Erro: '+e.message}
}
document.addEventListener('DOMContentLoaded',loadSub);
