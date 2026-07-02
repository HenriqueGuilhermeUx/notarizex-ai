function session(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
function show(t){document.getElementById('result').textContent=t}
function esc(v){return String(v||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function copyMsg(){var t=document.getElementById('msg');if(!t)return;navigator.clipboard.writeText(t.value);showCopied()}
function showCopied(){var c=document.getElementById('copied');if(c){c.textContent='Mensagem copiada. Agora cole no WhatsApp do cliente.'}}
async function createCampaign(type){
  const s=session();
  if(!s.botId||!s.clientToken){show('Entre pelo painel primeiro.');return}
  show('Criando campanha...');
  try{
    const r=await fetch('/.netlify/functions/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken,campaignType:type})});
    const j=await r.json();
    if(!r.ok||!j.success)throw new Error(j.error||'Erro ao criar campanha');
    const c=Array.isArray(j.campaign)?j.campaign[0]:j.campaign;
    const msg=c.suggested_message||'';
    result.innerHTML='<div class="space-y-4"><div><b class="text-white">Campanha criada:</b> '+esc(c.name||type)+'</div><div class="text-sm text-gray-400">Por enquanto esta campanha gera a mensagem pronta. O envio é manual: copie o texto e envie para clientes pelo WhatsApp. Na próxima etapa, vamos ligar isso aos contatos importados e ao envio controlado.</div><textarea id="msg" class="w-full h-44 bg-slate-900 border border-white/10 rounded-xl p-3 text-white">'+esc(msg)+'</textarea><button onclick="copyMsg()" class="bg-green-400 text-black px-4 py-2 rounded-xl font-black">Copiar mensagem</button><div id="copied" class="text-green-400 text-sm"></div></div>';
  }catch(e){show('Erro: '+e.message)}
}
