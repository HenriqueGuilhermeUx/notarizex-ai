# Integração Modo → SmartBots Assistido

## Objetivo

Receber o onboarding do plano Modo Presença e criar uma fila operacional para implantação assistida no SmartBots.

## Endpoint parceiro

`POST /.netlify/functions/partner-smartbots-intake`

Valores fixos:

- `partner`: `modo`
- `plan`: `presenca`
- `product`: `smartbots_assisted`
- status inicial: `pending_setup`

## Funções adicionadas

- `smartbots-health.js`: verifica se a API está publicada e se as integrações essenciais estão configuradas.
- `partner-smartbots-intake.js`: recebe, valida, autentica, deduplica e salva o onboarding da Modo.
- `admin-smartbots-intakes.js`: lista a fila de implantações.
- `admin-smartbots-intake-update.js`: altera status, responsável e observações internas.

## Status permitidos

1. `pending_setup`
2. `reviewing`
3. `waiting_customer`
4. `building`
5. `testing`
6. `active`
7. `paused`
8. `cancelled`

## Ativação sem terminal

### 1. Criar a tabela no Supabase

1. Abra o projeto Supabase usado pelo SmartBots.
2. Entre em **SQL Editor**.
3. Clique em **New query**.
4. Abra no GitHub o arquivo `supabase/migrations/20260724_create_partner_smartbots_intakes.sql`.
5. Copie todo o conteúdo para o SQL Editor.
6. Clique em **Run**.
7. Confirme no **Table Editor** que apareceu `partner_smartbots_intakes`.

### 2. Criar variáveis no Netlify

No projeto do domínio `smartbots.club`, abra:

**Project configuration → Environment variables**

Cadastre:

- `MODO_PARTNER_API_KEY`: segredo exclusivo da comunicação Modo → SmartBots.
- `SMARTBOTS_ADMIN_API_KEY`: segredo diferente, usado apenas pela operação administrativa.
- `SUPABASE_SERVICE_ROLE_KEY`: chave de servidor do projeto Supabase.
- `MODO_ALLOWED_ORIGINS`: domínios autorizados da Modo, separados por vírgula.

Mantenha também `SUPABASE_URL`, que já é usado pelo SmartBots.

Nunca coloque essas chaves em HTML, JavaScript do navegador ou arquivos públicos do GitHub.

### 3. Publicar novamente

Depois de salvar as variáveis:

1. Abra **Deploys** no Netlify.
2. Escolha **Trigger deploy**.
3. Selecione **Deploy site**.
4. Espere o estado ficar **Published**.

### 4. Verificar a API

Abra no navegador:

`https://smartbots.club/.netlify/functions/smartbots-health`

Resultado esperado:

```json
{
  "success": true,
  "service": "SmartBots API",
  "status": "online",
  "version": "2.1.0",
  "integrations": {
    "supabase": true,
    "modo": true
  }
}
```

## Payload do onboarding

```json
{
  "partner": "modo",
  "plan": "presenca",
  "businessName": "Clínica Exemplo",
  "ownerName": "Responsável",
  "email": "responsavel@empresa.com.br",
  "phone": "5511999999999",
  "instagram": "@empresa",
  "website": "https://empresa.com.br",
  "segment": "Clínica odontológica",
  "services": "Implantes, clareamento e ortodontia",
  "openingHours": "Segunda a sexta, 8h às 18h",
  "faq": "Perguntas e respostas principais",
  "prices": "Faixas de preço ou sob consulta",
  "welcomeMessage": "Olá! Como podemos ajudar?",
  "googleReviewLink": "",
  "notes": "Observações para implantação",
  "dataProcessingAccepted": true
}
```

Cabeçalhos obrigatórios:

- `Content-Type: application/json`
- `X-Partner-Key: <MODO_PARTNER_API_KEY>`
- `Idempotency-Key: <identificador único do envio>`

## Próxima etapa

Após a ativação da API no SmartBots, conectar o backend da Modo ao endpoint e, em seguida, criar no n8n o fluxo de orquestração do onboarding, diagnóstico, geração da base de conhecimento e acompanhamento da implantação.
