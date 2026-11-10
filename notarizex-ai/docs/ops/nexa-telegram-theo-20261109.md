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
4. A variável `NEXA_TELEGRAM_ENABLED` já existe com valor `false`. Após configurar os dois segredos e conferir o deploy do webhook, mude para **`true`**, mantendo escopo **Functions** e contexto **Production**. **Faça novo deploy** antes de registrar o webhook: funções antigas podem manter os valores anteriores. Não anuncie o bot ainda.
5. Registre e confira o webhook com o script local e interativo `notarizex-ai/scripts/activate-nexa-telegram.ps1` (PowerShell no Windows; não armazena credenciais):
   - Baixe apenas o script do repositório oficial e confira seu conteúdo.
   - Execute `.\\activate-nexa-telegram.ps1 -GenerateSecret` para criar o segredo (copie apenas para Netlify, nunca para chats).
   - Depois de salvar **token, mesmo segredo e ENABLED=true** no Netlify, e confirmar deploy READY, execute `.\\activate-nexa-telegram.ps1`.
   - O script pede token e segredo sem exibi-los, valida com `getMe` o username **NexaTheoBot**, confirma `setWebhook`, consulta `getWebhookInfo` e exibe apenas estado/URL.
   - Para verificar o estado posteriormente sem alterar o webhook, execute `.\\activate-nexa-telegram.ps1 -VerifyOnly`.
   - Alternativamente, método documentado na API: `POST https://api.telegram.org/bot<TOKEN>/setWebhook` com JSON `{"url":"https://smartbots.club/.netlify/functions/nexa-telegram-webhook","secret_token":"<WEBHOOK_SECRET>","allowed_updates":["message"],"drop_pending_updates":false}`. Não abra URL com token no navegador nem exponha em histórico, prints ou logs.
6. Teste com conversa privada: `/start`, `/kyc`, `preciso da provação`, `/parar`; confirme tickets em `nexa_telegram_handoffs` e contato em `nexa_telegram_contacts`. Não faça testes financeiros.
7. Divulgar **canal público** `https://t.me/NexaInsights` nos canais próprios da Nexa. Não apresentar `https://t.me/NexaTheoBot` como suporte ativo até o passo 6. Depois do teste real, promover o bot para atendimento voluntário, sem importar números.
8. Caso deseje centralizar contas organizacionais futuramente, avaliar transferência de propriedade com planejamento separado, pois ela é permanente. Não transferir automaticamente.

Documentação Telegram: https://core.telegram.org/bots/api e https://core.telegram.org/bots

## Checklist antes da divulgação (gate)
- [ ] Confirmar os 3 env vars no SmartBots Netlify (Production/Functions) e novo deploy pronto.
- [ ] Conferir que `getMe` devolveu `@NexaTheoBot`, `getWebhookInfo` aponta exclusivamente para `smartbots.club/.netlify/functions/nexa-telegram-webhook` e não há erros novos.
- [ ] Enviar `/start` via conversa privada e receber menu; testar `/kyc`, `/humano`, `/parar` sem documentos ou transações reais.
- [ ] Confirmar no Supabase SmartBots a criação de registro na fila de handoff; responder no CRM apenas como atendimento, nunca como identidade financeira verificada.
- [ ] **Somente depois** incluir o CTA público `https://t.me/NexaTheoBot` no site Nexa. Canal editorial `https://t.me/NexaInsights` permanece independente.
- Se houver erro de entrega, definir ENABLED=false, redeploy e revisar getWebhookInfo/logs; também desregistrar webhook se necessário. Não publicar status ativo prematuramente.

## Operação — preparação do ambiente em 09/11/2026
- O administrador informou que as variáveis do Telegram foram cadastradas no projeto Netlify `notarizex-ai` (`smartbots.club`).
- Inspeção de configuração confirmou presença de `NEXA_TELEGRAM_BOT_TOKEN` e `NEXA_TELEGRAM_WEBHOOK_SECRET` como segredos com escopo Functions. Os valores ocultos não foram validados contra a API do Telegram; `getMe` continua obrigatório.
- A flag `NEXA_TELEGRAM_ENABLED` foi alterada para `true` no Netlify. Este commit inicia um deploy via Git para aplicar a nova configuração nas funções, sem registrar webhook nem enviar mensagens.
- **Não divulgar o bot como ativo** até que o responsável execute o script de ativação e confirme `getWebhookInfo`, `/start` e fila de suporte.
- Separar atualização das variáveis, publicação Netlify e ativação Telegram: deploy READY não equivale a webhook registrado.

