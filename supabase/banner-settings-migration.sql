-- Shared home banner settings and public background image storage.
-- Run this once in Supabase SQL Editor.
create table if not exists public.site_settings (
  id text primary key check (id = 'home'),
  banner_title text not null default 'Tylka Genealogical Log',
  banner_subtitle text not null default 'A living archive of names, places, photographs, and family records.',
  banner_fade text not null default 'black' check (banner_fade in ('black','white','none')),
  banner_image_url text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "Anyone can view shared site settings" on public.site_settings;
create policy "Anyone can view shared site settings"
on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "Only the site owner can manage shared site settings" on public.site_settings;
create policy "Only the site owner can manage shared site settings"
on public.site_settings for all to authenticated
using (auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid)
with check (auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banner-images','banner-images',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Anyone can view banner images" on storage.objects;
create policy "Anyone can view banner images"
on storage.objects for select to anon, authenticated using (bucket_id = 'banner-images');
drop policy if exists "Only the site owner can upload banner images" on storage.objects;
create policy "Only the site owner can upload banner images"
on storage.objects for insert to authenticated
with check (bucket_id='banner-images' and (storage.foldername(name))[1]='7a8cd586-c68f-4078-b61d-a87f3842b07e' and auth.uid()='7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid);
drop policy if exists "Only the site owner can update banner images" on storage.objects;
create policy "Only the site owner can update banner images"
on storage.objects for update to authenticated
using (bucket_id='banner-images' and (storage.foldername(name))[1]='7a8cd586-c68f-4078-b61d-a87f3842b07e' and auth.uid()='7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid)
with check (bucket_id='banner-images' and (storage.foldername(name))[1]='7a8cd586-c68f-4078-b61d-a87f3842b07e' and auth.uid()='7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid);
insert into public.site_settings (id) values ('home') on conflict (id) do nothing;
