const crypto = require('crypto');
const fetch = require('node-fetch');

function env(name){ return String(process.env[name] || '').trim(); }
function json(statusCode, body){ return { statusCode, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify(body) }; }

async function db(path, options={}){
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if(!url || !key) throw new Error('Supabase service role nao configurado.');
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,...(options.headers||{})}
  });
}

async function rows(response, label){
  if(!response.ok) throw new Error(`${label}: ${(await response.text()).slice(0,500)}`);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : [];
}

function monthStart(){
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0)).toISOString();
}

function pct(used, limit){
  if(limit === null || limit === undefined || Number(limit) <= 0) return null;
  return Math.round((Number(used) / Number(limit)) * 1000) / 10;
}

function fingerprint(provider, metric, period){
  return crypto.createHash('sha256').update(`${provider}:${metric}:${period}`).digest('hex');
}

async function sendAlert(subject, text){
  const key = env('RESEND_API_KEY');
  const to = env('SMARTBOTS_ALERT_EMAIL') || env('SUPPORT_EMAIL') || 'henriquecampos66@gmail.com';
  if(!key || !to) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
    body:JSON.stringify({
      from:'SmartBots <smartbots@auth.f-insight.org>',
      to,
      subject,
      text
    })
  });
  return r.ok;
}

async function upsertIncident({provider, metric, used, limit, percentage, planCode, period, threshold}){
  const fp = fingerprint(provider, metric, period);
  const open = await rows(await db(`smartbot_provider_incidents?provider=eq.${encodeURIComponent(provider)}&fingerprint=eq.${encodeURIComponent(fp)}&resolved_at=is.null&select=*&limit=1`),'Buscar incidente');
  const now = new Date().toISOString();
  const severity = percentage >= 100 ? 'critical' : 'warning';
  const category = percentage >= 100 ? 'capacity_exhausted' : 'capacity_warning';
  const message = metric === 'connected_numbers'
    ? `${provider}: ${used}/${limit} numeros conectados (${percentage}%) no plano ${planCode}.`
    : `${provider}: ${used}/${limit} mensagens usadas no mes (${percentage}%) no plano ${planCode}.`;

  let incident = open[0] || null;
  if(incident){
    const patch = {
      category,
      severity,
      error_message:message,
      occurrence_count:Number(incident.occurrence_count||0)+1,
      last_seen_at:now,
      updated_at:now,
      metadata:{metric,used,limit,percentage,planCode,threshold,period}
    };
    const r = await db(`smartbot_provider_incidents?id=eq.${encodeURIComponent(incident.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
    incident = (await rows(r,'Atualizar incidente'))[0];
  } else {
    const payload = {
      provider,
      operation:'capacity_monitor',
      category,
      severity,
      error_message:message,
      fingerprint:fp,
      metadata:{metric,used,limit,percentage,planCode,threshold,period}
    };
    const r = await db('smartbot_provider_incidents',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
    incident = (await rows(r,'Criar incidente'))[0];
  }

  const alertAge = incident.alerted_at ? Date.now() - new Date(incident.alerted_at).getTime() : Infinity;
  if(!incident.alerted_at || alertAge >= 24*60*60*1000){
    const sent = await sendAlert(
      severity === 'critical' ? 'SmartBots: capacidade Kapso esgotada' : 'SmartBots: capacidade Kapso em atencao',
      `${message}\n\nAcao: revisar/elevar o plano Kapso antes de novos clientes ou de atingir o limite de mensagens.\n\nEste alerta foi gerado automaticamente pelo SmartBots.`
    );
    if(sent){
      await db(`smartbot_provider_incidents?id=eq.${encodeURIComponent(incident.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({alerted_at:now,updated_at:now})});
    }
  }
  return {metric,used,limit,percentage,severity,incidentId:incident.id};
}

async function resolveMetric(provider, metric, period){
  const fp = fingerprint(provider, metric, period);
  await db(`smartbot_provider_incidents?provider=eq.${encodeURIComponent(provider)}&fingerprint=eq.${encodeURIComponent(fp)}&resolved_at=is.null`,{
    method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()})
  });
}

exports.handler = async () => {
  try{
    const settings = await rows(await db('smartbot_provider_settings?provider=eq.kapso&select=*&limit=1'),'Carregar plano Kapso');
    const cfg = settings[0];
    if(!cfg) return json(200,{success:true,provider:'kapso',configured:false});

    const connected = await rows(await db('smartbot_whatsapp_config?provider=eq.kapso&status=eq.connected&provider_phone_number_id=not.is.null&select=bot_id,provider_phone_number_id'),'Contar numeros Kapso');
    const since = monthStart();
    const usage = await rows(await db(`smartbot_usage_events?channel=eq.whatsapp&created_at=gte.${encodeURIComponent(since)}&event_type=in.(whatsapp_message_received,whatsapp_message_sent)&select=quantity`),'Contar mensagens Kapso');
    const messages = usage.reduce((sum,row)=>sum+Number(row.quantity||0),0);
    const period = since.slice(0,7);
    const threshold = Number(cfg.alert_threshold_percent || 80);
    const metrics = [
      {metric:'connected_numbers',used:connected.length,limit:cfg.connected_number_limit},
      {metric:'monthly_messages',used:messages,limit:cfg.monthly_message_limit}
    ];
    const incidents=[];
    for(const m of metrics){
      const percentage = pct(m.used,m.limit);
      if(percentage !== null && percentage >= threshold){
        incidents.push(await upsertIncident({provider:'kapso',metric:m.metric,used:m.used,limit:Number(m.limit),percentage,planCode:cfg.plan_code,period,threshold}));
      } else {
        await resolveMetric('kapso',m.metric,period);
      }
    }
    return json(200,{success:true,provider:'kapso',plan:cfg.plan_code,thresholdPercent:threshold,usage:{connectedNumbers:connected.length,connectedNumberLimit:cfg.connected_number_limit,messagesThisMonth:messages,monthlyMessageLimit:cfg.monthly_message_limit},incidents});
  }catch(error){
    console.error('[ProviderHealth]',error.message);
    return json(500,{success:false,error:'Falha no monitor de capacidade de provedor.'});
  }
};
