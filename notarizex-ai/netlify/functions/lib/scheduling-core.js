const fetch = require('node-fetch');

function clean(value, max = 2000) {
  return String(value || '').trim().slice(0, max);
}

function dbConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase nao configurado');
  return { url, key };
}

function schedulingPrefix() {
  if (process.env.SCHEDULING_TABLE_PREFIX !== undefined) {
    const explicit = String(process.env.SCHEDULING_TABLE_PREFIX || '').trim();
    if (explicit && !/^[a-z0-9_]+$/i.test(explicit)) throw new Error('SCHEDULING_TABLE_PREFIX invalido');
    return explicit;
  }
  return process.env.CONTEXT === 'production' ? '' : 'stg_';
}

function routeSchedulingPath(path) {
  const prefix = schedulingPrefix();
  if (!prefix) return path;
  return String(path).replace(/^smartbot_scheduling_/, `${prefix}smartbot_scheduling_`);
}

async function db(path, options = {}) {
  const { url, key } = dbConfig();
  const routedPath = routeSchedulingPath(path);
  return fetch(`${url}/rest/v1/${routedPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
}

async function rows(response, label) {
  if (!response.ok) throw new Error(`${label}: ${(await response.text()).slice(0, 500)}`);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : [];
}

function iso(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} invalido`);
  return date.toISOString();
}

function int(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function minutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const weekday = { Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat' }[map.weekday];
  return { weekday, minuteOfDay: Number(map.hour) * 60 + Number(map.minute) };
}

function scheduleRanges(workingHours, weekday) {
  const raw = workingHours && workingHours[weekday];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(item => {
    if (typeof item === 'string') {
      const [from, to] = item.split('-');
      return { from: minutes(from), to: minutes(to) };
    }
    return { from: minutes(item && item.from), to: minutes(item && item.to) };
  }).filter(item => item.from !== null && item.to !== null && item.to > item.from);
}

function withinWorkingHours(resource, start, end) {
  const timezone = resource.timezone || 'America/Sao_Paulo';
  const a = localParts(start, timezone);
  const b = localParts(new Date(end.getTime() - 1000), timezone);
  if (a.weekday !== b.weekday) return false;
  const ranges = scheduleRanges(resource.working_hours || {}, a.weekday);
  return ranges.some(range => a.minuteOfDay >= range.from && b.minuteOfDay < range.to);
}

function overlaps(start, end, booking) {
  const bookingStart = new Date(booking.starts_at).getTime();
  const bookingEnd = new Date(booking.ends_at).getTime();
  return start.getTime() < bookingEnd && end.getTime() > bookingStart;
}

async function listServices(botId, activeOnly = true) {
  const filter = activeOnly ? '&is_active=eq.true' : '';
  const response = await db(`smartbot_scheduling_services?bot_id=eq.${encodeURIComponent(botId)}${filter}&order=name.asc`);
  return rows(response, 'services');
}

async function listResources(botId, activeOnly = true) {
  const filter = activeOnly ? '&is_active=eq.true' : '';
  const response = await db(`smartbot_scheduling_resources?bot_id=eq.${encodeURIComponent(botId)}${filter}&order=name.asc`);
  return rows(response, 'resources');
}

async function serviceById(botId, serviceId) {
  const response = await db(`smartbot_scheduling_services?bot_id=eq.${encodeURIComponent(botId)}&id=eq.${encodeURIComponent(serviceId)}&limit=1`);
  return (await rows(response, 'service'))[0] || null;
}

async function resourceById(botId, resourceId) {
  const response = await db(`smartbot_scheduling_resources?bot_id=eq.${encodeURIComponent(botId)}&id=eq.${encodeURIComponent(resourceId)}&limit=1`);
  return (await rows(response, 'resource'))[0] || null;
}

async function eligibleResources(botId, service, requestedResourceId) {
  const all = await listResources(botId, true);
  let eligible = all;
  if (requestedResourceId) eligible = eligible.filter(item => item.id === requestedResourceId);
  if (service.required_resource_type) eligible = eligible.filter(item => item.resource_type === service.required_resource_type);

  const response = await db(`smartbot_scheduling_service_resources?bot_id=eq.${encodeURIComponent(botId)}&service_id=eq.${encodeURIComponent(service.id)}&select=resource_id`);
  const mappings = await rows(response, 'service resources');
  if (mappings.length) {
    const allowed = new Set(mappings.map(item => item.resource_id));
    eligible = eligible.filter(item => allowed.has(item.id));
  }
  return eligible;
}

async function bookingsInWindow(botId, from, to, resourceIds = []) {
  let path = `smartbot_scheduling_bookings?bot_id=eq.${encodeURIComponent(botId)}&status=in.(requested,confirmed)&starts_at=lt.${encodeURIComponent(to)}&ends_at=gt.${encodeURIComponent(from)}&order=starts_at.asc`;
  if (resourceIds.length === 1) path += `&resource_id=eq.${encodeURIComponent(resourceIds[0])}`;
  if (resourceIds.length > 1) path += `&resource_id=in.(${resourceIds.map(id => encodeURIComponent(id)).join(',')})`;
  const response = await db(path);
  return rows(response, 'bookings');
}

async function availability({ botId, serviceId, resourceId, from, to, stepMinutes = 15, limit = 60 }) {
  const service = await serviceById(botId, serviceId);
  if (!service || !service.is_active) throw new Error('Servico nao encontrado ou inativo');
  const resources = await eligibleResources(botId, service, resourceId);
  if (!resources.length) return [];

  const startWindow = new Date(iso(from, 'from'));
  const endWindow = new Date(iso(to, 'to'));
  if (endWindow <= startWindow) throw new Error('Janela de disponibilidade invalida');
  const maxWindow = 31 * 24 * 60 * 60 * 1000;
  if (endWindow - startWindow > maxWindow) throw new Error('Janela maxima: 31 dias');

  const duration = int(service.duration_minutes, 60, 5, 1440);
  const before = int(service.buffer_before_minutes, 0, 0, 240);
  const after = int(service.buffer_after_minutes, 0, 0, 240);
  const step = int(stepMinutes, 15, 5, 240);
  const max = int(limit, 60, 1, 200);
  const bookings = await bookingsInWindow(botId, startWindow.toISOString(), endWindow.toISOString(), resources.map(item => item.id));
  const out = [];

  for (let cursor = startWindow.getTime(); cursor < endWindow.getTime() && out.length < max; cursor += step * 60000) {
    const startsAt = new Date(cursor);
    const endsAt = new Date(cursor + duration * 60000);
    if (endsAt > endWindow) break;
    for (const resource of resources) {
      const occupiedStart = new Date(startsAt.getTime() - before * 60000);
      const occupiedEnd = new Date(endsAt.getTime() + after * 60000);
      if (!withinWorkingHours(resource, occupiedStart, occupiedEnd)) continue;
      const conflict = bookings.some(item => item.resource_id === resource.id && overlaps(occupiedStart, occupiedEnd, item));
      if (!conflict) {
        out.push({
          serviceId: service.id,
          serviceName: service.name,
          resourceId: resource.id,
          resourceName: resource.name,
          resourceType: resource.resource_type,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone: resource.timezone || 'America/Sao_Paulo'
        });
        if (out.length >= max) break;
      }
    }
  }
  return out;
}

async function createBooking(input) {
  const botId = clean(input.botId, 160);
  const service = await serviceById(botId, input.serviceId);
  if (!service || !service.is_active) throw new Error('Servico nao encontrado ou inativo');
  const resource = await resourceById(botId, input.resourceId);
  if (!resource || !resource.is_active) throw new Error('Recurso nao encontrado ou inativo');
  const eligible = await eligibleResources(botId, service, resource.id);
  if (!eligible.length) throw new Error('Recurso nao atende este servico');

  const startsAt = new Date(iso(input.startsAt, 'startsAt'));
  const duration = int(service.duration_minutes, 60, 5, 1440);
  const endsAt = new Date(startsAt.getTime() + duration * 60000);
  const before = int(service.buffer_before_minutes, 0, 0, 240);
  const after = int(service.buffer_after_minutes, 0, 0, 240);
  const occupiedStart = new Date(startsAt.getTime() - before * 60000);
  const occupiedEnd = new Date(endsAt.getTime() + after * 60000);
  if (!withinWorkingHours(resource, occupiedStart, occupiedEnd)) throw new Error('Horario fora da disponibilidade do recurso');

  const conflicts = await bookingsInWindow(botId, occupiedStart.toISOString(), occupiedEnd.toISOString(), [resource.id]);
  if (conflicts.some(item => overlaps(occupiedStart, occupiedEnd, item))) throw new Error('Horario indisponivel');

  const record = {
    bot_id: botId,
    service_id: service.id,
    resource_id: resource.id,
    visitor_id: clean(input.visitorId, 200) || null,
    lead_id: input.leadId || null,
    customer_name: clean(input.customerName, 200) || null,
    customer_phone: clean(input.customerPhone, 40) || null,
    customer_email: clean(input.customerEmail, 320) || null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: ['requested', 'confirmed'].includes(input.status) ? input.status : 'confirmed',
    source: clean(input.source || 'smartbots', 80),
    notes: clean(input.notes, 4000) || null,
    external_reference: clean(input.externalReference, 300) || null,
    recurrence_key: clean(input.recurrenceKey, 300) || null,
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {},
    updated_at: new Date().toISOString()
  };
  const response = await db('smartbot_scheduling_bookings', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(record)
  });
  return (await rows(response, 'create booking'))[0] || record;
}

