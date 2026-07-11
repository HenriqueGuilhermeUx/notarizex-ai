async function testBrain(){
  result.innerText='Testando...';
  var s=JSON.parse(localStorage.getItem('sb_session')||'{}');
  var r=await fetch('/.netlify/functions/smartbot-brain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,visitorId:'teste-'+Date.now(),channel:'site',message:msg.value})});
  var j=await r.json();
  result.innerText=JSON.stringify(j,null,2);
}
