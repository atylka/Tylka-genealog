-- Visitor-submitted indexing corrections and owner moderation.
-- Run this file in the Supabase SQL Editor before enabling the correction form.
create table if not exists public.record_correction_reports (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.archive_records(id) on delete cascade,
  visitor_name text not null default '' check (char_length(visitor_name) <= 100),
  issue_type text not null check (char_length(issue_type) between 1 and 80),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.record_correction_reports enable row level security;
grant insert on public.record_correction_reports to anon, authenticated;
grant select, update, delete on public.record_correction_reports to authenticated;
drop policy if exists "Visitors can submit correction suggestions" on public.record_correction_reports;
create policy "Visitors can submit correction suggestions"
on public.record_correction_reports for insert to anon, authenticated
with check (status = 'pending');
drop policy if exists "Only archive owner can read correction suggestions" on public.record_correction_reports;
create policy "Only archive owner can read correction suggestions"
on public.record_correction_reports for select to authenticated
using (auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid);
drop policy if exists "Only archive owner can review correction suggestions" on public.record_correction_reports;
create policy "Only archive owner can review correction suggestions"
on public.record_correction_reports for update to authenticated
using (auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid)
with check (auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid);
drop policy if exists "Only archive owner can delete correction suggestions" on public.record_correction_reports;
create policy "Only archive owner can delete correction suggestions"
on public.record_correction_reports for delete to authenticated
using (auth.uid() = '7a8cd586-c68f-4078-b61d-a87f3842b07e'::uuid);
