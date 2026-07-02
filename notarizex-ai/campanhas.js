let currentMessage='';
function session(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
function show(t){document.getElementById('result').textContent=t}
function esc(v){return String(v||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function digits(v){return String(v||'').replace(/\D/g,'')}
function wa(phone,msg){let p=digits(phone);if(!p)return '#';if(!p.startsWith('55')&&p.length>=10)p='55'+p;return 'https://wa.me/'+p+'?text='+encodeURIComponent(msg)}
function copyMsg(){var t=document.getElementById('msg');if(!t)return;navigator.clipboard.writeText(t.value);showCopied()}
function showCopied(){var c=document.getElementById('copied');if(c)c.textContent='Mensagem copiada.'}
async function loadContacts(msg){
 const s=session();
 const r=await fetch('/.netlify/functions/opportunities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'list',botId:s.botId,clientToken:s.clientToken})});
 const j=await r.json();
 const arr=(j.leads||[]).filter(x=>(x.pipeline_status||'')==='reativacao'||x.origin==='importado'||x.intent==='reativacao').slice(0,50);
 if(!arr.length)return '<div class="text-gray-500 text-sm">Nenhum contato em Reativação ainda. Importe contatos primeiro.</div>';
 return arr.map(x=>'<div class="border-b border-white/10 py-3"><b class="text-white">'+esc(x.name||x.phone||x.email||'Contato')+'</b><p class="text-sm text-gray-400">'+esc(x.interest||'')+'</p><div class="flex gap-2 mt-2"><a target="_blank" class="bg-green-400 text-black px-3 py-2 rounded-lg text-xs font-black" href="'+wa(x.phone,msg)+'">Abrir WhatsApp</a><button class="bg-white/10 px-3 py-2 rounded-lg text-xs" onclick="navigator.clipboard.writeText(currentMessage)">Copiar</button></div></div>').join('');
}
async function createCampaign(type){
 const s=session();
 if(!s.botId||!s.clientToken){show('Entre pelo painel primeiro.');return}
 show('Criando campanha...');
 try{
  const r=await fetch('/.netlify/functions/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken,campaignType:type})});
  const j=await r.json();
  if(!r.ok||!j.success)throw new Error(j.error||'Erro ao criar campanha');
  const c=Array.isArray(j.campaign)?j.campaign[0]:j.campaign;
  currentMessage=c.suggested_message||'';
  const contacts=await loadContacts(currentMessage);
  result.innerHTML='<div class="space-y-4"><div><b class="text-white">Campanha criada:</b> '+esc(c.name||type)+'</div><div class="text-sm text-gray-400">Revise a mensagem, copie ou abra o WhatsApp de cada contato. O envio automático entra depois.</div><textarea id="msg" oninput="currentMessage=this.value" class="w-full h-36 bg-slate-900 border border-white/10 rounded-xl p-3 text-white">'+esc(currentMessage)+'</textarea><button onclick="copyMsg()" class="bg-green-400 text-black px-4 py-2 rounded-xl font-black">Copiar mensagem geral</button><div id="copied" class="text-green-400 text-sm"></div><h3 class="font-black text-white mt-4">Contatos para usar nesta campanha</h3>'+contacts+'</div>';
 }catch(e){show('Erro: '+e.message)}
}
