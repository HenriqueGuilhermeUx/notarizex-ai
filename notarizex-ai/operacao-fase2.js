document.addEventListener('DOMContentLoaded',function(){
  var main=document.querySelector('main');
  if(!main||document.getElementById('phase2Ops'))return;
  var s=document.createElement('section');
  s.id='phase2Ops';
  s.className='bg-white/5 border border-white/10 rounded-2xl p-5 mb-5';
  s.innerHTML='<h2 class="font-black text-2xl mb-2">Cérebro do Bot</h2><p class="text-gray-400 mb-4">Acompanhe conversas, ensine o bot, teste respostas e veja automações criadas automaticamente.</p><div class="grid md:grid-cols-4 gap-3"><a href="/conversas.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Conversas</b><p class="text-gray-400 text-sm">Histórico do bot.</p></a><a href="/conhecimento.html" class="bg-green-400 text-black rounded-xl p-4 block"><b>Conhecimento</b><p class="text-black/70 text-sm">Ensinar respostas.</p></a><a href="/testar-cerebro.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Testar Bot</b><p class="text-gray-400 text-sm">Simular conversa.</p></a><a href="/automacoes.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Automações</b><p class="text-gray-400 text-sm">Eventos gerados.</p></a></div>';
  var guide=document.getElementById('uxGuide');
  if(guide&&guide.nextSibling)main.insertBefore(s,guide.nextSibling);else main.appendChild(s);
  var x=document.createElement('script');x.src='/operacao-fase2-resumo.js';document.body.appendChild(x);
});
