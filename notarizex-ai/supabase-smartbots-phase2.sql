create table if not exists public.smartbot_conversations (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  visitor_id text not null,
  channel text default 'site',
  customer_name text,
  customer_phone text,
  customer_email text,
  intent text,
  status text default 'open',
  last_message text,
  last_reply text,
  lead_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.smartbot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.smartbot_conversations(id) on delete cascade,
  bot_id text not null,
  visitor_id text,
  role text not null,
  content text not null,
  intent text,
  created_at timestamptz default now()
);

create table if not exists public.smartbot_knowledge (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  title text default 'Base principal',
  content text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.smartbot_automation_events (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  conversation_id uuid,
  lead_id uuid,
  event_type text not null,
  payload jsonb,
  status text default 'done',
  created_at timestamptz default now()
);

create index if not exists idx_smartbot_conversations_bot on public.smartbot_conversations(bot_id);
create index if not exists idx_smartbot_conversations_visitor on public.smartbot_conversations(bot_id, visitor_id);
create index if not exists idx_smartbot_messages_conversation on public.smartbot_messages(conversation_id);
create index if not exists idx_smartbot_knowledge_bot on public.smartbot_knowledge(bot_id);
create index if not exists idx_smartbot_automation_bot on public.smartbot_automation_events(bot_id);

alter table public.smartbot_conversations disable row level security;
alter table public.smartbot_messages disable row level security;
alter table public.smartbot_knowledge disable row level security;
alter table public.smartbot_automation_events disable row level security;

grant all on table public.smartbot_conversations to anon;
grant all on table public.smartbot_messages to anon;
grant all on table public.smartbot_knowledge to anon;
grant all on table public.smartbot_automation_events to anon;
grant usage, select on all sequences in schema public to anon;
