import { timingSafeEqual } from 'node:crypto';

function env(name) {
  return String(Netlify.env.get(name) || '').trim();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function safeEqual(received, expected) {
  if (!received || !expected) return false;
  const a = Buffer.from(String(received));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

function digits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 20);
}

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function serviceContext(req) {
  const key = req.headers.get('x-nexoffice-key') || '';
  const expected = env('NEXOFFICE_SERVICE_KEY');
  if (!expected) return { error: json({ success: false, error: 'bridge_not_configured' }, 503) };
  if (!safeEqual(key, expected)) return { error: json({ success: false, error: 'unauthorized' }, 401) };
  const workspaceId = clean(req.headers.get('x-nexoffice-workspace-id'), 100);
  if (!workspaceId) return { error: json({ success: false, error: 'workspace_required' }, 400) };
  return { workspaceId };
}

function supabaseConfig() {
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const key = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('supabase_service_not_configured');
  return { url, key };
}

async function db(path, options = {}) {
  const { url, key } = supabaseConfig();
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      apikey: key,
      authorization: `Bearer ${key}`,
      ...(options.headers || {}),
    },
  });
}

async function rows(response, label) {
  if (!response.ok) throw new Error(`${label}:${response.status}:${(await response.text()).slice(0, 500)}`);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : [];
}

async function findBot(botId) {
  const response = await db(`website_bots?bot_id=eq.${encodeURIComponent(botId)}&select=bot_id,company_name,status&limit=1`);
  const data = await rows(response, 'bot_lookup_failed');
  return data[0] || null;
}

async function verifyClientToken(botId, clientToken) {
  if (!botId || !clientToken) return false;
  const response = await db(`website_bots?bot_id=eq.${encodeURIComponent(botId)}&client_token=eq.${encodeURIComponent(clientToken)}&select=bot_id&limit=1`);
  if (!response.ok) return false;
  const data = await response.json();
  return Boolean(data[0]);
}

async function workspaceBinding(workspaceId) {
  const response = await db(`smartbot_nexoffice_bindings?workspace_id=eq.${encodeURIComponent(workspaceId)}&status=eq.active&select=id,workspace_id,bot_id,status,updated_at&limit=1`);
  const data = await rows(response, 'binding_lookup_failed');
  return data[0] || null;
}

async function botBinding(botId) {
  const response = await db(`smartbot_nexoffice_bindings?bot_id=eq.${encodeURIComponent(botId)}&status=eq.active&select=id,workspace_id,bot_id,status&limit=1`);
  const data = await rows(response, 'bot_binding_lookup_failed');
  return data[0] || null;
}

async function bindWorkspace(workspaceId, botId, clientToken) {
  if (!await verifyClientToken(botId, clientToken)) {
    return { ok: false, status: 403, error: 'invalid_bot_credentials' };
  }
  const alreadyForBot = await botBinding(botId);
  if (alreadyForBot && alreadyForBot.workspace_id !== workspaceId) {
    return { ok: false, status: 409, error: 'bot_already_bound_to_another_workspace' };
  }
  const response = await db('smartbot_nexoffice_bindings?on_conflict=workspace_id', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      bot_id: botId,
      status: 'active',
      updated_at: new Date().toISOString(),
    }),
  });
  const data = await rows(response, 'binding_save_failed');
  return { ok: true, binding: data[0] || { workspace_id: workspaceId, bot_id: botId, status: 'active' } };
}

async function whatsappConfig(botId) {
  const response = await db(`smartbot_whatsapp_config?bot_id=eq.${encodeURIComponent(botId)}&select=bot_id,provider,status,provider_phone_number_id&limit=1`);
  const data = await rows(response, 'whatsapp_config_lookup_failed');
  return data[0] || null;
}

async function claimDispatch({ workspaceId, botId, correlationId, commandActionId, approvalId, phone }) {
  const record = {
    workspace_id: workspaceId,
    bot_id: botId,
    correlation_id: correlationId,
    command_action_id: commandActionId || null,
    approval_id: approvalId || null,
    recipient: phone,
    status: 'pending',
  };
  const response = await db('smartbot_nexoffice_dispatches', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (response.ok) {
    const data = await response.json();
    return { claimed: true, dispatch: data[0] || record };
  }
  if (response.status !== 409) throw new Error(`dispatch_claim_failed:${response.status}`);
  const existingResponse = await db(`smartbot_nexoffice_dispatches?workspace_id=eq.${encodeURIComponent(workspaceId)}&correlation_id=eq.${encodeURIComponent(correlationId)}&select=*&limit=1`);
  const existing = (await rows(existingResponse, 'dispatch_existing_lookup_failed'))[0];
  if (!existing) throw new Error('dispatch_conflict_without_record');
  if (existing.bot_id !== botId) return { claimed: false, conflict: true, error: 'correlation_bound_to_different_bot', dispatch: existing };
  if (existing.status === 'sent') return { claimed: false, duplicate: true, dispatch: existing };
  if (existing.status === 'pending') return { claimed: false, inProgress: true, dispatch: existing };
  const retry = await db(`smartbot_nexoffice_dispatches?id=eq.${encodeURIComponent(existing.id)}&status=eq.failed`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({ status: 'pending', error: null, updated_at: new Date().toISOString() }),
  });
  const retried = await rows(retry, 'dispatch_retry_failed');
  return { claimed: Boolean(retried[0]), dispatch: retried[0] || existing, inProgress: !retried[0] };
}

