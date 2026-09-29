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

## API

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

## Exemplo: disponibilidade

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

## Exemplo: reserva

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

O Brain ja classifica a intencao `agendamento` e gera o evento `schedule_requested`. A proxima camada de integracao deve consumir essa intencao/evento e chamar o Scheduling Core para:

1. resolver o servico;
2. consultar slots;
3. apresentar opcoes na conversa;
4. confirmar o slot escolhido;
5. criar a reserva;
6. manter CRM e automacoes sincronizados.

Essa separacao impede que regras de agenda fiquem presas ao WhatsApp ou ao Brain e permite reutilizar o mesmo motor em outros produtos da Alternative Ventures.
