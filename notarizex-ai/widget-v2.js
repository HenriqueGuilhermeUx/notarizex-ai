(function(){
window.SmartBots=window.SmartBots||{};
function visitorId(){
  var key='smartbots_visitor_id';
  var x=localStorage.getItem(key);
  if(!x){x='v-'+Date.now()+'-'+Math.random().toString(16).slice(2,8);localStorage.setItem(key,x)}
  return x;
}
function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
window.SmartBots.init=function(c){
  c=c||{};
  var botId=c.botId;
  if(!botId)return;
  var color=c.primaryColor||'#00FF88';
  var visitor=visitorId();
  var title=c.title||c.botName||'Assistente virtual';
  var greeting=c.greeting||'Olá! Como posso ajudar?';
  var apiBase=(c.apiBase||'https://smartbots.club').replace(/\/$/,'');
  var endpoint=apiBase+'/.netlify/functions/smartbot-brain';
  var css='.sb2btn{position:fixed;right:22px;bottom:22px;border:0;border-radius:50%;width:62px;height:62px;background:'+color+';z-index:999999;font-size:25px;cursor:pointer}.sb2box{position:fixed;right:22px;bottom:95px;width:360px;max-width:calc(100vw - 30px);height:560px;background:#0f1722;color:white;border:1px solid #334155;border-radius:20px;z-index:999999;display:none;overflow:hidden;font-family:Arial,sans-serif;box-shadow:0 18px 60px rgba(0,0,0,.35)}.sb2head{padding:15px;font-weight:900;background:#111827}.sb2body{height:365px;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}.sb2m{padding:10px;border-radius:12px;font-size:14px;line-height:1.4;max-width:88%}.sb2bot{background:#1f2937;align-self:flex-start}.sb2user{background:'+color+';color:#06120b;align-self:flex-end;font-weight:700}.sb2quick{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px}.sb2quick button{background:#1f2937;color:white;border:1px solid #334155;border-radius:10px;padding:8px;font-size:12px;cursor:pointer}.sb2form{display:flex;gap:6px;padding:10px;border-top:1px solid #334155}.sb2form input{flex:1;background:#111827;color:white;border:1px solid #334155;border-radius:10px;padding:10px;min-width:0}.sb2form button{background:'+color+';border:0;border-radius:10px;padding:0 12px;font-weight:900;cursor:pointer}';
  var st=document.createElement('style');st.innerHTML=css;document.head.appendChild(st);
  var b=document.createElement('button');b.className='sb2btn';b.setAttribute('aria-label','Abrir atendimento');b.innerHTML='💬';
  var box=document.createElement('div');box.className='sb2box';box.innerHTML='<div class="sb2head">'+esc(title)+'</div><div class="sb2body"></div><div class="sb2quick"><button type="button" data-q="Quero um orçamento">Orçamento</button><button type="button" data-q="Quero agendar um horário">Agendar</button><button type="button" data-q="Tenho uma dúvida">Dúvida</button><button type="button" data-q="Quero falar com um humano">Humano</button></div><form class="sb2form"><input aria-label="Mensagem" placeholder="Digite sua mensagem..."><button type="submit">Enviar</button></form>';
  document.body.appendChild(b);document.body.appendChild(box);
  var body=box.querySelector('.sb2body'),inp=box.querySelector('input');
  function add(t,u){var d=document.createElement('div');d.className='sb2m '+(u?'sb2user':'sb2bot');d.textContent=t;body.appendChild(d);body.scrollTop=body.scrollHeight}
  async function send(t){
    if(!t)return;
    add(t,1);add('Pensando...',0);var w=body.lastChild;
    try{
      var r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:botId,visitorId:visitor,channel:'site',message:t})});
      var j=await r.json().catch(function(){return{}});
      if(!r.ok)throw new Error(j.error||'Falha no atendimento');
      w.textContent=j.reply||'A equipe vai continuar com você.';
    }catch(e){w.textContent='Não consegui responder agora. Tente novamente em instantes ou deixe seu contato.'}
  }
  b.onclick=function(){box.style.display=box.style.display==='block'?'none':'block';if(!box.dataset.s){add(greeting,0);box.dataset.s=1}};
  box.querySelectorAll('[data-q]').forEach(function(q){q.onclick=function(){send(q.getAttribute('data-q'))}});
  box.querySelector('form').onsubmit=function(e){e.preventDefault();var t=inp.value.trim();inp.value='';send(t)};
};
})();
