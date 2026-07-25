create table if not exists public.smartbot_prospects (
  id uuid primary key default gen_random_uuid(),
  source text default 'apify',
  segment text,
  city text,
  business_name text,
  phone text,
  email text,
  website text,
  instagram text,
  address text,
  rating text,
  notes text,
  status text default 'novo',
  payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.smartbot_instagram_audits (
  id uuid primary key default gen_random_uuid(),
  instagram text not null,
  business_name text,
  score int,
  diagnosis text,
  suggestions text,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_smartbot_prospects_status on public.smartbot_prospects(status);
create index if not exists idx_smartbot_prospects_segment_city on public.smartbot_prospects(segment, city);
create index if not exists idx_smartbot_instagram_audits_instagram on public.smartbot_instagram_audits(instagram);

alter table public.smartbot_prospects disable row level security;
alter table public.smartbot_instagram_audits disable row level security;

grant all on table public.smartbot_prospects to anon;
grant all on table public.smartbot_instagram_audits to anon;
grant usage, select on all sequences in schema public to anon;
