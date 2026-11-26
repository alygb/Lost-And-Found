-- Map location for lost / found reports (pin, area circle, or route between two places)
-- Run once in Supabase: SQL Editor -> New query -> paste everything -> Run.
-- Format: {"mode":"point"|"area"|"route","points":[[lat,lng],...],"radius":metres}

alter table public.lost_items  add column if not exists map_location jsonb;
alter table public.found_items add column if not exists map_location jsonb;

notify pgrst, 'reload schema';
