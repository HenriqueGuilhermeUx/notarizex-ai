async function loadRevenue(){
  result.innerText='Carregando';
  var r=await fetch('/.netlify/functions/subscription-list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminToken:adminToken.value,status:'active'})});
  var j=await r.json();
  result.innerText=JSON.stringify(j,null,2);
}
