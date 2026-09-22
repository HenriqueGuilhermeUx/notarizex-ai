const { scrapeWebsiteDeep } = require('./lib/scraper');
const { TYPES, analyzeWebsite, buildQuestionnaire, suggestedProfile } = require('./lib/onboarding-intelligence');

const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'OPTIONS,POST'};
function reply(statusCode,body){return{statusCode,headers,body:JSON.stringify(body)}}
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}

exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers,body:''};
  if(event.httpMethod!=='POST')return reply(405,{success:false,error:'Method Not Allowed'});
  try{
    const body=JSON.parse(event.body||'{}');
    const website=clean(body.website);
    const companyName=clean(body.companyName);
    const forcedType=clean(body.businessType);

    if(forcedType&&!TYPES[forcedType])return reply(400,{success:false,error:'Tipo de negócio inválido.'});

    if(!website){
      const businessType=forcedType||'servicos';
      return reply(200,{success:true,mode:'manual',businessType,businessTypeLabel:TYPES[businessType].label,confidence:forcedType?1:0,questionnaire:buildQuestionnaire(businessType),suggestedProfile:suggestedProfile(businessType,companyName),facts:{emails:[],phones:[],hasPricing:false,hasScheduling:false,hasFaq:false,sourcePages:[]},pages:[],siteSummary:''});
    }

    const crawl=await scrapeWebsiteDeep(website,8);
    let analysis=analyzeWebsite({combinedText:crawl.combinedText,pages:crawl.pages,companyName});
    if(forcedType&&forcedType!==analysis.businessType){
      analysis={...analysis,businessType:forcedType,businessTypeLabel:TYPES[forcedType].label,confidence:1,questionnaire:buildQuestionnaire(forcedType),suggestedProfile:suggestedProfile(forcedType,companyName)};
    } else {
      analysis.businessTypeLabel=TYPES[analysis.businessType].label;
    }

    return reply(200,{success:true,mode:'website',...analysis,pages:crawl.pages.map(p=>({url:p.url,title:p.title,description:p.description})),pageCount:crawl.pageCount,totalChars:crawl.totalChars});
  }catch(error){
    console.error('[onboarding-discovery]',error);
    return reply(422,{success:false,error:error.message||'Não foi possível analisar o site.'});
  }
};
