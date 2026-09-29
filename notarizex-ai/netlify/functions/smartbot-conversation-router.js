const brain = require('./smartbot-brain');
const agent = require('./lib/scheduling-agent');
const core = require('./lib/scheduling-core');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function clean(value, max = 3000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function schedulingIntent(message) {
  const value = clean(message).toLowerCase();
  return /agenda|agendar|marcar|hor[aá]rio|disponibilidade|consulta|sess[aã]o|reuni[aã]o|visita|corte|barba|retorno|remarcar|remarca[cç][aã]o/.test(value);
}

async function activeSchedulingSession(botId, visitorId) {
  if (!botId || !visitorId) return null;
  try {
    const response = await core.db(`smartbot_scheduling_sessions?bot_id=eq.${encodeURIComponent(botId)}&visitor_id=eq.${encodeURIComponent(visitorId)}&state=in.(collecting,offered)&select=id,state,expires_at&limit=1`);
    if (!response.ok) return null;
    const row = (await response.json())[0] || null;
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
    return row;
  } catch (error) {
    console.error('scheduling session lookup', error.message);
    return null;
  }
}

async function syncLead(body, result) {
  const botId = clean(body.botId || body.bot_id, 160);
  const visitorId = clean(body.visitorId || body.visitor_id, 200);
  if (!botId || !visitorId || !result?.handled) return null;
  try {
    const lookup = await core.db(`smartbot_leads?bot_id=eq.${encodeURIComponent(botId)}&visitor_id=eq.${encodeURIComponent(visitorId)}&select=*&limit=1`);
    const existing = lookup.ok ? (await lookup.json())[0] : null;
    const now = new Date().toISOString();
    const payload = {
      bot_id: botId,
      visitor_id: visitorId,
      source_channel: clean(body.channel || 'site', 40),
      name: clean(body.contactName || existing?.name, 200) || null,
      phone: clean(body.contactPhone || existing?.phone, 40) || null,
      email: clean(body.contactEmail || existing?.email, 320).toLowerCase() || null,
      interest: clean(body.message, 1000),
      service_name: result.booking?.service_name || existing?.service_name || null,
      intent: 'agendamento',
      first_intent: existing?.first_intent || 'agendamento',
      last_intent: 'agendamento',
      lead_temperature: existing?.lead_temperature || 'hot',
      score: Math.max(Number(existing?.score || 0), result.state === 'confirmed' ? 95 : 75),
      next_action: result.state === 'confirmed' ? 'Agendamento confirmado' : 'Concluir escolha de horário',
      pipeline_status: result.state === 'confirmed' ? 'agendado' : 'agendamento',
      last_message_at: now,
      last_action_at: now,
      conversation_summary: clean(`Agendamento: ${body.message} | ${result.reply || ''}`, 1200),
      metadata: { ...(existing?.metadata || {}), schedulingState: result.state, schedulingCore: true },
      updated_at: now
    };
    let response;
    if (existing?.id) {
      response = await core.db(`smartbot_leads?id=eq.${encodeURIComponent(existing.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload)
      });
    } else {
      response = await core.db('smartbot_leads', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...payload, created_at: now })
      });
    }
    if (!response.ok) {
      console.error('scheduling lead sync', (await response.text()).slice(0, 400));
      return null;
    }
    return (await response.json())[0] || null;
  } catch (error) {
    console.error('scheduling lead sync', error.message);
    return null;
  }
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const botId = clean(body.botId || body.bot_id, 160);
    const visitorId = clean(body.visitorId || body.visitor_id || `v_${Date.now()}`, 200);
    const message = clean(body.message, 3000);
    if (!botId || !message) return reply(400, { success: false, error: 'botId e message obrigatorios' });

    const session = await activeSchedulingSession(botId, visitorId);
    const shouldSchedule = Boolean(session || schedulingIntent(message));
    if (shouldSchedule) {
      try {
        const result = await agent.handle({
          ...body,
          botId,
          visitorId,
          message,
          source: body.source || `smartbots-${clean(body.channel || 'site', 40)}`
        });
        if (result?.handled) {
          const lead = await syncLead({ ...body, botId, visitorId, message }, result);
          return reply(200, {
            success: true,
            reply: result.reply,
            intent: 'agendamento',
            visitorId,
            leadSaved: Boolean(lead),
            leadId: lead?.id || null,
            leadTemperature: lead?.lead_temperature || 'hot',
            pipelineStatus: lead?.pipeline_status || (result.state === 'confirmed' ? 'agendado' : 'agendamento'),
            nextAction: lead?.next_action || (result.state === 'confirmed' ? 'Agendamento confirmado' : 'Concluir escolha de horário'),
            handoffRequested: false,
            scheduling: {
              handled: true,
              state: result.state,
              booking: result.booking || null,
              slots: result.slots || null
            },
            engine: 'scheduling-core'
          });
        }
      } catch (error) {
        console.error('scheduling router fallback', error.message);
      }
    }

    return brain.handler({
      ...event,
      body: JSON.stringify({ ...body, botId, visitorId, message })
    });
  } catch (error) {
    console.error('smartbot-conversation-router', error);
    return reply(500, { success: false, error: error.message || 'Erro interno' });
  }
};
