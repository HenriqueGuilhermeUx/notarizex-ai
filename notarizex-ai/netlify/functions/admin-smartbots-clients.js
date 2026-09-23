const crypto=require('crypto');
const fetch=require('node-fetch');
const {validateAdminSession}=require('./smartbots-admin-auth');

const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-Admin-Key, X-Admin-Session','Access-Control-Allow-Methods':'OPTIONS, POST'};
function reply(c,b){return{statusCode:c,headers,body:JSON.stringify(b)}}
function clean(v,max=0){const s=String(v||'').trim();return max?s.slice(0,max):s}
function safeEqual(a,b){if(!a||!b)return false;const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
async function authorized(event,body){
  const legacy=clean((event.headers&&(event.headers['x-admin-key']||event.headers['X-Admin-Key']))||body.adminToken),expected=process.env.SMARTBOTS_ADMIN_API_KEY||process.env.SMARTBOTS_ADMIN_TOKEN||process.env.ADMIN_TOKEN;
  if(expected&&legacy&&safeEqual(legacy,expected))return true;
  const session=clean((event.headers&&(event.headers['x-admin-session']||event.headers['X-Admin-Session']))||body.sessionToken,300);
  return validateAdminSession(session);
}
async function db(path,opt={}){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase service role não configurado.');return fetch(url+'/rest/v1/'+path,{...opt,headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key,...(opt.headers||{})}})}
async function rows(res,label){if(!res.ok)throw new Error(label+': '+(await res.text()).slice(0,700));const raw=await res.text();return raw?JSON.parse(raw):[]}
async function listClients(){
  const [bots,wa,profiles,invites]=await Promise.all([
    rows(await db('website_bots?select=bot_id,company_name,owner_name,owner_email,owner_whatsapp,status,plan,website,payment_link,payment_status,created_at&order=created_at.desc&limit=200'),'bots'),
    rows(await db('smartbot_whatsapp_config?select=bot_id,provider,phone,business_name,auto_reply,status,provider_phone_number_id,connection_type,provider_message_webhook_status,provider_lifecycle_status,connected_at,connection_error&order=updated_at.desc&limit=300'),'whatsapp'),
    rows(await db('smartbot_profiles?select=bot_id,assistant_name,active,primary_goal&limit=300'),'profiles'),
    rows(await db('smartbot_connection_invites?select=id,bot_id,expires_at,last_used_at,completed_at,revoked_at,created_at&order=created_at.desc&limit=500'),'invites')
  ]);
  const waMap=new Map(wa.map(x=>[x.bot_id,x])),profileMap=new Map(profiles.map(x=>[x.bot_id,x])),inviteMap=new Map();
  for(const x of invites)if(!inviteMap.has(x.bot_id))inviteMap.set(x.bot_id,x);
  return bots.map(bot=>({...bot,profile:profileMap.get(bot.bot_id)||null,whatsapp:waMap.get(bot.bot_id)||null,latestInvite:inviteMap.get(bot.bot_id)||null}));
}
async function createInvite(botId,days){
  const bots=await rows(await db('website_bots?bot_id=eq.'+encodeURIComponent(botId)+'&select=bot_id,company_name&limit=1'),'bot');
  if(!bots[0])throw new Error('SmartBot não encontrado.');
  const now=new Date(),expires=new Date(now.getTime()+Math.max(1,Math.min(Number(days)||7,30))*86400000);
  await db('smartbot_connection_invites?bot_id=eq.'+encodeURIComponent(botId)+'&revoked_at=is.null&completed_at=is.null',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({revoked_at:now.toISOString()})});
  const token=crypto.randomBytes(32).toString('base64url'),hash=crypto.createHash('sha256').update(token).digest('hex');
  const inserted=await rows(await db('smartbot_connection_invites',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({bot_id:botId,token_hash:hash,purpose:'whatsapp_connect',expires_at:expires.toISOString(),metadata:{company_name:bots[0].company_name}})}),'criar convite');
  return{inviteId:inserted[0].id,expiresAt:expires.toISOString(),inviteUrl:'https://smartbots.club/conectar-whatsapp.html?invite='+encodeURIComponent(token)};
}
exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers,body:''};
  if(event.httpMethod!=='POST')return reply(405,{success:false,error:'Method Not Allowed'});
  let body={};try{body=JSON.parse(event.body||'{}')}catch{return reply(400,{success:false,error:'JSON inválido.'})}
  if(!(await authorized(event,body)))return reply(401,{success:false,error:'Sessão administrativa inválida ou expirada.'});
  try{
    const action=clean(body.action||'list');
    if(action==='list'){const clients=await listClients();return reply(200,{success:true,total:clients.length,clients})}
    if(action==='invite'){const botId=clean(body.botId,120);if(!botId)return reply(422,{success:false,error:'botId obrigatório.'});return reply(200,{success:true,...await createInvite(botId,body.days)})}
    if(action==='revoke_invites'){const botId=clean(body.botId,120);if(!botId)return reply(422,{success:false,error:'botId obrigatório.'});await db('smartbot_connection_invites?bot_id=eq.'+encodeURIComponent(botId)+'&revoked_at=is.null',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({revoked_at:new Date().toISOString()})});return reply(200,{success:true})}
    return reply(422,{success:false,error:'Ação inválida.'});
  }catch(error){console.error('[AdminSmartBotsClients]',error.message);return reply(500,{success:false,error:error.message||'Falha interna.'})}
};
