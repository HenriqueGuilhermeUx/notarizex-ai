'use strict';
const crypto=require('node:crypto');
const fetch=require('node-fetch');
const {BOT_ID,resolveTelegramTurn}=require('./lib/nexa-telegram-support');

function json(statusCode,payload) {
  return {statusCode,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)};
}
function sameSecret(expected,received) {
  if(!expected||!received)return false;
  const a=Buffer.from(expected),b=Buffer.from(received);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function numberId(value) {
  const num=Number(value);
  return Number.isSafeInteger(num)&&num>0?num:null;
}
function scrub(value,sensitive) {
  if(sensitive)return '[conteudo sensivel omitido]';
  return String(value||'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,900);
}

function createHandler({fetchImpl=fetch,env=process.env}={}) {
  async function db(path,options={}) {
    const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
    const key=String(env.SUPABASE_SERVICE_ROLE_KEY||'');
    if(!base||!key)throw new Error('telegram_storage_unconfigured');
    const res=await fetchImpl(base+'/rest/v1/'+path,{
      ...options,
      headers:{
        apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',
        ...(options.headers||{})
      }
    });
    if(!res.ok)throw new Error('telegram_storage_http_'+res.status);
    if(res.status===204)return null;
    return res.json();
  }
  async function markUpdate(updateId,patch) {
    await db('nexa_telegram_updates?update_id=eq.'+updateId,{
      method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)
    });
  }
  async function reserveUpdate(updateId,chatId) {
    const rows=await db('nexa_telegram_updates?on_conflict=update_id',{
      method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},
      body:JSON.stringify({update_id:updateId,chat_id:chatId,status:'received'})
    });
    return Array.isArray(rows)&&rows.length>0;
  }
  async function currentContact(userId,chatId,name) {
    const rows=await db('nexa_telegram_contacts?telegram_user_id=eq.'+userId+'&select=telegram_user_id,chat_id,status&limit=1');
    const first=Array.isArray(rows)?rows[0]:null;
    if(first&&Number(first.chat_id)!==chatId)throw new Error('telegram_chat_mismatch');
    if(!first) {
      const inserted=await db('nexa_telegram_contacts',{
        method:'POST',headers:{Prefer:'return=representation'},
        body:JSON.stringify({telegram_user_id:userId,chat_id:chatId,
          first_name:name,status:'active',last_message_at:new Date().toISOString()})
      });
      if(!Array.isArray(inserted)||!inserted.length)throw new Error('telegram_contact_not_recorded');
      return inserted[0];
    }
    await db('nexa_telegram_contacts?telegram_user_id=eq.'+userId,{
      method:'PATCH',headers:{Prefer:'return=minimal'},
      body:JSON.stringify({first_name:name,last_message_at:new Date().toISOString(),
        updated_at:new Date().toISOString()})
    });
    return first;
  }
  async function saveMessage(updateId,chatId,direction,content,telegramMessageId,deliveryStatus) {
    await db('nexa_telegram_messages',{
      method:'POST',headers:{Prefer:'return=minimal'},
      body:JSON.stringify({
        update_id:updateId,chat_id:chatId,direction,content,
        provider_message_id:telegramMessageId||null,delivery_status:deliveryStatus
      })
    });
  }
  async function setServicePreference(userId,on) {
    const now=new Date().toISOString();
    const patch=on
      ? {service_notice_opt_in:true,service_notice_opt_in_at:now,opted_out_at:null,updated_at:now}
      : {service_notice_opt_in:false,opted_out_at:now,updated_at:now};
    await db('nexa_telegram_contacts?telegram_user_id=eq.'+userId,{
      method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)
    });
  }
  async function createHandoff(chatId,category,name,summary) {
    const open=await db('nexa_telegram_handoffs?chat_id=eq.'+chatId+
      '&status=eq.open&select=id&limit=1');
    if(!Array.isArray(open)||!open[0]) {
      await db('nexa_telegram_handoffs',{
        method:'POST',headers:{Prefer:'return=minimal'},
        body:JSON.stringify({chat_id:chatId,category,status:'open'})
      });
    }
    await db('nexa_telegram_contacts?chat_id=eq.'+chatId,{
      method:'PATCH',headers:{Prefer:'return=minimal'},
      body:JSON.stringify({status:'human_needed',updated_at:new Date().toISOString()})
    });
    // Also surface the service request in the existing SmartBots CRM leads view.
    // A Telegram chat is never linked to a Nexa financial account by this operation.
    try {
      const visitorId='tg_'+chatId;
      const uri='smartbot_leads?bot_id=eq.'+BOT_ID+
        '&visitor_id=eq.'+visitorId+'&select=id&limit=1';
      const rows=await db(uri);
      const fields={
        bot_id:BOT_ID,visitor_id:visitorId,source_channel:'telegram',
        name:name||null,interest:summary,first_intent:'suporte',
        last_intent:category,intent:'suporte',pipeline_status:'human_needed',
        next_action:'Atendimento humano via Telegram',
        handoff_status:'pending',handoff_requested_at:new Date().toISOString(),
        last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()
      };
      if(rows?.[0]?.id) {
        await db('smartbot_leads?id=eq.'+rows[0].id,{
          method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(fields)
        });
      }else{
        await db('smartbot_leads',{
          method:'POST',headers:{Prefer:'return=minimal'},
          body:JSON.stringify({...fields,created_at:new Date().toISOString()})
        });
      }
    }catch(_error) {
      // Core Nexa handoff queue already exists even if CRM mirroring fails.
      console.error('telegram_crm_mirror_failed');
    }
  }
  async function sendTelegram(chatId,body,token) {
    const response=await fetchImpl('https://api.telegram.org/bot'+token+'/sendMessage',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:chatId,text:body,
        disable_web_page_preview:true,protect_content:false})
    });
    if(!response.ok)throw new Error('telegram_provider_http_'+response.status);
    const json=await response.json();
    if(json?.ok!==true||!numberId(json?.result?.message_id))
      throw new Error('telegram_provider_unconfirmed');
    return json.result.message_id;
  }
  return async function handler(event) {
    if(event?.httpMethod!=='POST')return json(405,{success:false,error:'method_not_allowed'});
    if(env.NEXA_TELEGRAM_ENABLED!=='true'||
       !env.NEXA_TELEGRAM_BOT_TOKEN||!env.NEXA_TELEGRAM_WEBHOOK_SECRET)
      return json(503,{success:false,error:'telegram_not_configured'});
    const signature=String(event.headers?.['x-telegram-bot-api-secret-token']||
      event.headers?.['X-Telegram-Bot-Api-Secret-Token']||'');
    if(!sameSecret(String(env.NEXA_TELEGRAM_WEBHOOK_SECRET),signature))
      return json(401,{success:false,error:'unauthorized'});
    let update;
    try {update=JSON.parse(String(event.body||'{}'));}
    catch(_error){return json(400,{success:false,error:'invalid_json'});}
    // No groups, channel broadcasting, phone sharing, files or callback writes.
    const msg=update?.message;
    const chatId=numberId(msg?.chat?.id);
    const userId=numberId(msg?.from?.id);
    const updateId=Number(update?.update_id);
    if(!Number.isSafeInteger(updateId)||updateId<0)
      return json(400,{success:false,error:'invalid_update'});
    if(!msg||msg.chat?.type!=='private'||!chatId||chatId!==userId||
       typeof msg.text!=='string'||msg.text.length>1800)
      return json(200,{success:true,ignored:true});
    let reserved=false;
    try {
      reserved=await reserveUpdate(updateId,chatId);
      if(!reserved)return json(200,{success:true,duplicate:true});
      const name=String(msg.from?.first_name||'').replace(/[<>]/g,'').slice(0,80);
      const contact=await currentContact(userId,chatId,name);
      const plan=resolveTelegramTurn({message:msg.text,humanPending:contact.status==='human_needed'});
      await saveMessage(updateId,chatId,'inbound',scrub(msg.text,plan.sensitive),
        numberId(msg.message_id),'received');
      if(plan.kind==='opt_out')await setServicePreference(userId,false);
      if(plan.kind==='service_opt_in')await setServicePreference(userId,true);
      if(plan.kind==='handoff')
        await createHandoff(chatId,plan.category,name,scrub(msg.text,plan.sensitive));
      if(plan.reply) {
        const sentId=await sendTelegram(chatId,plan.reply,String(env.NEXA_TELEGRAM_BOT_TOKEN));
        await saveMessage(updateId,chatId,'outbound',plan.reply,sentId,'sent');
      }
      await markUpdate(updateId,{status:'processed',processed_at:new Date().toISOString()});
      return json(200,{success:true,handled:true});
    }catch(error){
      console.error('telegram_support_error',error?.message||'unknown');
      if(reserved) {
        await markUpdate(updateId,{status:'failed',error_code:String(error?.message||'unknown').slice(0,80),
          processed_at:new Date().toISOString()}).catch(()=>null);
      }
      return json(500,{success:false,error:'processing_failed'});
    }
  };
}
exports.createHandler=createHandler;
exports.handler=createHandler();
