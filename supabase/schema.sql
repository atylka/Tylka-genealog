-- Tylka Genealogical Log: public-viewing archive schema
-- Run this in Supabase SQL Editor. Owner account UUID is configured below.

create extension if not exists pgcrypto;

create table if not exists public.archive_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  category text not null check (category in ('births','deaths','marriages','immigration','photos','notes')),
  description text not null default '' check (char_length(description) <= 5000),
  file_path text,
  file_name text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table public.archive_records enable row level security;

-- Record metadata and scans are publicly viewable; record and file writes remain owner-only.
create policy "Anyone can view archive record details"
on public.archive_records for select
to anon, authenticated
using (true);

create policy "Only the site owner can add archive records"
on public.archive_records for insert
to authenticated
with check (auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid and owner_id = auth.uid());

create policy "Only the site owner can update archive records"
on public.archive_records for update
to authenticated
using (auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid and owner_id = auth.uid())
with check (auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid and owner_id = auth.uid());

create policy "Only the site owner can delete archive records"
on public.archive_records for delete
to authenticated
using (auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid and owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-archive',
  'family-archive',
  true,
  20971520,
  array['image/jpeg','image/png','image/webp','image/tiff','application/pdf']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Owner can list family archive files"
on storage.objects for select to authenticated
using (
  bucket_id = 'family-archive'
  and (storage.foldername(name))[1] = '7a8cd586-c68f-4078-b61d-a87f3842b07e'
  and auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid
);

create policy "Owner can upload family archive files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'family-archive'
  and (storage.foldername(name))[1] = '7a8cd586-c68f-4078-b61d-a87f3842b07e'
  and auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid
);

create policy "Owner can delete family archive files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'family-archive'
  and (storage.foldername(name))[1] = '7a8cd586-c68f-4078-b61d-a87f3842b07e'
  and auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid
);

-- Disable public sign-ups in Authentication > Settings after creating your owner account.
-- Never expose the service_role key in this website.


-- Persons named in each archive record; used by the site's People search filter.
alter table public.archive_records add column if not exists persons_mentioned text not null default '';
