# SmartBots Hoje - App Android

App mobile da SmartBots para Android, feito em Expo/React Native.

## Identidade do app

- Nome: SmartBots Hoje
- Pacote Android: `club.smartbots.app`
- Slug EAS: `smartbots`
- Project ID EAS: `6893b421-ca62-4c5b-8fb0-20425a493b10`
- Política de Privacidade: `https://smartbots.club/politica-privacidade-app.html`
- Exclusão de conta/dados: `https://smartbots.club/excluir-conta.html`
- Termos: `https://smartbots.club/termos-app.html`

## Funções do MVP completo

- Cadastro de novo negócio pelo app
- Login amigável por código da empresa e código de acesso
- Acesso técnico por botId/clientToken
- Hoje: resumo diário do negócio
- CRM: contatos, oportunidades e prospects
- Ações: agenda, vendas, dúvidas, retorno e humano
- Mensagens: modelos prontos + abrir WhatsApp
- Prospecção: busca de oportunidades via Apify
- Agenda Pro: link Cal.com ou agenda externa
- Meu Bot: mini site para bio, QR e teste
- Mais: painel web, políticas, exclusão de conta e termos

## GitHub Actions

### APK instalável

Use o workflow:

```text
SmartBots Mobile - Android Installable APK
```

Ele gera o artifact:

```text
smartbots-hoje-installable-apk
```

### APK e AAB via EAS

Use o workflow:

```text
SmartBots Mobile - EAS APK and AAB
```

Ele roda dois builds:

- `preview`: APK
- `production`: AAB

Requer secret no GitHub:

```text
EXPO_TOKEN=seu_token_expo
```

ou:

```text
EAS_TOKEN=seu_token_eas
```

## Rodar localmente

```bash
cd smartbots-mobile
npm install
npx expo start
```

## Build manual pelo EAS

APK:

```bash
npm run build:apk
```

AAB:

```bash
npm run build:aab
```

## Observação

- APK: ideal para instalar direto em aparelhos de teste.
- AAB: formato usado para publicação na Google Play.
- O envio de mensagens abre o WhatsApp do cliente.
- A SmartBots não dispara mensagens automaticamente nesta versão.
- Algumas configurações avançadas continuam no painel web.
