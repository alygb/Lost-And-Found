-- User <-> Admin private messaging
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Privacy model (enforced by Postgres Row Level Security, not just the UI):
--   * Every conversation belongs to exactly one regular user (messages.user_id).
--   * That user can read and write only their own conversation.
--   * Admins (profiles.role = 'admin', not banned) can read and reply to every conversation.
--   * Other users can never read someone else's messages.
--   * Nobody can edit or delete a message after sending it.

-- 1. Helper: is the current user an active admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(is_banned, false) = false
  );
$$;

-- 2. Messages table
create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade, -- owner of the conversation
  sender_id     uuid not null references public.profiles(id) on delete cascade, -- who wrote this message
  body          text not null check (char_length(btrim(body)) between 1 and 2000),
  read_by_user  boolean not null default false,
  read_by_admin boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists messages_user_id_created_at_idx
  on public.messages (user_id, created_at);

-- 3. The sender has obviously read their own message
create or replace function public.messages_set_read_flags()
returns trigger
language plpgsql
as $$
begin
  if new.sender_id = new.user_id then
    new.read_by_user := true;
    new.read_by_admin := false;
  else
    new.read_by_admin := true;
    new.read_by_user := false;
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists messages_set_read_flags on public.messages;
create trigger messages_set_read_flags
  before insert on public.messages
  for each row execute function public.messages_set_read_flags();

-- 4. Row Level Security
alter table public.messages enable row level security;

drop policy if exists "messages: owner or admin can read" on public.messages;
create policy "messages: owner or admin can read"
  on public.messages for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "messages: owner or admin can send" on public.messages;
create policy "messages: owner or admin can send"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or (
        user_id = auth.uid()
        and not exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and coalesce(p.is_banned, false) = true
        )
      )
    )
  );

-- No UPDATE or DELETE policies: messages are immutable for everyone.
-- Read receipts go through the function below instead.

-- 5. Mark a conversation as read (user marks admin replies, admin marks user messages)
create or replace function public.mark_messages_read(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  elsif auth.uid() = p_user_id then
    update public.messages
       set read_by_user = true
     where user_id = p_user_id and read_by_user = false;
  elsif public.is_admin() then
    update public.messages
       set read_by_admin = true
     where user_id = p_user_id and read_by_admin = false;
  end if;
end;
$$;

revoke all on function public.mark_messages_read(uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 6. Live updates (Supabase Realtime respects the RLS policies above)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- 7. Tell the Supabase API about the new table right away
notify pgrst, 'reload schema';
