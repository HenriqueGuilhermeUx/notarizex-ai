document.addEventListener('DOMContentLoaded',function(){
  var main=document.querySelector('main');
  if(!main||document.getElementById('uxGuide'))return;
  var session={};
  try{session=JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){}
  var login=document.createElement('section');
  login.id='loginStatus';
  login.className='bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3';
  if(session.botId){
    login.innerHTML='<div><b>Logado</b><p class="text-gray-400 text-sm">'+(session.companyName||'SmartBots')+'</p></div><div class="flex gap-2"><a href="/dashboard-cliente.html" class="bg-green-400 text-black px-4 py-2 rounded-xl font-black">Painel</a><button id="logoutBtn" class="bg-white/10 px-4 py-2 rounded-xl font-black">Sair</button></div>';
  }else{
    login.innerHTML='<div><b>Acesso do cliente</b><p class="text-gray-400 text-sm">Entre com e-mail e token para usar CRM, agenda, campanhas e indicadores.</p></div><a href="/login" class="bg-green-400 text-black px-4 py-2 rounded-xl font-black text-center">Entrar no painel</a>';
  }
  var hero=main.querySelector('section');
  if(hero)main.insertBefore(login,hero);
  var out=document.getElementById('logoutBtn');
  if(out)out.onclick=function(){localStorage.removeItem('sb_session');location.href='/login'};
  var box=document.createElement('section');
  box.id='uxGuide';
  box.className='grid md:grid-cols-4 lg:grid-cols-8 gap-3 mb-5';
  box.innerHTML='<a href="/onboarding.html" class="bg-green-400 text-black rounded-xl p-4 block"><b>Onboarding</b><p class="text-black/70 text-sm">Aprender o fluxo.</p></a><a href="/comecar.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Começar</b><p class="text-gray-400 text-sm">Passo a passo.</p></a><a href="/checklist.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Checklist</b><p class="text-gray-400 text-sm">Áreas principais.</p></a><a href="/indicadores.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Indicadores</b><p class="text-gray-400 text-sm">Resumo.</p></a><a href="/plano.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Plano</b><p class="text-gray-400 text-sm">Oferta.</p></a><a href="/cobranca.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Cobrança</b><p class="text-gray-400 text-sm">Pix manual.</p></a><a href="/hoje.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Hoje</b><p class="text-gray-400 text-sm">Rotina diária.</p></a><a href="/divulgar-bot.html" class="bg-slate-900 border border-white/10 rounded-xl p-4 block"><b>Divulgar</b><p class="text-gray-400 text-sm">Link e QR.</p></a>';
  if(hero&&hero.nextSibling)main.insertBefore(box,hero.nextSibling);
});
