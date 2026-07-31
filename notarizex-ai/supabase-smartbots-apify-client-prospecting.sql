alter table public.smartbot_prospects add column if not exists bot_id text;
alter table public.smartbot_prospects add column if not exists target_audience text;
alter table public.smartbot_prospects add column if not exists use_case text default 'client_prospecting';
alter table public.smartbot_prospects add column if not exists owner_notes text;

create index if not exists idx_smartbot_prospects_bot on public.smartbot_prospects(bot_id);
create index if not exists idx_smartbot_prospects_use_case on public.smartbot_prospects(use_case);
