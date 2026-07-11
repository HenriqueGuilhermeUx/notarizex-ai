async function loadConversations(){
  list.innerText='Carregando';
  var s=JSON.parse(localStorage.getItem('sb_session')||'{}');
  var r=await fetch('/.netlify/functions/smartbot-conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken})});
  var j=await r.json();
  list.innerText=JSON.stringify(j,null,2);
}
