// ============================================
// WHATSAPP ROUTER - Roteia mensagens para o bot correto
// ============================================
// Este arquivo decide se a mensagem vai para:
// - Bot Comercial (empresas) → whatsapp-webhook.js
// - Staff (pessoas físicas) → staff-webhook.js

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Só aceita POST (mensagens do Twilio)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  try {
    // Parsear dados do Twilio (vem como form-urlencoded)
    const params = new URLSearchParams(event.body);
    const from = params.get('From'); // Ex: whatsapp:+5513999999999
    const body = params.get('Body'); // Texto da mensagem
    const profileName = params.get('ProfileName'); // Nome do contato

    console.log('[Router] Nova mensagem de:', from);
    console.log('[Router] Conteúdo:', body);

    // ========================================
    // 1. VERIFICAR SE É BOT COMERCIAL
    // ========================================
    const commercialResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/whatsapp_bots?phone_number=eq.${encodeURIComponent(from)}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    const commercialBots = await commercialResponse.json();

    if (commercialBots && commercialBots.length > 0) {
      console.log('[Router] ✅ Bot Comercial encontrado:', commercialBots[0].bot_id);
      console.log('[Router] Roteando para whatsapp-webhook.js');
      
      // Chamar a função do Bot Comercial
      const { handler: commercialHandler } = require('./whatsapp-webhook');
      return await commercialHandler(event, context);
    }

    // ========================================
    // 2. VERIFICAR SE É STAFF
    // ========================================
    const staffResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_users?phone_number=eq.${encodeURIComponent(from)}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    const staffUsers = await staffResponse.json();

    if (staffUsers && staffUsers.length > 0) {
      console.log('[Router] ✅ Staff encontrado:', staffUsers[0].user_id);
      console.log('[Router] Roteando para staff-webhook.js');
      
      // Chamar a função do Staff
      const { handler: staffHandler } = require('./staff-webhook');
      return await staffHandler(event, context);
    }

    // ========================================
    // 3. NÚMERO NÃO CADASTRADO
    // ========================================
    console.log('[Router] ❌ Número não cadastrado:', from);
    console.log('[Router] Enviando mensagem de boas-vindas');

    // Responder com TwiML (formato XML do Twilio)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/xml'
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Olá! 👋

Você ainda não tem um bot SmartBots ativo.

Temos 3 opções para você:

💼 *Bot para Site* (R$ 79/mês)
Chat inteligente no seu site

📱 *Bot para WhatsApp* (R$ 129/mês)
Atendimento automático no WhatsApp da sua empresa

👔 *Staff* (R$ 19,90/mês)
Assistente pessoal para sua vida

Visite: smartbots.club</Message>
</Response>`
    };

  } catch (error) {
    console.error('[Router] Erro:', error.message);

    // Em caso de erro, retornar mensagem genérica
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/xml'
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Desculpe, ocorreu um erro temporário. Tente novamente em alguns instantes.</Message>
</Response>`
    };
  }
};
