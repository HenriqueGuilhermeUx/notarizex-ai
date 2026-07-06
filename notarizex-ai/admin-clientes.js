function box(t,n){return '<div class="bg-white/5 border border-white/10 rounded-xl p-4"><b>'+n+'</b><div class="text-gray-400">'+t+'</div></div>'}
async function loadClients(){
  list.innerText='Carregando';
  var r=await fetch('/.netlify/functions/subscription-list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminToken:adminToken.value,status:status.value})});
  var j=await r.json();
  if(!j.success){list.innerText='Erro: '+j.error;return}
  var t=j.totals||{};
  totals.innerHTML=box('Ativos',t.active||0)+box('Pendentes',t.pending||0)+box('Vencidos',t.overdue||0)+box('Total',t.total||0);
  list.innerHTML=(j.items||[]).map(function(x){return '<div class="bg-slate-900 border border-white/10 rounded-xl p-4 mb-3"><b>'+String(x.company_name||x.bot_id)+'</b><p>'+String(x.plan||'')+' - '+String(x.status||'')+'</p><p>'+String(x.customer_email||'')+'</p><a href="/admin-assinaturas.html" class="text-green-400">Editar</a></div>'}).join('')||'Nenhum cliente';
}
