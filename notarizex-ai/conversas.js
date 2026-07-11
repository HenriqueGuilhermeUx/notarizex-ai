async function loadConversations(){
  list.innerText='Carregando';
  var s=JSON.parse(localStorage.getItem('sb_session')||'{}');
  var r=await fetch('/.netlify/functions/smartbot-conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken})});
  var j=await r.json();
  if(!j.success){list.innerText='Erro: '+j.error;return}
  var arr=j.conversations||j.items||[];
  list.innerHTML=arr.map(function(x){return '<div class="bg-slate-900 border border-white/10 rounded-xl p-4 mb-3"><b>'+String(x.customer_name||x.visitor_id||'Visitante')+'</b><p>'+String(x.intent||'')+'</p><p>'+String(x.last_message||'')+'</p></div>'}).join('')||'Nenhuma conversa';
}
document.addEventListener('DOMContentLoaded',loadConversations);
