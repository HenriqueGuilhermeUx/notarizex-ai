const fetch=require('node-fetch');
const {validateAdminSession}=require('./smartbots-admin-auth');
const {capacitySnapshot}=require('./lib/provider-capacity');
const {sendOpsAlert}=require('./lib/ops-alerts');

const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-Admin-Session','Access-Control-Allow-Methods':'OPTIONS,POST'};
function reply(c,b){return{statusCode:c,headers,body:JSON.stringify(b)}}
function clean(v,max=0){const s=String(v||'').trim();return max?s.slice(0,max):s}
function env(name){return String(process.env[name]||'').trim()}
async function db(path,opt={}){const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw new Error('Supabase service role não configurado.');return fetch(url+'/rest/v1/'+path,{...opt,headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key,...(opt.headers||{})}})}
async function rows(r,label){if(!r.ok)throw new Error(label+': '+(await r.text()).slice(0,600));const raw=await r.text();return raw?JSON.parse(raw):[]}
function monthStart(){const d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).toISOString()}
async function messageUsage(){
  const usage=await rows(await db('smartbot_usage_events?channel=eq.whatsapp&created_at=gte.'+encodeURIComponent(monthStart())+'&event_type=in.(whatsapp_message_received,whatsapp_message_sent)&select=quantity'),'Uso mensal');
  return usage.reduce((sum,x)=>sum+Number(x.quantity||0),0);
}
async function loadSettings(){
  const data=await rows(await db('smartbot_provider_settings?provider=eq.kapso&select=*&limit=1'),'Configuração Kapso');
  return data[0]||null;
}
async function status(){
  const [capacity,settings,messages]=await Promise.all([capacitySnapshot('kapso'),loadSettings(),messageUsage()]);
  const messageLimit=Number(settings&&settings.monthly_message_limit||0);
  return{...capacity,messagesThisMonth:messages,monthlyMessageLimit:messageLimit,messagePercentage:messageLimit>0?Math.round((messages/messageLimit)*1000)/10:null,thresholdPercent:Number(settings&&settings.alert_threshold_percent||80)};
}
async function update(body){
  const connectedNumberLimit=Math.max(1,Math.min(10000,Number(body.connectedNumberLimit)||0));
  const monthlyMessageLimit=Math.max(0,Math.min(100000000,Number(body.monthlyMessageLimit)||0));
  const thresholdPercent=Math.max(50,Math.min(100,Number(body.thresholdPercent)||80));
  const planCode=clean(body.planCode,80)||'custom';
  if(!connectedNumberLimit)throw new Error('Informe o limite de números contratado.');
  const now=new Date().toISOString();
  const current=await loadSettings();
  const payload={provider:'kapso',plan_code:planCode,connected_number_limit:connectedNumberLimit,monthly_message_limit:monthlyMessageLimit,alert_threshold_percent:thresholdPercent,updated_at:now};
  const r=current
    ? await db('smartbot_provider_settings?provider=eq.kapso',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)})
    : await db('smartbot_provider_settings',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
  await rows(r,'Atualizar capacidade');
  const snapshot=await status();
  await sendOpsAlert(
    'SmartBots: capacidade WhatsApp atualizada',
    [
      'Plano registrado: '+planCode,
      'Limite de números: '+connectedNumberLimit,
      'Em uso/conectando: '+snapshot.used,
      'Vagas restantes: '+snapshot.remaining,
      'Clientes aguardando: '+snapshot.waitingCount,
      monthlyMessageLimit?('Limite mensal de mensagens: '+monthlyMessageLimit):null
    ].filter(Boolean).join('\n'),
    {adminUrl:'https://smartbots.club/admin/capacidade'}
  ).catch(()=>{});
  return snapshot;
}
exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers,body:''};
  if(event.httpMethod!=='POST')return reply(405,{success:false,error:'Method Not Allowed'});
  try{
    const token=clean((event.headers&&(event.headers['x-admin-session']||event.headers['X-Admin-Session']))||'',240);
    if(!token||!await validateAdminSession(token))return reply(401,{success:false,error:'Sessão administrativa expirada.'});
    const body=JSON.parse(event.body||'{}'),action=clean(body.action||'status');
    if(action==='status')return reply(200,{success:true,capacity:await status()});
    if(action==='update')return reply(200,{success:true,capacity:await update(body)});
    return reply(422,{success:false,error:'Ação inválida.'});
  }catch(error){console.error('[AdminProviderCapacity]',error.message);return reply(500,{success:false,error:error.message||'Falha no radar de capacidade.'})}
};
