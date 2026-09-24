create table if not exists public.smartbot_subscriptions (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  customer_email text,
  company_name text,
  plan text not null default 'Completo',
  status text not null default 'pending',
  amount_cents integer not null default 29700,
  billing_cycle text not null default 'monthly',
  current_period_start timestamptz default now(),
  current_period_end timestamptz,
  paid_at timestamptz,
  canceled_at timestamptz,
  notes text,
  woovi_correlation_id text,
  woovi_charge_id text,
  woovi_payment_link text,
  woovi_qr_code_image text,
  woovi_br_code text,
  woovi_status text,
  woovi_payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists uq_smartbot_subscriptions_bot_id on public.smartbot_subscriptions(bot_id);
create index if not exists idx_smartbot_subscriptions_status on public.smartbot_subscriptions(status);
create unique index if not exists uq_smartbot_subscriptions_woovi_correlation_id
  on public.smartbot_subscriptions(woovi_correlation_id)
  where woovi_correlation_id is not null;

alter table public.smartbot_subscriptions enable row level security;
revoke all on table public.smartbot_subscriptions from anon, authenticated;
grant all on table public.smartbot_subscriptions to service_role;
