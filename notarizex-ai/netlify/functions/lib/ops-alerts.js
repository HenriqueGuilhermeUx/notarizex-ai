const fetch=require('node-fetch');

function env(name){return String(process.env[name]||'').trim()}
function clean(v,max=0){const s=String(v||'').trim();return max?s.slice(0,max):s}

async function sendOpsAlert(subject,text,options={}){
  const key=env('RESEND_API_KEY');
  const to=env('SMARTBOTS_ALERT_EMAIL')||env('SUPPORT_EMAIL');
  if(!key||!to)return{sent:false,reason:'not_configured'};
  const body=[
    clean(text,12000),
    '',
    options.adminUrl?('Admin: '+options.adminUrl):'',
    'Gerado automaticamente pelo SmartBots.'
  ].filter(Boolean).join('\n');
  const r=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
    body:JSON.stringify({
      from:'SmartBots <noreply@smartbots.club>',
      to,
      subject:clean(subject,180),
      text:body
    })
  });
  if(!r.ok){
    console.error('[OpsAlert] Resend',r.status,(await r.text()).slice(0,400));
    return{sent:false,reason:'resend_error'};
  }
  return{sent:true};
}

module.exports={sendOpsAlert};
