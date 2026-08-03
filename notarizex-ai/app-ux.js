document.addEventListener('DOMContentLoaded',function(){
  if(!document.querySelector('link[href="/app-ux.css"]')){var l=document.createElement('link');l.rel='stylesheet';l.href='/app-ux.css';document.head.appendChild(l)}
  if(document.getElementById('sbBottomNav'))return;
  var nav=document.createElement('nav');nav.id='sbBottomNav';nav.className='sb-bottom';
  nav.innerHTML='<a href="/operacao.html">Central</a><a href="/crm-smartbots.html">CRM</a><a href="/acoes.html">Ações</a><a href="/prospeccao-assistida.html">Prospecção</a><a href="/mensagens.html">Mensagens</a><a href="/gestao.html">Gestão</a>';
  document.body.appendChild(nav);
});