async function listBookings(botId, from, to, visitorId) {
  let path = `smartbot_scheduling_bookings?bot_id=eq.${encodeURIComponent(botId)}&order=starts_at.asc&limit=500`;
  if (from) path += `&starts_at=gte.${encodeURIComponent(iso(from, 'from'))}`;
  if (to) path += `&starts_at=lt.${encodeURIComponent(iso(to, 'to'))}`;
  if (visitorId) path += `&visitor_id=eq.${encodeURIComponent(visitorId)}`;
  const response = await db(path);
  return rows(response, 'list bookings');
}

async function updateBooking(botId, id, patch = {}) {
  const allowed = {};
  if (patch.status !== undefined) {
    const status = clean(patch.status, 40);
    if (!['requested','confirmed','completed','cancelled','no_show'].includes(status)) throw new Error('Status invalido');
    allowed.status = status;
  }
  if (patch.notes !== undefined) allowed.notes = clean(patch.notes, 4000) || null;
  allowed.updated_at = new Date().toISOString();
  const response = await db(`smartbot_scheduling_bookings?bot_id=eq.${encodeURIComponent(botId)}&id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(allowed)
  });
  return (await rows(response, 'update booking'))[0] || null;
}

module.exports = {
  clean,
  db,
  rows,
  listServices,
  listResources,
  availability,
  createBooking,
  listBookings,
  updateBooking,
  schedulingPrefix,
  routeSchedulingPath
};
