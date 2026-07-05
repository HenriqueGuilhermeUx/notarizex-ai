async function sbSubscriptionGuard(){
  var s={};try{s=JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){}
  if(!s.botId||document.getElementById('subGuardNotice'))return;
  try{
    var r=await fetch('/.netlify/functions/subscription-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken})});
    var j=await r.json();
    if(!j.success)return;
    var st=(j.subscription&&j.subscription.status)||'pending';
    if(st==='active'||st==='trial')return;
    var main=document.querySelector('main')||document.body;
    var box=document.createElement('section');
    box.id='subGuardNotice';
    box.className='bg-red-500/15 border border-red-400/30 text-white rounded-2xl p-4 mb-4';
    var msg=st==='overdue'?'Assinatura vencida. Regularize para continuar usando.':st==='canceled'?'Assinatura cancelada. Reative para continuar usando.':'Assinatura pendente. Ative o plano para liberar o uso completo.';
    box.innerHTML='<b>Status da assinatura: '+st+'</b><p class="text-sm mt-1">'+msg+'</p><div class="mt-3"><a href="/assinatura.html" class="bg-white/10 px-4 py-2 rounded-xl font-black">Ver assinatura</a> <a href="/cobranca.html" class="bg-green-400 text-black px-4 py-2 rounded-xl font-black">Regularizar</a></div>';
    main.insertBefore(box,main.firstChild);
  }catch(e){}
}
document.addEventListener('DOMContentLoaded',sbSubscriptionGuard);
