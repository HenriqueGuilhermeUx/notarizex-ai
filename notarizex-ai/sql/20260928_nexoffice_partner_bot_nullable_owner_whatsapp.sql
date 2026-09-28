-- SmartBots · NexOffice partner provisioning compatibility
-- The NexOffice add-on creates the SmartBot before WhatsApp is connected.
-- Self-service onboarding still requires WhatsApp at the application layer,
-- but partner provisioning must allow this field to be completed during handoff.

alter table if exists public.website_bots
  alter column owner_whatsapp drop not null;
