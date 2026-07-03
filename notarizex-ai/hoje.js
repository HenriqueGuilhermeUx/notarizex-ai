document.addEventListener('DOMContentLoaded',function(){
  var b=document.getElementById('board');
  var s=document.getElementById('summary');
  if(s)s.innerHTML='<div class="bg-white/5 border border-white/10 rounded-xl p-3"><div class="text-2xl font-black">0</div><div class="text-xs text-gray-400">Ações</div></div>';
  if(b)b.innerHTML='<div class="bg-slate-900 border border-white/10 rounded-2xl p-4"><h2 class="font-black text-xl">SmartBots Hoje</h2><p class="text-gray-400 mt-2">A rotina diária será carregada aqui.</p><div class="flex gap-2 mt-4"><a href="/crm.html" class="bg-white/10 px-4 py-2 rounded-xl font-black">Abrir CRM</a><a href="/agenda.html" class="bg-green-400 text-black px-4 py-2 rounded-xl font-black">Abrir Agenda</a></div></div>';
});
