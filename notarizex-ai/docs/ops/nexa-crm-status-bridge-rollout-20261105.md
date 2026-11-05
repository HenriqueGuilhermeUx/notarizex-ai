# Nexa CRM SmartBots status bridge

The GET `/.netlify/functions/nexa-crm-status-bridge` endpoint returns only Nexa bot connection metadata to the Nexa backend. It requires a dedicated `NEXA_CRM_BRIDGE_TOKEN` set as a Netlify Functions production secret and a matching `NEXA_CRM_SMARTBOTS_BRIDGE_TOKEN` on the Nexa Render backend.

The Nexa backend uses `NEXA_CRM_SMARTBOTS_READ_ENABLED=true` and `NEXA_CRM_SMARTBOTS_BRIDGE_URL=https://smartbots.club/.netlify/functions/nexa-crm-status-bridge`.

No chat messages, PII, customer links, outbound messaging, Kapso webhook routing, or auto_reply settings are changed by this integration. Validate unauthorized GET returns 401 and authenticated response returns only the expected bot metadata. Never record the token in GitHub.
