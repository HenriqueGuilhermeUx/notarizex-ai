function loadAgendaIndicator(){
  try{
    var s=JSON.parse(localStorage.getItem('sb_session')||'{}');
    if(!s.botId)return;
    fetch('/.netlify/functions/appts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken,action:'list'})})
    .then(function(r){return r.json()})
    .then(function(j){
      var arr=j.items||[];
      var now=Date.now();
      var prox=arr.filter(function(x){var d=new Date(x.appointment_at||0).getTime();return d>now-86400000&&d<now+604800000}).length;
      var k=document.getElementById('kpis');
      if(k&&!document.getElementById('agendaKpi'))k.innerHTML+='<a id="agendaKpi" href="/hoje.html" class="bg-white/5 border border-white/10 rounded-xl p-4 block hover:border-green-400"><div class="text-3xl font-black">'+prox+'</div><div class="text-sm text-gray-400">Próximos horários</div></a>';
      var a=document.getElementById('actions');
      if(a&&prox>0&&!document.getElementById('agendaTip'))a.innerHTML+='<div id="agendaTip" class="border-b border-white/10 py-3">Confirmar próximos horários no SmartBots Hoje.</div>';
    });
  }catch(e){}
}
window.addEventListener('load',function(){setTimeout(loadAgendaIndicator,900)});
