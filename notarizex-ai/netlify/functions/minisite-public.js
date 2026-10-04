const fetch=require('node-fetch');
const headers={'Content-Type':'application/json','Cache-Control':'public, max-age=60, stale-while-revalidate=300','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'OPTIONS,POST'};
function reply(c,b){return{statusCode:c,headers,body:JSON.stringify(b)}}
function clean(v,max=0){const s=String(v||'').trim();return max?s.slice(0,max):s}
async function db(path){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase indisponível.');return fetch(url+'/rest/v1/'+path,{headers:{apikey:key,Authorization:'Bearer '+key}})}
async function rows(r,label){if(!r.ok)throw new Error(label+': '+(await r.text()).slice(0,500));return r.json()}
function safe(site,bot){
  const snap=site.published_snapshot&&typeof site.published_snapshot==='object'&&Object.keys(site.published_snapshot).length?site.published_snapshot:{
    theme:site.theme,accentColor:site.accent_color,logoUrl:site.logo_url,heroImageUrl:site.hero_image_url,eyebrow:site.eyebrow,title:site.title,subtitle:site.subtitle,
    aboutTitle:site.about_title,aboutText:site.about_text,primaryCtaLabel:site.primary_cta_label,primaryCtaKind:site.primary_cta_kind,primaryCtaUrl:site.primary_cta_url,
    secondaryCtaLabel:site.secondary_cta_label,secondaryCtaUrl:site.secondary_cta_url,sections:site.sections,faq:site.faq,contact:site.contact,seo:site.seo
  };
  return{slug:site.slug,theme:snap.theme||'aurora',accentColor:snap.accentColor||'#00ff88',logoUrl:snap.logoUrl||null,heroImageUrl:snap.heroImageUrl||null,
    eyebrow:snap.eyebrow||null,title:snap.title||bot.company_name,subtitle:snap.subtitle||null,aboutTitle:snap.aboutTitle||null,aboutText:snap.aboutText||null,
    primaryCtaLabel:snap.primaryCtaLabel||'Falar agora',primaryCtaKind:snap.primaryCtaKind||'chat',primaryCtaUrl:snap.primaryCtaUrl||null,
    secondaryCtaLabel:snap.secondaryCtaLabel||null,secondaryCtaUrl:snap.secondaryCtaUrl||null,sections:Array.isArray(snap.sections)?snap.sections:[],
    faq:Array.isArray(snap.faq)?snap.faq:[],contact:snap.contact&&typeof snap.contact==='object'?snap.contact:{},seo:snap.seo&&typeof snap.seo==='object'?snap.seo:{},
    companyName:bot.company_name,botId:bot.bot_id,publishedAt:site.published_at||null}
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
