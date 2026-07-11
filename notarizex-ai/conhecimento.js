function S(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
async function callKnowledge(action){
  result.innerText='Enviando...';
  var s=S();
  var body={action:action,botId:s.botId,clientToken:s.clientToken,title:title.value,content:content.value};
  var r=await fetch('/.netlify/functions/smartbot-knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  var j=await r.json();
  result.innerText=JSON.stringify(j,null,2);
}
function saveKnowledge(){callKnowledge('save')}
function loadKnowledge(){callKnowledge('list')}
