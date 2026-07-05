function addAssinaturaStatus(){
  var main=document.querySelector('main');
  if(!main||document.getElementById('assinaturaStatus'))return;
  var s={};try{s=JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){}
  var box=document.createElement('section');
  box.id='assinaturaStatus';
  box.className='bg-white/5 border border-white/10 rounded-2xl p-4 mb-4';
  if(s.botId){box.innerHTML='<b>Assinatura</b><p class="text-gray-400 text-sm">Plano em validação. Use a tela de cobrança para controle manual.</p><div class="mt-3 flex gap-2"><a href="/plano.html" class="bg-white/10 px-4 py-2 rounded-xl font-black">Ver plano</a><a href="/cobranca.html" class="bg-green-400 text-black px-4 py-2 rounded-xl font-black">Cobrança</a></div>'}
  else{box.innerHTML='<b>Assinatura</b><p class="text-gray-400 text-sm">Entre para visualizar plano e status.</p><a href="/login" class="inline-block mt-3 bg-green-400 text-black px-4 py-2 rounded-xl font-black">Entrar</a>'}
  main.insertBefore(box,main.firstChild);
}
window.addEventListener('load',addAssinaturaStatus);
