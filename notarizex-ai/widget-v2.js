(function(){
window.SmartBots=window.SmartBots||{};
function id(){var x=localStorage.getItem('smartbots_visitor_id');if(!x){x='v-'+Date.now();localStorage.setItem('smartbots_visitor_id',x)}return x}
window.SmartBots.init=function(c){
 c=c||{};var botId=c.botId;if(!botId)return;var color=c.primaryColor||'#00FF88',visitor=id();
 var css='.sb2btn{position:fixed;right:22px;bottom:22px;border:0;border-radius:50%;width:62px;height:62px;background:'+color+';z-index:999999;font-size:25px}.sb2box{position:fixed;right:22px;bottom:95px;width:360px;max-width:calc(100vw - 30px);height:560px;background:#0f1722;color:white;border:1px solid #334155;border-radius:20px;z-index:999999;display:none;overflow:hidden;font-family:Arial}.sb2head{padding:15px;font-weight:900;background:#111827}.sb2body{height:365px;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}.sb2m{padding:10px;border-radius:12px;font-size:14px}.sb2bot{background:#1f2937}.sb2user{background:'+color+';color:#06120b;align-self:flex-end;font-weight:700}.sb2quick{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px}.sb2quick button{background:#1f2937;color:white;border:1px solid #334155;border-radius:10px;padding:8px;font-size:12px}.sb2form{display:flex;gap:6px;padding:10px;border-top:1px solid #334155}.sb2form input{flex:1;background:#111827;color:white;border:1px solid #334155;border-radius:10px;padding:10px}.sb2form button{background:'+color+';border:0;border-radius:10px;padding:0 12px;font-weight:900}';
 var st=document.createElement('style');st.innerHTML=css;document.head.appendChild(st);
 var b=document.createElement('button');b.className='sb2btn';b.innerHTML='chat';
 var box=document.createElement('div');box.className='sb2box';box.innerHTML='<div class="sb2head">SmartBots IA</div><div class="sb2body"></div><div class="sb2quick"><button data-q="Quero um orçamento">Orçamento</button><button data-q="Quero agendar um horário">Agendar</button><button data-q="Tenho uma dúvida">Dúvida</button><button data-q="Quero falar com um humano">Humano</button></div><form class="sb2form"><input placeholder="Digite sua mensagem..."><button>Enviar</button></form>';
 document.body.appendChild(b);document.body.appendChild(box);var body=box.querySelector('.sb2body'),inp=box.querySelector('input');
 function add(t,u){var d=document.createElement('div');d.className='sb2m '+(u?'sb2user':'sb2bot');d.textContent=t;body.appendChild(d);body.scrollTop=body.scrollHeight}
 async function send(t){if(!t)return;add(t,1);add('Pensando...',0);var w=body.lastChild;try{var r=await fetch('/.netlify/functions/smartbot-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:botId,visitorId:visitor,channel:'site',message:t})});var j=await r.json();w.textContent=j.reply||j.error||'A equipe vai retornar.'}catch(e){w.textContent='Erro. Deixe seu nome e WhatsApp.'}}
 b.onclick=function(){box.style.display=box.style.display==='block'?'none':'block';if(!box.dataset.s){add('Olá! Posso ajudar com orçamento, agendamento, dúvidas ou atendimento humano.',0);box.dataset.s=1}};
 box.querySelectorAll('[data-q]').forEach(function(q){q.onclick=function(){send(q.getAttribute('data-q'))}});
 box.querySelector('form').onsubmit=function(e){e.preventDefault();var t=inp.value.trim();inp.value='';send(t)};
}}
)();
