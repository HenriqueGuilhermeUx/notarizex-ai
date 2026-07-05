window.addEventListener('load',function(){
  document.querySelectorAll('#precos article').forEach(function(card,i){
    if(i===0){card.querySelector('h3').textContent='Essencial';card.querySelector('span').textContent='R$49/mês'}
    if(i===1){card.querySelector('h3').textContent='Profissional';card.querySelector('span').textContent='R$79/mês'}
  });
});
