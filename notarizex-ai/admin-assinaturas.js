function val(id){return document.getElementById(id).value.trim()}
async function callSub(action){
  result.textContent='Enviando...';
  try{
    var body={action:action,adminToken:val('adminToken'),botId:val('botId'),companyName:val('companyName'),email:val('email'),plan:val('plan'),status:val('status'),notes:val('notes')};
    var r=await fetch('/.netlify/functions/subscription-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var j=await r.json();
    result.textContent=JSON.stringify(j,null,2);
  }catch(e){result.textContent='Erro: '+e.message}
}
function saveSub(){callSub('upsert')}
function getSub(){callSub('get')}
document.addEventListener('DOMContentLoaded',function(){var t=localStorage.getItem('sb_admin_token');if(t)adminToken.value=t;var p=new URLSearchParams(location.search);if(p.get('botId'))botId.value=p.get('botId');adminToken.addEventListener('input',function(){localStorage.setItem('sb_admin_token',adminToken.value)})});
