-- Public comments under lost / found items + "someone commented on your item" notifications
-- Run once in Supabase: SQL Editor -> New query -> paste everything -> Run.

-- 1. Notifications can link to a page (the item that was commented on)
alter table public.notifications add column if not exists link text;

-- 2. Comments table
create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null,
  item_type     text not null check (item_type in ('lost', 'found')),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  author_name   text,
  author_avatar text,
  body          text not null check (char_length(btrim(body)) between 2 and 1000),
  created_at    timestamptz not null default now()
);

create index if not exists comments_item_idx on public.comments (item_id, created_at);

-- 3. Before insert: check the item exists, fill the author's name/photo, fix the time
create or replace function public.comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.item_type = 'lost' and not exists (select 1 from lost_items where id = new.item_id) then
    raise exception 'Item not found';
  elsif new.item_type = 'found' and not exists (select 1 from found_items where id = new.item_id) then
    raise exception 'Item not found';
  end if;

  select full_name, avatar_url into new.author_name, new.author_avatar
    from profiles where id = new.user_id;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists comments_before_insert on public.comments;
create trigger comments_before_insert
  before insert on public.comments
  for each row execute function public.comments_before_insert();

-- 4. After insert: notify the item's owner (not when they comment on their own item)
create or replace function public.comments_notify_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id  uuid;
  item_name text;
  snippet   text;
begin
  if new.item_type = 'lost' then
    select l.user_id, l.item_name into owner_id, item_name from lost_items l where l.id = new.item_id;
  else
    select f.user_id, f.item_name into owner_id, item_name from found_items f where f.id = new.item_id;
  end if;

  if owner_id is null or owner_id = new.user_id then
    return new;
  end if;

  snippet := left(btrim(new.body), 90) || case when char_length(btrim(new.body)) > 90 then '…' else '' end;

  insert into notifications (user_id, title, message, type, link)
  values (
    owner_id,
    'New comment on your item 💬',
    coalesce(new.author_name, 'Someone') || ' commented on "' || coalesce(item_name, 'your item') || '": "' || snippet || '"',
    'new_comment',
    '/item/' || new.item_id
  );
  return new;
end;
$$;

drop trigger if exists comments_notify_owner on public.comments;
create trigger comments_notify_owner
  after insert on public.comments
  for each row execute function public.comments_notify_owner();

-- 5. Row Level Security
alter table public.comments enable row level security;

-- Items are public, so their comments are too
drop policy if exists "comments: anyone can read" on public.comments;
create policy "comments: anyone can read"
  on public.comments for select
  to anon, authenticated
  using (true);

-- Signed-in, non-banned users post as themselves
drop policy if exists "comments: users post as themselves" on public.comments;
create policy "comments: users post as themselves"
  on public.comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not exists (select 1 from profiles p where p.id = auth.uid() and coalesce(p.is_banned, false))
  );

-- Authors delete their own comments; admins can delete any
drop policy if exists "comments: author or admin can delete" on public.comments;
create policy "comments: author or admin can delete"
  on public.comments for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and not coalesce(p.is_banned, false))
  );
-- No UPDATE policy: comments cannot be edited after posting.

-- 6. Live updates
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
  -- Notifications appear live in the bell
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

notify pgrst, 'reload schema';
