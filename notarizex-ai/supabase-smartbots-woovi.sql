alter table public.smartbot_subscriptions add column if not exists woovi_correlation_id text;
alter table public.smartbot_subscriptions add column if not exists woovi_charge_id text;
alter table public.smartbot_subscriptions add column if not exists woovi_payment_link text;
alter table public.smartbot_subscriptions add column if not exists woovi_qr_code_image text;
alter table public.smartbot_subscriptions add column if not exists woovi_br_code text;
alter table public.smartbot_subscriptions add column if not exists woovi_status text;
alter table public.smartbot_subscriptions add column if not exists woovi_payload jsonb;
create index if not exists idx_smartbot_subscriptions_woovi_correlation on public.smartbot_subscriptions(woovi_correlation_id);
