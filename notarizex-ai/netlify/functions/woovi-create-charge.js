const fetch = require('node-fetch');
const { PLANS } = require('./lib/commercial-plans');

const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'OPTIONS,POST'};
function reply(c,b){return{statusCode:c,headers,body:JSON.stringify(b)}}
function clean(v){return String(v||'').trim()}
function env(name){return String(process.env[name]||'').trim()}
function apiBase(){return env('WOOVI_ENV')==='sandbox'?'https://api.woovi-sandbox.com':'https://api.woovi.com'}
function wooviCredential(){return env('WOOVI_APP_ID')||env('WOOVI_TOKEN')||env('OPENPIX_TOKEN')}
async function db(path,opt={}){const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw new Error('Supabase service role não configurado.');return fetch(url+'/rest/v1/'+path,{...opt,headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key,...(opt.headers||{})}})}
async function auth(botId,token){const r=await db('website_bots?bot_id=eq.'+encodeURIComponent(botId)+'&client_token=eq.'+encodeURIComponent(token)+'&select=bot_id,company_name,email,owner_email,plan');const a=r.ok?await r.json():[];return a[0]||null}
exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers,body:''};
  if(event.httpMethod!=='POST')return reply(405,{success:false,error:'Method Not Allowed'});
  try{
    const body=JSON.parse(event.body||'{}'),botId=clean(body.botId),token=clean(body.clientToken);
    if(!botId||!token)return reply(400,{success:false,error:'botId e clientToken obrigatórios'});
    const bot=await auth(botId,token);if(!bot)return reply(403,{success:false,error:'Acesso negado'});
    const plan=PLANS.completo;
    const wooviToken=wooviCredential();
    if(!wooviToken)throw new Error('Pagamento Pix temporariamente indisponível.');
    const correlationID='sb_'+botId+'_'+Date.now();
    const payload={correlationID,value:plan.amountCents,comment:plan.name+' — mensal',customer:{name:bot.company_name||'SmartBots',email:bot.email||bot.owner_email||''}};
    const wr=await fetch(apiBase()+'/api/v1/charge',{method:'POST',headers:{'Content-Type':'application/json',Authorization:wooviToken},body:JSON.stringify(payload)});
    const wj=await wr.json().catch(()=>({}));
    if(!wr.ok){console.error('woovi-create-charge',wr.status,JSON.stringify(wj).slice(0,500));throw new Error('Não foi possível gerar o Pix agora.');}
    const ch=wj.charge||wj;
    const patch={bot_id:botId,company_name:bot.company_name,customer_email:bot.email||bot.owner_email,plan:plan.code,status:'pending',amount_cents:plan.amountCents,billing_cycle:plan.billingCycle,woovi_correlation_id:correlationID,woovi_charge_id:ch.globalID||ch.chargeId||ch.id||ch.identifier||'',woovi_payment_link:ch.paymentLinkUrl||ch.paymentLink||'',woovi_qr_code_image:ch.qrCodeImage||'',woovi_br_code:ch.brCode||(ch.paymentMethods&&ch.paymentMethods.pix&&ch.paymentMethods.pix.brCode)||'',woovi_status:ch.status||'ACTIVE',woovi_payload:wj,updated_at:new Date().toISOString()};
    const ex=await db('smartbot_subscriptions?bot_id=eq.'+encodeURIComponent(botId)+'&limit=1');const rs=ex.ok?await ex.json():[];
    const sr=rs.length?await db('smartbot_subscriptions?id=eq.'+rs[0].id,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)}):await db('smartbot_subscriptions',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
    if(!sr.ok)throw new Error(await sr.text());
    return reply(200,{success:true,charge:ch,subscription:(await sr.json())[0]});
  }catch(e){console.error('woovi-create-charge',e);return reply(500,{success:false,error:e.message})}
};
