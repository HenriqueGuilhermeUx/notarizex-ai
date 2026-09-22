function session(){
  try{
    return JSON.parse(sessionStorage.getItem('sb_client_session')||localStorage.getItem('sb_session')||'{}');
  }catch(_){return{}}
}
function el(id){return document.getElementById(id)}
function setResult(message,ok=true){var r=el('result');r.textContent=message||'';r.className=ok?'wa-ok':'wa-error'}
async function callApi(body){
  var r=await fetch('/.netlify/functions/whatsapp-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  var d={};try{d=await r.json()}catch(_){}
  if(!r.ok||d.success===false)throw new Error(d.error||'Falha ao acessar configuração WhatsApp');
  return d;
}
function applyConfig(c){
  c=c||{};
  el('phone').value=c.phone||'';
  el('businessName').value=c.businessName||'';
  el('mode').value=c.mode||'assisted';
  el('greeting').value=c.greeting||'';
  el('awayMessage').value=c.awayMessage||'';
  el('humanMessage').value=c.humanMessage||'';
  el('autoReply').checked=c.autoReply===true;
  el('autoReply').disabled=!c.connected;
  el('autoReplyHelp').textContent=c.connected?'Número validado. Você pode ligar ou desligar a resposta automática.':'Auto-reply bloqueado até o provedor validar o número.';
  var badge=el('statusBadge');
  if(c.connected){badge.textContent='● Conectado';badge.className='wa-status connected'}else{badge.textContent='● Pendente';badge.className='wa-status pending'}
  el('providerLine').innerHTML='Provedor: <span class="wa-provider">'+String(c.provider||'manual').replace(/[&<>"']/g,'')+'</span>'+(c.providerPhoneNumberId?' · ID validado: '+String(c.providerPhoneNumberId).replace(/\D/g,''):'');
}
async function loadConfig(){
  var s=session();
  if(!s.botId||!s.clientToken){setResult('Abra esta página a partir do Painel do Cliente e faça login novamente.',false);return}
  setResult('Carregando estado...',true);
  try{
    var d=await callApi({action:'get',botId:s.botId,clientToken:s.clientToken});
    applyConfig(d.config);
    setResult(d.config&&d.config.connected?'WhatsApp conectado ao Brain deste cliente.':'Preferências disponíveis; conexão técnica ainda pendente.',true);
  }catch(e){setResult(e.message,false)}
}
async function saveConfig(){
  var s=session();
  if(!s.botId||!s.clientToken){setResult('Sessão do cliente não encontrada.',false);return}
  var b=el('saveBtn');b.disabled=true;b.textContent='Salvando...';
  try{
    var d=await callApi({
      action:'save',botId:s.botId,clientToken:s.clientToken,
      phone:el('phone').value,businessName:el('businessName').value,mode:el('mode').value,
      greeting:el('greeting').value,awayMessage:el('awayMessage').value,humanMessage:el('humanMessage').value,
      autoReply:el('autoReply').checked
    });
    applyConfig(d.config);setResult(d.message||'Configuração salva.',true);
  }catch(e){setResult(e.message,false)}finally{b.disabled=false;b.textContent='Salvar preferências'}
}
window.addEventListener('load',loadConfig);
