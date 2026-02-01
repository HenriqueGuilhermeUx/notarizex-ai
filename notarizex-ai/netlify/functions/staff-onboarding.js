// ============================================
// STAFF ONBOARDING - Cria assistente pessoal
// ============================================

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    
    const {
      name,
      email,
      whatsapp,
      preferences
    } = data;

    console.log('[Staff Onboarding] Iniciando para:', email);

    // Gerar ID único
    const userId = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Criar instruções personalizadas do assistente
    const instructions = `Você é o Staff, um assistente pessoal inteligente do ${name}.

Suas funções principais:
1. Gerenciar lembretes e agenda
2. Fornecer informações financeiras (cotações, investimentos)
3. Ajudar com tarefas do dia a dia
4. Responder perguntas gerais

Preferências do usuário:
${preferences || 'Nenhuma preferência específica fornecida'}

Seja proativo, amigável e eficiente. Use linguagem natural e brasileira.
Sempre que possível, sugira ações e melhorias.

Exemplos de uso:
- "Me lembre de pagar o DARF dia 20"
- "Qual a cotação do Bitcoin?"
- "Resumo da minha agenda hoje"
- "Calcule 15% de R$ 1.500"

Responda de forma concisa mas completa.`;

    // Criar Assistente na OpenAI
    console.log('[Staff] Criando assistente...');
    
    const assistant = await openai.beta.assistants.create({
      name: `Staff - ${name}`,
      instructions: instructions,
      model: 'gpt-4-turbo-preview',
      tools: [
        { type: 'code_interpreter' }, // Para cálculos
        { type: 'retrieval' } // Para buscar informações
      ]
    });

    console.log('[Staff] Assistente criado:', assistant.id);

    // Criar link de pagamento no Mercado Pago
    const preference = new Preference(mercadopago);
    
    const preferenceData = {
      items: [
        {
          title: 'Staff - Assistente Pessoal',
          description: `Assinatura mensal do Staff para ${name}`,
          quantity: 1,
          unit_price: 19.90,
          currency_id: 'BRL'
        }
      ],
      payer: {
        name: name,
        email: email,
        phone: {
          number: whatsapp.replace(/\D/g, '')
        }
      },
      back_urls: {
        success: 'https://smartbots.club/obrigado',
        failure: 'https://smartbots.club/erro',
        pending: 'https://smartbots.club/pendente'
      },
      auto_return: 'approved',
      external_reference: userId,
      notification_url: `${process.env.URL}/.netlify/functions/payment-webhook`
    };

    const response = await preference.create({ body: preferenceData });
    const paymentLink = response.init_point;

    console.log('[Staff] Link de pagamento criado');

    // Salvar no Supabase
    const { error: dbError } = await supabase
      .from('staff_users')
      .insert({
        user_id: userId,
        name: name,
        email: email,
        phone_number: `whatsapp:${whatsapp}`,
        preferences: preferences,
        assistant_id: assistant.id,
        payment_link: paymentLink,
        status: 'pending_payment'
      });

    if (dbError) {
      console.error('[Staff] Erro ao salvar no banco:', dbError);
      throw dbError;
    }

    console.log('[Staff] Usuário salvo no banco');

    // Enviar email de confirmação
    try {
      await resend.emails.send({
        from: 'SmartBots <noreply@smartbots.club>',
        to: email,
        subject: 'Bem-vindo ao Staff! 🎉',
        html: `
          <h1>Olá, ${name}!</h1>
          
          <p>Seu assistente pessoal <strong>Staff</strong> foi criado com sucesso!</p>
          
          <h2>Próximos Passos:</h2>
          
          <ol>
            <li><strong>Complete o pagamento:</strong><br>
              <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background: #00A3FF; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0;">
                Pagar R$ 19,90/mês
              </a>
            </li>
            
            <li><strong>Após o pagamento aprovado:</strong><br>
              Você receberá um email com instruções para conectar seu WhatsApp.
            </li>
          </ol>
          
          <h2>O que o Staff pode fazer por você:</h2>
          
          <ul>
            <li>✅ Gerenciar lembretes e agenda</li>
            <li>✅ Fornecer cotações financeiras</li>
            <li>✅ Fazer cálculos complexos</li>
            <li>✅ Responder perguntas gerais</li>
            <li>✅ Ajudar com tarefas do dia a dia</li>
          </ul>
          
          <p>Qualquer dúvida, responda este email!</p>
          
          <p>Abraços,<br>
          Equipe SmartBots</p>
        `
      });

      console.log('[Staff] Email enviado');
    } catch (emailError) {
      console.error('[Staff] Erro ao enviar email:', emailError);
      // Não falha o processo se o email não for enviado
    }

    // Retornar sucesso
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        userId: userId,
        paymentLink: paymentLink,
        message: 'Staff criado com sucesso! Verifique seu email.'
      })
    };

  } catch (error) {
    console.error('[Staff Onboarding] Erro:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao criar Staff'
      })
    };
  }
};
