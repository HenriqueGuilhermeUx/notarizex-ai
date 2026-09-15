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

async function findBot(botId) {
  for (const table of ['whatsapp_bots', 'website_bots']) {
    const response = await db(`${table}?bot_id=eq.${encodeURIComponent(botId)}&select=bot_id&limit=1`);
    if (!response.ok) continue;
    const rows = await response.json();
    if (rows[0]) return { table, bot: rows[0] };
  }
  return null;
}

async function findReceipt(botId, correlationId) {
  const path = `smartbot_whatsapp_messages?bot_id=eq.${encodeURIComponent(botId)}&provider=eq.nexoffice&payload->>nexofficeCorrelationId=eq.${encodeURIComponent(correlationId)}&select=id,payload&limit=1`;
  const response = await db(path);
  if (!response.ok) throw new Error(`idempotency_lookup_failed:${response.status}`);
  const rows = await response.json();
  return rows[0] || null;
}

async function saveReceipt({ botId, phone, message, workspaceId, correlationId, commandActionId, approvalId, providerResponse }) {
  const record = {
    bot_id: botId,
    direction: 'outbound',
    contact_phone: phone,
    message,
    provider: 'nexoffice',
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
  if (!response.ok) throw new Error(`delivery_receipt_failed:${response.status}`);
  const rows = await response.json();
  return rows[0] || null;
}

async function sendProvider({ botId, phone, message, workspaceId, correlationId }) {
  const providerUrl = env('WHATSAPP_PROVIDER_URL');
  if (!providerUrl) throw new Error('whatsapp_provider_not_configured');
  const providerKey = env('WHATSAPP_PROVIDER_API_KEY');
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (providerKey) headers.authorization = `Bearer ${providerKey}`;
  const response = await fetch(providerUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      phone,
      message,
      botId,
      source: 'nexoffice',
      workspaceId,
      correlationId,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { text: text.slice(0, 1000) }; }
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || `provider_http_${response.status}`);
    error.httpStatus = response.status;
    throw error;
  }
  return { httpStatus: response.status, payload };
}

async function health(req) {
  const ctx = serviceContext(req);
  if (ctx.error) return ctx.error;
  let supabase = false;
  try { supabaseConfig(); supabase = true; } catch {}
  return json({
    success: true,
    service: 'SmartBots NexOffice Bridge',
    status: 'online',
    workspaceId: ctx.workspaceId,
    capabilities: ['whatsapp.send.approved'],
    integrations: {
      supabase,
      provider: Boolean(env('WHATSAPP_PROVIDER_URL')),
    },
  });
}

async function sendMessage(req) {
  const ctx = serviceContext(req);
  if (ctx.error) return ctx.error;
  if (req.method !== 'POST') return json({ success: false, error: 'method_not_allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ success: false, error: 'invalid_json' }, 400); }

  const botId = clean(body?.botId, 160);
  const channel = clean(body?.channel || 'whatsapp', 30).toLowerCase();
  const phone = digits(body?.recipient || body?.phone);
  const message = clean(body?.message, 4000);
  const correlationId = clean(req.headers.get('idempotency-key') || body?.correlationId, 220);
  const commandActionId = clean(body?.commandActionId, 120);
  const approvalId = clean(body?.approvalId, 120);

  if (body?.humanApproved !== true) return json({ success: false, error: 'human_approval_required' }, 409);
  if (channel !== 'whatsapp') return json({ success: false, error: 'unsupported_channel' }, 422);
  if (!botId || !phone || !message || !correlationId) {
    return json({ success: false, error: 'botId_recipient_message_and_correlation_required' }, 400);
  }
  if (phone.length < 10) return json({ success: false, error: 'invalid_recipient' }, 422);

  try {
    const bot = await findBot(botId);
    if (!bot) return json({ success: false, error: 'bot_not_found' }, 404);

    const prior = await findReceipt(botId, correlationId);
    if (prior) return json({ success: true, sent: true, duplicate: true, receiptId: prior.id, correlationId });

    const provider = await sendProvider({ botId, phone, message, workspaceId: ctx.workspaceId, correlationId });
    const receipt = await saveReceipt({
      botId,
      phone,
      message,
      workspaceId: ctx.workspaceId,
      correlationId,
      commandActionId,
      approvalId,
      providerResponse: provider.payload,
    });

    return json({
      success: true,
      sent: true,
      duplicate: false,
      provider: 'smartbots',
      botId,
      workspaceId: ctx.workspaceId,
      correlationId,
      receiptId: receipt?.id || null,
      providerResponse: provider.payload,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    const status = Number(error?.httpStatus || (messageText === 'whatsapp_provider_not_configured' ? 409 : 502));
    console.error('[NexOffice SmartBots Bridge]', messageText);
    return json({ success: false, sent: false, error: messageText }, status);
  }
}

export default async (req) => {
  const pathname = new URL(req.url).pathname;
  if (pathname.endsWith('/health')) return health(req);
  if (pathname.endsWith('/message')) return sendMessage(req);
  return json({ success: false, error: 'not_found' }, 404);
};

export const config = {
  path: ['/api/internal/nexoffice/health', '/api/internal/nexoffice/message'],
};
