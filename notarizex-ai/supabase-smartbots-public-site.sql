alter table if exists website_bots add column if not exists public_title text;
alter table if exists website_bots add column if not exists public_subtitle text;
alter table if exists website_bots add column if not exists public_cta text;
alter table if exists website_bots add column if not exists public_theme text default 'dark';
alter table if exists website_bots add column if not exists public_slug text;
