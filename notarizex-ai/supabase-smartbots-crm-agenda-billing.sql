-- SmartBots.club — CRM Invisível + Agenda + Trial/Pix
-- Rode no Supabase SQL Editor.

alter table if exists smartbot_leads add column if not exists pipeline_status text default 'novo';
alter table if exists smartbot_leads add column if not exists return_at timestamptz;
alter table if exists smartbot_leads add column if not exists service_name text;
alter table if exists smartbot_leads add column if not exists origin text default 'bot';
alter table if exists smartbot_leads add column if not exists referred_by text;
alter table if exists smartbot_leads add column if not exists owner_notes text;
alter table if exists smartbot_leads add column if not exists last_action_at timestamptz;

alter table if exists website_bots add column if not exists trial_started_at timestamptz default now();
alter table if exists website_bots add column if not exists trial_ends_at timestamptz default (now() + interval '7 days');
alter table if exists website_bots add column if not exists billing_status text default 'trial';
alter table if exists website_bots add column if not exists pix_charge_id text;
alter table if exists website_bots add column if not exists pix_payment_link text;
alter table if exists website_bots add column if not exists pix_br_code text;
alter table if exists website_bots add column if not exists pix_qr_code_image text;

create table if not exists smartbot_appointments (
  id bigserial primary key,
  bot_id text not null,
  lead_id bigint,
  customer_name text,
  customer_phone text,
  customer_email text,
  service_name text,
  appointment_at timestamptz,
  duration_minutes integer default 60,
  status text default 'solicitado',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists smartbot_campaigns (
  id bigserial primary key,
  bot_id text not null,
  name text not null,
  campaign_type text default 'reativacao',
  audience_count integer default 0,
  suggested_message text,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists smartbot_imported_contacts (
  id bigserial primary key,
  bot_id text not null,
  name text,
  phone text,
  email text,
  interest text,
  notes text,
  origin text default 'csv',
  pipeline_status text default 'reativacao',
  created_at timestamptz default now()
);

create index if not exists idx_smartbot_leads_bot_status on smartbot_leads(bot_id, pipeline_status);
create index if not exists idx_smartbot_leads_return_at on smartbot_leads(bot_id, return_at);
create index if not exists idx_smartbot_appointments_bot_date on smartbot_appointments(bot_id, appointment_at);
create index if not exists idx_smartbot_imported_contacts_bot on smartbot_imported_contacts(bot_id);

alter table if exists smartbot_leads disable row level security;
alter table if exists smartbot_appointments disable row level security;
alter table if exists smartbot_campaigns disable row level security;
alter table if exists smartbot_imported_contacts disable row level security;
