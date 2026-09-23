const crypto=require('crypto');
const fetch=require('node-fetch');

const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-Admin-Session','Access-Control-Allow-Methods':'OPTIONS, POST'};
function reply(c,b){return{statusCode:c,headers,body:JSON.stringify(b)}}
function clean(v,max=0){const s=String(v||'').trim();return max?s.slice(0,max):s}
function email(v){return clean(v,240).toLowerCase()}
function secret(){const s=process.env.SMARTBOTS_ADMIN_AUTH_SECRET;if(!s)throw new Error('Admin auth não configurado.');return s}
function hmac(value){return crypto.createHmac('sha256',secret()).update(String(value)).digest('hex')}
function safeEqual(a,b){if(!a||!b)return false;const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
async function db(path,opt={}){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase service role não configurado.');return fetch(url+'/rest/v1/'+path,{...opt,headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key,...(opt.headers||{})}})}
async function rows(res,label){if(!res.ok)throw new Error(label+': '+(await res.text()).slice(0,700));const raw=await res.text();return raw?JSON.parse(raw):[]}
function allowedEmail(value){const configured=email(process.env.SMARTBOTS_ADMIN_EMAIL);return Boolean(configured&&value&&safeEqual(value,configured))}
async function sendCode(to,code){const key=process.env.RESEND_API_KEY;if(!key)throw new Error('Serviço de e-mail não configurado.');const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({from:'SmartBots <noreply@smartbots.club>',to,subject:'Seu código de acesso SmartBots',text:`Seu código de acesso administrativo é ${code}. Ele expira em 10 minutos. Se você não solicitou este código, ignore esta mensagem.`})});if(!r.ok)throw new Error('Não foi possível enviar o código: '+(await r.text()).slice(0,300))}
async function requestCode(addr){
  if(!allowedEmail(addr))return;
  const since=new Date(Date.now()-10*60*1000).toISOString();
  const recent=await rows(await db('smartbot_admin_auth?email=eq.'+encodeURIComponent(addr)+'&purpose=eq.otp&created_at=gte.'+encodeURIComponent(since)+'&select=id&limit=6'),'limite');
  if(recent.length>=5)throw new Error('Muitas solicitações. Aguarde alguns minutos.');
  const code=String(crypto.randomInt(0,1000000)).padStart(6,'0'),hash=hmac(`otp:${addr}:${code}`),expires=new Date(Date.now()+10*60*1000).toISOString();
  await rows(await db('smartbot_admin_auth',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({email:addr,purpose:'otp',secret_hash:hash,expires_at:expires})}),'salvar código');
  try{await sendCode(addr,code)}catch(error){await db('smartbot_admin_auth?secret_hash=eq.'+encodeURIComponent(hash),{method:'DELETE'});throw error}
}
async function verifyCode(addr,code){
  if(!allowedEmail(addr))return null;
  const hash=hmac(`otp:${addr}:${clean(code,12)}`),now=new Date().toISOString();
  const found=await rows(await db('smartbot_admin_auth?secret_hash=eq.'+encodeURIComponent(hash)+'&purpose=eq.otp&used_at=is.null&expires_at=gt.'+encodeURIComponent(now)+'&select=*&limit=1'),'validar código');
  if(!found[0])return null;
  await db('smartbot_admin_auth?id=eq.'+encodeURIComponent(found[0].id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({used_at:now})});
  await db('smartbot_admin_auth?email=eq.'+encodeURIComponent(addr)+'&purpose=eq.session&used_at=is.null',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({used_at:now})});
  const token=crypto.randomBytes(32).toString('base64url'),sessionHash=hmac(`session:${token}`),expires=new Date(Date.now()+12*60*60*1000).toISOString();
  await rows(await db('smartbot_admin_auth',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({email:addr,purpose:'session',secret_hash:sessionHash,expires_at:expires})}),'criar sessão');
  return{token,expiresAt:expires};
}
async function validateSession(token){if(!token)return false;const hash=hmac(`session:${token}`),now=new Date().toISOString();const found=await rows(await db('smartbot_admin_auth?secret_hash=eq.'+encodeURIComponent(hash)+'&purpose=eq.session&used_at=is.null&expires_at=gt.'+encodeURIComponent(now)+'&select=id&limit=1'),'validar sessão');return Boolean(found[0])}
exports.validateAdminSession=validateSession;
exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers,body:''};if(event.httpMethod!=='POST')return reply(405,{success:false,error:'Method Not Allowed'});
  try{const body=JSON.parse(event.body||'{}'),action=clean(body.action||'request'),addr=email(body.email);
    if(action==='request'){await requestCode(addr);return reply(200,{success:true,message:'Se o e-mail estiver autorizado, o código será enviado.'})}
    if(action==='verify'){const session=await verifyCode(addr,body.code);if(!session)return reply(401,{success:false,error:'Código inválido ou expirado.'});return reply(200,{success:true,sessionToken:session.token,expiresAt:session.expiresAt})}
    if(action==='validate'){const token=clean((event.headers&&(event.headers['x-admin-session']||event.headers['X-Admin-Session']))||body.sessionToken,200);return reply(200,{success:await validateSession(token)})}
    return reply(422,{success:false,error:'Ação inválida.'});
  }catch(error){console.error('[SmartBotsAdminAuth]',error.message);return reply(500,{success:false,error:error.message||'Falha de autenticação.'})}
};
