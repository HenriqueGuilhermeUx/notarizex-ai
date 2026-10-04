-- SmartBots MiniSite V1
create table if not exists public.smartbot_minisites (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null unique,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  theme text not null default 'aurora',
  accent_color text not null default '#00ff88',
  logo_url text,
  hero_image_url text,
  eyebrow text,
  title text not null default '',
  subtitle text,
  about_title text,
  about_text text,
  primary_cta_label text not null default 'Falar agora',
  primary_cta_kind text not null default 'chat' check (primary_cta_kind in ('chat','whatsapp','agenda','link')),
  primary_cta_url text,
  secondary_cta_label text,
  secondary_cta_url text,
  sections jsonb not null default '[]'::jsonb,
  faq jsonb not null default '[]'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  source_website text,
  source_snapshot jsonb not null default '{}'::jsonb,
  published_snapshot jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smartbot_minisites_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?
);

create index if not exists smartbot_minisites_status_idx on public.smartbot_minisites(status);
create index if not exists smartbot_minisites_updated_at_idx on public.smartbot_minisites(updated_at desc);

alter table public.smartbot_minisites enable row level security;
revoke all on table public.smartbot_minisites from anon, authenticated;
grant select, insert, update, delete on table public.smartbot_minisites to service_role;

comment on table public.smartbot_minisites is 'Public MiniSite configuration per isolated SmartBot. Browser clients access it only through server-side Functions.';
)
);

create index if not exists smartbot_minisites_status_idx on public.smartbot_minisites(status);
create index if not exists smartbot_minisites_updated_at_idx on public.smartbot_minisites(updated_at desc);

alter table public.smartbot_minisites enable row level security;
revoke all on table public.smartbot_minisites from anon, authenticated;
grant select, insert, update, delete on table public.smartbot_minisites to service_role;

comment on table public.smartbot_minisites is 'Public MiniSite configuration per isolated SmartBot. Browser clients access it only through server-side Functions.';
