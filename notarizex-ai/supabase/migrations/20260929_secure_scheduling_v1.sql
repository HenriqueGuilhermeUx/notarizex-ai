alter table public.smartbot_scheduling_services enable row level security;
alter table public.smartbot_scheduling_resources enable row level security;
alter table public.smartbot_scheduling_service_resources enable row level security;
alter table public.smartbot_scheduling_bookings enable row level security;
alter table public.smartbot_scheduling_sessions enable row level security;

revoke all on public.smartbot_scheduling_services from anon, authenticated;
revoke all on public.smartbot_scheduling_resources from anon, authenticated;
revoke all on public.smartbot_scheduling_service_resources from anon, authenticated;
revoke all on public.smartbot_scheduling_bookings from anon, authenticated;
revoke all on public.smartbot_scheduling_sessions from anon, authenticated;

comment on table public.smartbot_scheduling_services is 'Scheduling domain: server-side access only; tenant isolation enforced by application bot_id.';
comment on table public.smartbot_scheduling_resources is 'Scheduling resources: server-side access only.';
comment on table public.smartbot_scheduling_service_resources is 'Scheduling service-resource links: server-side access only.';
comment on table public.smartbot_scheduling_bookings is 'Scheduling bookings: server-side access only.';
comment on table public.smartbot_scheduling_sessions is 'Scheduling conversational sessions: server-side access only.';
