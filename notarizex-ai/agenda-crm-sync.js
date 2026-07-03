async function syncLeadAgendado(){
  var p=new URLSearchParams(location.search);
  var leadId=p.get('leadId');
  if(!leadId)return;
  try{
    var s=JSON.parse(localStorage.getItem('sb_session')||'{}');
    await fetch('/.netlify/functions/opportunities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update',botId:s.botId,clientToken:s.clientToken,leadId:leadId,status:'agendado'})});
  }catch(e){}
}
document.addEventListener('click',function(e){
  if(e.target&&String(e.target.textContent||'').indexOf('Salvar agendamento')>=0){setTimeout(syncLeadAgendado,1200)}
});
