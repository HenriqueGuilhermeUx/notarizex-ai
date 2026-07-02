function session(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
function show(t){document.getElementById('result').textContent=t}
async function createCampaign(type){
  const s=session();
  if(!s.botId||!s.clientToken){show('Entre pelo painel primeiro.');return}
  show('Criando campanha...');
  try{
    const r=await fetch('/.netlify/functions/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken,campaignType:type})});
    const j=await r.json();
    if(!r.ok||!j.success)throw new Error(j.error||'Erro ao criar campanha');
    const c=Array.isArray(j.campaign)?j.campaign[0]:j.campaign;
    show('Campanha criada: '+(c.name||type)+' | Mensagem sugerida: '+(c.suggested_message||''));
  }catch(e){show('Erro: '+e.message)}
}
