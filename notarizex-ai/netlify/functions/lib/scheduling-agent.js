const core = require('./scheduling-core');

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9:@._+\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function localDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: map.weekday
  };
}

function localIsoDate(date, timeZone) {
  const p = localDateParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function zonedBoundary(dateString, time, offset = '-03:00') {
  return `${dateString}T${time}:00${offset}`;
}

function nextWeekdayDate(target, timeZone) {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const current = localDateParts(today, timeZone).weekday;
  const currentIndex = weekdays.indexOf(current);
  const targetIndex = weekdays.indexOf(target);
  let delta = (targetIndex - currentIndex + 7) % 7;
  if (delta === 0) delta = 7;
  const date = new Date(today.getTime() + delta * 86400000);
  return localIsoDate(date, timeZone);
}

function inferDateText(message, timeZone) {
  const value = normalize(message);
  const today = new Date();
  if (/\bhoje\b/.test(value)) return localIsoDate(today, timeZone);
  if (/\bamanha\b/.test(value)) return localIsoDate(new Date(today.getTime() + 86400000), timeZone);

  const direct = value.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (direct) {
    const now = localDateParts(today, timeZone);
    let year = direct[3] ? Number(direct[3]) : now.year;
    if (year < 100) year += 2000;
    return `${year}-${String(Number(direct[2])).padStart(2, '0')}-${String(Number(direct[1])).padStart(2, '0')}`;
  }

  const days = [
    ['domingo', 'Sun'],
    ['segunda', 'Mon'],
    ['terca', 'Tue'],
    ['quarta', 'Wed'],
    ['quinta', 'Thu'],
    ['sexta', 'Fri'],
    ['sabado', 'Sat']
  ];
  for (const [word, key] of days) if (value.includes(word)) return nextWeekdayDate(key, timeZone);
  return null;
}

function inferDaypart(message) {
  const value = normalize(message);
  if (/\bmanha\b/.test(value)) return ['08:00', '12:00'];
  if (/\btarde\b/.test(value)) return ['12:00', '18:00'];
  if (/\bnoite\b/.test(value)) return ['18:00', '22:00'];
  return ['08:00', '20:00'];
}

function inferTime(message) {
  const value = normalize(message);
  const match = value.match(/\b([01]?\d|2[0-3])(?::|h)([0-5]\d)?\b/);
  if (!match) return null;
  return `${String(Number(match[1])).padStart(2, '0')}:${String(Number(match[2] || 0)).padStart(2, '0')}`;
}

function scoreName(query, candidate) {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (q.includes(c) || c.includes(q)) return 80;
  const words = c.split(' ').filter(w => w.length >= 3);
  return words.reduce((score, word) => score + (q.includes(word) ? 15 : 0), 0);
}

function bestByName(message, items) {
  let best = null;
  let bestScore = 0;
  for (const item of items) {
    const score = scoreName(message, item.name);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return bestScore >= 15 ? best : null;
}

async function session(botId, visitorId) {
  const response = await core.db(`smartbot_scheduling_sessions?bot_id=eq.${encodeURIComponent(botId)}&visitor_id=eq.${encodeURIComponent(visitorId)}&limit=1`);
  if (!response.ok) return null;
  return (await response.json())[0] || null;
}

async function saveSession(botId, visitorId, patch) {
  const body = {
    bot_id: botId,
    visitor_id: visitorId,
    ...patch,
    updated_at: new Date().toISOString()
  };
  const response = await core.db('smartbot_scheduling_sessions?on_conflict=bot_id,visitor_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body)
  });
  return (await core.rows(response, 'save scheduling session'))[0] || body;
}

function formatSlot(slot) {
  const date = new Date(slot.startsAt);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: slot.timezone || 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date).replace(',', '');
}

function chooseOfferedSlot(message, offered) {
  if (!Array.isArray(offered) || !offered.length) return null;
  const value = normalize(message);
  const option = value.match(/(?:opcao|opção)?\s*([1-9])\b/);
  if (option) return offered[Number(option[1]) - 1] || null;
  const time = inferTime(message);
  if (time) {
    const matching = offered.find(slot => {
      const d = new Date(slot.startsAt);
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: slot.timezone || 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(d);
      const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
      return `${map.hour}:${map.minute}` === time;
    });
    if (matching) return matching;
  }
  if (/\b(primeiro|primeira)\b/.test(value)) return offered[0] || null;
  if (/\b(segundo|segunda)\b/.test(value)) return offered[1] || null;
  if (/\b(terceiro|terceira)\b/.test(value)) return offered[2] || null;
  return null;
}

