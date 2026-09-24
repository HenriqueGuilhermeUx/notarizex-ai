const fetch=require('node-fetch');
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'OPTIONS,POST'};
function reply(c,b){return{statusCode:c,headers,body:JSON.stringify(b)}}
function env(name){return String(process.env[name]||'').trim()}
function base(){return env('WOOVI_ENV')==='sandbox'?'https://api.woovi-sandbox.com':'https://api.woovi.com'}
function admin(t){const a=env('SMARTBOTS_ADMIN_TOKEN')||env('ADMIN_TOKEN');return Boolean(a&&t&&t===a)}
exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers,body:''};
  if(event.httpMethod!=='POST')return reply(405,{success:false,error:'Method Not Allowed'});
  try{
    const b=JSON.parse(event.body||'{}');
    if(!admin(String(b.adminToken||'')))return reply(403,{success:false,error:'Admin token inválido'});
    const token=env('WOOVI_TOKEN')||env('OPENPIX_TOKEN');
    if(!token)throw new Error('WOOVI_TOKEN não configurado');
    const webhookSecret=env('WOOVI_WEBHOOK_SECRET');
    if(!webhookSecret)throw new Error('WOOVI_WEBHOOK_SECRET não configurado');
    const site=env('URL')||env('DEPLOY_PRIME_URL')||'https://smartbots.club';
    const url=b.url||site+'/.netlify/functions/woovi-webhook';
    const payload={webhook:{name:'SmartBots Charge Completed',event:'OPENPIX:CHARGE_COMPLETED',url,authorization:webhookSecret,isActive:true}};
    const r=await fetch(base()+'/api/v1/webhook',{method:'POST',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(payload)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){console.error('woovi-register-webhook',r.status,JSON.stringify(j).slice(0,500));throw new Error('Não foi possível registrar o webhook Woovi.');}
    return reply(200,{success:true,webhook:j,url});
  }catch(e){return reply(500,{success:false,error:e.message})}
};
