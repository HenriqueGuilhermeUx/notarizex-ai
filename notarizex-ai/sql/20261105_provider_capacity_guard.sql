-- SmartBots provider capacity guard and waiting queue
create table if not exists public.smartbot_provider_capacity_queue (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  bot_id text not null,
  company_name text,
  owner_email text,
  status text not null default 'waiting'
    check (status in ('waiting','reserved','released','connected','cancelled')),
  reason text,
  requested_at timestamptz not null default now(),
  reservation_expires_at timestamptz,
  alerted_at timestamptz,
  released_at timestamptz,
  connected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, bot_id)
);

create index if not exists smartbot_provider_capacity_queue_status_idx
  on public.smartbot_provider_capacity_queue(provider,status,requested_at);

alter table public.smartbot_provider_capacity_queue enable row level security;
revoke all on table public.smartbot_provider_capacity_queue from anon, authenticated;
grant select,insert,update,delete on table public.smartbot_provider_capacity_queue to service_role;

create or replace function public.smartbot_reserve_provider_capacity(
  p_provider text,
  p_bot_id text,
  p_company_name text default null,
  p_owner_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_plan text;
  v_connected int := 0;
  v_connecting int := 0;
  v_reserved int := 0;
  v_used int := 0;
  v_has_existing boolean := false;
  v_queue_status text;
  v_result jsonb;
begin
  select connected_number_limit, plan_code
    into v_limit, v_plan
  from public.smartbot_provider_settings
  where provider = p_provider
  for update;

  if v_limit is null or v_limit <= 0 then
    insert into public.smartbot_provider_capacity_queue(provider,bot_id,company_name,owner_email,status,reason,requested_at,updated_at)
    values (p_provider,p_bot_id,p_company_name,p_owner_email,'waiting','capacity_not_configured',now(),now())
    on conflict(provider,bot_id) do update
      set company_name=excluded.company_name,
          owner_email=excluded.owner_email,
          status='waiting',
          reason='capacity_not_configured',
          requested_at=excluded.requested_at,
          reservation_expires_at=null,
          updated_at=now();
    return jsonb_build_object('available',false,'provider',p_provider,'plan',coalesce(v_plan,'unknown'),'limit',coalesce(v_limit,0),'used',0,'remaining',0,'reason','capacity_not_configured');
  end if;

  select exists(
    select 1 from public.smartbot_whatsapp_config
    where bot_id=p_bot_id and provider=p_provider and status in ('connected','connecting')
  ) into v_has_existing;

  if v_has_existing then
    select status into v_queue_status
    from public.smartbot_provider_capacity_queue
    where provider=p_provider and bot_id=p_bot_id;

    if v_queue_status='waiting' then
      update public.smartbot_provider_capacity_queue
      set status='released',released_at=now(),reservation_expires_at=null,updated_at=now()
      where provider=p_provider and bot_id=p_bot_id;
    end if;

    select count(distinct bot_id) filter (where status='connected'),
           count(distinct bot_id) filter (where status='connecting')
      into v_connected, v_connecting
    from public.smartbot_whatsapp_config
    where provider=p_provider and status in ('connected','connecting');

    v_used := coalesce(v_connected,0)+coalesce(v_connecting,0);
    return jsonb_build_object('available',true,'provider',p_provider,'plan',v_plan,'limit',v_limit,'used',v_used,'remaining',greatest(v_limit-v_used,0),'alreadyReserved',true);
  end if;

  update public.smartbot_provider_capacity_queue
    set status='released', released_at=now(), reservation_expires_at=null, updated_at=now()
  where provider=p_provider
    and status='reserved'
    and reservation_expires_at is not null
    and reservation_expires_at <= now();

  select count(distinct bot_id) filter (where status='connected'),
         count(distinct bot_id) filter (where status='connecting')
    into v_connected, v_connecting
  from public.smartbot_whatsapp_config
  where provider=p_provider and status in ('connected','connecting');

  select count(*) into v_reserved
  from public.smartbot_provider_capacity_queue q
  where q.provider=p_provider
    and q.status='reserved'
    and q.reservation_expires_at > now()
    and not exists (
      select 1 from public.smartbot_whatsapp_config w
      where w.provider=p_provider and w.bot_id=q.bot_id and w.status in ('connected','connecting')
    );

  v_used := coalesce(v_connected,0)+coalesce(v_connecting,0)+coalesce(v_reserved,0);

  if v_used < v_limit then
    insert into public.smartbot_provider_capacity_queue(
      provider,bot_id,company_name,owner_email,status,reason,requested_at,reservation_expires_at,released_at,updated_at
    )
    values (
      p_provider,p_bot_id,p_company_name,p_owner_email,'reserved','slot_reserved',now(),now()+interval '15 minutes',null,now()
    )
    on conflict(provider,bot_id) do update
      set company_name=excluded.company_name,
          owner_email=excluded.owner_email,
          status='reserved',
          reason='slot_reserved',
          requested_at=excluded.requested_at,
          reservation_expires_at=excluded.reservation_expires_at,
          released_at=null,
          updated_at=now();

    return jsonb_build_object('available',true,'provider',p_provider,'plan',v_plan,'limit',v_limit,'used',v_used+1,'remaining',greatest(v_limit-(v_used+1),0),'reserved',true);
  end if;

  insert into public.smartbot_provider_capacity_queue(
    provider,bot_id,company_name,owner_email,status,reason,requested_at,reservation_expires_at,updated_at
  )
  values (
    p_provider,p_bot_id,p_company_name,p_owner_email,'waiting','capacity_full',now(),null,now()
  )
  on conflict(provider,bot_id) do update
    set company_name=excluded.company_name,
        owner_email=excluded.owner_email,
        status='waiting',
        reason='capacity_full',
        requested_at=excluded.requested_at,
        reservation_expires_at=null,
        updated_at=now();

  return jsonb_build_object('available',false,'provider',p_provider,'plan',v_plan,'limit',v_limit,'used',v_used,'remaining',0,'reason','capacity_full');
end
$$;

revoke all on function public.smartbot_reserve_provider_capacity(text,text,text,text) from public, anon, authenticated;
grant execute on function public.smartbot_reserve_provider_capacity(text,text,text,text) to service_role;

comment on table public.smartbot_provider_capacity_queue is
  'Internal queue used to prevent customer-facing provider-capacity failures.';
