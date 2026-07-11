async function loadPhase2Resumo(){
  var main=document.querySelector('main');
  if(!main||document.getElementById('phase2Resumo'))return;
  var s={};try{s=JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){}
  if(!s.botId)return;
  var box=document.createElement('section');
  box.id='phase2Resumo';
  box.className='bg-slate-900 border border-white/10 rounded-2xl p-5 mb-5';
  box.innerHTML='<h2 class="font-black text-xl mb-2">Resumo do cérebro</h2><p class="text-gray-400">Carregando...</p>';
  var p=document.getElementById('phase2Ops');
  if(p&&p.nextSibling)main.insertBefore(box,p.nextSibling);else main.appendChild(box);
  try{
    var ev=await fetch('/.netlify/functions/smartbot-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken})});
    var ej=await ev.json();
    var events=ej.events||[];
    var pend=events.filter(function(x){return (x.status||'pending')==='pending'}).length;
    var cv=await fetch('/.netlify/functions/smartbot-conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken})});
    var cj=await cv.json();
    var conv=(cj.conversations||[]).length;
    box.innerHTML='<h2 class="font-black text-xl mb-3">Resumo do cérebro</h2><div class="grid md:grid-cols-2 gap-3"><a href="/conversas.html" class="bg-white/5 rounded-xl p-4"><b>'+conv+'</b><p class="text-gray-400 text-sm">Conversas registradas</p></a><a href="/automacoes.html" class="bg-white/5 rounded-xl p-4"><b>'+pend+'</b><p class="text-gray-400 text-sm">Automações pendentes</p></a></div>';
  }catch(e){box.innerHTML='<h2 class="font-black text-xl">Resumo do cérebro</h2><p class="text-gray-400">Não foi possível carregar agora.</p>'}
}
document.addEventListener('DOMContentLoaded',loadPhase2Resumo);
