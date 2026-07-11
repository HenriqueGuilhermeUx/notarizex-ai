alter table public.smartbot_automation_events alter column status set default 'pending';
alter table public.smartbot_automation_events add column if not exists resolved_at timestamptz;
alter table public.smartbot_automation_events add column if not exists resolved_by text;
alter table public.smartbot_automation_events add column if not exists notes text;

create index if not exists idx_smartbot_automation_status on public.smartbot_automation_events(bot_id,status);
