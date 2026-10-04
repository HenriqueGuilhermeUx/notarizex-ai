const fetch=require('node-fetch');
const {scrapeWebsiteDeep}=require('./scraper');

function clean(v){return String(v||'').trim()}
function clampPages(v){return Math.max(1,Math.min(12,Number(v)||8))}
function normalizeRemote(data,website){
  const pages=Array.isArray(data&&data.pages)?data.pages.map(p=>({
    url:clean(p.url),
    title:clean(p.title),
    description:clean(p.description),
    text:clean(p.text).slice(0,50000)
  })).filter(p=>p.url||p.text):[];
  const combinedText=clean(data&&data.combinedText)||pages.map(p=>`URL: ${p.url}\n${p.text}`).join('\n\n--- PÁGINA ---\n\n');
  return {
    baseUrl:clean(data&&data.baseUrl)||website,
    pages,
    combinedText:combinedText.slice(0,180000),
    pageCount:Number(data&&data.pageCount)||pages.length,
    totalChars:Number(data&&data.totalChars)||combinedText.length,
    brand:data&&data.brand&&typeof data.brand==='object'?data.brand:{},
    source:'scrapling'
  };
}
async function remoteCrawl(website,maxPages){
  const base=clean(process.env.SMARTBOTS_CRAWLER_URL).replace(/\/$/,'');
  if(!base)return null;
  const headers={'Content-Type':'application/json'};
  const secret=clean(process.env.SMARTBOTS_CRAWLER_SECRET);
  if(secret)headers['X-Crawler-Key']=secret;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),30000);
  try{
    const r=await fetch(base+'/crawl',{method:'POST',headers,body:JSON.stringify({url:website,max_pages:clampPages(maxPages)}),signal:controller.signal});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||data.success===false)throw new Error(data.error||`crawler HTTP ${r.status}`);
    return normalizeRemote(data,website);
  }finally{clearTimeout(timer)}
}
async function crawlWebsite(website,maxPages=8){
  try{
    const remote=await remoteCrawl(website,maxPages);
    if(remote&&remote.pages.length)return remote;
  }catch(error){
    console.warn('[CrawlerClient] remote fallback:',error.message);
  }
  const local=await scrapeWebsiteDeep(website,clampPages(maxPages));
  return {...local,brand:{},source:'node_fallback'};
}
module.exports={crawlWebsite};
