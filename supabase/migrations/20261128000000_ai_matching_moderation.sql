-- Scam / fake-report detection (flags reviewed by admins in the "Flagged" tab)
-- Run once in Supabase: SQL Editor -> New query -> paste everything -> Run.
-- Needs public.is_admin() from 20261120000000_user_admin_messages.sql (already run).
-- Safe to run more than once.

-- WhatsApp alerts were removed; this drops the columns an earlier version of this file added.
alter table public.profiles drop column if exists whatsapp_phone;
alter table public.profiles drop column if exists whatsapp_alerts;
alter table public.profiles drop column if exists whatsapp_apikey;

-- Scam / spam / fake-report flags, written by the server, reviewed by admins
create table if not exists public.moderation_flags (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('lost', 'found', 'comment')),
  target_id   uuid not null,
  item_id     uuid,                -- the lost/found item the flagged content belongs to (for links)
  user_id     uuid references public.profiles(id) on delete cascade,
  score       int  not null check (score between 0 and 100),
  flags       text[] not null default '{}',
  reason      text,
  excerpt     text,
  status      text not null default 'open' check (status in ('open', 'dismissed', 'removed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (target_type, target_id)
);

create index if not exists moderation_flags_status_idx on public.moderation_flags (status, created_at desc);

alter table public.moderation_flags enable row level security;

-- Only admins can see and review flags. Nobody inserts from the browser:
-- the server writes flags with the secret key, which bypasses RLS.
drop policy if exists "moderation_flags: admins read" on public.moderation_flags;
create policy "moderation_flags: admins read"
  on public.moderation_flags for select
  to authenticated
  using (public.is_admin());

drop policy if exists "moderation_flags: admins review" on public.moderation_flags;
create policy "moderation_flags: admins review"
  on public.moderation_flags for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, update on public.moderation_flags to authenticated;

notify pgrst, 'reload schema';
