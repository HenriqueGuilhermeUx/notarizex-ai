function session(){
  try{
    return JSON.parse(sessionStorage.getItem('sb_client_session')||localStorage.getItem('sb_session')||'{}');
  }catch(_){return{}}
}
function el(id){return document.getElementById(id)}
function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function setResult(message,ok=true){var r=el('result');r.textContent=message||'';r.className=ok?'wa-ok':'wa-error'}
async function callApi(body){
  var r=await fetch('/.netlify/functions/whatsapp-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  var d={};try{d=await r.json()}catch(_){}
  if(!r.ok||d.success===false)throw new Error(d.error||'Falha ao acessar configuração WhatsApp');
  return d;
}
function credentials(){
  var s=session();
  if(!s.botId||!s.clientToken)throw new Error('Abra esta página pelo Painel do Cliente e faça login novamente.');
  return s;
}
function typeLabel(v){return v==='coexistence'?'Coexistência (App + SmartBots)':v==='dedicated'?'Dedicado (Cloud API)':v||'—'}
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
  el('autoReplyHelp').textContent=c.connected?'Número validado. Você pode ligar ou desligar a resposta automática.':'Auto-reply bloqueado até a Kapso confirmar o número.';
  var badge=el('statusBadge');
  if(c.connected){badge.textContent='● Conectado';badge.className='wa-status connected'}
  else if(c.status==='connection_failed'){badge.textContent='● Falha na conexão';badge.className='wa-status failed'}
  else if(c.status==='connecting'){badge.textContent='● Conectando';badge.className='wa-status pending'}
  else{badge.textContent='● Não conectado';badge.className='wa-status pending'}
  el('providerLine').innerHTML='Provedor: <span class="wa-provider">'+esc(c.provider||'kapso')+'</span>'+(c.phone?' · '+esc(c.phone):'');
  el('notConnectedBox').style.display=c.connected?'none':'block';
  el('connectedBox').style.display=c.connected?'block':'none';
  el('connectedPhone').value=c.phone||'';
  el('connectedType').value=typeLabel(c.connectionType);
  if(c.connectionError){el('setupInfo').textContent='Última tentativa: '+c.connectionError}else if(c.setupExpiresAt&&!c.connected){el('setupInfo').textContent='Link de conexão válido até '+new Date(c.setupExpiresAt).toLocaleString('pt-BR')}
}
async function loadConfig(){
  try{
    var s=credentials();
    setResult('Carregando estado...',true);
    var d=await callApi({action:'get',botId:s.botId,clientToken:s.clientToken});
    applyConfig(d.config);
    var qs=new URLSearchParams(location.search);
    if(qs.get('kapso')==='success'){
      setResult('A Meta concluiu o fluxo. Confirmando o número na Kapso...',true);
      await checkConnection(true);
      history.replaceState({},'',location.pathname);
      return;
    }
    if(qs.get('kapso')==='failed'){
      setResult('A conexão não foi concluída. Você pode gerar um novo link e tentar novamente.',false);
      history.replaceState({},'',location.pathname);
      return;
    }
    setResult(d.config&&d.config.connected?'WhatsApp conectado ao Brain deste cliente.':'Pronto para conectar o WhatsApp deste cliente.',true);
  }catch(e){setResult(e.message,false)}
}
async function startConnection(){
  var b=el('connectBtn');
  try{
    var s=credentials();b.disabled=true;b.textContent='Preparando conexão...';
    setResult('Criando conexão segura na Kapso...',true);
    var d=await callApi({action:'connect_start',botId:s.botId,clientToken:s.clientToken});
    applyConfig(d.config);
    if(d.alreadyConnected){setResult('Este SmartBot já tem um WhatsApp conectado.',true);return}
    if(!d.setupUrl)throw new Error('A Kapso não retornou o link de conexão.');
    el('setupInfo').textContent=d.expiresAt?'Link válido até '+new Date(d.expiresAt).toLocaleString('pt-BR'):'';
    setResult('Abrindo o fluxo oficial da Meta. Conclua a conexão e você voltará ao SmartBots.',true);
    window.location.href=d.setupUrl;
  }catch(e){setResult(e.message,false)}finally{b.disabled=false;b.textContent='Conectar meu WhatsApp'}
}
async function checkConnection(silent){
  var b=el('verifyBtn');
  try{
    var s=credentials();if(b){b.disabled=true;b.textContent='Verificando...'}
    if(!silent)setResult('Consultando a Kapso...',true);
    var d=await callApi({action:'connect_status',botId:s.botId,clientToken:s.clientToken});
    applyConfig(d.config);
    if(d.config&&d.config.connected){
      setResult('Conexão confirmada! Agora você pode ativar a resposta automática.',true);
    }else if(d.setupStatus==='failed'){
      setResult('A Kapso informou falha na conexão. Gere um novo link e tente novamente.',false);
    }else{
      setResult('A conexão ainda não apareceu como concluída. Termine o fluxo da Meta e verifique novamente.',true);
    }
  }catch(e){setResult(e.message,false)}finally{if(b){b.disabled=false;b.textContent='Já conectei — verificar'}}
}
async function saveConfig(){
  var b=el('saveBtn');
  try{
    var s=credentials();b.disabled=true;b.textContent='Salvando...';
    var d=await callApi({
      action:'save',botId:s.botId,clientToken:s.clientToken,
      businessName:el('businessName').value,mode:el('mode').value,
      greeting:el('greeting').value,awayMessage:el('awayMessage').value,humanMessage:el('humanMessage').value,
      autoReply:el('autoReply').checked
    });
    applyConfig(d.config);setResult(d.message||'Configuração salva.',true);
  }catch(e){setResult(e.message,false)}finally{b.disabled=false;b.textContent='Salvar preferências'}
}
window.startConnection=startConnection;
window.checkConnection=checkConnection;
window.saveConfig=saveConfig;
window.loadConfig=loadConfig;
window.addEventListener('load',loadConfig);
