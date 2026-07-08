function sess(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
function copyPix(){var t=document.getElementById('brcode');if(t){navigator.clipboard.writeText(t.value);alert('Pix copia e cola copiado.')}}
async function createPix(){
  out.innerHTML='Gerando cobrança...';
  var s=sess();
  if(!s.botId){out.innerHTML='Entre no painel primeiro. <a class="text-green-400" href="/login">Entrar</a>';return}
  try{
    var r=await fetch('/.netlify/functions/woovi-create-charge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:s.botId,clientToken:s.clientToken,plan:plan.value})});
    var j=await r.json();
    if(!j.success)throw new Error(j.error||'Erro');
    var c=j.charge||{};
    var img=c.qrCodeImage||'';
    var br=c.brCode||(c.paymentMethods&&c.paymentMethods.pix&&c.paymentMethods.pix.brCode)||'';
    var link=c.paymentLinkUrl||'';
    out.innerHTML=(img?'<img src="'+img+'" style="max-width:260px;background:white;padding:8px;border-radius:12px">':'')+(link?'<p class="mt-3"><a class="text-green-400" target="_blank" href="'+link+'">Abrir link de pagamento</a></p>':'')+'<textarea id="brcode" rows="5" class="w-full mt-3 bg-slate-950 border border-white/10 rounded-xl p-3">'+br+'</textarea><button onclick="copyPix()" class="mt-3 bg-white/10 px-4 py-2 rounded-xl font-black">Copiar Pix</button><p class="text-gray-400 mt-3">Após o pagamento, a ativação será automática pelo webhook.</p>';
  }catch(e){out.innerText='Erro: '+e.message}
}
