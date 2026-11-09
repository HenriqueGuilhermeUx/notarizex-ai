-- Nexa Telegram Theo: isolated, private, service-role-only records.
-- /start is NOT marketing consent and chat_id is NOT proof of Nexa identity.
-- This migration creates no outbound notification scheduler or financial actions.
CREATE TABLE IF NOT EXISTS public.nexa_telegram_contacts (
  telegram_user_id bigint PRIMARY KEY CHECK (telegram_user_id > 0),
  chat_id bigint NOT NULL UNIQUE CHECK (chat_id > 0),
  first_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','human_needed')),
  service_notice_opt_in boolean NOT NULL DEFAULT false,
  service_notice_opt_in_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nexa_telegram_updates (
  update_id bigint PRIMARY KEY CHECK (update_id >= 0),
  chat_id bigint NOT NULL CHECK (chat_id > 0),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','failed','ignored')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nexa_telegram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id bigint NOT NULL REFERENCES public.nexa_telegram_updates(update_id),
  chat_id bigint NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  content text NOT NULL,
  provider_message_id bigint,
  delivery_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nexa_telegram_messages_chat_time_idx
  ON public.nexa_telegram_messages(chat_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.nexa_telegram_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  category text NOT NULL CHECK(category IN ('support','kyc','privacy','financial_support','general_support')),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS nexa_telegram_handoffs_one_open_per_chat
  ON public.nexa_telegram_handoffs(chat_id) WHERE status='open';

ALTER TABLE public.nexa_telegram_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexa_telegram_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexa_telegram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexa_telegram_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nexa_telegram_contacts, public.nexa_telegram_updates,
  public.nexa_telegram_messages, public.nexa_telegram_handoffs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.nexa_telegram_contacts,
  public.nexa_telegram_updates, public.nexa_telegram_messages, public.nexa_telegram_handoffs TO service_role;
COMMENT ON TABLE public.nexa_telegram_contacts IS
  'Nexa-only Telegram service contacts. No Nexa account link or marketing permission inferred from /start.';
COMMENT ON TABLE public.nexa_telegram_handoffs IS
  'Private Telegram human support queue; not a verified Nexa identity.';
