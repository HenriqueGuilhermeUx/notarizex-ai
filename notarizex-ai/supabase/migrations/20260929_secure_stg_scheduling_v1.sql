alter table public.stg_smartbot_scheduling_services enable row level security;
alter table public.stg_smartbot_scheduling_resources enable row level security;
alter table public.stg_smartbot_scheduling_service_resources enable row level security;
alter table public.stg_smartbot_scheduling_bookings enable row level security;
alter table public.stg_smartbot_scheduling_sessions enable row level security;

revoke all on table public.stg_smartbot_scheduling_services from anon, authenticated;
revoke all on table public.stg_smartbot_scheduling_resources from anon, authenticated;
revoke all on table public.stg_smartbot_scheduling_service_resources from anon, authenticated;
revoke all on table public.stg_smartbot_scheduling_bookings from anon, authenticated;
revoke all on table public.stg_smartbot_scheduling_sessions from anon, authenticated;
