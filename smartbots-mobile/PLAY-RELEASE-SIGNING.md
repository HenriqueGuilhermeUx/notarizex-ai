# SmartBots Hoje - Publicação Google Play

## Dados do app

- Nome: SmartBots Hoje
- Pacote Android: `club.smartbots.app`
- Arquivo de publicação: `smartbots-hoje-release.aab`
- Política de privacidade: `https://smartbots.club/politica-privacidade-app.html`
- Exclusão de conta/dados: `https://smartbots.club/excluir-conta.html`
- Termos: `https://smartbots.club/termos-app.html`

## Por que precisa de assinatura release

A Google Play exige que o Android App Bundle enviado para o Play Console seja assinado com uma chave de upload/release. Builds debug ou assinados com `CN=Android Debug` não devem ser enviados.

## Fluxo recomendado

### 1. Gerar a upload keystore

No GitHub:

1. Actions
2. SmartBots Mobile - Generate Upload Keystore
3. Run workflow
4. Baixe o artifact `smartbots-android-upload-keystore-package`

Guarde esse artifact com segurança. Ele contém a chave de upload.

### 2. Criar os secrets no GitHub

Abra o arquivo `GITHUB-SECRETS.txt` que veio no artifact e crie estes secrets:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

Caminho:

```text
GitHub > Settings > Secrets and variables > Actions > New repository secret
```

### 3. Gerar AAB assinado

No GitHub:

1. Actions
2. SmartBots Mobile - Signed Play Release
3. Run workflow
4. Baixe o artifact `smartbots-hoje-signed-play-release`

Dentro dele estarão:

```text
smartbots-hoje-release.aab
smartbots-hoje-release.apk
signing-report.txt
README.txt
```

### 4. Arquivo para subir na Google Play

Use este arquivo:

```text
smartbots-hoje-release.aab
```

## Atenção

- Não publique AAB assinado com `Android Debug`.
- Não commite a `.jks` no repositório.
- Guarde a keystore com segurança. Ela será necessária para atualizar o app no futuro.
- Se a keystore for perdida, será necessário seguir o fluxo de reset/rotação de upload key na Play Console.

## Permissões Android pretendidas

O app deve usar somente:

```text
android.permission.INTERNET
```

As permissões abaixo foram bloqueadas na configuração Expo por não serem necessárias ao produto:

```text
android.permission.SYSTEM_ALERT_WINDOW
android.permission.READ_EXTERNAL_STORAGE
android.permission.WRITE_EXTERNAL_STORAGE
```
