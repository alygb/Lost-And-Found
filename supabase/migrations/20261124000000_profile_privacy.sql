-- Profile privacy + protection of admin-only fields
-- Run once in Supabase: SQL Editor -> New query -> paste everything -> Run.
-- Needs public.is_admin() from 20261120000000_user_admin_messages.sql (already run).

-- 1. Only you (and admins) can read your full profile row (email, role, ban status...)
alter table public.profiles enable row level security;

do $$
declare p record;
begin
  -- Remove every existing read policy (some allowed anyone to read all emails)
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end;
$$;

create policy "profiles: read own or admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- Users can create and edit their own row (register, name, avatar)
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2. Public, safe subset for item pages and comments: name, photo, admin badge. No email.
create or replace view public.public_profiles as
  select id, full_name, avatar_url, (role = 'admin') as is_admin
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- 3. Nobody but an admin (or the server / SQL editor) may change role, ban or super-admin flags
create or replace function public.profiles_protect_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the server's secret key, auth triggers and the SQL editor
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'student';
    new.is_banned := false;
    new.is_super_admin := false;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_banned is distinct from old.is_banned
     or new.is_super_admin is distinct from old.is_super_admin then
    raise exception 'Only an admin can change role or ban status';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before insert or update on public.profiles
  for each row execute function public.profiles_protect_fields();

notify pgrst, 'reload schema';
