document.addEventListener('DOMContentLoaded',function(){
  var p=new URLSearchParams(location.search);
  function set(id,key){var el=document.getElementById(id);var v=p.get(key);if(el&&v)el.value=v}
  set('name','name');
  set('phone','phone');
  set('service','service');
  set('notes','notes');
  var msg=document.getElementById('msg');
  if(msg&&(p.get('name')||p.get('phone')))msg.textContent='Dados do cliente carregados. Escolha data e horário para salvar.';
});
