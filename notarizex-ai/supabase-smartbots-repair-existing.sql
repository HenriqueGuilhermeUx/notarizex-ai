-- SmartBots.club — reparo para tabelas antigas existentes no Supabase
-- Objetivo: manter dados existentes e tornar o banco compatível com o novo fluxo self-service.

-- 1) Tabelas operacionais do MVP sem RLS por enquanto.
alter table if exists website_bots disable row level security;
alter table if exists whatsapp_bots disable row level security;
alter table if exists bot_training_files disable row level security;
alter table if exists chat_history disable row level security;
alter table if exists smartbot_leads disable row level security;

-- 2) website_bots: campos que podem nascer pendentes.
alter table if exists website_bots alter column assistant_id drop not null;
alter table if exists website_bots alter column vector_store_id drop not null;
alter table if exists website_bots alter column file_ids drop not null;
alter table if exists website_bots alter column content_options drop not null;
alter table if exists website_bots alter column payment_link drop not null;
alter table if exists website_bots alter column owner_email drop not null;

alter table if exists website_bots alter column status set default 'pending_payment';
alter table if exists website_bots alter column bot_tone set default 'friendly';
alter table if exists website_bots alter column bot_language set default 'pt';
alter table if exists website_bots alter column plan set default 'site';

-- 3) whatsapp_bots: campos que podem nascer pendentes antes da conexão com WhatsApp/IA.
alter table if exists whatsapp_bots alter column assistant_id drop not null;
alter table if exists whatsapp_bots alter column vector_store_id drop not null;
alter table if exists whatsapp_bots alter column file_ids drop not null;
alter table if exists whatsapp_bots alter column payment_link drop not null;
alter table if exists whatsapp_bots alter column phone_number drop not null;
alter table if exists whatsapp_bots alter column website drop not null;

alter table if exists whatsapp_bots alter column status set default 'pending_payment';

-- 4) chat_history: thread_id não deve ser obrigatório no MVP.
alter table if exists chat_history alter column thread_id drop not null;
alter table if exists chat_history alter column bot_response drop not null;
alter table if exists chat_history alter column user_identifier drop not null;

-- 5) bot_training_files: openai_file_id pode ficar nulo quando o arquivo ainda não foi enviado para IA.
alter table if exists bot_training_files alter column openai_file_id drop not null;
alter table if exists bot_training_files alter column file_size_bytes set default 0;
alter table if exists bot_training_files alter column status set default 'active';

-- 6) smartbot_leads já usa identity column no Supabase.
-- Não mexer no default do id.

-- 7) Garantir colunas novas do cérebro do bot.
alter table if exists website_bots add column if not exists knowledge_text text;
alter table if exists website_bots add column if not exists knowledge_status text;
alter table if exists website_bots add column if not exists uploaded_file_name text;
alter table if exists website_bots add column if not exists uploaded_file_mime text;
alter table if exists website_bots add column if not exists uploaded_file_size_bytes bigint;
alter table if exists website_bots add column if not exists uploaded_file_base64 text;

alter table if exists whatsapp_bots add column if not exists knowledge_text text;
alter table if exists whatsapp_bots add column if not exists knowledge_status text;
alter table if exists whatsapp_bots add column if not exists uploaded_file_name text;
alter table if exists whatsapp_bots add column if not exists uploaded_file_mime text;
alter table if exists whatsapp_bots add column if not exists uploaded_file_size_bytes bigint;
alter table if exists whatsapp_bots add column if not exists uploaded_file_base64 text;
