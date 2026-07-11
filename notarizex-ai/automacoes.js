async function loadEvents(){
  result.innerText='Carregando';
  var s=JSON.parse(localStorage.getItem('sb_session')||'{}');
  var r=await fetch('/.netlify/functions/smartbot-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken})});
  var j=await r.json();
  if(!j.success){result.innerText='Erro: '+j.error;return}
  var arr=j.events||j.items||[];
  result.innerHTML=arr.map(function(x){return '<div style="padding:12px;border:1px solid #333;margin:8px;border-radius:10px"><b>'+String(x.event_type||'evento')+'</b><p>'+String(x.created_at||'')+'</p></div>'}).join('')||'Nenhum evento';
}
document.addEventListener('DOMContentLoaded',loadEvents);
