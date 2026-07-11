function S(){return JSON.parse(localStorage.getItem('sb_session')||'{}')}
function esc(v){return String(v||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function onlyPhone(v){return String(v||'').replace(/\D/g,'')}
function copyText(t){navigator.clipboard.writeText(t);alert('Copiado')}
async function loadMessages(id){
  messages.innerText='Carregando mensagens...';
  var s=S();
  var r=await fetch('/.netlify/functions/smartbot-conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken,action:'messages',conversationId:id})});
  var j=await r.json();
  if(!j.success){messages.innerText='Erro: '+j.error;return}
  messages.innerHTML='<h2 class="font-black text-xl mb-3 text-white">Mensagens</h2>'+((j.messages||[]).map(function(m){return '<div class="border-b border-white/10 py-3"><b>'+esc(m.role)+'</b><p>'+esc(m.content)+'</p></div>'}).join('')||'Sem mensagens');
}
async function loadConversations(){
  list.innerText='Carregando';
  var s=S();
  var r=await fetch('/.netlify/functions/smartbot-conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken})});
  var j=await r.json();
  if(!j.success){list.innerText='Erro: '+j.error;return}
  var arr=j.conversations||j.items||[];
  list.innerHTML=arr.map(function(x){var txt='Conversa SmartBots\nIntenção: '+(x.intent||'')+'\nMensagem: '+(x.last_message||'');var wa=onlyPhone(x.customer_phone);var btn=wa?'<a target="_blank" href="https://wa.me/55'+wa+'" class="mt-2 inline-block bg-green-400 text-black px-3 py-2 rounded-xl font-black">WhatsApp</a>':'';return '<div class="bg-slate-900 border border-white/10 rounded-xl p-4 mb-3"><b>'+esc(x.customer_name||x.visitor_id||'Visitante')+'</b><p>'+esc(x.intent||'')+'</p><p>'+esc(x.last_message||'')+'</p><div class="flex gap-2 flex-wrap"><button onclick="loadMessages(\''+esc(x.id)+'\')" class="mt-2 bg-white/10 px-3 py-2 rounded-xl">Ver mensagens</button><button onclick="copyText(\''+esc(txt).replace(/'/g,'')+'\')" class="mt-2 bg-white/10 px-3 py-2 rounded-xl">Copiar resumo</button>'+btn+'</div></div>'}).join('')||'Nenhuma conversa';
}
document.addEventListener('DOMContentLoaded',loadConversations);
