# Kapso Capacity Guard V1

Operational behavior:
- checks configured Kapso connected-number capacity before starting new WhatsApp onboarding
- existing connected bot is not blocked
- new onboarding is stopped before Meta when provider capacity is exhausted
- an internal provider incident is recorded and an operational alert is attempted

No secrets are stored in this file.
