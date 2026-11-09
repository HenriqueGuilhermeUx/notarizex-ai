# Nexa — Theo no Telegram (fase 1; desativado até BotFather)
Canal público informado pelo proprietário em 09/11/2026: **Nexa Insights — https://t.me/NexaInsights**.
Bot Telegram criado pelo proprietário: **Theo | Nexa — @NexaTheoBot**, que ainda não responde automaticamente até conectar token e webhook.
A criação dos dois na mesma conta pessoal não expõe automaticamente ao público a identidade do proprietário.
Para preservar a privacidade, mantenha no canal **Assinaturas de administradores desativadas** e **Mostrar perfis dos autores desativado**; cuidado ao comentar em grupos usando perfil pessoal. A lista de administradores não é pública para inscritos comuns, conforme FAQ oficial (https://telegram.org/faq_channels).
Não compartilhar tokens do BotFather em chat, email, repo ou capturas.

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
1. **Concluído:** bot criado pelo proprietário no @BotFather (https://t.me/BotFather), username `NexaTheoBot`. Não recriar; abrir `/mybots` para revisar nome, descrição e comandos.
2. Guarde o token como segredo no site **smartbots.club** do Netlify: `NEXA_TELEGRAM_BOT_TOKEN`, escopo Functions, contexto Production.
3. Configure outro segredo criptograficamente aleatório com 32–64 caracteres alfanuméricos/underscore/hífen como `NEXA_TELEGRAM_WEBHOOK_SECRET`.
4. Após confirmar o token com `getMe`, registre o webhook pela API oficial:
   `POST https://api.telegram.org/bot<TOKEN>/setWebhook`
   JSON `{"url":"https://smartbots.club/.netlify/functions/nexa-telegram-webhook","secret_token":"<WEBHOOK_SECRET>","allowed_updates":["message"],"drop_pending_updates":false}`.
   Nunca inclua token real em logs, capturas, chats, repo ou URL pública.
5. Só após o webhook estar válido, `NEXA_TELEGRAM_ENABLED=true` em Production. Por padrão a função devolve 503 sem configuração.
6. Teste com conversa privada: `/start`, `/kyc`, `preciso da provação`, `/parar`; confirme tickets em `nexa_telegram_handoffs` e contato em `nexa_telegram_contacts`. Não faça testes financeiros.
7. Divulgar **canal público** `https://t.me/NexaInsights` nos canais próprios da Nexa. Não apresentar `https://t.me/NexaTheoBot` como suporte ativo até o passo 6. Depois do teste real, promover o bot para atendimento voluntário, sem importar números.
8. Caso deseje centralizar contas organizacionais futuramente, avaliar transferência de propriedade com planejamento separado, pois ela é permanente. Não transferir automaticamente.

Documentação Telegram: https://core.telegram.org/bots/api e https://core.telegram.org/bots
