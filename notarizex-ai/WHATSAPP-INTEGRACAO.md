# SmartBots WhatsApp

## Caminhos disponíveis

### 1. Assistido Pro
Sem API. A SmartBots gera a mensagem, abre o WhatsApp e registra o histórico.

Arquivos:
- /whatsapp-pro.html
- /.netlify/functions/whatsapp-send

### 2. Provedor rápido
Para Z-API, Evolution API ou outro gateway.

Configure no Netlify:

```text
WHATSAPP_PROVIDER_URL=https://seu-gateway-ou-wrapper/send
WHATSAPP_DEFAULT_BOT_ID=bot_id_padrao_para_webhook
```

O provedor deve aceitar POST com:

```json
{
  "phone": "5511999999999",
  "message": "Texto da mensagem",
  "botId": "bot_123"
}
```

Webhook de entrada para configurar no provedor:

```text
https://smartbots.club/.netlify/functions/whatsapp-webhook
```

### 3. Oficial
Para Meta Cloud API, Twilio ou BSP. O sistema já tem páginas de configuração e inbox. A próxima etapa é adaptar o envio oficial por credenciais do provedor.

## Páginas

- /whatsapp-integracao.html
- /whatsapp-config.html
- /whatsapp-pro.html
- /whatsapp-inbox.html

## Segurança comercial

Use para atendimento, vendas, agendamento, orçamento e pós-venda. Evite spam, listas frias e mensagens sem autorização.
