create extension if not exists btree_gist;

alter table public.stg_smartbot_scheduling_bookings
  drop constraint if exists stg_smartbot_scheduling_bookings_no_overlap;

alter table public.stg_smartbot_scheduling_bookings
  add constraint stg_smartbot_scheduling_bookings_no_overlap
  exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('requested','confirmed') and resource_id is not null);

comment on constraint stg_smartbot_scheduling_bookings_no_overlap on public.stg_smartbot_scheduling_bookings
  is 'Staging guard against concurrent active bookings for the same resource.';
