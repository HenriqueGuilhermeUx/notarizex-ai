alter table if exists public.smartbot_whatsapp_config
  add column if not exists provider_phone_number_id text,
  add column if not exists provider_customer_id text,
  add column if not exists provider_waba_id text,
  add column if not exists connected_at timestamptz;

create index if not exists idx_smartbot_whatsapp_config_provider_phone
  on public.smartbot_whatsapp_config(provider_phone_number_id);
