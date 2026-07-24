create extension if not exists pgcrypto;

create table if not exists public.partner_smartbots_intakes (
  id uuid primary key default gen_random_uuid(),
  partner text not null default 'modo' check (partner = 'modo'),
  plan text not null default 'presenca' check (plan = 'presenca'),
  product text not null default 'smartbots_assisted',
  status text not null default 'pending_setup' check (
    status in (
      'pending_setup',
      'reviewing',
      'waiting_customer',
      'building',
      'testing',
      'active',
      'paused',
      'cancelled'
    )
  ),
  business_name text not null,
  owner_name text not null,
  email text not null,
  phone text not null,
  instagram text,
  website text,
  segment text not null,
  services text,
  opening_hours text,
  faq text,
  prices text,
  welcome_message text,
  google_review_link text,
  notes text,
  consent_accepted boolean not null default false,
  consent_accepted_at timestamptz,
  source text not null default 'modo_onboarding',
  idempotency_key text not null unique,
  assigned_to text,
  internal_notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_smartbots_intakes_status_idx
  on public.partner_smartbots_intakes (status, created_at desc);

create index if not exists partner_smartbots_intakes_email_idx
  on public.partner_smartbots_intakes (lower(email));

alter table public.partner_smartbots_intakes enable row level security;

comment on table public.partner_smartbots_intakes is
  'Fila de implantação do SmartBots Assistido recebida de parceiros, inicialmente Modo Presença.';
