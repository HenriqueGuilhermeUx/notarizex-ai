# Woovi Billing Readiness V1

Billing code is aligned with the current Woovi API:
- production API host: api.woovi.com
- AppID is sent raw in the Authorization header
- webhook verification secret is required
- SmartBots commercial prices remain R$ 99 founder / R$ 149 regular

The Woovi AppID itself must be configured as a secret environment variable before live Pix charges can be created.

No credentials are stored in this file.
