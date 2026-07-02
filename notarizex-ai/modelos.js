function getSession(){try{return JSON.parse(localStorage.getItem('sb_session')||'{}')}catch(e){return {}}}
function text(type){
 if(type==='clinica')return 'Agendar consulta, captar nome, WhatsApp, convenio, urgencia e melhor horario.';
 if(type==='advocacia')return 'Entender area juridica, prazo, documentos e melhor contato. Nao prometer resultado.';
 if(type==='imobiliaria')return 'Identificar compra, venda ou aluguel, bairro, valor, quartos e urgencia.';
 if(type==='agencia')return 'Entender servico desejado, objetivo, prazo, orcamento e tamanho da empresa.';
 if(type==='estetica')return 'Explicar procedimentos, captar WhatsApp, sugerir avaliacao e registrar retorno.';
 return 'Qualificar dor, urgencia, decisor, tamanho da empresa, orcamento e proximo passo.';
}
async function applyModel(type){
 const s=getSession();
 if(!s.botId||!s.clientToken){result.textContent='Entre pelo painel primeiro.';return}
 const instructions=text(type);
 result.textContent='Aplicando modelo...';
 try{
  const res=await fetch('/.netlify/functions/client-portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_config',botId:s.botId,clientToken:s.clientToken,config:{segment:type,tone:'friendly',language:'pt',instructions:instructions}})});
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||'Erro ao salvar modelo');
  result.textContent='Modelo aplicado: '+type+' — '+instructions;
 }catch(e){result.textContent='Erro: '+e.message}
}
