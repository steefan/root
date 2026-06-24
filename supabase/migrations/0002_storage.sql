-- Private 'media' bucket for avatars, chat images, and TTS audio.
-- Objects are stored under a top-level folder named after the user's id:
--   <user_id>/avatars/...   <user_id>/images/...   <user_id>/audio/...
-- The app reads them via short-lived signed URLs.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Owner-scoped access: a user may manage only objects under their own folder.
create policy "own media read" on storage.objects
  for select using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own media insert" on storage.objects
  for insert with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own media update" on storage.objects
  for update using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own media delete" on storage.objects
  for delete using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
