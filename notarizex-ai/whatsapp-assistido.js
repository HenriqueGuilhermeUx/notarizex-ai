const T={
 orcamento:'Oi, tudo bem? Recebi seu contato pelo nosso atendimento. Posso te ajudar com um orçamento. Me diga qual serviço você procura e qual melhor horário para falarmos.',
 agendamento:'Oi, tudo bem? Recebi seu pedido de agendamento. Qual dia e horário fica melhor para você?',
 reativacao:'Oi, tudo bem? Aqui é da equipe. Vi que você já teve contato conosco e queria saber se ainda podemos ajudar em algo.',
 indicacao:'Oi, tudo bem? Ficamos felizes com sua confiança. Você conhece alguém que também poderia precisar da nossa ajuda? Pode me passar o nome e WhatsApp por aqui.',
 retorno:'Oi, tudo bem? Estou passando para lembrar do seu retorno. Quer que a gente veja um melhor horário para você?',
 humano:'Oi, tudo bem? A equipe recebeu sua solicitação e vai dar continuidade por aqui.'
};
function sess(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
function esc(v){return String(v||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function js(v){return esc(v).replace(/'/g,'&#39;')}
function dig(v){return String(v||'').replace(/\D/g,'')}
function wa(p,m){let n=dig(p);if(!n)return '#';if(!n.startsWith('55')&&n.length>=10)n='55'+n;return 'https://wa.me/'+n+'?text='+encodeURIComponent(m||'Olá')}
function setTemplate(){message.value=T[template.value]||T.orcamento}
function copyMsg(){navigator.clipboard.writeText(message.value);status.textContent='Mensagem copiada.'}
function openManual(){if(!phone.value){status.textContent='Informe o WhatsApp.';return}window.open(wa(phone.value,message.value),'_blank')}
function fill(p,m){phone.value=p||'';message.value=m||T.orcamento;window.scrollTo({top:0,behavior:'smooth'})}
async function api(b){const s=sess();const r=await fetch('/.netlify/functions/opportunities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({botId:s.botId,clientToken:s.clientToken},b))});return r.json()}
async function setLead(id,st){await api({action:'update',leadId:id,status:st});loadContacts()}
async function openLead(id,p,m){await api({action:'update',leadId:id,status:'contatado'});window.open(wa(p,m),'_blank');loadContacts()}
async function loadContacts(){const s=sess();if(!s.botId){list.textContent='Entre pelo painel primeiro.';return}list.textContent='Carregando...';try{const j=await api({action:'list'});const arr=(j.leads||[]).filter(x=>x.phone).slice(0,120);if(!arr.length){list.textContent='Nenhum contato com WhatsApp ainda.';return}list.innerHTML=arr.map(x=>{let msg=x.intent==='reativacao'?T.reativacao:x.intent==='agendamento'?T.agendamento:x.pipeline_status==='retorno_futuro'?T.retorno:T.orcamento;return '<div class="border-b border-white/10 py-3"><div class="flex flex-col md:flex-row md:justify-between gap-2"><div><b class="text-white">'+esc(x.name||x.phone)+'</b><p class="text-sm text-gray-400">'+esc(x.interest||'')+'</p><p class="text-xs text-green-400">'+esc(x.intent||'')+' · '+esc(x.pipeline_status||'novo')+'</p></div><div class="flex flex-wrap gap-2"><button class="bg-white/10 px-3 py-2 rounded-lg text-xs" onclick="fill(\''+js(x.phone)+'\',\''+js(msg)+'\')">Usar</button><button class="bg-green-400 text-black px-3 py-2 rounded-lg text-xs font-black" onclick="openLead(\''+js(x.id)+'\',\''+js(x.phone)+'\',\''+js(msg)+'\')">WhatsApp</button><button class="bg-white/10 px-3 py-2 rounded-lg text-xs" onclick="setLead(\''+js(x.id)+'\',\'contatado\')">Contatado</button><button class="bg-white/10 px-3 py-2 rounded-lg text-xs" onclick="setLead(\''+js(x.id)+'\',\'agendado\')">Agendado</button><button class="bg-white/10 px-3 py-2 rounded-lg text-xs" onclick="setLead(\''+js(x.id)+'\',\'perdido\')">Perdido</button></div></div></div>'}).join('')}catch(e){list.textContent='Erro: '+e.message}}
document.addEventListener('DOMContentLoaded',function(){setTemplate();loadContacts()});
