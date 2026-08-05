create table if not exists public.smartbot_mobile_signups (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text not null,
  email text,
  phone text,
  segment text,
  city text,
  source text default 'mobile_app',
  status text default 'new_mobile_signup',
  bot_id text not null,
  client_token text not null,
  mini_site_url text,
  payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_smartbot_mobile_signups_bot_id on public.smartbot_mobile_signups(bot_id);
create index if not exists idx_smartbot_mobile_signups_status on public.smartbot_mobile_signups(status);
create index if not exists idx_smartbot_mobile_signups_email on public.smartbot_mobile_signups(email);

alter table public.smartbot_mobile_signups disable row level security;
grant all on table public.smartbot_mobile_signups to anon;
grant usage, select on all sequences in schema public to anon;
