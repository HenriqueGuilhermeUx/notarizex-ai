alter table public.smartbot_subscriptions
  alter column plan set default 'completo',
  alter column amount_cents set default 14900;
