function S(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
function el(id){return document.getElementById(id)}
function val(id){return (el(id)&&el(id).value||'').trim()}
function set(id,v){if(el(id))el(id).value=v||''}
function compose(){
  var parts=[];
  function add(t,c){if(c)parts.push('## '+t+'\n'+c)}
  add('Segmento',val('segment'));
  add('Servicos e produtos',val('services'));
  add('Precos e condicoes',val('prices'));
  add('Horarios, endereco e atendimento',val('hours'));
  add('Perguntas frequentes',val('faq'));
  add('Politicas e regras',val('policies'));
  add('Conteudo do site ou documento',val('sourceText'));
  add('Link de referencia',val('sourceUrl'));
  return parts.join('\n\n');
}
function parseContent(c){
  var map={};
  var current='';
  String(c||'').split('\n').forEach(function(line){
    var m=line.match(/^##\s+(.+)/);
    if(m){current=m[1];map[current]='';return}
    if(current)map[current]+=(map[current]?'\n':'')+line;
  });
  return map;
}
async function callKnowledge(action,bodyExtra){
  if(el('result'))result.innerText='Enviando...';
  var s=S();
  var body=Object.assign({action:action,botId:s.botId,clientToken:s.clientToken,title:val('title')||'Base principal',content:compose()},bodyExtra||{});
  var r=await fetch('/.netlify/functions/smartbot-knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  var j=await r.json().catch(function(){return {success:false,error:'Resposta invalida'}});
  if(!j.success){if(el('result'))result.innerText='Erro: '+(j.error||'Falha');return j}
  if(el('result'))result.innerText='OK';
  return j;
}
async function saveKnowledge(){
  var c=compose();
  if(!c){result.innerText='Preencha pelo menos uma informacao do negocio.';return}
  var j=await callKnowledge('save');
  if(j.success){result.innerText='Base salva. O bot ja pode usar essas informacoes.';loadKnowledge();buildPreview()}
}
async function loadKnowledge(){
  var j=await callKnowledge('list',{content:''});
  var arr=j.items||j.knowledge||[];
  var box=el('sources');
  if(box)box.innerHTML='';
  if(!arr.length){if(box)box.innerHTML='<span class="sb-pill">Nenhuma base cadastrada ainda.</span>';if(el('result'))result.innerText='Nenhuma base cadastrada ainda.';return}
  var first=arr[0];
  set('title',first.title||'Base principal');
  var p=parseContent(first.content||'');
  set('segment',p['Segmento']);
  set('services',p['Servicos e produtos']);
  set('prices',p['Precos e condicoes']);
  set('hours',p['Horarios, endereco e atendimento']);
  set('faq',p['Perguntas frequentes']);
  set('policies',p['Politicas e regras']);
  set('sourceText',p['Conteudo do site ou documento']);
  set('sourceUrl',p['Link de referencia']);
  arr.forEach(function(x){if(box){var d=document.createElement('div');d.className='sb-card';d.innerHTML='<b>'+(x.title||'Base')+'</b><p>'+(x.updated_at||'salva')+'</p>';box.appendChild(d)}});
  if(el('result'))result.innerText='Base carregada.';
  buildPreview();
}
function buildPreview(){
  var services=val('services')||'os servicos cadastrados';
  var hours=val('hours')||'os horarios informados';
  var prices=val('prices')||'condicoes informadas pela empresa';
  var msg='Posso ajudar com '+services.split('\n')[0]+'. Atendimento: '+hours.split('\n')[0]+'. Sobre valores: '+prices.split('\n')[0]+'.';
  if(el('previewBot'))el('previewBot').innerText=msg;
}
function openMiniSite(){
  var s=S();
  if(!s.botId){result.innerText='Entre no painel antes de testar o mini site.';return}
  window.open('/b/'+encodeURIComponent(s.botId),'_blank');
}
document.addEventListener('DOMContentLoaded',function(){loadKnowledge().catch(function(e){if(el('result'))result.innerText='Erro: '+e.message})});
