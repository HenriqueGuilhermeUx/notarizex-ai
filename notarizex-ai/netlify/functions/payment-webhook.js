exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'received',
      message: 'Webhook recebido. Ativação manual/painel será configurada na próxima etapa.'
    })
  };
};
