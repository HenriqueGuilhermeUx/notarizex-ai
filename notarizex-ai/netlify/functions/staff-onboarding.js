exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  return {
    statusCode: 410,
    headers,
    body: JSON.stringify({
      success: false,
      disabled: true,
      product: 'Staff',
      message: 'O produto Staff não faz mais parte da oferta principal da SmartBots.club. Use Bot para Site ou Bot WhatsApp.'
    })
  };
};
