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

## Como rodar localmente

```bash
cd smartbots-mobile
npm install
npx expo start
```

## Gerar APK para teste

```bash
npx eas login
npx eas build -p android --profile preview
```

ou:

```bash
npm run build:apk
```

## Gerar AAB para Google Play

```bash
npx eas build -p android --profile production
```

ou:

```bash
npm run build:aab
```

## Observação

- APK: ideal para instalar direto em aparelhos de teste.
- AAB: formato correto para publicação na Google Play.
- O envio de mensagens abre o WhatsApp do cliente. A SmartBots não dispara mensagens automaticamente nesta versão.
