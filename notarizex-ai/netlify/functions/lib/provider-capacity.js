const fetch=require('node-fetch');
const {sendOpsAlert}=require('./ops-alerts');

function env(name){return String(process.env[name]||'').trim()}
function clean(v,max=0){const s=String(v||'').trim();return max?s.slice(0,max):s}
async function db(path,opt={}){
  const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)throw new Error('Supabase service role não configurado.');
  return fetch(url+'/rest/v1/'+path,{...opt,headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key,...(opt.headers||{})}});
}
async function rows(r,label){
  if(!r.ok)throw new Error(label+': '+(await r.text()).slice(0,700));
  const raw=await r.text();return raw?JSON.parse(raw):[];
}
async function reserveProviderCapacity(provider,bot){
  const r=await db('rpc/smartbot_reserve_provider_capacity',{
    method:'POST',
    headers:{Prefer:'return=representation'},
    body:JSON.stringify({
      p_provider:provider,
      p_bot_id:bot.bot_id,
      p_company_name:clean(bot.company_name,220)||null,
      p_owner_email:clean(bot.owner_email,260)||null
    })
  });
  const raw=await r.text();
  if(!r.ok)throw new Error('Reservar capacidade: '+raw.slice(0,700));
  let result={};try{result=raw?JSON.parse(raw):{}}catch{}
  if(Array.isArray(result))result=result[0]||{};
  if(!result||typeof result!=='object')result={available:false,reason:'invalid_capacity_response'};
  return result;
}
async function queueRow(provider,botId){
  const data=await rows(await db(
    'smartbot_provider_capacity_queue?provider=eq.'+encodeURIComponent(provider)+
    '&bot_id=eq.'+encodeURIComponent(botId)+'&select=*&limit=1'
  ),'Fila de capacidade');
  return data[0]||null;
}
async function markReleased(provider,botId,status='released'){
  const now=new Date().toISOString();
  await db(
    'smartbot_provider_capacity_queue?provider=eq.'+encodeURIComponent(provider)+
    '&bot_id=eq.'+encodeURIComponent(botId),
    {method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({
      status,
      released_at:status==='released'?now:null,
      connected_at:status==='connected'?now:null,
      reservation_expires_at:null,
      updated_at:now
    })}
  );
}
async function alertCapacityWait(provider,bot,capacity){
  const row=await queueRow(provider,bot.bot_id);
  if(row&&row.alerted_at)return{sent:false,deduped:true};
  const subject='SmartBots: novo cliente aguardando capacidade WhatsApp';
  const text=[
    'Empresa: '+(bot.company_name||bot.bot_id),
    'Bot: '+bot.bot_id,
    bot.owner_email?('Cliente: '+bot.owner_email):null,
    'Provider: '+provider,
    'Capacidade registrada: '+String(capacity.used??'?')+'/'+String(capacity.limit??'?'),
    'Plano registrado: '+String(capacity.plan||'não informado'),
    '',
    'O cliente não recebeu erro. A tela está mostrando que a conexão está sendo preparada.',
    'Após ampliar a capacidade, atualize o limite em /admin/capacidade. A próxima tentativa será liberada automaticamente.'
  ].filter(Boolean).join('\n');
  const sent=await sendOpsAlert(subject,text,{adminUrl:'https://smartbots.club/admin/capacidade'});
  if(sent.sent){
    await db(
      'smartbot_provider_capacity_queue?provider=eq.'+encodeURIComponent(provider)+
      '&bot_id=eq.'+encodeURIComponent(bot.bot_id),
      {method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({alerted_at:new Date().toISOString(),updated_at:new Date().toISOString()})}
    );
  }
  return sent;
}
async function capacitySnapshot(provider='kapso'){
  const settings=await rows(await db('smartbot_provider_settings?provider=eq.'+encodeURIComponent(provider)+'&select=*&limit=1'),'Configuração do provider');
  const cfg=settings[0]||null;
  const live=await rows(await db('smartbot_whatsapp_config?provider=eq.'+encodeURIComponent(provider)+'&status=in.(connected,connecting)&select=bot_id,status'),'Uso do provider');
  const waiting=await rows(await db('smartbot_provider_capacity_queue?provider=eq.'+encodeURIComponent(provider)+'&status=eq.waiting&select=bot_id,company_name,owner_email,requested_at&order=requested_at.asc'),'Fila do provider');
  const connected=new Set(live.filter(x=>x.status==='connected').map(x=>x.bot_id)).size;
  const connecting=new Set(live.filter(x=>x.status==='connecting').map(x=>x.bot_id)).size;
  const limit=Number(cfg&&cfg.connected_number_limit||0);
  const used=connected+connecting;
  const percent=limit>0?Math.round((used/limit)*1000)/10:null;
  return{
    provider,
    configured:Boolean(cfg),
    planCode:cfg&&cfg.plan_code||null,
    connected,
    connecting,
    used,
    limit,
    remaining:Math.max(limit-used,0),
    percentage:percent,
    waitingCount:waiting.length,
    waiting
  };
}
module.exports={reserveProviderCapacity,alertCapacityWait,markReleased,capacitySnapshot};
