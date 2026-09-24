const crypto = require('crypto');
const fetch = require('node-fetch');

const PARTNER_PRICE_CENTS = 7900;
const REGULAR_PRICE_CENTS = 14900;
const TRIAL_DAYS = 7;
const HANDOFF_TTL_MS = 5 * 60 * 1000;

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-NexOffice-Key, X-NexOffice-Workspace-ID',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

function reply(statusCode, body) { return { statusCode, headers, body: JSON.stringify(body) }; }
function clean(value, max = 4000) { return String(value || '').replace(/\u0000/g, '').trim().slice(0, max); }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function safeEqual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function serviceContext(event) {
  const input = event.headers || {};
  const key = input['x-nexoffice-key'] || input['X-NexOffice-Key'] || '';
  const expected = process.env.NEXOFFICE_SERVICE_KEY || '';
  if (!expected) return { error: reply(503, { success:false, error:'bridge_not_configured' }) };
  if (!safeEqual(key, expected)) return { error: reply(401, { success:false, error:'unauthorized' }) };
  const workspaceId = clean(input['x-nexoffice-workspace-id'] || input['X-NexOffice-Workspace-ID'], 100);
  if (!workspaceId) return { error: reply(400, { success:false, error:'workspace_required' }) };
  return { workspaceId };
}
async function db(path, options = {}) {
  const url = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('supabase_service_not_configured');
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { accept:'application/json','content-type':'application/json',apikey:key,Authorization:`Bearer ${key}`,...(options.headers || {}) }
  });
}
async function rows(response, label) {
  if (!response.ok) throw new Error(`${label}:${response.status}:${(await response.text()).slice(0,500)}`);
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}
async function bindingForWorkspace(workspaceId) {
  return (await rows(await db(`smartbot_nexoffice_bindings?workspace_id=eq.${encodeURIComponent(workspaceId)}&status=eq.active&select=id,workspace_id,bot_id,status,updated_at&limit=1`),'binding_lookup'))[0] || null;
}
async function bindingForBot(botId) {
  return (await rows(await db(`smartbot_nexoffice_bindings?bot_id=eq.${encodeURIComponent(botId)}&status=eq.active&select=id,workspace_id,bot_id,status&limit=1`),'bot_binding_lookup'))[0] || null;
}
async function botForId(botId) {
  return (await rows(await db(`website_bots?bot_id=eq.${encodeURIComponent(botId)}&select=bot_id,company_name,owner_name,owner_email,email,status,billing_status,trial_ends_at,plan,client_token&limit=1`),'bot_lookup'))[0] || null;
}
async function whatsappPublic(botId) {
  const wa = (await rows(await db(`smartbot_whatsapp_config?bot_id=eq.${encodeURIComponent(botId)}&select=status,phone,auto_reply,provider_message_webhook_status,connection_type,provider_phone_number_id&limit=1`),'whatsapp_lookup'))[0] || null;
  if (!wa) return { connected:false, phone:null, autoReply:false, messageWebhookActive:false };
  return {
    connected: Boolean(wa.status === 'connected' && wa.provider_phone_number_id),
    phone: wa.phone || null,
    autoReply: wa.auto_reply === true,
    messageWebhookActive: wa.provider_message_webhook_status === 'active'
  };
}
async function subscriptionPublic(botId) {
  const sub = (await rows(await db(`smartbot_subscriptions?bot_id=eq.${encodeURIComponent(botId)}&select=status,plan,amount_cents,current_period_end,paid_at&limit=1`),'subscription_lookup'))[0] || null;
  if (!sub) return null;
  return { status:sub.status, plan:sub.plan, amountCents:Number(sub.amount_cents || 0), currentPeriodEnd:sub.current_period_end || null, paidAt:sub.paid_at || null };
}
async function publicStatus(workspaceId) {
  const binding = await bindingForWorkspace(workspaceId);
  if (!binding) return { provisioned:false, partnerEligible:false, offer:{partnerAmountCents:PARTNER_PRICE_CENTS,regularAmountCents:REGULAR_PRICE_CENTS,trialDays:TRIAL_DAYS} };
  const bot = await botForId(binding.bot_id);
  if (!bot) return { provisioned:false, partnerEligible:false, error:'bound_bot_not_found', offer:{partnerAmountCents:PARTNER_PRICE_CENTS,regularAmountCents:REGULAR_PRICE_CENTS,trialDays:TRIAL_DAYS} };
  const [whatsapp,subscription] = await Promise.all([whatsappPublic(bot.bot_id),subscriptionPublic(bot.bot_id)]);
  return {
    provisioned:true,
    partnerEligible:true,
    botId:bot.bot_id,
    companyName:bot.company_name,
    botStatus:bot.status,
    billingStatus:bot.billing_status || null,
    trialEndsAt:bot.trial_ends_at || null,
    subscription,
    whatsapp,
    offer:{partnerAmountCents:PARTNER_PRICE_CENTS,regularAmountCents:REGULAR_PRICE_CENTS,trialDays:TRIAL_DAYS}
  };
}
function normalizedProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    sector:clean(p.sector,120), subsector:clean(p.subsector,120), revenueModel:clean(p.revenue_model || p.revenueModel,120),
    primarySalesChannel:clean(p.primary_sales_channel || p.primarySalesChannel,160), seasonality:clean(p.seasonality,500), mainDependency:clean(p.main_dependency || p.mainDependency,500),
    notes:clean(p.notes,5000), metadata:p.metadata && typeof p.metadata === 'object' ? p.metadata : {}
  };
}
function seedKnowledge(companyName, website, profile, summary) {
  const facts = [
    `Empresa: ${companyName}.`,
    website ? `Site informado pelo NexOffice: ${website}.` : '',
    profile.sector ? `Setor: ${profile.sector}.` : '',
    profile.subsector ? `Subsetor: ${profile.subsector}.` : '',
    profile.revenueModel ? `Modelo de receita: ${profile.revenueModel}.` : '',
    profile.primarySalesChannel ? `Canal comercial principal: ${profile.primarySalesChannel}.` : '',
    profile.seasonality ? `Sazonalidade informada: ${profile.seasonality}.` : '',
    profile.mainDependency ? `Dependência principal informada: ${profile.mainDependency}.` : '',
    profile.notes ? `Notas empresariais: ${profile.notes}` : '',
    summary ? `Resumo do contexto NexOffice: ${summary}` : ''
  ].filter(Boolean);
  if (profile.metadata && Object.keys(profile.metadata).length) facts.push(`Contexto empresarial estruturado: ${JSON.stringify(profile.metadata).slice(0,12000)}`);
  facts.push('Regra: não inventar preços, políticas, garantias, resultados, certificações ou informações que não estejam explicitamente cadastradas. Quando faltar informação, pedir confirmação ou encaminhar para uma pessoa da equipe.');
  return facts.join('\n\n').slice(0,30000);
}
async function upsertBinding(workspaceId, botId) {
  const other = await bindingForBot(botId);
  if (other && other.workspace_id !== workspaceId) throw new Error('bot_already_bound_to_another_workspace');
  const response = await db('smartbot_nexoffice_bindings?on_conflict=workspace_id', {
    method:'POST', headers:{Prefer:'resolution=merge-duplicates,return=representation'},
    body:JSON.stringify({workspace_id:workspaceId,bot_id:botId,status:'active',updated_at:new Date().toISOString()})
  });
  return (await rows(response,'binding_save'))[0] || {workspace_id:workspaceId,bot_id:botId,status:'active'};
}
async function createPartnerHandoff(workspaceId, botId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now()+HANDOFF_TTL_MS).toISOString();
  await db(`smartbot_connection_invites?bot_id=eq.${encodeURIComponent(botId)}&purpose=eq.nexoffice_partner_handoff&completed_at=is.null`, {
    method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({revoked_at:new Date().toISOString()})
  }).catch(()=>null);
  await rows(await db('smartbot_connection_invites',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({bot_id:botId,token_hash:hash(token),purpose:'nexoffice_partner_handoff',expires_at:expiresAt,metadata:{source:'nexoffice',workspaceId}})}),'handoff_create');
  return { handoffUrl:`https://smartbots.club/nexoffice-handoff.html#handoff=${encodeURIComponent(token)}`, expiresAt };
}
async function createPartnerBot(workspaceId, body) {
  const companyName = clean(body.companyName,180);
  const ownerName = clean(body.ownerName,180) || companyName;
  const ownerEmail = clean(body.ownerEmail,240).toLowerCase();
  const website = clean(body.website,500);
  if (!companyName || !ownerEmail) throw new Error('company_and_owner_required');
  const profile = normalizedProfile(body.businessProfile);
  const knowledge = seedKnowledge(companyName,website,profile,clean(body.businessSummary,12000));
  const botId = `site-nexoffice-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
  const clientToken = `nx_${crypto.randomBytes(32).toString('base64url')}`;
  const now = new Date();
  const trialEndsAt = new Date(now.getTime()+TRIAL_DAYS*24*60*60*1000).toISOString();
  let botCreated = false;
  try {
    await rows(await db('website_bots',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
      bot_id:botId,client_token:clientToken,company_name:companyName,owner_name:ownerName,owner_email:ownerEmail,email:ownerEmail,owner_whatsapp:clean(body.ownerWhatsApp,40)||null,website:website||null,
      business_description:clean(body.businessSummary,5000)||profile.notes||`Atendimento da ${companyName}`,
      plan:'nexoffice',status:'onboarding',billing_status:'trial',trial_started_at:now.toISOString(),trial_ends_at:trialEndsAt,knowledge_status:'ok'
    })}),'bot_create');
    botCreated = true;
    await rows(await db('smartbot_profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
      bot_id:botId,profile_name:'Padrão NexOffice',assistant_name:`Assistente ${companyName}`.slice(0,160),assistant_role:'Atendimento comercial e relacionamento',
      primary_goal:'Atender clientes, responder dúvidas com base no conhecimento da empresa, qualificar oportunidades e encaminhar para uma pessoa quando necessário.',
      tone:'profissional, claro, cordial e objetivo',language:'pt-BR',communication_style:'Conversa natural. Respostas curtas quando possível; aprofundar quando o cliente pedir.',
      qualification_questions:[],handoff_rules:['Pedido explícito para falar com uma pessoa','Intenção clara de contratar quando a equipe precisar continuar','Questão sensível ou informação não cadastrada'],
      guardrails:['Não inventar preços, políticas, garantias, resultados ou informações ausentes','Não misturar dados de outras empresas','Não prometer ação externa que não foi confirmada'],
      ai_model:'gpt-5.6-luna',active:true
    })}),'profile_create');
    await rows(await db('smartbot_knowledge',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({bot_id:botId,source_type:'nexoffice',title:'Contexto empresarial NexOffice',content:knowledge,source_url:website||null,priority:100,is_active:true})}),'knowledge_create');
    await upsertBinding(workspaceId,botId);
    return await botForId(botId);
  } catch (error) {
    if (botCreated) {
      await db(`smartbot_profiles?bot_id=eq.${encodeURIComponent(botId)}`,{method:'DELETE'}).catch(()=>null);
      await db(`smartbot_knowledge?bot_id=eq.${encodeURIComponent(botId)}`,{method:'DELETE'}).catch(()=>null);
      await db(`website_bots?bot_id=eq.${encodeURIComponent(botId)}`,{method:'DELETE'}).catch(()=>null);
    }
    throw error;
  }
}
async function start(workspaceId, body) {
  if (body.eligible !== true) return { statusCode:403, body:{success:false,error:'nexoffice_subscription_required'} };
  let binding = await bindingForWorkspace(workspaceId);
  let bot = binding ? await botForId(binding.bot_id) : null;
  if (!bot && body.existingBotId) {
    const candidate = await botForId(clean(body.existingBotId,160));
    if (candidate) { await upsertBinding(workspaceId,candidate.bot_id); bot=candidate; binding=await bindingForWorkspace(workspaceId); }
  }
  if (!bot) { bot=await createPartnerBot(workspaceId,body); binding=await bindingForWorkspace(workspaceId); }
  if (!binding) await upsertBinding(workspaceId,bot.bot_id);
  await db(`website_bots?bot_id=eq.${encodeURIComponent(bot.bot_id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({plan:'nexoffice',updated_at:new Date().toISOString()})});
  const handoff = await createPartnerHandoff(workspaceId,bot.bot_id);
  return { statusCode:200, body:{success:true,...await publicStatus(workspaceId),handoffUrl:handoff.handoffUrl,handoffExpiresAt:handoff.expiresAt} };
}
async function sync(workspaceId, body) {
  const binding = await bindingForWorkspace(workspaceId);
  if (body.eligible === true) {
    if (!binding && body.existingBotId) {
      const bot=await botForId(clean(body.existingBotId,160));
      if (bot) await upsertBinding(workspaceId,bot.bot_id);
    }
    const active=await bindingForWorkspace(workspaceId);
    if (active) await db(`website_bots?bot_id=eq.${encodeURIComponent(active.bot_id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({plan:'nexoffice',updated_at:new Date().toISOString()})});
    return { success:true,eligible:true,provisioned:Boolean(active),...(await publicStatus(workspaceId)) };
  }
  if (binding) await db(`smartbot_nexoffice_bindings?id=eq.${encodeURIComponent(binding.id)}`,{method:'DELETE'});
  return { success:true,eligible:false,provisioned:Boolean(binding),partnerBenefitActive:false,offer:{partnerAmountCents:PARTNER_PRICE_CENTS,regularAmountCents:REGULAR_PRICE_CENTS,trialDays:TRIAL_DAYS} };
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return {statusCode:204,headers,body:''};
  if (event.httpMethod !== 'POST') return reply(405,{success:false,error:'Method Not Allowed'});
  const ctx = serviceContext(event);
  if (ctx.error) return ctx.error;
  try {
    const body = JSON.parse(event.body || '{}');
    const action = clean(body.action || 'status',40);
    if (action === 'status') return reply(200,{success:true,...await publicStatus(ctx.workspaceId)});
    if (action === 'start') { const result=await start(ctx.workspaceId,body); return reply(result.statusCode,result.body); }
    if (action === 'sync') return reply(200,await sync(ctx.workspaceId,body));
    return reply(422,{success:false,error:'invalid_action'});
  } catch (error) {
    const message=error instanceof Error?error.message:String(error);
    console.error('[NexOffice Addon]',message);
    const status=message==='bot_already_bound_to_another_workspace'?409:502;
    return reply(status,{success:false,error:message});
  }
};
