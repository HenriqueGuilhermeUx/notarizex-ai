create table if not exists public.smartbot_agenda_config (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null unique,
  provider text default 'calcom',
  booking_url text,
  button_label text default 'Agendar horario',
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_smartbot_agenda_config_bot on public.smartbot_agenda_config(bot_id);

alter table public.smartbot_agenda_config disable row level security;
grant all on table public.smartbot_agenda_config to anon;
grant usage, select on all sequences in schema public to anon;
