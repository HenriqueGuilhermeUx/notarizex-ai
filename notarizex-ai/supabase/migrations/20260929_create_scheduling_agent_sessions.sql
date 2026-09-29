create table if not exists public.smartbot_scheduling_sessions (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  visitor_id text not null,
  service_id uuid references public.smartbot_scheduling_services(id) on delete set null,
  resource_id uuid references public.smartbot_scheduling_resources(id) on delete set null,
  state text not null default 'collecting' check (state in ('collecting','offered','confirmed','cancelled','expired')),
  requested_text text,
  offered_slots jsonb not null default '[]'::jsonb,
  customer_name text,
  customer_phone text,
  customer_email text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bot_id, visitor_id)
);

create index if not exists idx_sched_sessions_bot_state on public.smartbot_scheduling_sessions(bot_id, state, updated_at desc);
create index if not exists idx_sched_sessions_expiry on public.smartbot_scheduling_sessions(expires_at) where expires_at is not null;

comment on table public.smartbot_scheduling_sessions is 'Short-lived conversational state used by SmartBots to offer and confirm scheduling slots.';
