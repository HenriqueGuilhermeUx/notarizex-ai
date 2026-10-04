const fetch=require('node-fetch');
const headers={'Content-Type':'application/json','Cache-Control':'public, max-age=60, stale-while-revalidate=300','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'OPTIONS,POST'};
function reply(c,b){return{statusCode:c,headers,body:JSON.stringify(b)}}
function clean(v,max=0){const s=String(v||'').trim();return max?s.slice(0,max):s}
async function db(path){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase indisponível.');return fetch(url+'/rest/v1/'+path,{headers:{apikey:key,Authorization:'Bearer '+key}})}
async function rows(r,label){if(!r.ok)throw new Error(label+': '+(await r.text()).slice(0,500));return r.json()}
function safe(site,bot){
  return{
    slug:site.slug,theme:site.theme,accentColor:site.accent_color,logoUrl:site.logo_url||null,heroImageUrl:site.hero_image_url||null,
    eyebrow:site.eyebrow||null,title:site.title,subtitle:site.subtitle||null,aboutTitle:site.about_title||null,aboutText:site.about_text||null,
    primaryCtaLabel:site.primary_cta_label||'Falar agora',primaryCtaKind:site.primary_cta_kind||'chat',primaryCtaUrl:site.primary_cta_url||null,
    secondaryCtaLabel:site.secondary_cta_label||null,secondaryCtaUrl:site.secondary_cta_url||null,sections:Array.isArray(site.sections)?site.sections:[],
    faq:Array.isArray(site.faq)?site.faq:[],contact:site.contact&&typeof site.contact==='object'?site.contact:{},seo:site.seo&&typeof site.seo==='object'?site.seo:{},
    companyName:bot.company_name,botId:bot.bot_id,publishedAt:site.published_at||null,updatedAt:site.updated_at||null
  }
}
exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers,body:''};
  if(event.httpMethod!=='POST')return reply(405,{success:false,error:'Method Not Allowed'});
  try{
    const body=JSON.parse(event.body||'{}'),slug=clean(body.slug,90).toLowerCase();
    if(!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(slug))return reply(404,{success:false,error:'MiniSite não encontrado.'});
    const sites=await rows(await db('smartbot_minisites?slug=eq.'+encodeURIComponent(slug)+'&status=eq.published&select=*&limit=1'),'MiniSite');
    const site=sites[0];if(!site)return reply(404,{success:false,error:'MiniSite não encontrado.'});
    const bots=await rows(await db('website_bots?bot_id=eq.'+encodeURIComponent(site.bot_id)+'&select=bot_id,company_name,status,billing_status&limit=1'),'SmartBot');
    const bot=bots[0];if(!bot)return reply(404,{success:false,error:'MiniSite não encontrado.'});
    return reply(200,{success:true,site:safe(site,bot)});
  }catch(error){console.error('[MiniSitePublic]',error.message);return reply(500,{success:false,error:'Não foi possível carregar este MiniSite agora.'})}
};
