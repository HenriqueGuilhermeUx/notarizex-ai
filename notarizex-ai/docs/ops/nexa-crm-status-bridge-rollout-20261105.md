# Nexa CRM SmartBots status bridge

The GET `/.netlify/functions/nexa-crm-status-bridge` endpoint returns only Nexa bot connection metadata to the Nexa backend. It requires a dedicated `NEXA_CRM_BRIDGE_TOKEN` set as a Netlify Functions production secret and a matching `NEXA_CRM_SMARTBOTS_BRIDGE_TOKEN` on the Nexa Render backend.

The Nexa backend uses `NEXA_CRM_SMARTBOTS_READ_ENABLED=true` and `NEXA_CRM_SMARTBOTS_BRIDGE_URL=https://smartbots.club/.netlify/functions/nexa-crm-status-bridge`.

No chat messages, PII, customer links, outbound messaging, Kapso webhook routing, or auto_reply settings are changed by this integration. Validate unauthorized GET returns 401 and authenticated response returns only the expected bot metadata. Never record the token in GitHub.

## WhatsApp inbox (read-only)

The inbox bridge uses a **different** production Functions secret, `NEXA_CRM_INBOX_BRIDGE_TOKEN`; the Nexa Render backend requires the matching `NEXA_CRM_SMARTBOTS_INBOX_BRIDGE_TOKEN` plus `NEXA_CRM_SMARTBOTS_INBOX_READ_ENABLED=true`. Rotate both sides together. The Netlify build must include the updated production environment. No tokens, personal conversation data or message bodies belong in this document.

## Procedimento seguro de rotação e validação (2026-11-05)

1. Atualizar somente `NEXA_CRM_BRIDGE_TOKEN` e `NEXA_CRM_INBOX_BRIDGE_TOKEN` como segredos de produção **Functions** no Netlify SmartBots; conservar credenciais Kapso e Supabase atuais.
2. Publicar o SmartBots sem modificar os arquivos do webhook; conferir que o deploy esteja pronto e que uma requisição GET sem autorização às bridges responda HTTP 401.
3. No Render do backend Nexa, fazer MERGE das cinco variáveis de integração (`NEXA_CRM_SMARTBOTS_READ_ENABLED`, `NEXA_CRM_SMARTBOTS_BRIDGE_URL`, `NEXA_CRM_SMARTBOTS_BRIDGE_TOKEN`, `NEXA_CRM_SMARTBOTS_INBOX_READ_ENABLED` e `NEXA_CRM_SMARTBOTS_INBOX_BRIDGE_TOKEN`); nunca substituir todo o ambiente.
4. Verificar o deploy LIVE no Render e executar testes administrativos autenticados de status, listagem e histórico, sem acionar mensagens. Em erro, desativar as duas flags de leitura preservando o WhatsApp.
5. Não inferir vínculo de identidade por telefone, não ativar campanhas, não alterar `auto_reply`, nem compartilhar conteúdo de mensagens fora do Admin autenticado.

Este registro contém somente o procedimento, sem valores dos segredos.
