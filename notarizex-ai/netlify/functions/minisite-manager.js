const crypto=require('crypto');
const fetch=require('node-fetch');
const {resolvePortalSession}=require('./lib/client-portal-session');
const {crawlWebsite}=require('./lib/crawler-client');

const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://smartbots.club','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'OPTIONS,POST'};
function reply(c,b){return{statusCode:c,headers,body:JSON.stringify(b)}}
function clean(v,max=0){const s=String(v||'').replace(/\s+/g,' ').trim();return max?s.slice(0,max):s}
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function arr(v){return Array.isArray(v)?v:[]}
function color(v){const x=clean(v,16);return /^#[0-9a-f]{6}$/i.test(x)?x.toLowerCase():'#00ff88'}
function safeUrl(v){const x=clean(v,1400);if(!x)return null;try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)?u.toString():null}catch{return null}}
function slugify(v){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,72)||'empresa'}
function now(){return new Date().toISOString()}
async function db(path,opt={}){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase service role não configurado.');return fetch(url+'/rest/v1/'+path,{...opt,headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key,...(opt.headers||{})}})}
async function rows(r,label){if(!r.ok)throw new Error(label+': '+(await r.text()).slice(0,700));const raw=await r.text();return raw?JSON.parse(raw):[]}
async function getOne(path,label){return(await rows(await db(path),label))[0]||null}
async function getSite(botId){return getOne('smartbot_minisites?bot_id=eq.'+encodeURIComponent(botId)+'&select=*&limit=1','MiniSite')}
async function uniqueSlug(base,botId){
  let candidate=slugify(base);
  for(let i=0;i<20;i++){
    const slug=i?candidate+'-'+(i+1):candidate;
    const found=await getOne('smartbot_minisites?slug=eq.'+encodeURIComponent(slug)+'&select=bot_id&limit=1','slug');
    if(!found||found.bot_id===botId)return slug;
  }
  return candidate+'-'+crypto.randomBytes(3).toString('hex');
}
function snapshotFromRow(x){return{theme:x.theme,accentColor:x.accent_color,logoUrl:x.logo_url||null,heroImageUrl:x.hero_image_url||null,eyebrow:x.eyebrow||null,title:x.title,subtitle:x.subtitle||null,aboutTitle:x.about_title||null,aboutText:x.about_text||null,primaryCtaLabel:x.primary_cta_label||'Falar agora',primaryCtaKind:x.primary_cta_kind||'chat',primaryCtaUrl:x.primary_cta_url||null,secondaryCtaLabel:x.secondary_cta_label||null,secondaryCtaUrl:x.secondary_cta_url||null,sections:x.sections||[],faq:x.faq||[],contact:x.contact||{},seo:x.seo||{}}}
function publicSite(x){if(!x)return null;const changed=x.status==='published'&&x.published_at&&x.updated_at&&new Date(x.updated_at).getTime()>new Date(x.published_at).getTime()+500;return{id:x.id,slug:x.slug,status:x.status,theme:x.theme,accentColor:x.accent_color,logoUrl:x.logo_url,heroImageUrl:x.hero_image_url,eyebrow:x.eyebrow,title:x.title,subtitle:x.subtitle,aboutTitle:x.about_title,aboutText:x.about_text,primaryCtaLabel:x.primary_cta_label,primaryCtaKind:x.primary_cta_kind,primaryCtaUrl:x.primary_cta_url,secondaryCtaLabel:x.secondary_cta_label,secondaryCtaUrl:x.secondary_cta_url,sections:x.sections||[],faq:x.faq||[],contact:x.contact||{},seo:x.seo||{},sourceWebsite:x.source_website||null,generatedAt:x.generated_at||null,publishedAt:x.published_at||null,updatedAt:x.updated_at||null,hasUnpublishedChanges:Boolean(changed),publicUrl:x.status==='published'?'https://smartbots.club/s/'+encodeURIComponent(x.slug):null}}
async function context(bot){
  const botId=bot.bot_id;
  const [profile,knowledge,catalogConfig,catalogItems,agenda]=await Promise.all([
    getOne('smartbot_profiles?bot_id=eq.'+encodeURIComponent(botId)+'&active=eq.true&select=*&limit=1','perfil'),
    rows(await db('smartbot_knowledge?bot_id=eq.'+encodeURIComponent(botId)+'&is_active=eq.true&select=title,content,source_type,updated_at&order=updated_at.desc&limit=18'),'knowledge'),
    getOne('smartbot_catalog_config?bot_id=eq.'+encodeURIComponent(botId)+'&select=*&limit=1','catálogo config'),
    rows(await db('smartbot_catalog_items?bot_id=eq.'+encodeURIComponent(botId)+'&active=eq.true&select=name,category,description,price,currency,availability_status,attributes,item_type&order=sort_order.asc,created_at.asc&limit=60'),'catálogo itens'),
    getOne('smartbot_agenda_config?bot_id=eq.'+encodeURIComponent(botId)+'&is_active=eq.true&select=booking_url,button_label,services,business_hours,notes&limit=1','agenda')
  ]);
  return{bot,profile,knowledge,catalogConfig,catalogItems,agenda};
}
function compactContext(c,crawl){
  const knowledge=c.knowledge.map(k=>`[${k.source_type||'base'}] ${k.title||''}\n${clean(k.content,2500)}`).join('\n\n').slice(0,15000);
  const items=c.catalogItems.slice(0,30).map(x=>({
    name:x.name,category:x.category||x.item_type||null,description:clean(x.description,600)||null,
    price:x.price, currency:x.currency, availability:x.availability_status, attributes:obj(x.attributes)
  }));
  return JSON.stringify({
    company:{name:c.bot.company_name,website:c.bot.website||null,whatsapp:c.bot.owner_whatsapp||null,businessDescription:c.bot.business_description||null},
    profile:c.profile?{assistantName:c.profile.assistant_name,primaryGoal:c.profile.primary_goal,businessContext:c.profile.business_context,audience:c.profile.audience}:null,
    catalog:c.catalogConfig&&c.catalogConfig.enabled?{name:c.catalogConfig.display_name,currency:c.catalogConfig.currency,showPrices:c.catalogConfig.show_prices,notes:c.catalogConfig.notes,items}:null,
    agenda:c.agenda||null,
    knowledge,
    website:crawl?{source:crawl.source,summary:clean(crawl.combinedText,18000),brand:crawl.brand||{},pages:crawl.pages.slice(0,8).map(p=>({url:p.url,title:p.title,description:p.description}))}:null
  }).slice(0,36000);
}
const SCHEMA={
  type:'object',additionalProperties:false,
  properties:{
    eyebrow:{type:'string'},title:{type:'string'},subtitle:{type:'string'},aboutTitle:{type:'string'},aboutText:{type:'string'},
    primaryCtaLabel:{type:'string'},primaryCtaKind:{type:'string',enum:['chat','whatsapp','agenda','link']},
    sections:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,properties:{type:{type:'string',enum:['cards','text','steps']},title:{type:'string'},text:{type:'string'},items:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},text:{type:'string'},badge:{type:['string','null']},price:{type:['string','null']}},required:['title','text','badge','price']}}},required:['type','title','text','items']}},
    faq:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,properties:{question:{type:'string'},answer:{type:'string'}},required:['question','answer']}},
    seo:{type:'object',additionalProperties:false,properties:{title:{type:'string'},description:{type:'string'}},required:['title','description']}
  },
  required:['eyebrow','title','subtitle','aboutTitle','aboutText','primaryCtaLabel','primaryCtaKind','sections','faq','seo']
};
function responseText(data){if(data&&typeof data.output_text==='string'&&data.output_text.trim())return data.output_text.trim();const out=[];for(const item of(data&&data.output)||[])if(item&&item.type==='message')for(const c of item.content||[])if(c&&c.type==='output_text'&&c.text)out.push(c.text);return out.join('\n').trim()}
async function generateCopy(c,crawl){
  const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('OPENAI_API_KEY ausente.');
  const model=(c.profile&&c.profile.ai_model)||'gpt-5.6-luna';
  const evidence=compactContext(c,crawl);
  const prompt=`Crie o conteúdo de um MiniSite comercial curto, elegante e útil para a empresa abaixo.
Use SOMENTE fatos presentes nas evidências. Não invente serviços, preços, depoimentos, números, certificações, clientes, urgência, endereço ou benefícios específicos.
Se um preço não estiver cadastrado, price deve ser null. Se faltarem fatos para uma seção, faça uma seção institucional simples sem inventar.
O título deve ser claro e orientado ao valor real da empresa, sem clichês exagerados.
O CTA principal deve ser chat quando houver SmartBot; use agenda somente se houver booking_url explícita; use whatsapp quando for claramente o melhor caminho e existir telefone.
FAQ deve responder dúvidas sustentadas pelas evidências.
Retorne JSON no schema solicitado.

EVIDÊNCIAS:
<<<EVIDENCIAS
${evidence}
EVIDENCIAS>>>`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,reasoning:{effort:'low'},text:{verbosity:'low',format:{type:'json_schema',name:'smartbots_minisite',strict:true,schema:SCHEMA}},max_output_tokens:2200,store:false,input:[{role:'developer',content:'Você cria páginas comerciais factuais e concisas. Nunca invente fatos.'},{role:'user',content:prompt}]})});
  if(!r.ok)throw new Error('OpenAI MiniSite: '+(await r.text()).slice(0,700));
  const data=await r.json(),raw=responseText(data);if(!raw)throw new Error('OpenAI MiniSite: resposta vazia');
  return JSON.parse(raw);
}
function fallbackCopy(c){
  const company=c.bot.company_name||'Sua empresa',desc=clean(c.profile&&c.profile.business_context||c.bot.business_description||'',1000);
  const items=c.catalogItems.slice(0,6).map(x=>({title:x.name,text:clean(x.description,300)||'Consulte detalhes com nossa equipe.',badge:x.category||null,price:x.price!=null&&c.catalogConfig&&c.catalogConfig.show_prices!==false?`${x.currency||'BRL'} ${Number(x.price).toFixed(2)}`:null}));
  return{eyebrow:'Atendimento inteligente',title:company,subtitle:desc||'Informações, dúvidas e atendimento em um só lugar.',aboutTitle:'Sobre',aboutText:desc||`Conheça a ${company} e fale com nosso atendimento inteligente.`,primaryCtaLabel:'Falar agora',primaryCtaKind:'chat',sections:items.length?[{type:'cards',title:c.catalogConfig&&c.catalogConfig.display_name||'O que oferecemos',text:'',items}]:[],faq:[],seo:{title:company,description:desc||`Atendimento da ${company}`}};
}
async function save(bot,existing,patch){
  const payload={bot_id:bot.bot_id,updated_at:now(),...patch};
  let r;if(existing)r=await db('smartbot_minisites?bot_id=eq.'+encodeURIComponent(bot.bot_id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
  else r=await db('smartbot_minisites',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
  return(await rows(r,'salvar MiniSite'))[0];
}
function sanitizeSections(value){return arr(value).slice(0,8).map(s=>({type:['cards','text','steps'].includes(clean(s.type))?clean(s.type):'text',title:clean(s.title,180),text:clean(s.text,1800),items:arr(s.items).slice(0,10).map(i=>({title:clean(i.title,180),text:clean(i.text,900),badge:clean(i.badge,100)||null,price:clean(i.price,80)||null}))}))}
function sanitizeFaq(value){return arr(value).slice(0,10).map(x=>({question:clean(x.question,240),answer:clean(x.answer,1200)})).filter(x=>x.question&&x.answer)}
exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers,body:''};
  if(event.httpMethod!=='POST')return reply(405,{success:false,error:'Method Not Allowed'});
  try{
    const body=JSON.parse(event.body||'{}'),bot=await resolvePortalSession(body.portalToken);
    if(!bot)return reply(401,{success:false,error:'Sessão expirada. Entre novamente no painel.'});
    const action=clean(body.action||'get'),existing=await getSite(bot.bot_id);
    if(action==='get')return reply(200,{success:true,companyName:bot.company_name,site:publicSite(existing),canGenerate:true});
    if(action==='generate'){
      const c=await context(bot);let crawl=null;
      if(bot.website){try{crawl=await crawlWebsite(bot.website,8)}catch(e){console.warn('[MiniSite] crawl:',e.message)}}
      let generated;try{generated=await generateCopy(c,crawl)}catch(e){console.warn('[MiniSite] AI fallback:',e.message);generated=fallbackCopy(c)}
      const slug=existing&&existing.slug||await uniqueSlug(bot.company_name,bot.bot_id);
      const brand=obj(crawl&&crawl.brand),accent=color(arr(brand.colors)[0]||existing&&existing.accent_color||'#00ff88');
      const agendaUrl=c.agenda&&clean(c.agenda.booking_url,1000)||null,whatsapp=clean(bot.owner_whatsapp,40)||null;
      let kind=generated.primaryCtaKind||'chat',url=null;
      if(kind==='agenda'&&agendaUrl)url=agendaUrl;else if(kind==='whatsapp'&&whatsapp)url='https://wa.me/'+whatsapp.replace(/\D/g,'');else if(kind==='link'&&bot.website)url=bot.website;else kind='chat';
      const saved=await save(bot,existing,{slug,status:existing&&existing.status==='published'?'published':'draft',theme:existing&&existing.theme||'aurora',accent_color:accent,logo_url:safeUrl(brand.logoUrl)||existing&&existing.logo_url||null,eyebrow:clean(generated.eyebrow,120),title:clean(generated.title,220)||bot.company_name,subtitle:clean(generated.subtitle,900),about_title:clean(generated.aboutTitle,180),about_text:clean(generated.aboutText,2400),primary_cta_label:clean(generated.primaryCtaLabel,100)||'Falar agora',primary_cta_kind:kind,primary_cta_url:safeUrl(url),sections:sanitizeSections(generated.sections),faq:sanitizeFaq(generated.faq),contact:{whatsapp,email:bot.owner_email||bot.email||null,website:bot.website||null,bookingUrl:agendaUrl},seo:obj(generated.seo),source_website:bot.website||null,source_snapshot:{crawler:crawl&&crawl.source||null,pageCount:crawl&&crawl.pageCount||0,brand},generated_at:now()});
      return reply(200,{success:true,generated:true,site:publicSite(saved)});
    }
    if(action==='save'){
      const slug=existing&&existing.slug||await uniqueSlug(body.slug||bot.company_name,bot.bot_id);
      const patch={slug,theme:clean(body.theme,40)||existing&&existing.theme||'aurora',accent_color:color(body.accentColor||existing&&existing.accent_color),logo_url:safeUrl(body.logoUrl),hero_image_url:safeUrl(body.heroImageUrl),eyebrow:clean(body.eyebrow,120),title:clean(body.title,220)||bot.company_name,subtitle:clean(body.subtitle,900),about_title:clean(body.aboutTitle,180),about_text:clean(body.aboutText,2400),primary_cta_label:clean(body.primaryCtaLabel,100)||'Falar agora',primary_cta_kind:['chat','whatsapp','agenda','link'].includes(clean(body.primaryCtaKind))?clean(body.primaryCtaKind):'chat',primary_cta_url:safeUrl(body.primaryCtaUrl),secondary_cta_label:clean(body.secondaryCtaLabel,100)||null,secondary_cta_url:safeUrl(body.secondaryCtaUrl),sections:sanitizeSections(body.sections),faq:sanitizeFaq(body.faq),seo:{title:clean(obj(body.seo).title,180)||bot.company_name,description:clean(obj(body.seo).description,320)||clean(body.subtitle,320)}};
      const saved=await save(bot,existing,patch);return reply(200,{success:true,site:publicSite(saved)});
    }
    if(action==='publish'){
      if(!existing)return reply(409,{success:false,error:'Gere ou salve o MiniSite antes de publicar.'});
      const publishedAt=now(),snapshot=snapshotFromRow(existing);const saved=await save(bot,existing,{status:'published',published_snapshot:snapshot,published_at:publishedAt,updated_at:publishedAt});return reply(200,{success:true,published:true,site:publicSite(saved)});
    }
    if(action==='unpublish'){
      if(!existing)return reply(404,{success:false,error:'MiniSite não encontrado.'});
      const saved=await save(bot,existing,{status:'draft'});return reply(200,{success:true,published:false,site:publicSite(saved)});
    }
    return reply(422,{success:false,error:'Ação inválida.'});
  }catch(error){console.error('[MiniSiteManager]',error);return reply(500,{success:false,error:error.message||'Falha no MiniSite.'})}
};
