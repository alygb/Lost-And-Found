-- AI-generated image tags for lost & found reports
-- Run once in Supabase: SQL Editor -> New query -> paste everything -> Run.
--
-- ai_image_urls   : the photos of this report that the reporter confirmed are AI-generated.
--                   Every viewer sees an "AI image" tag on these photos.
-- ai_image_reason : the reporter's explanation of why an AI image was used.

alter table public.lost_items
  add column if not exists ai_image_urls   text[] not null default '{}',
  add column if not exists ai_image_reason text;

alter table public.found_items
  add column if not exists ai_image_urls   text[] not null default '{}',
  add column if not exists ai_image_reason text;

-- Make the API see the new columns right away
notify pgrst, 'reload schema';
