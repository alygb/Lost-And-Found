-- Allow deleting user <-> admin messages
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Who can delete what (enforced by Row Level Security):
--   * A user can delete messages in their OWN conversation (a single message they sent,
--     or the whole chat). They can never touch anyone else's conversation.
--   * Admins can delete any message, or a whole conversation, with any user.
--   * Deletion is permanent and removes the message for both sides.
--   (The UI only offers single-message delete on messages the user wrote themselves.)

drop policy if exists "messages: owner or admin can delete" on public.messages;
create policy "messages: owner or admin can delete"
  on public.messages for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant delete on public.messages to authenticated;

notify pgrst, 'reload schema';
