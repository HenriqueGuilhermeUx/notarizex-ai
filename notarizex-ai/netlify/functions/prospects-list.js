const fetch=require('node-fetch');
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'OPTIONS,POST'};
function reply(c,b){return{statusCode:c,headers,body:JSON.stringify(b)}}
function clean(v){return String(v||'').trim()}
async function db(path,opt={}){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;if(!url||!key)throw new Error('Supabase nao configurado');return fetch(url+'/rest/v1/'+path,{...opt,headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key,...(opt.headers||{})}})}
exports.handler=async(ev)=>{if(ev.httpMethod==='OPTIONS')return{statusCode:204,headers,body:''};if(ev.httpMethod!=='POST')return reply(405,{success:false,error:'Method Not Allowed'});try{const b=JSON.parse(ev.body||'{}');const botId=clean(b.botId);if(!botId)return reply(400,{success:false,error:'botId obrigatorio'});const r=await db('smartbot_prospects?bot_id=eq.'+encodeURIComponent(botId)+'&order=created_at.desc&limit=100');return reply(200,{success:true,items:r.ok?await r.json():[]})}catch(e){return reply(500,{success:false,error:e.message})}};
