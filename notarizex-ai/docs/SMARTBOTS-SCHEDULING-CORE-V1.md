# SmartBots Scheduling Core V1

## Objetivo

Criar um motor de agendamento reutilizavel que funcione de duas formas:

1. **Standalone**: site, app, portal ou outro produto pode consumir o mesmo core.
2. **SmartBots**: o bot, WhatsApp/Kapso e automacoes n8n podem consultar disponibilidade e criar/alterar reservas no mesmo core.

O SmartBots continua sendo cerebro + CRM + produto. Kapso continua sendo canal WhatsApp. n8n continua sendo orquestrador invisivel. A agenda nao fica acoplada a nenhum desses componentes.

## Entidades

- `smartbot_scheduling_services`: servicos, duracao, buffers e preco.
- `smartbot_scheduling_resources`: profissionais, salas, boxes, elevadores, equipamentos etc.
- `smartbot_scheduling_service_resources`: quais recursos atendem quais servicos.
- `smartbot_scheduling_bookings`: reserva canonica compartilhada por todos os canais.
- `smartbot_scheduling_sessions`: estado curto da conversa enquanto o cliente escolhe servico/data/slot.

Tudo e isolado por `bot_id`.

## Tipos de recurso

`resource_type` e texto aberto. Exemplos:

- `professional`
- `room`
- `box`
- `lift`
- `equipment`

Isso permite usar o mesmo motor para clinica, salao, terapia, oficina e outros verticais.

## Horario de trabalho

`working_hours` e JSON por dia da semana. Exemplo:

```json
{
  "mon": [{"from":"09:00","to":"12:00"},{"from":"13:00","to":"18:00"}],
  "tue": [{"from":"09:00","to":"18:00"}],
  "wed": [{"from":"09:00","to":"18:00"}],
  "thu": [{"from":"09:00","to":"18:00"}],
  "fri": [{"from":"09:00","to":"18:00"}],
  "sat": [{"from":"09:00","to":"13:00"}]
}
```

O timezone padrao e `America/Sao_Paulo`.

## API de dominio

Function: `/.netlify/functions/scheduling-core`

Acoes:

- `capabilities`
- `list_services`
- `save_service`
- `list_resources`
- `save_resource`
- `bind_service_resource`
- `availability`
- `create_booking`
- `list_bookings`
- `update_booking`

Autenticacao administrativa aceita sessao do portal (`portalToken`) e o modo legado (`botId` + `clientToken`). Chamadas server-to-server usam `X-SmartBots-Internal-Key` com `SMARTBOTS_INTERNAL_KEY`.

## API conversacional

Function: `/.netlify/functions/scheduling-agent`

O agente recebe a fala original do cliente e mantem estado por `botId + visitorId`. Ele consegue:

- identificar servico pelo nome;
- identificar profissional/recurso pelo nome;
- entender `hoje`, `amanha`, dias da semana e datas numericas;
- entender `manha`, `tarde`, `noite`;
- oferecer ate quatro slots reais;
- aceitar `opcao 1`, `primeiro`, `15h30` etc.;
- confirmar a reserva usando o mesmo Scheduling Core.

Exemplo inicial:

```json
{
  "botId": "BOT_ID",
  "visitorId": "wa_5513999999999",
  "message": "Quero cortar com o Rafael sabado a tarde",
  "serviceName": "Corte",
  "customerName": "Henrique",
  "customerPhone": "5513999999999"
}
```

Resposta esperada quando existe disponibilidade:

```json
{
  "success": true,
  "handled": true,
  "state": "offered",
  "reply": "Tenho estes horarios para Corte: 1) ...; 2) ...; 3) ... . Qual voce prefere?"
}
```

Na mensagem seguinte o mesmo `visitorId` pode responder apenas `15h30` ou `opcao 2`; o agente recupera os slots ofertados e tenta criar a reserva canonica.

## Exemplo: disponibilidade direta

```json
{
  "action": "availability",
  "botId": "BOT_ID",
  "serviceId": "UUID_SERVICO",
  "from": "2026-09-30T09:00:00-03:00",
  "to": "2026-10-02T18:00:00-03:00",
  "stepMinutes": 15,
  "limit": 20
}
```

## Exemplo: reserva direta

```json
{
  "action": "create_booking",
  "botId": "BOT_ID",
  "serviceId": "UUID_SERVICO",
  "resourceId": "UUID_RECURSO",
  "startsAt": "2026-09-30T14:00:00-03:00",
  "visitorId": "wa_5513999999999",
  "customerName": "Cliente",
  "customerPhone": "5513999999999",
  "source": "smartbots-whatsapp"
}
```

O core valida horario de trabalho, duracao, buffer, elegibilidade do recurso e conflito com reservas ativas antes de gravar.

## Integracao SmartBots

O Brain ja classifica a intencao `agendamento` e gera o evento `schedule_requested`. O `scheduling-agent` agora e a camada pronta para consumir esse contexto e executar o fluxo:

1. resolver o servico;
2. resolver profissional/recurso quando citado;
3. entender dia e periodo;
4. consultar slots reais;
5. apresentar opcoes na conversa;
6. recuperar a escolha no turno seguinte;
7. criar a reserva;
8. manter o estado separado do Brain e do canal.

O ponto de integracao do canal/Brain deve encaminhar mensagens de agendamento para `scheduling-agent` com o mesmo `visitorId`. Assim, WhatsApp, site e app usam a mesma conversa operacional sem duplicar regras.

## Antes de producao

1. aplicar as duas migrations em homologacao;
2. cadastrar pelo menos um servico e um recurso com `working_hours`;
3. vincular servico e recurso;
4. testar disponibilidade direta;
5. testar conversa em dois turnos (`quero ... sabado a tarde` -> `opcao 2`);
6. testar conflito tentando reservar o mesmo recurso/horario duas vezes;
7. somente depois conectar ao fluxo real de WhatsApp/site e publicar em producao.
