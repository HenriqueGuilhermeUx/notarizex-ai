const crypto=require('crypto');
const fetch=require('node-fetch');
const whatsappConfig=require('./whatsapp-config');

const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'OPTIONS, POST'};
function reply(c,b){return{statusCode:c,headers,body:JSON.stringify(b)}}
function clean(v,max=0){const s=String(v||'').trim();return max?s.slice(0,max):s}
function hashToken(token){return crypto.createHash('sha256').update(String(token)).digest('hex')}
async function db(path,opt={}){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase service role não configurado.');return fetch(url+'/rest/v1/'+path,{...opt,headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key,...(opt.headers||{})}})}
async function rows(res,label){if(!res.ok)throw new Error(label+': '+(await res.text()).slice(0,700));const raw=await res.text();return raw?JSON.parse(raw):[]}
async function resolveInvite(token){const hash=hashToken(token);const data=await rows(await db('smartbot_connection_invites?token_hash=eq.'+encodeURIComponent(hash)+'&purpose=eq.whatsapp_connect&select=*&limit=1'),'convite');const invite=data[0];if(!invite)throw new Error('Link inválido.');if(invite.revoked_at)throw new Error('Este link foi revogado.');if(new Date(invite.expires_at).getTime()<Date.now())throw new Error('Este link expirou. Solicite um novo link.');const bots=await rows(await db('website_bots?bot_id=eq.'+encodeURIComponent(invite.bot_id)+'&select=bot_id,company_name,client_token,status&limit=1'),'SmartBot');if(!bots[0]||!bots[0].client_token)throw new Error('SmartBot indisponível.');return{invite,bot:bots[0]}}
function sanitizeConfig(c){c=c||{};return{phone:c.phone||'',businessName:c.businessName||'',autoReply:c.autoReply===true,status:c.status||'pending',connected:c.connected===true,connectionType:c.connectionType||null,messageWebhookStatus:c.messageWebhookStatus||null,lifecycleStatus:c.lifecycleStatus||null,connectedAt:c.connectedAt||null,connectionError:c.connectionError||null}}
async function callConfig(bot,action){const result=await whatsappConfig.handler({httpMethod:'POST',headers:{},body:JSON.stringify({botId:bot.bot_id,clientToken:bot.client_token,action})});let body={};try{body=JSON.parse(result.body||'{}')}catch{}if(result.statusCode>=400||body.success===false)throw new Error(body.error||'Falha ao acessar conexão WhatsApp.');return body}
async function touch(invite,patch={}){await db('smartbot_connection_invites?id=eq.'+encodeURIComponent(invite.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({last_used_at:new Date().toISOString(),...patch})})}
async function restoreActiveBotAutoReply(bot,config){if(bot.status!=='active'||!config||config.connected!==true||config.autoReply===true)return config;const saved=await rows(await db('smartbot_whatsapp_config?bot_id=eq.'+encodeURIComponent(bot.bot_id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({auto_reply:true,updated_at:new Date().toISOString()})}),'reativar atendimento automático');if(saved[0])config.autoReply=true;return config}
function capacityFingerprint(){const d=new Date(),period=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;return crypto.createHash('sha256').update(`kapso:connected_numbers:${period}`).digest('hex')}
async function alertCapacity(bot,used,limit,planCode){
  const fp=capacityFingerprint(),now=new Date().toISOString(),message=`Kapso: ${used}/${limit} números conectados no plano ${planCode}. Novo onboarding bloqueado antes da Meta.`;
  const open=await rows(await db('smartbot_provider_incidents?provider=eq.kapso&fingerprint=eq.'+encodeURIComponent(fp)+'&resolved_at=is.null&select=*&limit=1'),'incidente Kapso');
  let incident=open[0]||null;
  if(incident){
    const r=await db('smartbot_provider_incidents?id=eq.'+encodeURIComponent(incident.id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({bot_id:bot.bot_id,operation:'whatsapp_connect_start',category:'capacity_exhausted',severity:'critical',error_message:message,occurrence_count:Number(incident.occurrence_count||0)+1,last_seen_at:now,updated_at:now,metadata:{used,limit,planCode,blockedBotId:bot.bot_id}})});incident=(await rows(r,'atualizar incidente Kapso'))[0];
  }else{
    const r=await db('smartbot_provider_incidents',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({provider:'kapso',bot_id:bot.bot_id,operation:'whatsapp_connect_start',category:'capacity_exhausted',severity:'critical',error_message:message,fingerprint:fp,metadata:{used,limit,planCode,blockedBotId:bot.bot_id}})});incident=(await rows(r,'criar incidente Kapso'))[0];
  }
  if(!incident.alerted_at&&process.env.RESEND_API_KEY){
    const to=clean(process.env.SMARTBOTS_ALERT_EMAIL||process.env.SUPPORT_EMAIL||'henriquecampos66@gmail.com');
    const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.RESEND_API_KEY},body:JSON.stringify({from:'SmartBots <smartbots@auth.f-insight.org>',to,subject:'SmartBots: upgrade Kapso necessário',text:message+'\n\nFaça upgrade do plano Kapso antes de conectar o próximo cliente. O SmartBots bloqueou o fluxo antes de enviar o cliente para a Meta.'})}).catch(()=>null);
    if(mail&&mail.ok)await db('smartbot_provider_incidents?id=eq.'+encodeURIComponent(incident.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({alerted_at:now,updated_at:now})});
  }
}
async function assertKapsoCapacity(bot){
  const own=await rows(await db('smartbot_whatsapp_config?bot_id=eq.'+encodeURIComponent(bot.bot_id)+'&provider=eq.kapso&status=eq.connected&provider_phone_number_id=not.is.null&select=bot_id&limit=1'),'conexão atual');
  if(own.length)return;
  const settings=await rows(await db('smartbot_provider_settings?provider=eq.kapso&select=plan_code,connected_number_limit&limit=1'),'plano Kapso');
  const cfg=settings[0];if(!cfg||!cfg.connected_number_limit)return;
  const connected=await rows(await db('smartbot_whatsapp_config?provider=eq.kapso&status=eq.connected&provider_phone_number_id=not.is.null&select=bot_id'),'capacidade Kapso');
  const used=connected.length,limit=Number(cfg.connected_number_limit);
  if(used>=limit){await alertCapacity(bot,used,limit,cfg.plan_code||'atual');const e=new Error('A conexão do WhatsApp está temporariamente indisponível. Nossa equipe já foi avisada e vai liberar a capacidade necessária.');e.code='KAPSO_CAPACITY_FULL';throw e}
}
exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers,body:''};
  if(event.httpMethod!=='POST')return reply(405,{success:false,error:'Method Not Allowed'});
  try{
    const body=JSON.parse(event.body||'{}'),token=clean(body.invite,300),action=clean(body.action||'status');if(!token)return reply(422,{success:false,error:'Link de conexão ausente.'});
    const {invite,bot}=await resolveInvite(token);await touch(invite);
    if(action==='start'){
      await assertKapsoCapacity(bot);
      const result=await callConfig(bot,'connect_start');
      return reply(200,{success:true,companyName:bot.company_name,alreadyConnected:result.alreadyConnected===true,setupUrl:result.setupUrl||null,expiresAt:result.expiresAt||null,config:sanitizeConfig(result.config)});
    }
    if(action==='status'){
      const result=await callConfig(bot,'connect_status');let config=sanitizeConfig(result.config),connected=config.connected===true;if(connected){config=await restoreActiveBotAutoReply(bot,config);if(!invite.completed_at)await touch(invite,{completed_at:new Date().toISOString()})}
      return reply(200,{success:true,companyName:bot.company_name,setupStatus:result.setupStatus||null,setupError:result.setupError||null,config,completed:connected});
    }
    return reply(422,{success:false,error:'Ação inválida.'});
  }catch(error){console.error('[WhatsAppConnectInvite]',error.message);return reply(error.code==='KAPSO_CAPACITY_FULL'?503:400,{success:false,error:error.message||'Falha no link de conexão.',code:error.code||null})}
};
