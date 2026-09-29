const { resolvePortalSession } = require('./lib/client-portal-session');
const core = require('./lib/scheduling-core');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-SmartBots-Internal-Key',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

async function legacyBot(botId, clientToken) {
  if (!botId || !clientToken) return null;
  const response = await core.db(`website_bots?bot_id=eq.${encodeURIComponent(botId)}&client_token=eq.${encodeURIComponent(clientToken)}&select=bot_id&limit=1`);
  if (!response.ok) return null;
  return (await response.json())[0] || null;
}

async function resolveBot(event, body) {
  const internalKey = process.env.SMARTBOTS_INTERNAL_KEY;
  const suppliedKey = event.headers?.['x-smartbots-internal-key'] || event.headers?.['X-SmartBots-Internal-Key'];
  if (internalKey && suppliedKey === internalKey && body.botId) return { bot_id: core.clean(body.botId, 160), internal: true };

  if (body.portalToken) {
    const bot = await resolvePortalSession(body.portalToken);
    if (bot) return bot;
  }

  const botId = core.clean(body.botId, 160);
  const clientToken = core.clean(body.clientToken, 300);
  return legacyBot(botId, clientToken);
}

async function upsertService(botId, body) {
  const record = {
    bot_id: botId,
    name: core.clean(body.name, 200),
    description: core.clean(body.description, 2000) || null,
    duration_minutes: Math.max(5, Math.min(1440, Number(body.durationMinutes || 60))),
    buffer_before_minutes: Math.max(0, Math.min(240, Number(body.bufferBeforeMinutes || 0))),
    buffer_after_minutes: Math.max(0, Math.min(240, Number(body.bufferAfterMinutes || 0))),
    price_cents: body.priceCents == null ? null : Math.max(0, Math.round(Number(body.priceCents))),
    currency: core.clean(body.currency || 'BRL', 10),
    required_resource_type: core.clean(body.requiredResourceType, 80) || null,
    is_active: body.isActive !== false,
    metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {},
    updated_at: new Date().toISOString()
  };
  if (!record.name) throw new Error('Nome do servico obrigatorio');

  const id = core.clean(body.id, 80);
  const path = id
    ? `smartbot_scheduling_services?bot_id=eq.${encodeURIComponent(botId)}&id=eq.${encodeURIComponent(id)}`
    : 'smartbot_scheduling_services';
  const response = await core.db(path, {
    method: id ? 'PATCH' : 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(record)
  });
  return (await core.rows(response, 'save service'))[0] || null;
}

async function upsertResource(botId, body) {
  const workingHours = body.workingHours && typeof body.workingHours === 'object' && !Array.isArray(body.workingHours) ? body.workingHours : {};
  const record = {
    bot_id: botId,
    name: core.clean(body.name, 200),
    resource_type: core.clean(body.resourceType || 'professional', 80),
    timezone: core.clean(body.timezone || 'America/Sao_Paulo', 100),
    working_hours: workingHours,
    is_active: body.isActive !== false,
    metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {},
    updated_at: new Date().toISOString()
  };
  if (!record.name) throw new Error('Nome do recurso obrigatorio');

  const id = core.clean(body.id, 80);
  const path = id
    ? `smartbot_scheduling_resources?bot_id=eq.${encodeURIComponent(botId)}&id=eq.${encodeURIComponent(id)}`
    : 'smartbot_scheduling_resources';
  const response = await core.db(path, {
    method: id ? 'PATCH' : 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(record)
  });
  return (await core.rows(response, 'save resource'))[0] || null;
}

async function bindServiceResource(botId, serviceId, resourceId, enabled) {
  const service = core.clean(serviceId, 80);
  const resource = core.clean(resourceId, 80);
  if (!service || !resource) throw new Error('serviceId e resourceId obrigatorios');
  const path = `smartbot_scheduling_service_resources?bot_id=eq.${encodeURIComponent(botId)}&service_id=eq.${encodeURIComponent(service)}&resource_id=eq.${encodeURIComponent(resource)}`;
  if (enabled === false) {
    const response = await core.db(path, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    if (!response.ok) throw new Error(`unbind service resource: ${(await response.text()).slice(0, 500)}`);
    return { serviceId: service, resourceId: resource, enabled: false };
  }
  const response = await core.db('smartbot_scheduling_service_resources?on_conflict=service_id,resource_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ bot_id: botId, service_id: service, resource_id: resource })
  });
  await core.rows(response, 'bind service resource');
  return { serviceId: service, resourceId: resource, enabled: true };
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const bot = await resolveBot(event, body);
    if (!bot?.bot_id) return reply(403, { success: false, error: 'Sessao ou credencial invalida' });
    const botId = bot.bot_id;
    const action = core.clean(body.action, 80);

    if (action === 'capabilities') {
      return reply(200, {
        success: true,
        capabilities: [
          'scheduling.services.manage',
          'scheduling.resources.manage',
          'scheduling.availability.read',
          'scheduling.bookings.create',
          'scheduling.bookings.read',
          'scheduling.bookings.update'
        ]
      });
    }

    if (action === 'list_services') return reply(200, { success: true, items: await core.listServices(botId, body.activeOnly !== false) });
    if (action === 'list_resources') return reply(200, { success: true, items: await core.listResources(botId, body.activeOnly !== false) });
    if (action === 'save_service') return reply(200, { success: true, item: await upsertService(botId, body) });
    if (action === 'save_resource') return reply(200, { success: true, item: await upsertResource(botId, body) });
    if (action === 'bind_service_resource') return reply(200, { success: true, item: await bindServiceResource(botId, body.serviceId, body.resourceId, body.enabled) });

    if (action === 'availability') {
      const items = await core.availability({
        botId,
        serviceId: body.serviceId,
        resourceId: body.resourceId || null,
        from: body.from,
        to: body.to,
        stepMinutes: body.stepMinutes,
        limit: body.limit
      });
      return reply(200, { success: true, items });
    }

    if (action === 'create_booking') {
      const item = await core.createBooking({
        ...body,
        botId,
        source: body.source || (bot.internal ? 'smartbots-agent' : 'portal')
      });
      return reply(200, { success: true, item });
    }

    if (action === 'list_bookings') {
      return reply(200, { success: true, items: await core.listBookings(botId, body.from, body.to, body.visitorId) });
    }

    if (action === 'update_booking') {
      const id = core.clean(body.id, 80);
      if (!id) return reply(400, { success: false, error: 'id obrigatorio' });
      return reply(200, { success: true, item: await core.updateBooking(botId, id, { status: body.status, notes: body.notes }) });
    }

    return reply(400, { success: false, error: 'Acao invalida' });
  } catch (error) {
    console.error('scheduling-core', error);
    const message = error.message || 'Erro interno';
    const status = /indisponivel|fora da disponibilidade|nao encontrado|invalido|obrigatorio/i.test(message) ? 400 : 500;
    return reply(status, { success: false, error: message });
  }
};
