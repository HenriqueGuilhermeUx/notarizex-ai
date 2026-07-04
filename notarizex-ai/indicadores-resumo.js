function addResumoVisual(){
  var k=document.getElementById('kpis');
  var a=document.getElementById('actions');
  if(!k||!a||document.getElementById('resumoVisual'))return;
  var total=0;
  k.querySelectorAll('.text-3xl').forEach(function(x){total+=Number(x.textContent||0)||0});
  var box=document.createElement('section');
  box.id='resumoVisual';
  box.className='bg-white/5 border border-white/10 rounded-2xl p-5 mb-5';
  box.innerHTML='<h2 class="font-black text-xl">Resumo rápido</h2><p class="text-gray-400 mt-2">Sua operação tem '+total+' itens acompanhados agora. Veja as ações sugeridas abaixo e comece pelo SmartBots Hoje.</p>';
  a.parentNode.insertBefore(box,a);
}
window.addEventListener('load',function(){setInterval(addResumoVisual,1000)});
