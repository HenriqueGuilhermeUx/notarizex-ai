create extension if not exists pgcrypto;

create table if not exists public.stg_smartbot_scheduling_services (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  name text not null,
  description text,
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 1440),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 240),
  price_cents integer,
  currency text not null default 'BRL',
  required_resource_type text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stg_smartbot_scheduling_resources (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  name text not null,
  resource_type text not null default 'professional',
  timezone text not null default 'America/Sao_Paulo',
  working_hours jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stg_smartbot_scheduling_service_resources (
  service_id uuid not null references public.stg_smartbot_scheduling_services(id) on delete cascade,
  resource_id uuid not null references public.stg_smartbot_scheduling_resources(id) on delete cascade,
  bot_id text not null,
  created_at timestamptz not null default now(),
  primary key (service_id, resource_id)
);

create table if not exists public.stg_smartbot_scheduling_bookings (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  service_id uuid references public.stg_smartbot_scheduling_services(id) on delete set null,
  resource_id uuid references public.stg_smartbot_scheduling_resources(id) on delete set null,
  visitor_id text,
  lead_id bigint,
  customer_name text,
  customer_phone text,
  customer_email text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('requested','confirmed','completed','cancelled','no_show')),
  source text not null default 'smartbots',
  notes text,
  external_reference text,
  recurrence_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.stg_smartbot_scheduling_sessions (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  visitor_id text not null,
  service_id uuid references public.stg_smartbot_scheduling_services(id) on delete set null,
  resource_id uuid references public.stg_smartbot_scheduling_resources(id) on delete set null,
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

create index if not exists idx_stg_sched_services_bot_active on public.stg_smartbot_scheduling_services(bot_id, is_active);
create index if not exists idx_stg_sched_resources_bot_active on public.stg_smartbot_scheduling_resources(bot_id, is_active);
create index if not exists idx_stg_sched_service_resources_bot on public.stg_smartbot_scheduling_service_resources(bot_id, service_id, resource_id);
create index if not exists idx_stg_sched_bookings_bot_start on public.stg_smartbot_scheduling_bookings(bot_id, starts_at);
create index if not exists idx_stg_sched_bookings_resource_range on public.stg_smartbot_scheduling_bookings(resource_id, starts_at, ends_at) where status in ('requested','confirmed');
create index if not exists idx_stg_sched_bookings_visitor on public.stg_smartbot_scheduling_bookings(bot_id, visitor_id, starts_at desc);
create index if not exists idx_stg_sched_sessions_bot_state on public.stg_smartbot_scheduling_sessions(bot_id, state, updated_at desc);
create index if not exists idx_stg_sched_sessions_expiry on public.stg_smartbot_scheduling_sessions(expires_at) where expires_at is not null;

comment on table public.stg_smartbot_scheduling_services is 'Isolated SmartBots Scheduling V1 staging services.';
comment on table public.stg_smartbot_scheduling_resources is 'Isolated SmartBots Scheduling V1 staging resources.';
comment on table public.stg_smartbot_scheduling_bookings is 'Isolated SmartBots Scheduling V1 staging bookings.';
comment on table public.stg_smartbot_scheduling_sessions is 'Isolated SmartBots Scheduling V1 staging conversational sessions.';
