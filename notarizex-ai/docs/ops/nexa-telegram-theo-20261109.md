# Nexa — Theo no Telegram (fase 1; desativado até BotFather)
Escopo independente de WhatsApp Theo e pesquisa de satisfação. Reutiliza o bot lógico Nexa do SmartBots (`site-nexa-20260923-live`) sem vincular IDs do Telegram a contas financeiras.

## Implantado no código
- Netlify Function `/.netlify/functions/nexa-telegram-webhook`, somente POST de conversas **privadas**.
- Verificação de `X-Telegram-Bot-Api-Secret-Token` com comparação timing-safe.
- Idempotência por `update_id`; mensagens mínimas em tabelas privadas com RLS.
- `/start`, `/ajuda`, `/kyc`, `/humano`, `/avisos`, `/parar`.
- Handoff gravado em fila dedicada + espelho de lead no CRM do SmartBots.
- CPF, dados de autenticação, arquivos e grupos não são processados. Conta pessoal somente no portal Nexa.
- `/start` inicia suporte, **não** concordância com marketing. `/avisos` coleta autorização separada somente para avisos de serviço e **não liga disparos**.
- Sem disparos automáticos, marketing, pesquisa de satisfação, pagamento ou acesso a informações pessoais.

## Passo necessário do proprietário
1. Em @BotFather (https://t.me/BotFather) crie bot oficial: nome `Theo | Nexa`, username disponível (ex.: `NexaTheoBot`).
2. Guarde o token como segredo no site **smartbots.club** do Netlify: `NEXA_TELEGRAM_BOT_TOKEN`, escopo Functions, contexto Production.
3. Configure outro segredo criptograficamente aleatório com 32–64 caracteres alfanuméricos/underscore/hífen como `NEXA_TELEGRAM_WEBHOOK_SECRET`.
4. Após confirmar o token com `getMe`, registre o webhook pela API oficial:
   `POST https://api.telegram.org/bot<TOKEN>/setWebhook`
   JSON `{"url":"https://smartbots.club/.netlify/functions/nexa-telegram-webhook","secret_token":"<WEBHOOK_SECRET>","allowed_updates":["message"],"drop_pending_updates":false}`.
   Nunca inclua token real em logs, capturas, chats, repo ou URL pública.
5. Só após o webhook estar válido, `NEXA_TELEGRAM_ENABLED=true` em Production. Por padrão a função devolve 503 sem configuração.
6. Teste com conversa privada: `/start`, `/kyc`, `preciso da provação`, `/parar`; confirme tickets em `nexa_telegram_handoffs` e contato em `nexa_telegram_contacts`. Não faça testes financeiros.
7. Após confirmar username, divulgar o link `https://t.me/<username_real>` nos canais da Nexa para entrada voluntária, sem importar números.

Documentação Telegram: https://core.telegram.org/bots/api e https://core.telegram.org/bots
