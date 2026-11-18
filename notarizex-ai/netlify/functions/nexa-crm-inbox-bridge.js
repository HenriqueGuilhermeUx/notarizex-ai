'use strict';
const crypto = require('crypto');
const fetch = require('node-fetch');

const BOT_ID = 'site-nexa-20260923-live';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store, max-age=0',
    'Vary': 'Authorization',
    'X-Content-Type-Options': 'nosniff'
  },
  body: JSON.stringify(body)
});

function authorized(value, expected) {
  if (!value || !expected || expected.length < 32) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeText(value, maxLength) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function maskPhone(value) {
  const digits = safeText(value, 32).replace(/\D/g, '');
  return digits.length >= 4 ? '••••' + digits.slice(-4) : '';
}

function projectInbox(row) {
  return {
    id: row.id,
    contactName: safeText(row.contact_name, 120),
    maskedPhone: maskPhone(row.contact_phone),
    preview: safeText(row.last_message, 200),
    intent: safeText(row.intent, 100),
    status: safeText(row.status, 60),
    source: safeText(row.source, 60),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function projectMessage(row) {
  return {
    id: row.id,
    direction: row.direction === 'outbound' ? 'outbound' : 'inbound',
    message: safeText(row.message, 4000),
    createdAt: row.created_at || null,
    deliveryStatus: safeText(row.delivery_status, 40)
  };
}

/**
 * A read-only operational count. A sent/delivered message or pending ticket
 * is NOT evidence that a user's KYC was completed or their case resolved.
 * No customer identifiers, raw messages, preview or PII leave this function.
 */
function aggregateSupportOutcomes(inboxes, messages, since) {
  const active = inboxes.filter(row => Date.parse(String(row.updated_at || '')) >= since);
  const statuses = {human_needed:0,new:0,commercial_ready:0,other:0};
  const intents = {handoff:0,duvida:0,other:0};
  for (const row of active) {
    const status=String(row.status||'');
    statuses[Object.prototype.hasOwnProperty.call(statuses,status)?status:'other']++;
    const intent=String(row.intent||'');
    intents[Object.prototype.hasOwnProperty.call(intents,intent)?intent:'other']++;
  }
  const counts={inbound:0,outbound:0,providerSent:0,providerDelivered:0,providerRead:0,
    providerFailed:0,providerUnconfirmed:0};
  for(const row of messages) {
    if(Date.parse(String(row.created_at||''))<since) continue;
    if(row.direction==='inbound') {counts.inbound++;continue;}
    if(row.direction!=='outbound') continue;
    counts.outbound++;
    const delivery=String(row.delivery_status||'').toLowerCase();
    if(delivery==='sent') counts.providerSent++;
    else if(delivery==='delivered') counts.providerDelivered++;
    else if(delivery==='read') counts.providerRead++;
    else if(delivery==='failed') counts.providerFailed++;
    else counts.providerUnconfirmed++;
  }
  return {activeConversations:active.length,queue:statuses,intents,messages:counts,
    confirmedByProvider:counts.providerSent+counts.providerDelivered+counts.providerRead,
    resolutionRate:null,kycCompletionRate:null,
    limitations:['A fila registra necessidade de atendimento, nao resolucao.',
      'Mensagens confirmadas pelo provedor nao comprovam leitura ou conversao.',
      'Janela de sete dias e dados limitados a 500 registros recentes por consulta.']};
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, {error:'method_not_allowed'});
  const token = process.env.NEXA_CRM_INBOX_BRIDGE_TOKEN;
  const bearer = String(event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!authorized(bearer, token)) return json(401, {error:'unauthorized'});

  const isSummary = event.queryStringParameters?.summary === '7d';
  const inboxId = String(event.queryStringParameters?.inbox_id || '').trim();
  if (inboxId && !UUID.test(inboxId)) return json(400, {error:'invalid_inbox_id'});

  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url.startsWith('https://') || !key) return json(503, {error:'not_configured'});

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  const headers = {apikey:key, Authorization:'Bearer ' + key, Accept:'application/json'};
  const getRows = async (path) => {
    const response = await fetch(url + '/rest/v1/' + path, {
      headers, signal:controller.signal, redirect:'error'
    });
    if (!response.ok) throw new Error('upstream_unavailable');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('invalid_upstream');
    return rows;
  };

  try {
    const filter = 'bot_id=eq.' + encodeURIComponent(BOT_ID);
    if (isSummary && !inboxId) {
      const since=Date.now()-7*24*60*60*1000;
      const threshold=new Date(since).toISOString();
      const [inboxes,messages]=await Promise.all([
        getRows('smartbot_whatsapp_inbox?' + filter +
          '&updated_at=gte.'+encodeURIComponent(threshold)+
          '&select=status,intent,updated_at&order=updated_at.desc&limit=500'),
        getRows('smartbot_whatsapp_messages?' + filter +
          '&created_at=gte.'+encodeURIComponent(threshold)+
          '&select=direction,delivery_status,created_at&order=created_at.desc&limit=500')
      ]);
      return json(200,{success:true,mode:'aggregate_read_only',period:'last_7_days',
        channel:'whatsapp',noPersonalData:true,canSend:false,
        outcomes:aggregateSupportOutcomes(inboxes,messages,since)});
    }
    if (!inboxId) {
      const rows = await getRows('smartbot_whatsapp_inbox?' + filter +
        '&select=id,contact_name,contact_phone,last_message,intent,status,source,created_at,updated_at' +
        '&order=updated_at.desc&limit=50');
      return json(200, {success:true,mode:'read_only',botId:BOT_ID,
        customerIdentityLinked:false,canSend:false,
        items: rows.filter(row => UUID.test(String(row.id || ''))).map(projectInbox)});
    }

    const inbox = await getRows('smartbot_whatsapp_inbox?' + filter +
      '&id=eq.' + encodeURIComponent(inboxId) +
      '&select=id,contact_name,contact_phone,last_message,intent,status,source,created_at,updated_at&limit=1');
    if (!inbox.length) return json(404, {error:'inbox_not_found'});
    const messages = await getRows('smartbot_whatsapp_messages?' + filter +
      '&inbox_id=eq.' + encodeURIComponent(inboxId) +
      '&select=id,direction,message,created_at,delivery_status&order=created_at.desc&limit=50');
    return json(200, {success:true,mode:'read_only',botId:BOT_ID,
      customerIdentityLinked:false,canSend:false,
      conversation:projectInbox(inbox[0]),
      messages:messages.reverse().map(projectMessage)});
  } catch {
    return json(502, {error:'upstream_unavailable'});
  } finally {
    clearTimeout(timeout);
  }
};

module.exports.aggregateSupportOutcomes=aggregateSupportOutcomes;
