#requires -Version 5.1
<#
Ativacao local do @NexaTheoBot sem gravar token em arquivo, GitHub ou historico.
Uso:
  .\activate-nexa-telegram.ps1 -GenerateSecret
  .\activate-nexa-telegram.ps1
  .\activate-nexa-telegram.ps1 -VerifyOnly
Antes de executar sem -VerifyOnly: cadastrar BOT_TOKEN, WEBHOOK_SECRET e ENABLED=true
no Netlify SmartBots (escopo Functions, contexto Production), e republicar o site.
#>
[CmdletBinding()]
param(
  [switch]$GenerateSecret,
  [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
$expectedUsername = 'NexaTheoBot'
$webhook = 'https://smartbots.club/.netlify/functions/nexa-telegram-webhook'

function Read-PrivateValue([string]$promptText) {
  $secure = Read-Host -Prompt $promptText -AsSecureString
  $pointer = [IntPtr]::Zero
  try {
    $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    if ($pointer -ne [IntPtr]::Zero) {
      [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    $secure.Dispose()
  }
}

if ($GenerateSecret) {
  [byte[]]$bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $generated = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  Write-Host 'Copie este segredo somente para NEXA_TELEGRAM_WEBHOOK_SECRET no Netlify:'
  Write-Output $generated
  Write-Host 'Nao salve em arquivos nem envie em chats. Gere novamente se for exposto.'
  return
}

$token = $null
$secret = $null
try {
  $token = Read-PrivateValue 'Token do @BotFather (entrada oculta)'
  if ($token -notmatch '^\d{5,20}:[A-Za-z0-9_-]{20,}$') {
    throw 'Formato de token invalido. Nao cole aqui o token para suporte.'
  }

  $baseUri = 'https://api.telegram.org/bot' + $token + '/'
  try {
    $me = Invoke-RestMethod -Method Post -Uri ($baseUri + 'getMe') -ContentType 'application/json' -Body '{}' -ErrorAction Stop
  } catch {
    throw 'Falha ao verificar token com getMe. Confira o token e a conexao. Nao compartilhe logs com URL.'
  }
  if ($me.ok -ne $true -or $me.result.username -cne $expectedUsername) {
    throw 'Token nao pertence a @NexaTheoBot; operacao abortada sem alterar webhook.'
  }
  Write-Host 'Token confirmado para @NexaTheoBot.'

  if (-not $VerifyOnly) {
    Write-Host 'Antes de registrar: os 2 segredos e NEXA_TELEGRAM_ENABLED=true precisam estar no Netlify (Production/Functions), com novo deploy READY.'
    $approval = Read-Host 'Se ja verificou essas condicoes, digite SIM'
    if ($approval -cne 'SIM') {
      throw 'Ativacao cancelada. O webhook nao foi alterado.'
    }
    $secret = Read-PrivateValue 'NEXA_TELEGRAM_WEBHOOK_SECRET (entrada oculta)'
    if ($secret -cnotmatch '^[A-Za-z0-9_-]{32,64}$') {
      throw 'Webhook secret deve conter 32-64 caracteres: letras, numeros, _ ou -.'
    }
    $payload = @{
      url = $webhook
      secret_token = $secret
      allowed_updates = @('message')
      drop_pending_updates = $false
    } | ConvertTo-Json -Depth 5 -Compress
    try {
      $result = Invoke-RestMethod -Method Post -Uri ($baseUri + 'setWebhook') -ContentType 'application/json' -Body $payload -ErrorAction Stop
    } catch {
      throw 'Falha no setWebhook. Confira o deploy, as credenciais e a rede. Nao compartilhe logs com URL.'
    }
    if ($result.ok -ne $true -or $result.result -ne $true) {
      throw 'Telegram nao confirmou o registro do webhook.'
    }
    Write-Host 'Telegram confirmou setWebhook.'
  }

  try {
    $info = Invoke-RestMethod -Method Post -Uri ($baseUri + 'getWebhookInfo') -ContentType 'application/json' -Body '{}' -ErrorAction Stop
  } catch {
    throw 'Nao foi possivel consultar getWebhookInfo; confirme no Telegram com a mesma credencial.'
  }
  if ($info.ok -ne $true) { throw 'Resposta invalida de getWebhookInfo.' }
  $urlMatches = $info.result.url -ceq $webhook
  Write-Host ('Webhook confere: ' + $urlMatches)
  Write-Host ('Destino: ' + $info.result.url)
  Write-Host ('Atualizacoes pendentes: ' + $info.result.pending_update_count)
  if (-not $urlMatches) { throw 'Webhook diferente do endereco do SmartBots. Nenhum teste foi realizado.' }
  if ($info.result.last_error_date) {
    Write-Warning 'Existe erro anterior registrado pelo Telegram. Verifique os logs do Netlify sem compartilhar tokens.'
  }
  Write-Host 'Agora envie /start em https://t.me/NexaTheoBot e confira a resposta.'
} finally {
  $token = $null
  $secret = $null
  $baseUri = $null
  $payload = $null
}
