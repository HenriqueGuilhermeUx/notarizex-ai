document.addEventListener('DOMContentLoaded',function(){
  var main=document.querySelector('main');
  if(!main||document.getElementById('uxGuide'))return;
  var box=document.createElement('section');
  box.id='uxGuide';
  box.className='grid md:grid-cols-5 gap-3 mb-5';
  box.innerHTML='<a href="/comecar.html" class="bg-green-400 text-black rounded-xl p-4 block"><b>Começar</b><p class="text-black/70 text-sm">Passo a passo inicial.</p></a><a href="/checklist.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Checklist</b><p class="text-gray-400 text-sm">Ver principais áreas.</p></a><a href="/indicadores.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Indicadores</b><p class="text-gray-400 text-sm">Resumo da operação.</p></a><a href="/hoje.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Rotina do dia</b><p class="text-gray-400 text-sm">Veja quem chamar.</p></a><a href="/divulgar-bot.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Divulgar bot</b><p class="text-gray-400 text-sm">Link e QR Code.</p></a>';
  var hero=main.querySelector('section');
  if(hero&&hero.nextSibling)main.insertBefore(box,hero.nextSibling);
});
