function startCampanhasDireto(){
  var raw=(location.href.split('tipo=')[1]||'').split('&')[0];
  var t=decodeURIComponent(raw||'');
  var allow=['confirmacao','retorno','reativacao','orcamento','indicacao','pos_atendimento'];
  if(!t||allow.indexOf(t)<0)return;
  if(typeof createCampaign==='function')createCampaign(t);
}
window.addEventListener('load',startCampanhasDireto);