async function handle(input) {
  const botId = core.clean(input.botId, 160);
  const visitorId = core.clean(input.visitorId, 200);
  const message = core.clean(input.message, 3000);
  if (!botId || !visitorId || !message) throw new Error('botId, visitorId e message obrigatorios');

  const current = await session(botId, visitorId);
  const offered = Array.isArray(current?.offered_slots) ? current.offered_slots : [];
  const selected = chooseOfferedSlot(message, offered);
  if (current?.state === 'offered' && selected) {
    const booking = await core.createBooking({
      botId,
      serviceId: selected.serviceId,
      resourceId: selected.resourceId,
      startsAt: selected.startsAt,
      visitorId,
      leadId: input.leadId || null,
      customerName: input.customerName || current.customer_name,
      customerPhone: input.customerPhone || current.customer_phone,
      customerEmail: input.customerEmail || current.customer_email,
      source: input.source || 'smartbots-agent',
      notes: input.notes || null,
      metadata: { conversational: true }
    });
    await saveSession(botId, visitorId, {
      service_id: booking.service_id,
      resource_id: booking.resource_id,
      state: 'confirmed',
      requested_text: message,
      offered_slots: offered,
      expires_at: new Date(Date.now() + 86400000).toISOString()
    });
    const label = formatSlot(selected);
    return { handled: true, state: 'confirmed', reply: `Pronto. Agendamento confirmado para ${label}.`, booking };
  }

  const services = await core.listServices(botId, true);
  if (!services.length) return { handled: false, state: 'no_services', reply: null };
  const resources = await core.listResources(botId, true);

  let service = null;
  if (input.serviceName) service = bestByName(input.serviceName, services);
  if (!service) service = bestByName(message, services);
  if (!service && current?.service_id) service = services.find(item => item.id === current.service_id) || null;

  if (!service) {
    const names = services.slice(0, 6).map(item => item.name).join(', ');
    await saveSession(botId, visitorId, {
      state: 'collecting',
      requested_text: message,
      customer_name: input.customerName || current?.customer_name || null,
      customer_phone: input.customerPhone || current?.customer_phone || null,
      customer_email: input.customerEmail || current?.customer_email || null,
      expires_at: new Date(Date.now() + 1800000).toISOString()
    });
    return { handled: true, state: 'collecting_service', reply: `Claro. Qual serviço você quer agendar? Temos: ${names}.` };
  }

  let resource = null;
  if (input.resourceName) resource = bestByName(input.resourceName, resources);
  if (!resource) resource = bestByName(message, resources);
  if (!resource && current?.resource_id) resource = resources.find(item => item.id === current.resource_id) || null;

  const timezone = resource?.timezone || 'America/Sao_Paulo';
  const date = inferDateText(message, timezone) || (current?.metadata && current.metadata.requestedDate) || null;
  if (!date) {
    await saveSession(botId, visitorId, {
      service_id: service.id,
      resource_id: resource?.id || null,
      state: 'collecting',
      requested_text: message,
      customer_name: input.customerName || current?.customer_name || null,
      customer_phone: input.customerPhone || current?.customer_phone || null,
      customer_email: input.customerEmail || current?.customer_email || null,
      metadata: { ...(current?.metadata || {}), serviceName: service.name },
      expires_at: new Date(Date.now() + 1800000).toISOString()
    });
    return { handled: true, state: 'collecting_date', reply: `Perfeito, ${service.name}. Para qual dia você quer agendar?` };
  }

  const [fromTime, toTime] = inferDaypart(message);
  const from = zonedBoundary(date, fromTime);
  const to = zonedBoundary(date, toTime);
  const slots = await core.availability({
    botId,
    serviceId: service.id,
    resourceId: resource?.id || null,
    from,
    to,
    stepMinutes: 15,
    limit: 8
  });

  if (!slots.length) {
    await saveSession(botId, visitorId, {
      service_id: service.id,
      resource_id: resource?.id || null,
      state: 'collecting',
      requested_text: message,
      offered_slots: [],
      metadata: { ...(current?.metadata || {}), requestedDate: date },
      expires_at: new Date(Date.now() + 1800000).toISOString()
    });
    return { handled: true, state: 'no_availability', reply: `Não encontrei horário disponível nesse período para ${service.name}. Quer tentar outro dia ou período?` };
  }

  const offeredSlots = slots.slice(0, 4);
  await saveSession(botId, visitorId, {
    service_id: service.id,
    resource_id: resource?.id || null,
    state: 'offered',
    requested_text: message,
    offered_slots: offeredSlots,
    customer_name: input.customerName || current?.customer_name || null,
    customer_phone: input.customerPhone || current?.customer_phone || null,
    customer_email: input.customerEmail || current?.customer_email || null,
    metadata: { ...(current?.metadata || {}), requestedDate: date, serviceName: service.name },
    expires_at: new Date(Date.now() + 1800000).toISOString()
  });

  const options = offeredSlots.map((slot, index) => `${index + 1}) ${formatSlot(slot)}${slot.resourceName ? ` com ${slot.resourceName}` : ''}`).join('; ');
  return {
    handled: true,
    state: 'offered',
    reply: `Tenho estes horários para ${service.name}: ${options}. Qual você prefere?`,
    slots: offeredSlots
  };
}

module.exports = { handle, normalize, inferDateText, inferDaypart, inferTime, bestByName, chooseOfferedSlot };
