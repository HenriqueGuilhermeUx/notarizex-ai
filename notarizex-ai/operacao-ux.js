document.addEventListener('DOMContentLoaded',function(){
  var main=document.querySelector('main');
  if(!main||document.getElementById('uxGuide'))return;
  var box=document.createElement('section');
  box.id='uxGuide';
  box.className='grid md:grid-cols-4 lg:grid-cols-8 gap-3 mb-5';
  box.innerHTML='<a href="/onboarding.html" class="bg-green-400 text-black rounded-xl p-4 block"><b>Onboarding</b><p class="text-black/70 text-sm">Aprender o fluxo.</p></a><a href="/comecar.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Começar</b><p class="text-gray-400 text-sm">Passo a passo.</p></a><a href="/checklist.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Checklist</b><p class="text-gray-400 text-sm">Áreas principais.</p></a><a href="/indicadores.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Indicadores</b><p class="text-gray-400 text-sm">Resumo.</p></a><a href="/plano.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Plano</b><p class="text-gray-400 text-sm">Oferta.</p></a><a href="/cobranca.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Cobrança</b><p class="text-gray-400 text-sm">Pix manual.</p></a><a href="/hoje.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Hoje</b><p class="text-gray-400 text-sm">Rotina diária.</p></a><a href="/divulgar-bot.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Divulgar</b><p class="text-gray-400 text-sm">Link e QR.</p></a>';
  var hero=main.querySelector('section');
  if(hero&&hero.nextSibling)main.insertBefore(box,hero.nextSibling);
});
