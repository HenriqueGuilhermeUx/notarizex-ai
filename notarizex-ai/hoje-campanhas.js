function addHojeCampaignLinks(){
  var map=[['Confirmar horários','confirmacao'],['Retornos','retorno'],['reativar','reativacao'],['Contatados','orcamento'],['indicação','indicacao'],['perdidos','reativacao']];
  document.querySelectorAll('#board h2').forEach(function(h){
    if(h.dataset.campanhaOk)return;
    var txt=h.textContent||'',tipo='';
    map.forEach(function(m){if(txt.toLowerCase().indexOf(m[0].toLowerCase())>=0)tipo=m[1]});
    if(!tipo)return;
    h.dataset.campanhaOk='1';
    var a=document.createElement('a');
    a.href='/campanhas.html?tipo='+encodeURIComponent(tipo);
    a.textContent='Campanha';
    a.className='ml-2 bg-green-400 text-black px-3 py-1 rounded-lg text-xs font-black';
    h.appendChild(a);
  });
}
document.addEventListener('DOMContentLoaded',function(){setInterval(addHojeCampaignLinks,800)});
