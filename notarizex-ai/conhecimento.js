function S(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
async function callKnowledge(action){
  result.innerText='Enviando...';
  var s=S();
  var body={action:action,botId:s.botId,clientToken:s.clientToken,title:title.value,content:content.value};
  var r=await fetch('/.netlify/functions/smartbot-knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  var j=await r.json();
  if(!j.success){result.innerText='Erro: '+j.error;return j}
  result.innerText='OK';
  return j;
}
async function saveKnowledge(){await callKnowledge('save')}
async function loadKnowledge(){
  var j=await callKnowledge('list');
  var arr=j.items||j.knowledge||[];
  if(arr[0]){title.value=arr[0].title||'Base principal';content.value=arr[0].content||'';result.innerText='Base carregada.'}else{result.innerText='Nenhuma base cadastrada ainda.'}
}
document.addEventListener('DOMContentLoaded',loadKnowledge);
