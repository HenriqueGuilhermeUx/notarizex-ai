# NexOffice × SmartBots — production contract

## Purpose

This integration exposes SmartBots as a private NexOffice subscriber add-on while keeping WhatsApp provider details inside SmartBots.

## Required server-side configuration

SmartBots / Netlify:
- `NEXOFFICE_SERVICE_KEY` — production secret, Functions scope only.

NexOffice API / Render:
- `SMARTBOTS_BASE_URL=https://smartbots.club`
- `SMARTBOTS_API_KEY` — must match `NEXOFFICE_SERVICE_KEY`.

Never expose either secret to browser code, logs, screenshots, docs, or customer UI.

## Contract

NexOffice calls SmartBots server-to-server with:
- `X-NexOffice-Key`
- `X-NexOffice-Workspace-ID`

SmartBots add-on endpoint:
- `POST /.netlify/functions/nexoffice-addon`
- actions: `status`, `start`, `sync`

Existing approved outbound bridge remains separate:
- `/api/internal/nexoffice/health`
- `/api/internal/nexoffice/bind`
- `/api/internal/nexoffice/message`

## Commercial rules

- Regular SmartBots price: R$ 149/mês.
- Eligible NexOffice subscriber price: R$ 79/mês.
- Private partner price is selected server-side only.
- Removing NexOffice eligibility pauses the benefit/binding but does not delete the SmartBot or its history.

## Security invariants

- No Kapso, WABA, phone-number provider IDs, or client tokens are exposed in NexOffice customer UX.
- Partner handoff is opaque, short-lived, SHA-256 at rest, and single-use.
- Outbound SmartBots messages initiated by NexOffice still require recorded human approval and idempotent dispatch.
- MyDataMed production state must never be reset or replaced during integration validation.
