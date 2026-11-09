-- Nexa-only WhatsApp STOP/SAIR suppression; NEVER an opt-in list.
-- Keep this isolated from SmartBots generic clients and the Nexa user ledger.
-- Required by Kapso webhook before acknowledging an opt-out.
CREATE TABLE IF NOT EXISTS public.nexa_whatsapp_suppression (
  bot_id text NOT NULL CHECK (bot_id = 'site-nexa-20260923-live'),
  contact_phone text NOT NULL CHECK (contact_phone ~ '^[0-9]{8,20}$'),
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'whatsapp_inbound_stop'
    CHECK (source = 'whatsapp_inbound_stop'),
  provider_message_id text NOT NULL,
  PRIMARY KEY (bot_id, contact_phone)
);
ALTER TABLE public.nexa_whatsapp_suppression ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nexa_whatsapp_suppression FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.nexa_whatsapp_suppression TO service_role;
COMMENT ON TABLE public.nexa_whatsapp_suppression IS
  'Nexa WhatsApp opt-out suppression; service role only. Never grants permission to send messages.';
