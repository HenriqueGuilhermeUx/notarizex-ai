// ============================================
// STAFF WEBHOOK - Processa mensagens do WhatsApp
// ============================================

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async (event, context) => {
  // Verificar método
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    // Parse do body do Twilio (application/x-www-form-urlencoded)
    const params = new URLSearchParams(event.body);
    const from = params.get('From'); // Ex: "whatsapp:+5513999999999"
    const body = params.get('Body'); // Mensagem do usuário
    const profileName = params.get('ProfileName') || 'Usuário';

    console.log(`[Staff] Mensagem recebida de ${from}: ${body}`);

    // Buscar usuário Staff
    const { data: staffUser, error: userError } = await supabase
      .from('staff_users')
      .select('*')
      .eq('phone_number', from)
      .eq('status', 'active')
      .single();

    if (userError || !staffUser) {
      console.error('[Staff] Usuário não encontrado ou inativo:', from);
      
      // Responder que não está cadastrado
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message('Olá! Você ainda não tem uma assinatura ativa do Staff. Assine em: https://smartbots.club');
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/xml' },
        body: twiml.toString()
      };
    }

    // Buscar ou criar thread
    let threadId = staffUser.thread_id;

    if (!threadId) {
      // Criar nova thread
      const thread = await openai.beta.threads.create();
      threadId = thread.id;

      // Salvar thread no banco
      await supabase
        .from('staff_users')
        .update({ thread_id: threadId })
        .eq('id', staffUser.id);

      console.log(`[Staff] Thread criada: ${threadId}`);
    }

    // Adicionar mensagem do usuário à thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: body
    });

    // Executar o assistente
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: staffUser.assistant_id
    });

    // Aguardar conclusão
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    let attempts = 0;
    const maxAttempts = 30; // 30 segundos

    while (runStatus.status !== 'completed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      attempts++;

      if (runStatus.status === 'failed' || runStatus.status === 'cancelled' || runStatus.status === 'expired') {
        throw new Error(`Run failed with status: ${runStatus.status}`);
      }
    }

    if (runStatus.status !== 'completed') {
      throw new Error('Run timeout');
    }

    // Buscar resposta do assistente
    const messages = await openai.beta.threads.messages.list(threadId, {
      order: 'desc',
      limit: 1
    });

    const assistantMessage = messages.data[0];
    const reply = assistantMessage.content[0].text.value;

    console.log(`[Staff] Resposta: ${reply}`);

    // Salvar no histórico
    await supabase
      .from('staff_history')
      .insert({
        user_id: staffUser.id,
        phone_number: from,
        thread_id: threadId,
        user_message: body,
        bot_reply: reply
      });

    // Retornar resposta via TwiML
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(reply);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: twiml.toString()
    };

  } catch (error) {
    console.error('[Staff] Erro:', error);

    // Responder com erro genérico
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message('Desculpe, ocorreu um erro. Tente novamente em alguns instantes.');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: twiml.toString()
    };
  }
};
