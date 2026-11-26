-- Areas (towns / tehsils) for every AJK district, so the "Area" dropdown works.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once: it never creates duplicates.

-- 1. Make sure the table exists (it normally already does)
create table if not exists public.areas (
  id          bigserial primary key,
  district_id bigint not null references public.districts(id) on delete cascade,
  name        text not null,
  category    text
);

create index if not exists areas_district_id_idx on public.areas (district_id);

-- 2. Everyone may READ the list of areas (it is public reference data).
--    Without this policy Row Level Security hides every row and the dropdown stays disabled.
alter table public.areas enable row level security;

drop policy if exists "areas: anyone can read" on public.areas;
create policy "areas: anyone can read"
  on public.areas for select
  to anon, authenticated
  using (true);

grant select on public.areas to anon, authenticated;

-- 3. Add the areas (matched to districts by name, skipped if already there)
insert into public.areas (district_id, name, category)
select d.id, v.area, v.category
from (values
  -- Muzaffarabad division
  ('Muzaffarabad', 'Muzaffarabad City', 'City'),
  ('Muzaffarabad', 'Chattar', 'Area'),
  ('Muzaffarabad', 'Upper Adda', 'Area'),
  ('Muzaffarabad', 'Lower Plate', 'Area'),
  ('Muzaffarabad', 'Domel', 'Area'),
  ('Muzaffarabad', 'Chella Bandi', 'Area'),
  ('Muzaffarabad', 'Gojra', 'Area'),
  ('Muzaffarabad', 'Tariqabad', 'Area'),
  ('Muzaffarabad', 'Ambore', 'Area'),
  ('Muzaffarabad', 'Pattika (Naseerabad)', 'Tehsil'),
  ('Muzaffarabad', 'Garhi Dupatta', 'Town'),
  ('Muzaffarabad', 'Kohala', 'Town'),

  ('Hattian Bala', 'Hattian Bala', 'Town'),
  ('Hattian Bala', 'Chikar', 'Town'),
  ('Hattian Bala', 'Leepa', 'Tehsil'),
  ('Hattian Bala', 'Chinari', 'Town'),
  ('Hattian Bala', 'Chakothi', 'Town'),

  ('Neelum', 'Athmuqam', 'Town'),
  ('Neelum', 'Sharda', 'Tehsil'),
  ('Neelum', 'Kel', 'Town'),
  ('Neelum', 'Keran', 'Town'),
  ('Neelum', 'Dudhnial', 'Town'),
  ('Neelum', 'Kundal Shahi', 'Town'),
  ('Neelum', 'Arang Kel', 'Tourist spot'),
  ('Neelum', 'Taobat', 'Town'),

  -- Poonch division
  ('Poonch (Rawalakot)', 'Rawalakot City', 'City'),
  ('Poonch (Rawalakot)', 'Hajira', 'Tehsil'),
  ('Poonch (Rawalakot)', 'Abbaspur', 'Tehsil'),
  ('Poonch (Rawalakot)', 'Thorar', 'Town'),
  ('Poonch (Rawalakot)', 'Banjosa', 'Tourist spot'),
  ('Poonch (Rawalakot)', 'Khaigala', 'Town'),
  ('Poonch (Rawalakot)', 'Toli Pir', 'Tourist spot'),
  ('Poonch (Rawalakot)', 'Paniola', 'Town'),

  ('Bagh', 'Bagh City', 'City'),
  ('Bagh', 'Dhirkot', 'Tehsil'),
  ('Bagh', 'Harighel', 'Town'),
  ('Bagh', 'Rera', 'Town'),
  ('Bagh', 'Sudhan Gali', 'Tourist spot'),
  ('Bagh', 'Arja', 'Town'),
  ('Bagh', 'Birpani', 'Town'),

  ('Sudhnoti', 'Pallandri', 'City'),
  ('Sudhnoti', 'Trarkhal', 'Tehsil'),
  ('Sudhnoti', 'Mang', 'Tehsil'),
  ('Sudhnoti', 'Baloch', 'Tehsil'),
  ('Sudhnoti', 'Azad Pattan', 'Town'),

  ('Haveli', 'Forward Kahuta', 'Town'),
  ('Haveli', 'Khurshidabad', 'Tehsil'),

  -- Mirpur division
  ('Mirpur', 'Mirpur City', 'City'),
  ('Mirpur', 'New City Mirpur', 'Area'),
  ('Mirpur', 'Dadyal', 'Tehsil'),
  ('Mirpur', 'Islamgarh', 'Town'),
  ('Mirpur', 'Chakswari', 'Town'),
  ('Mirpur', 'Khari Sharif', 'Town'),
  ('Mirpur', 'Mangla', 'Town'),

  ('Kotli', 'Kotli City', 'City'),
  ('Kotli', 'Sehnsa', 'Tehsil'),
  ('Kotli', 'Fatehpur Thakiala (Nakyal)', 'Tehsil'),
  ('Kotli', 'Khuiratta', 'Tehsil'),
  ('Kotli', 'Charhoi', 'Tehsil'),
  ('Kotli', 'Dhanna', 'Town'),
  ('Kotli', 'Tatta Pani', 'Town'),
  ('Kotli', 'Gulpur', 'Town'),

  ('Bhimber', 'Bhimber City', 'City'),
  ('Bhimber', 'Barnala', 'Tehsil'),
  ('Bhimber', 'Samahni', 'Tehsil')
) as v(district, area, category)
join public.districts d on lower(d.name) = lower(v.district)
where not exists (
  select 1 from public.areas a
  where a.district_id = d.id and lower(a.name) = lower(v.area)
);

notify pgrst, 'reload schema';

-- Check: how many areas each district has now
select d.name as district, count(a.id) as areas
from public.districts d
left join public.areas a on a.district_id = d.id
group by d.id, d.name
order by d.id;
