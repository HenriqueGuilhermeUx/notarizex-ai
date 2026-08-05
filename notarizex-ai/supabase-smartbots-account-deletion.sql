create table if not exists public.smartbot_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  app_name text default 'SmartBots Hoje',
  package_name text default 'club.smartbots.app',
  name text,
  email text,
  phone text,
  bot_id text,
  reason text,
  status text default 'requested',
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_smartbot_account_deletion_status on public.smartbot_account_deletion_requests(status);
create index if not exists idx_smartbot_account_deletion_email on public.smartbot_account_deletion_requests(email);
create index if not exists idx_smartbot_account_deletion_bot_id on public.smartbot_account_deletion_requests(bot_id);

alter table public.smartbot_account_deletion_requests disable row level security;
grant all on table public.smartbot_account_deletion_requests to anon;
grant usage, select on all sequences in schema public to anon;
