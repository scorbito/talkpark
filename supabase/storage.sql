-- Phase 8 storage buckets and policies. Run after supabase/schema.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('ticket-images', 'ticket-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('review-photos', 'review-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('profile-images', 'profile-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "users upload own ticket images"
on storage.objects for insert
with check (
  bucket_id = 'ticket-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users read own ticket images"
on storage.objects for select
using (
  bucket_id = 'ticket-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users delete own ticket images"
on storage.objects for delete
using (
  bucket_id = 'ticket-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users upload own review photos"
on storage.objects for insert
with check (
  bucket_id = 'review-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "review photos are publicly readable"
on storage.objects for select
using (bucket_id = 'review-photos');

create policy "users delete own review photos"
on storage.objects for delete
using (
  bucket_id = 'review-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users upload own profile images"
on storage.objects for insert
with check (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "profile images are publicly readable"
on storage.objects for select
using (bucket_id = 'profile-images');

create policy "users delete own profile images"
on storage.objects for delete
using (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

