function getSession(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
function parseCsv(text){
  const lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length)return [];
  const header=lines.shift().split(',').map(h=>h.trim().toLowerCase());
  return lines.map(line=>{
    const parts=line.split(',').map(p=>p.trim());
    const obj={};
    header.forEach((h,i)=>obj[h]=parts[i]||'');
    return obj;
  });
}
async function importContacts(){
  const s=getSession();
  if(!s.botId||!s.clientToken){result.textContent='Entre pelo painel primeiro.';return}
  const contacts=parseCsv(csv.value);
  if(!contacts.length){result.textContent='Cole pelo menos um contato.';return}
  result.textContent='Importando...';
  try{
    const res=await fetch('/.netlify/functions/import-contacts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken,contacts})});
    const data=await res.json();
    if(!res.ok||!data.success)throw new Error(data.error||'Erro ao importar');
    result.textContent='Importados: '+(data.imported||[]).length+' contatos. Eles ficaram em Reativação.';
  }catch(e){result.textContent='Erro: '+e.message}
}
