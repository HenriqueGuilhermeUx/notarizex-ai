alter table public.smartbot_subscriptions
  add column if not exists woovi_correlation_id text,
  add column if not exists woovi_charge_id text,
  add column if not exists woovi_payment_link text,
  add column if not exists woovi_qr_code_image text,
  add column if not exists woovi_br_code text,
  add column if not exists woovi_status text,
  add column if not exists woovi_payload jsonb;

alter table public.smartbot_subscriptions
  alter column plan set default 'Completo',
  alter column amount_cents set default 29700;

create unique index if not exists uq_smartbot_subscriptions_bot_id
  on public.smartbot_subscriptions(bot_id);
create unique index if not exists uq_smartbot_subscriptions_woovi_correlation_id
  on public.smartbot_subscriptions(woovi_correlation_id)
  where woovi_correlation_id is not null;

alter table public.smartbot_subscriptions enable row level security;
revoke all on table public.smartbot_subscriptions from anon, authenticated;
grant all on table public.smartbot_subscriptions to service_role;
