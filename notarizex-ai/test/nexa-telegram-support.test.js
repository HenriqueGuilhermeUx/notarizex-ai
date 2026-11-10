'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {resolveTelegramTurn,containsSensitive,MENU}=require('../netlify/functions/lib/nexa-telegram-support');
const {createHandler}=require('../netlify/functions/nexa-telegram-webhook');

function decide(message,humanPending=false){
  return resolveTelegramTurn({message,humanPending});
}
function event(text='/start',headers={'x-telegram-bot-api-secret-token':'test-secret'}, overrides={}){
  return {httpMethod:'POST',headers,body:JSON.stringify({
    update_id:101,
    message:{
      message_id:66,
      chat:{id:123456,type:'private'},
      from:{id:123456,first_name:'Cliente'},
      text
    },...overrides
  })};
}
const env={
  NEXA_TELEGRAM_ENABLED:'true',
  NEXA_TELEGRAM_BOT_TOKEN:'123:FAKE-TOKEN',
  NEXA_TELEGRAM_WEBHOOK_SECRET:'test-secret',
  SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'test-service-role'
};
function fakeBackend(){
  const seen=new Set();
  const out=[];
  const fake=async(url,options={})=>{
    out.push({url,options});
    if(String(url).startsWith('https://api.telegram.org/'))
      return {ok:true,status:200,json:async()=>({ok:true,result:{message_id:44}})};
    if(String(url).includes('nexa_telegram_updates?on_conflict=')) {
      const id=JSON.parse(options.body).update_id;
      if(seen.has(id))return {ok:true,status:200,json:async()=>([])};
      seen.add(id);
      return {ok:true,status:201,json:async()=>([{update_id:id}])};
    }
    if(String(url).includes('nexa_telegram_contacts?telegram_user_id=') &&
       (!options.method||options.method==='GET'))
      return {ok:true,status:200,json:async()=>([])};
    if(String(url).endsWith('/nexa_telegram_contacts') && options.method==='POST')
      return {ok:true,status:201,json:async()=>([{chat_id:123456,status:'active'}])};
    // Real PostgREST returns HTTP 201 with an EMPTY body for return=minimal.
    // A JSON parse here is a bug even though the database write succeeded.
    if(String(url).includes('/nexa_telegram_messages') && options.method==='POST')
      return {ok:true,status:201,json:async()=>{throw new SyntaxError('Unexpected end of JSON input')}};
    if(String(url).includes('nexa_telegram_handoffs?')&&(!options.method||options.method==='GET'))
      return {ok:true,status:200,json:async()=>([])};
    if(String(url).includes('smartbot_leads?')&&(!options.method||options.method==='GET'))
      return {ok:true,status:200,json:async()=>([])};
    return {ok:true,status:204,json:async()=>({})};
  };
  return {fake,out};
}

test('Nexa Telegram menu is informative and does not imply account authentication',()=>{
  const r=decide('/start');
  assert.equal(r.kind,'menu');
  assert.equal(r.reply,MENU);
  assert.match(r.reply,/não autentica|nao autentica/i);
  assert.doesNotMatch(r.reply,/mande um pix|deposite agora|ganho garantido/i);
});
test('KYC and a delayed approval issue get different answers',()=>{
  assert.equal(decide('/kyc').kind,'answer');
  assert.equal(decide('Preciso da provação').category,'kyc');
  assert.equal(decide('Minha aprovação do cadastro está pendente').reason,'kyc_handoff');
  assert.match(decide('/kyc').reply,/Didit/);
});
test('privacy complaints and financial problems require a human request',()=>{
  assert.equal(decide('Fala sobre dados não apagados').category,'privacy');
  assert.equal(decide('Meu depósito não caiu').category,'financial_support');
});
test('STOP overrides human pending, /avisos never grants marketing consent',()=>{
  assert.equal(decide('/parar',true).kind,'opt_out');
  assert.equal(decide('/avisos').kind,'service_opt_in');
  assert.match(decide('/avisos').reply,/não autoriza ofertas financeiras/i);
  assert.equal(decide('Eu ainda aguardo',true).kind,'ignore');
});
test('CPF and passwords are guarded before handoff',()=>{
  assert.equal(containsSensitive('Meu CPF 123.456.789-01'),true);
  assert.equal(decide('Meu CPF 123.456.789-01').reason,'unsafe_identifier');
  assert.equal(decide('senha: abcd123').sensitive,true);
});
test('invalid Telegram secret is rejected without any DB or provider activity',async()=>{
  const {fake,out}=fakeBackend();
  const handler=createHandler({fetchImpl:fake,env});
  const response=await handler(event('/start',{'x-telegram-bot-api-secret-token':'wrong'}));
  assert.equal(response.statusCode,401);
  assert.equal(out.length,0);
});
test('unconfigured bot fails closed',async()=>{
  const {fake,out}=fakeBackend();
  const handler=createHandler({fetchImpl:fake,env:{...env,NEXA_TELEGRAM_ENABLED:'false'}});
  assert.equal((await handler(event())).statusCode,503);
  assert.equal(out.length,0);
});
test('group messages and forwarded unsupported updates are ignored',async()=>{
  const {fake,out}=fakeBackend();
  const handler=createHandler({fetchImpl:fake,env});
  const p=event('/start');
  const data=JSON.parse(p.body);
  data.message.chat.type='group';
  p.body=JSON.stringify(data);
  const r=await handler(p);
  assert.equal(r.statusCode,200);
  assert.equal(out.length,0);
});
test('minimal HTTP 201 database writes do not abort the Telegram menu',async()=>{
  const {fake,out}=fakeBackend();
  const handler=createHandler({fetchImpl:fake,env});
  const result=await handler(event('/start'));
  assert.equal(result.statusCode,200);
  const writes=out.filter(x=>x.url.includes('/nexa_telegram_messages')&&x.options.method==='POST');
  assert.equal(writes.length,2); // inbound and outbound message
  assert.equal(writes[0].options.headers.Prefer,'return=minimal');
  assert.equal(writes[1].options.headers.Prefer,'return=minimal');
  assert.equal(out.filter(x=>x.url.startsWith('https://api.telegram.org/')).length,1);
});

test('private /start sends one message and update_id is deduplicated',async()=>{
  const {fake,out}=fakeBackend();
  const handler=createHandler({fetchImpl:fake,env});
  assert.equal((await handler(event())).statusCode,200);
  assert.equal((await handler(event())).statusCode,200);
  const sent=out.filter(x=>x.url.startsWith('https://api.telegram.org/'));
  assert.equal(sent.length,1);
  const payload=JSON.parse(sent[0].options.body);
  assert.equal(payload.chat_id,123456);
  assert.match(payload.text,/Theo/);
  assert.ok(out.some(x=>x.url.includes('nexa_telegram_updates?on_conflict=')));
});
test('Telegram webhook never stores sensitive message contents',async()=>{
  const {fake,out}=fakeBackend();
  const handler=createHandler({fetchImpl:fake,env});
  const res=await handler(event('CPF 123.456.789-01'));
  assert.equal(res.statusCode,200);
  const saved=out.filter(x=>x.url.includes('/nexa_telegram_messages')&&x.options.method==='POST');
  assert.equal(saved.length,2);
  assert.equal(JSON.parse(saved[0].options.body).content,'[conteudo sensivel omitido]');
  assert.doesNotMatch(JSON.stringify(saved[0].options.body),/123\.456\.789-01/);
});
