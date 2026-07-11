async function loadEvents(){
  result.innerText='Carregando';
  var s=JSON.parse(localStorage.getItem('sb_session')||'{}');
  var r=await fetch('/.netlify/functions/smartbot-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken})});
  var j=await r.json();
  if(!j.success){result.innerText='Erro: '+j.error;return}
  var arr=j.events||j.items||[];
  var p=arr.filter(function(x){return (x.status||'pending')==='pending'});
  var d=arr.filter(function(x){return (x.status||'pending')!=='pending'});
  function row(x){return '<div style="padding:12px;border:1px solid #333;margin:8px;border-radius:10px"><b>'+String(x.event_type||'evento')+'</b><p>'+String(x.status||'pending')+'</p><p>'+String(x.created_at||'')+'</p></div>'}
  result.innerHTML='<h2>Pendentes: '+p.length+'</h2>'+p.map(row).join('')+'<h2>Resolvidos: '+d.length+'</h2>'+d.map(row).join('');
}
document.addEventListener('DOMContentLoaded',loadEvents);