async function finishDispatch(id, patch) {
  if (!id) return null;
  const response = await db(`smartbot_nexoffice_dispatches?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  const data = await rows(response, 'dispatch_update_failed');
  return data[0] || null;
}

async function saveMessageReceipt({ botId, phone, message, workspaceId, correlationId, commandActionId, approvalId, providerMessageId, providerResponse }) {
  const record = {
    bot_id: botId,
    direction: 'outbound',
    contact_phone: phone,
    message,
    provider: 'kapso',
    provider_message_id: providerMessageId || null,
    payload: {
      source: 'nexoffice',
      workspaceId,
      nexofficeCorrelationId: correlationId,
      commandActionId: commandActionId || null,
      approvalId: approvalId || null,
      humanApproved: true,
      sentAt: new Date().toISOString(),
      providerResponse,
    },
  };
  const response = await db('smartbot_whatsapp_messages', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (!response.ok) {
    console.error('[NexOffice SmartBots Bridge] delivery receipt failed', response.status);
    return null;
  }
  const data = await response.json();
  return data[0] || null;
}

async function sendKapso({ botId, phone, message }) {
  const apiKey = env('KAPSO_API_KEY');
  if (!apiKey) throw new Error('kapso_not_configured');
  const cfg = await whatsappConfig(botId);
  if (!cfg || clean(cfg.provider).toLowerCase() !== 'kapso' || clean(cfg.status).toLowerCase() !== 'connected') {
    throw new Error('bot_whatsapp_not_connected');
  }
  const phoneNumberId = clean(cfg.provider_phone_number_id, 120);
  if (!phoneNumberId) throw new Error('bot_kapso_phone_number_missing');
  const mod = await import('@kapso/whatsapp-cloud-api');
  const WhatsAppClient = mod.WhatsAppClient || mod.default?.WhatsAppClient;
  if (!WhatsAppClient) throw new Error('kapso_client_unavailable');
  const client = new WhatsAppClient({ baseUrl: 'https://api.kapso.ai/meta/whatsapp', kapsoApiKey: apiKey });
  const sent = await client.messages.sendText({ phoneNumberId, to: phone, body: message });
  const providerMessageId = clean(sent?.messages?.[0]?.id, 300) || null;
  return { provider: 'kapso', providerMessageId, payload: sent };
}

async function health(req) {
  const ctx = serviceContext(req);
  if (ctx.error) return ctx.error;
  let supabase = false;
  let binding = null;
  let whatsapp = null;
  try {
    supabaseConfig();
    supabase = true;
    binding = await workspaceBinding(ctx.workspaceId);
    if (binding) whatsapp = await whatsappConfig(binding.bot_id);
  } catch (error) {
    console.error('[NexOffice SmartBots Bridge] health', error instanceof Error ? error.message : String(error));
  }
  const whatsappConnected = Boolean(whatsapp && clean(whatsapp.provider).toLowerCase() === 'kapso' && clean(whatsapp.status).toLowerCase() === 'connected' && clean(whatsapp.provider_phone_number_id));
  return json({
    success: true,
    service: 'SmartBots NexOffice Bridge',
    status: 'online',
    workspaceId: ctx.workspaceId,
    workspaceBound: Boolean(binding),
    botId: binding?.bot_id || null,
    capabilities: ['workspace.binding', 'whatsapp.send.approved', 'idempotent.dispatch'],
    integrations: {
      supabase,
      kapso: Boolean(env('KAPSO_API_KEY')),
      whatsappConnected,
    },
  });
}

async function bind(req) {
  const ctx = serviceContext(req);
  if (ctx.error) return ctx.error;
  if (req.method !== 'POST') return json({ success: false, error: 'method_not_allowed' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ success: false, error: 'invalid_json' }, 400); }
  const botId = clean(body?.botId, 160);
  const clientToken = clean(body?.clientToken, 300);
  if (!botId || !clientToken) return json({ success: false, error: 'botId_and_clientToken_required' }, 400);
  try {
    const bot = await findBot(botId);
    if (!bot) return json({ success: false, error: 'bot_not_found' }, 404);
    const result = await bindWorkspace(ctx.workspaceId, botId, clientToken);
    if (!result.ok) return json({ success: false, error: result.error }, result.status || 400);
    return json({ success: true, provider: 'smartbots', workspaceId: ctx.workspaceId, botId, bound: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[NexOffice SmartBots Bridge] bind', message);
    return json({ success: false, error: message }, 502);
  }
}

async function sendMessage(req) {
  const ctx = serviceContext(req);
  if (ctx.error) return ctx.error;
  if (req.method !== 'POST') return json({ success: false, error: 'method_not_allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ success: false, error: 'invalid_json' }, 400); }

  const requestedBotId = clean(body?.botId, 160);
  const channel = clean(body?.channel || 'whatsapp', 30).toLowerCase();
  const phone = digits(body?.recipient || body?.phone);
  const message = clean(body?.message, 4000);
  const correlationId = clean(req.headers.get('idempotency-key') || body?.correlationId, 220);
  const commandActionId = clean(body?.commandActionId, 120);
  const approvalId = clean(body?.approvalId, 120);

  if (body?.humanApproved !== true) return json({ success: false, error: 'human_approval_required' }, 409);
  if (channel !== 'whatsapp') return json({ success: false, error: 'unsupported_channel' }, 422);
  if (!phone || !message || !correlationId) return json({ success: false, error: 'recipient_message_and_correlation_required' }, 400);
  if (phone.length < 10) return json({ success: false, error: 'invalid_recipient' }, 422);

  let dispatch = null;
  try {
    const binding = await workspaceBinding(ctx.workspaceId);
    if (!binding) return json({ success: false, error: 'workspace_not_bound_to_smartbot' }, 403);
    const botId = clean(binding.bot_id, 160);
    if (requestedBotId && requestedBotId !== botId) return json({ success: false, error: 'bot_workspace_mismatch' }, 403);
    const bot = await findBot(botId);
    if (!bot) return json({ success: false, error: 'bound_bot_not_found' }, 404);

    const claim = await claimDispatch({ workspaceId: ctx.workspaceId, botId, correlationId, commandActionId, approvalId, phone });
    dispatch = claim.dispatch;
    if (claim.conflict) return json({ success: false, error: claim.error }, 409);
    if (claim.duplicate) {
      return json({
        success: true,
        sent: true,
        duplicate: true,
        provider: dispatch.provider || 'kapso',
        botId,
        workspaceId: ctx.workspaceId,
        correlationId,
        dispatchId: dispatch.id,
        providerMessageId: dispatch.provider_message_id || null,
      });
    }
    if (claim.inProgress || !claim.claimed) return json({ success: false, sent: false, error: 'dispatch_in_progress', correlationId }, 409);

    const provider = await sendKapso({ botId, phone, message });
    dispatch = await finishDispatch(dispatch?.id, {
      status: 'sent',
      provider: provider.provider,
      provider_message_id: provider.providerMessageId,
      provider_response: provider.payload,
      error: null,
    }) || dispatch;

    const receipt = await saveMessageReceipt({
      botId,
      phone,
      message,
      workspaceId: ctx.workspaceId,
      correlationId,
      commandActionId,
      approvalId,
      providerMessageId: provider.providerMessageId,
      providerResponse: provider.payload,
    });

    return json({
      success: true,
      sent: true,
      duplicate: false,
      provider: provider.provider,
      botId,
      workspaceId: ctx.workspaceId,
      correlationId,
      dispatchId: dispatch?.id || null,
      receiptId: receipt?.id || null,
      providerMessageId: provider.providerMessageId,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (dispatch?.id) {
      try { await finishDispatch(dispatch.id, { status: 'failed', error: messageText.slice(0, 1000) }); } catch {}
    }
    const status = messageText === 'bot_whatsapp_not_connected' || messageText === 'bot_kapso_phone_number_missing' ? 409 : 502;
    console.error('[NexOffice SmartBots Bridge]', messageText);
    return json({ success: false, sent: false, error: messageText }, status);
  }
}

export default async (req) => {
  const pathname = new URL(req.url).pathname;
  if (pathname.endsWith('/health')) return health(req);
  if (pathname.endsWith('/bind')) return bind(req);
  if (pathname.endsWith('/message')) return sendMessage(req);
  return json({ success: false, error: 'not_found' }, 404);
};

export const config = {
  path: ['/api/internal/nexoffice/health', '/api/internal/nexoffice/bind', '/api/internal/nexoffice/message'],
};
