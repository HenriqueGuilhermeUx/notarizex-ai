const T={
 orcamento:'Oi, tudo bem? Recebi seu contato pelo nosso atendimento. Posso te ajudar com um orçamento. Me diga qual serviço você procura e qual melhor horário para falarmos.',
 agendamento:'Oi, tudo bem? Recebi seu pedido de agendamento. Qual dia e horário fica melhor para você?',
 reativacao:'Oi, tudo bem? Aqui é da equipe. Vi que você já teve contato conosco e queria saber se ainda podemos ajudar em algo.',
 indicacao:'Oi, tudo bem? Ficamos felizes com sua confiança. Você conhece alguém que também poderia precisar da nossa ajuda? Pode me passar o nome e WhatsApp por aqui.',
 retorno:'Oi, tudo bem? Estou passando para lembrar do seu retorno. Quer que a gente veja um melhor horário para você?',
 humano:'Oi, tudo bem? A equipe recebeu sua solicitação e vai dar continuidade por aqui.'
};
let firstContact=null;
function E(id){return document.getElementById(id)}
function sess(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
function esc(v){return String(v||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function js(v){return esc(v).replace(/'/g,'&#39;')}
function dig(v){return String(v||'').replace(/\D/g,'')}
function wa(p,m){let n=dig(p);if(!n)return '';if(!n.startsWith('55')&&n.length>=10)n='55'+n;return 'https://wa.me/'+n+'?text='+encodeURIComponent(m||'Olá')}
function setStatus(t){var x=E('status');if(x)x.textContent=t||''}
function setTemplate(){E('message').value=T[E('template').value]||T.orcamento}
function copyMsg(){navigator.clipboard.writeText(E('message').value);setStatus('Mensagem copiada.')}
function openManual(){var p=E('phone').value;if(!p&&firstContact){p=firstContact.phone;E('phone').value=p}if(!p){setStatus('Escolha um contato em "Usar" ou informe o WhatsApp com DDD.');return}var u=wa(p,E('message').value);if(!u){setStatus('WhatsApp inválido. Informe DDD + número.');return}window.open(u,'_blank');setStatus('WhatsApp aberto.')}
function fill(p,m){E('phone').value=p||'';E('message').value=m||T.orcamento;setStatus('Contato carregado. Agora clique em Abrir WhatsApp.');window.scrollTo({top:0,behavior:'smooth'})}
function fromQuery(){var q=new URLSearchParams(location.search),p=q.get('p')||'',t=q.get('t')||'';if(p){E('phone').value=p;if(T[t]){E('template').value=t;E('message').value=T[t]}else{setTemplate()}setStatus('Contato vindo do SmartBots Hoje carregado.')}}
async function api(b){const s=sess();const r=await fetch('/.netlify/functions/opportunities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({botId:s.botId,clientToken:s.clientToken},b))});return r.json()}
async function setLead(id,st){await api({action:'update',leadId:id,status:st});loadContacts()}
async function openLead(id,p,m){await api({action:'update',leadId:id,status:'contatado'});window.open(wa(p,m),'_blank');loadContacts()}
async function loadContacts(){const s=sess();const box=E('list');if(!s.botId){box.textContent='Entre pelo painel primeiro.';return}box.textContent='Carregando...';try{const j=await api({action:'list'});const arr=(j.leads||[]).filter(x=>x.phone).slice(0,120);if(!arr.length){box.textContent='Nenhum contato com WhatsApp ainda.';return}firstContact=arr[0];if(!E('phone').value){let fm=firstContact.intent==='reativacao'?T.reativacao:firstContact.intent==='agendamento'?T.agendamento:firstContact.pipeline_status==='retorno_futuro'?T.retorno:T.orcamento;fill(firstContact.phone,fm)}box.innerHTML=arr.map(x=>{let msg=x.intent==='reativacao'?T.reativacao:x.intent==='agendamento'?T.agendamento:x.pipeline_status==='retorno_futuro'?T.retorno:T.orcamento;return '<div class="border-b border-white/10 py-3"><div class="flex flex-col md:flex-row md:justify-between gap-2"><div><b class="text-white">'+esc(x.name||x.phone)+'</b><p class="text-sm text-gray-400">'+esc(x.interest||'')+'</p><p class="text-xs text-green-400">'+esc(x.intent||'')+' · '+esc(x.pipeline_status||'novo')+'</p></div><div class="flex flex-wrap gap-2"><button class="bg-white/10 px-3 py-2 rounded-lg text-xs" onclick="fill(\''+js(x.phone)+'\',\''+js(msg)+'\')">Usar</button><button class="bg-green-400 text-black px-3 py-2 rounded-lg text-xs font-black" onclick="openLead(\''+js(x.id)+'\',\''+js(x.phone)+'\',\''+js(msg)+'\')">WhatsApp</button><button class="bg-white/10 px-3 py-2 rounded-lg text-xs" onclick="setLead(\''+js(x.id)+'\',\'contatado\')">Contatado</button><button class="bg-white/10 px-3 py-2 rounded-lg text-xs" onclick="setLead(\''+js(x.id)+'\',\'agendado\')">Agendado</button><button class="bg-white/10 px-3 py-2 rounded-lg text-xs" onclick="setLead(\''+js(x.id)+'\',\'perdido\')">Perdido</button></div></div></div>'}).join('')}catch(e){box.textContent='Erro: '+e.message}}
document.addEventListener('DOMContentLoaded',function(){setTemplate();fromQuery();loadContacts()});
