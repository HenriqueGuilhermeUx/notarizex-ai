import {apiBase} from '../theme';
export async function post(path,body){const r=await fetch(apiBase+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});let j={};try{j=await r.json()}catch(e){}if(!r.ok&&!j.error)j.error='Erro '+r.status;return j}
export async function mobileSignup(input){return post('/.netlify/functions/mobile-signup',input)}
export async function crmSummary(session){return post('/.netlify/functions/crm-smartbots-summary',{botId:session.botId,clientToken:session.clientToken})}
export async function events(session){return post('/.netlify/functions/smartbot-events',{botId:session.botId,clientToken:session.clientToken})}
export async function conversations(session){return post('/.netlify/functions/smartbot-conversations',{botId:session.botId,clientToken:session.clientToken})}
export async function prospect(session,input){return post('/.netlify/functions/apify-run-task',{task:'prospects',limit:input.limit||30,input:{query:input.query,queries:input.query,search:input.query,location:input.city,segment:input.segment}})}
export async function importProspects(session,items,input){return post('/.netlify/functions/apify-import-prospects',{botId:session.botId,segment:input.segment,city:input.city,targetAudience:input.segment,items})}
export async function agendaSave(session,bookingUrl){return post('/.netlify/functions/agenda-pro-config',{botId:session.botId,clientToken:session.clientToken,action:'save',bookingUrl})}
export async function agendaGet(session){return post('/.netlify/functions/agenda-pro-config',{botId:session.botId,clientToken:session.clientToken,action:'get'})}