## Ativação automatizada temporária — 09/11/2026
O webhook ainda não tinha nenhum contato nem atualização recebida na verificação inicial. O operador autorizou prosseguir com a integração e as credenciais já foram armazenadas como segredos no Netlify.

O arquivo `netlify/functions/nexa-telegram-bootstrap.mjs` agenda uma tentativa de ativação **somente** durante o fim de 09/11/2026 em UTC (20:00 a 23:59, a cada 5 minutos). Ao terminar essa janela, a função não executa ações mesmo que o agendamento seja invocado; não há broadcast ou mensagens aos clientes.

Travas antes de `setWebhook`:
- Site `SITE_ID` deve ser exatamente o SmartBots de produção; execução agendada do Netlify ocorre apenas em deploy publicado
- `NEXA_TELEGRAM_ENABLED=true` e token/segredo com formato esperado
- `getMe` precisa identificar o `@NexaTheoBot` e `is_bot=true`
- `getWebhookInfo` deve apresentar URL vazia, ou já ser exatamente o endpoint Nexa; se for diferente, recusar alterar
- Somente URL `https://smartbots.club/.netlify/functions/nexa-telegram-webhook`, `allowed_updates=['message']`, `drop_pending_updates=false` e `secret_token` secreto
- Confirmar o destino com `getWebhookInfo` depois de registrar. Não armazenar credenciais em logs; os logs contêm exclusivamente códigos de estado.

Os resultados esperados da execução são `registered` ou `already_registered`. Códigos como `invalid_credentials_format`, `bot_identity_mismatch`, `existing_webhook_conflict`, `getme_failed`, `provider_request_failed` ou `verification_failed` são bloqueios e exigem inspeção segura. O agendamento **não** substitui o teste humano de `/start` e a verificação de fila/CRM no Supabase antes da divulgação. Não afirmar que o bot está respondendo só porque o deploy está READY.

Depois da ativação, remover a função de bootstrap temporária do repositório via PR; o webhook oficial permanente e o atendimento permanecem intactos. O script PowerShell pode ser usado caso o agendamento expire ou apresente bloqueio. Não registrar um webhook diferente ou modificar bot já controlado por outro serviço.

## Correção de ativação — 10/11/2026
- O cron de 09/11 expirou sem evidência de mensagens Telegram recebidas; às consultas seguintes a contagem de contatos, mensagens, updates e handoffs da Nexa continuava zerada.
- A janela foi corrigida para **10/11/2026, 19:00–23:59 UTC**, com agendamento `*/5 19-23 10 11 *`, protegido por limite absoluto de datas no código. Depois disso não há novos registros automáticos.
- Além de não sobrescrever webhook de terceiros, o bootstrap agora **reaplica `secret_token` caso o webhook existente já seja exatamente o endpoint oficial**, já que a API `getWebhookInfo` não revela qual segredo foi previamente configurado.
- Sem nova aprovação do usuário, não divulgue bot ativo nem execute campanhas: o gate de publicação permanece a confirmação de `/start` com registro no CRM.
- O bootstrap temporário deve ser removido por PR após o teste, mesmo depois de expirar.

## Diagnóstico de uma sessão — somente 10/11/2026
Endpoint temporário, somente leitura: `https://smartbots.club/.netlify/functions/nexa-theo-health`.
- É publicado exclusivamente em produção do projeto SmartBots, tem limitação por IP (3/min), não permite CORS arbitrário e expira automaticamente em 11/11/2026 às 00:00 UTC (HTTP 410).
- Consulta `getMe` e `getWebhookInfo` internamente com token do Netlify, **sem retornar URLs de API, tokens, segredos, IDs de chat ou dados de clientes**.
- Resposta limitada a `status` (bot_verified, wrong_bot, telegram_identity_unavailable, telegram_webhook_info_unavailable, credentials_not_validated, disabled), `webhook` (registered/not_registered/different_endpoint), contagem de updates pendentes e indicador booleano de falha de entrega.
- `webhook=registered` só comprova destino na Telegram API, não valida o segredo em uso nem mensagens entregues. O sucesso definitivo depende de `/start` e linha criada em `nexa_telegram_updates`.
- Remover o arquivo temporário após a homologação ou no próximo ciclo. Não usar esse endpoint como monitoramento permanente.

