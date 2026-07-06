async function loadClients(){
  list.innerText='Carregando';
  var r=await fetch('/.netlify/functions/subscription-list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminToken:adminToken.value,status:status.value})});
  var j=await r.json();
  list.innerText=JSON.stringify(j,null,2);
}
