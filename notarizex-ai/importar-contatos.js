function getSession(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}

function normalizeHeader(h){
  h=String(h||'').trim().toLowerCase();
  const map={nome:'name',telefone:'phone',whatsapp:'phone',celular:'phone',email:'email','e-mail':'email',interesse:'interest',servico:'interest','serviço':'interest',observacao:'notes','observação':'notes',obs:'notes'};
  return map[h]||h;
}

function parseCsv(text){
  const lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length)return [];
  const header=lines.shift().split(',').map(normalizeHeader);
  return lines.map(line=>{
    const parts=line.split(',').map(p=>p.trim());
    const obj={};
    header.forEach((h,i)=>obj[h]=parts[i]||'');
    return obj;
  });
}

function loadCsvFile(event){
  const file=event.target.files&&event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{csv.value=String(reader.result||'');result.textContent='Arquivo carregado. Confira os dados e clique em importar.'};
  reader.onerror=()=>{result.textContent='Erro ao ler o arquivo.'};
  reader.readAsText(file,'UTF-8');
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
