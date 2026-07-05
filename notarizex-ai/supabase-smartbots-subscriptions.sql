create table if not exists public.smartbot_subscriptions (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  customer_email text,
  company_name text,
  plan text not null default 'Profissional',
  status text not null default 'pending',
  amount_cents integer not null default 7900,
  billing_cycle text not null default 'monthly',
  current_period_start timestamptz default now(),
  current_period_end timestamptz,
  paid_at timestamptz,
  canceled_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_smartbot_subscriptions_bot_id on public.smartbot_subscriptions(bot_id);
create index if not exists idx_smartbot_subscriptions_status on public.smartbot_subscriptions(status);

alter table public.smartbot_subscriptions disable row level security;
grant all on table public.smartbot_subscriptions to anon;
grant usage, select on all sequences in schema public to anon;
