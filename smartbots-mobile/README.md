# SmartBots Hoje - App Android

App mobile da SmartBots para Android, feito em Expo/React Native.

## Funções do MVP

- Hoje: resumo diário do negócio
- CRM: contatos, oportunidades e prospects
- Ações: agenda, vendas, dúvidas, retorno e humano
- Mensagens: modelos prontos + abrir WhatsApp
- Prospecção: busca de oportunidades via Apify
- Agenda Pro: link Cal.com ou agenda externa
- Meu Bot: link do mini site para bio, QR e teste

## Gerar pelo GitHub Actions

### APK de teste, sem EAS

1. Abra o repositório no GitHub.
2. Vá em **Actions**.
3. Escolha **SmartBots Mobile - Android Debug APK**.
4. Clique em **Run workflow**.
5. Quando terminar, baixe o artifact **smartbots-hoje-debug-apk**.

Esse APK serve para instalar em aparelhos Android e testar o app.

### APK/AAB assinado com EAS

Para build assinado via Expo/EAS:

1. Crie/configure o projeto no Expo/EAS.
2. Gere um token EAS.
3. No GitHub, vá em **Settings > Secrets and variables > Actions**.
4. Crie o secret:

```text
EAS_TOKEN=seu_token_eas
```

Depois:

1. Vá em **Actions**.
2. Escolha **SmartBots Mobile - EAS Android Build**.
3. Clique em **Run workflow**.
4. Escolha:
   - `preview` para APK
   - `production` para AAB

## Rodar localmente

```bash
cd smartbots-mobile
npm install
npx expo start
```

## Gerar APK local/EAS

```bash
npm run build:apk
```

## Gerar AAB local/EAS

```bash
npm run build:aab
```

## Observação

- APK: ideal para instalar direto em aparelhos de teste.
- AAB: formato usado para publicação na Google Play.
- O envio de mensagens abre o WhatsApp do cliente.
- A SmartBots não dispara mensagens automaticamente nesta versão.
