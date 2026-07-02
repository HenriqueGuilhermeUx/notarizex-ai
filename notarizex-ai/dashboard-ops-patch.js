(function(){
  function s(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
  function addBtn(){
    var h=document.getElementById('headerStatus');
    if(!h||document.getElementById('opsPatchBtn'))return;
    var a=document.createElement('a');
    a.id='opsPatchBtn';
    a.href='/operacao.html';
    a.textContent='Central de Operação';
    a.className='btn-soft text-sm';
    h.parentElement.insertBefore(a,h);
  }
  function addCard(){
    if(document.getElementById('opsPatchCard'))return;
    var grid=document.querySelector('#tab-content-overview .grid');
    if(!grid)return;
    var d=document.createElement('div');
    d.id='opsPatchCard';
    d.className='card p-5';
    d.innerHTML='<h3 class="font-black text-lg mb-2">Central de Operação</h3><p class="text-gray-400 text-sm">CRM, agenda, campanhas, mini site, QR Code e teste do bot.</p><a href="/operacao.html" class="btn mt-4 w-full block">Abrir central</a>';
    grid.insertBefore(d,grid.firstChild);
  }
  function patchWidgetCode(){
    var w=document.getElementById('widgetCode');
    var d=document.getElementById('displayBotId');
    if(!w)return;
    var st=s();
    if(!st.botId)return;
    var company=(st.companyName||'sua empresa').replace(/'/g,'');
    var code='<!-- SmartBots Widget -->\n<script src="https://smartbots.club/widget-v2.js"><\/script>\n<script>\n  SmartBots.init({\n    botId: \''+st.botId+'\',\n    primaryColor: \'#00FF88\',\n    companyName: \''+company+'\'\n  });\n<\/script>';
    w.textContent=code;
    if(d)d.textContent=st.botId;
  }
  function run(){addBtn();addCard();patchWidgetCode()}
  document.addEventListener('DOMContentLoaded',run);
  setInterval(run,1200);
})();
