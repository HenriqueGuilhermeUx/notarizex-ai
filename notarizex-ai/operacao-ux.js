document.addEventListener('DOMContentLoaded',function(){
  var main=document.querySelector('main');
  if(!main||document.getElementById('uxGuide'))return;
  var box=document.createElement('section');
  box.id='uxGuide';
  box.className='grid md:grid-cols-3 gap-3 mb-5';
  box.innerHTML='<div class="bg-slate-900 border border-white/10 rounded-xl p-4"><b>1. Comece no Hoje</b><p class="text-gray-400 text-sm">Veja quem precisa ser chamado.</p></div><div class="bg-slate-900 border border-white/10 rounded-xl p-4"><b>2. Envie mensagens</b><p class="text-gray-400 text-sm">Use mensagens assistidas ou campanhas.</p></div><div class="bg-slate-900 border border-white/10 rounded-xl p-4"><b>3. Atualize o CRM</b><p class="text-gray-400 text-sm">Marque retorno, agendado ou perdido.</p></div>';
  var hero=main.querySelector('section');
  if(hero&&hero.nextSibling)main.insertBefore(box,hero.nextSibling);
});
