function patchAgendaLinks(){
  document.querySelectorAll('a[href^="/agenda.html?"]').forEach(function(a){
    if(a.dataset.leadPatched)return;
    var card=a.closest('.bg-slate-900');
    if(!card)return;
    var btn=card.querySelector('button[onclick*="moveLead"]')||card.querySelector('button[onclick*="addNote"]');
    var raw=btn?String(btn.getAttribute('onclick')||''):'';
    var m=raw.match(/'([^']+)'/);
    if(m&&m[1]){
      var url=new URL(a.getAttribute('href'),location.origin);
      url.searchParams.set('leadId',m[1]);
      a.href=url.pathname+url.search;
      a.dataset.leadPatched='1';
    }
  });
}
document.addEventListener('DOMContentLoaded',function(){setInterval(patchAgendaLinks,800)});
