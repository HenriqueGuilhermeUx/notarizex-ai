document.addEventListener('DOMContentLoaded',function(){
  var s={};try{s=JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){}
  if(s.botId){
    var x=document.createElement('script');
    x.src='/subscription-guard.js';
    document.body.appendChild(x);
    return;
  }
  if(document.getElementById('sbLoginNotice'))return;
  var m=document.querySelector('main')||document.body;
  var b=document.createElement('section');
  b.id='sbLoginNotice';
  b.className='bg-yellow-400 text-black rounded-2xl p-4 mb-4';
  b.innerHTML='<b>Entre no painel</b><p>Faça login para usar esta área.</p><a href="/login" class="font-black underline">Entrar</a>';
  m.insertBefore(b,m.firstChild);
});
