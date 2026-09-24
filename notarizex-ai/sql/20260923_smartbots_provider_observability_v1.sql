create table if not exists public.smartbot_provider_incidents (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  bot_id text,
  operation text not null,
  category text not null,
  severity text not null default 'warning',
  status_code integer,
  error_code text,
  error_message text,
  fingerprint text not null,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  alerted_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_incidents_open
  on public.smartbot_provider_incidents(provider, resolved_at, last_seen_at desc);
create index if not exists idx_provider_incidents_fingerprint
  on public.smartbot_provider_incidents(provider, fingerprint, last_seen_at desc);

create table if not exists public.smartbot_provider_settings (
  provider text primary key,
  plan_code text not null,
  connected_number_limit integer,
  monthly_message_limit bigint,
  alert_threshold_percent integer not null default 80,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.smartbot_provider_settings(
  provider, plan_code, connected_number_limit, monthly_message_limit,
  alert_threshold_percent, notes, updated_at
)
values (
  'kapso', 'free', 1, 2000, 80,
  'Kapso published limits checked 2026-09-23; update this row when upgrading plan.',
  now()
)
on conflict (provider) do update set
  plan_code=excluded.plan_code,
  connected_number_limit=excluded.connected_number_limit,
  monthly_message_limit=excluded.monthly_message_limit,
  alert_threshold_percent=excluded.alert_threshold_percent,
  notes=excluded.notes,
  updated_at=now();

alter table public.smartbot_provider_incidents enable row level security;
alter table public.smartbot_provider_settings enable row level security;
revoke all on table public.smartbot_provider_incidents from anon, authenticated;
revoke all on table public.smartbot_provider_settings from anon, authenticated;
grant select, insert, update, delete on table public.smartbot_provider_incidents to service_role;
grant select, insert, update, delete on table public.smartbot_provider_settings to service_role;
