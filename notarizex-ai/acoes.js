function S(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
function card(t,d,l){return '<div style="border:1px solid #333;border-radius:12px;padding:14px;margin:10px 0"><b>'+t+'</b><p>'+d+'</p>'+(l?'<p>'+l+'</p>':'')+'</div>'}
async function post(url,body){var r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json()}
function msgFor(x){var i=x.intent||x.event_type||'';if(i.indexOf('human')>=0||i==='handoff')return 'Responder agora e assumir atendimento humano.';if(i.indexOf('schedule')>=0||i==='agendamento')return 'Confirmar dados e sugerir horário.';if(i.indexOf('follow')>=0)return 'Fazer retorno combinado.';if(i==='orcamento')return 'Enviar orçamento ou pedir detalhes finais.';return 'Verificar conversa e dar continuidade.'}
async function loadActions(){
 result.innerHTML='Carregando...';var s=S();if(!s.botId){result.innerHTML='Entre no painel primeiro.';return}
 var ev=await post('/.netlify/functions/smartbot-events',{botId:s.botId,clientToken:s.clientToken});
 var cv=await post('/.netlify/functions/smartbot-conversations',{botId:s.botId,clientToken:s.clientToken});
 var out='<h2>Pendentes</h2>';
 (ev.events||[]).filter(function(x){return (x.status||'pending')==='pending'}).slice(0,20).forEach(function(x){out+=card(x.event_type,msgFor(x),x.created_at)});
 out+='<h2>Conversas recentes</h2>';
 (cv.conversations||[]).slice(0,10).forEach(function(x){out+=card(x.customer_name||x.visitor_id||'Visitante',msgFor(x),x.last_message||'')});
 result.innerHTML=out;
}
document.addEventListener('DOMContentLoaded',loadActions);