## Ajuste operacional do segredo em 10/11/2026
- Diagnóstico executado por GitHub Actions (workflow `Nexa Theo Telegram live diagnostic`) retornou `credentials_not_validated` com a configuração inicial.
- Formato do segredo dev previamente cadastrado não era compatível com a política do bootstrap. Um novo segredo aleatório de 64 caracteres hexadecimais foi armazenado exclusivamente no Netlify em `NEXA_TELEGRAM_WEBHOOK_SECRET`, sem registro do valor no repositório, log ou documentos.
- Token de bot `NEXA_TELEGRAM_BOT_TOKEN` não foi modificado.
- Este commit dispara novo deploy, para que o segredo atualizado chegue a Functions em Production. Também é disparada nova verificação read-only do webhook.
- **A liberação pública depende ainda de `getMe` validado, `getWebhookInfo` confirmado e resposta /start registrada no banco.**

## Integração CRM — 10/11/2026
- Após o conserto do retorno vazio PostgREST, foi confirmado em produção **1 update processado**, **1 resposta outbound enviada**, **1 contato Telegram** no Supabase SmartBots. O update antigo permanece como falha auditável.
- A primeira interação de suporte no Telegram agora cria ou atualiza um contato no `smartbot_leads` para `site-nexa-20260923-live` com `source_channel='telegram'`, `pipeline_status='novo'`, `handoff_status='none'`, nome fornecido pelo Telegram e resumo genérico. IDs de chat permanecem identificadores operacionais, não autenticação bancária. Uma interação repetida atualiza somente os carimbos de atividade, sem rebaixar um pedido de atendimento humano.
- Nenhum telefone, e-mail, CPF, conteúdo de mensagens ou dados financeiros é copiado no CRM no momento do `/start`; `metadata.purpose='service_only'`, `metadata.marketing_opt_in=false`, `metadata.customer_identity_verified=false`. Não definir `follow_up_at` nem `return_at`, pois o agendador comum do SmartBots usa essas datas para enfileirar follow-ups.
- `/humano` ou categoria urgente continua criando um ticket `nexa_telegram_handoffs` e espelho CRM com `pipeline_status='handoff'`, `handoff_status='requested'`, sem consentimento comercial. O espelho CRM é best-effort: falha do CRM nunca deve impedir a resposta do Theo ou o registro do ticket privado.
- `/parar` não cria novo contato no funil nem permite campanhas. `/avisos` só altera consentimento separado para avisos de serviço; **não** autoriza marketing nem ativa disparos automáticos.
- Verificar em homologação: `/start` cria lead service-only; `/humano` cria handoff; duplicatas de update não duplicam; nenhuma campanha é enfileirada. Só então promover CTA Telegram no site Nexa.

## Homologação e retirada da infraestrutura temporária (10/11/2026)
- Registro confirmado em produção: update do Telegram `processed`, mensagem inbound e resposta outbound `sent`. A primeira falha de JSON foi mantida como histórico.
- O contato real do teste foi inserido de forma idempotente no CRM SmartBots: **1 contato Telegram**, `pipeline_status=novo`, `handoff_status=none`, `metadata.marketing_opt_in=false`, `follow_up_at/return_at=NULL` e identidade financeira não verificada.
- Após CI verde e deploy da PR do CRM, o bootstrap temporário `nexa-telegram-bootstrap.mjs`, o endpoint `nexa-theo-health.mjs`, seus testes de diagnóstico e o workflow único de inspeção foram retirados. O webhook permanente `nexa-telegram-webhook.js`, a API de atendimento e o script local manual de recuperação continuam intactos.
- Homologação pendente: enviar `/humano` numa conversa privada de teste e confirmar **1 ticket** em `nexa_telegram_handoffs` com espelho `handoff/requested` no CRM. Só então ativar CTA de Telegram nas páginas Nexa. Não iniciar campanhas sem consentimento explícito separado.
