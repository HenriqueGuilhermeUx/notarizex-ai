create table if not exists public.smartbot_whatsapp_config (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null unique,
  mode text not null default 'assisted',
  provider text not null default 'manual',
  phone text,
  business_name text,
  greeting text,
  away_message text,
  human_message text,
  auto_reply boolean default false,
  webhook_url text,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.smartbot_whatsapp_inbox (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  contact_phone text,
  contact_name text,
  last_message text,
  intent text,
  status text default 'new',
  source text default 'whatsapp',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.smartbot_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  inbox_id uuid,
  direction text not null default 'inbound',
  contact_phone text,
  contact_name text,
  message text,
  provider text,
  provider_message_id text,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_smartbot_whatsapp_config_bot on public.smartbot_whatsapp_config(bot_id);
create index if not exists idx_smartbot_whatsapp_inbox_bot on public.smartbot_whatsapp_inbox(bot_id);
create index if not exists idx_smartbot_whatsapp_messages_bot on public.smartbot_whatsapp_messages(bot_id);

alter table public.smartbot_whatsapp_config disable row level security;
alter table public.smartbot_whatsapp_inbox disable row level security;
alter table public.smartbot_whatsapp_messages disable row level security;

grant all on table public.smartbot_whatsapp_config to anon;
grant all on table public.smartbot_whatsapp_inbox to anon;
grant all on table public.smartbot_whatsapp_messages to anon;
grant usage, select on all sequences in schema public to anon;
