-- SmartBots Commercial V1 security hardening
-- Prepared 2026-09-23. DO NOT auto-apply without explicit operator approval.
-- Goal: make legacy/public tables server-only and remove PostgREST/GraphQL access
-- from anon/authenticated roles. Netlify Functions that still need the active
-- SmartBots tables must use SUPABASE_SERVICE_ROLE_KEY before this migration runs.

begin;

alter table public.chat_history enable row level security;
alter table public.whatsapp_threads enable row level security;
alter table public.whatsapp_history enable row level security;
alter table public.staff_users enable row level security;
alter table public.staff_history enable row level security;
alter table public.smartbot_campaigns enable row level security;
alter table public.smartbot_imported_contacts enable row level security;

revoke all privileges on table public.chat_history from anon, authenticated;
revoke all privileges on table public.whatsapp_threads from anon, authenticated;
revoke all privileges on table public.whatsapp_history from anon, authenticated;
revoke all privileges on table public.staff_users from anon, authenticated;
revoke all privileges on table public.staff_history from anon, authenticated;
revoke all privileges on table public.smartbot_campaigns from anon, authenticated;
revoke all privileges on table public.smartbot_imported_contacts from anon, authenticated;

-- Preserve explicit server-side access. service_role bypasses RLS, but keeping
-- grants explicit makes the intended boundary auditable.
grant all privileges on table public.chat_history to service_role;
grant all privileges on table public.whatsapp_threads to service_role;
grant all privileges on table public.whatsapp_history to service_role;
grant all privileges on table public.staff_users to service_role;
grant all privileges on table public.staff_history to service_role;
grant all privileges on table public.smartbot_campaigns to service_role;
grant all privileges on table public.smartbot_imported_contacts to service_role;

commit;
