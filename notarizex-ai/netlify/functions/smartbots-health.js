exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({
      success: true,
      service: 'SmartBots API',
      status: 'online',
      version: '2.1.0',
      integrations: {
        supabase: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)),
        modo: Boolean(process.env.MODO_PARTNER_API_KEY)
      },
      timestamp: new Date().toISOString()
    })
  };
};
