-- Visitor browsing and attachment approval workflow.
-- Run this migration in the Supabase SQL Editor.
create table if not exists public.record_access_requests (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.archive_records(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  visitor_name text not null check (char_length(visitor_name) between 1 and 100),
  request_token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.record_access_requests enable row level security;
-- Intentionally no anon/authenticated table policies: all request operations go through
-- the Edge Function using the service role after validating the visitor token or owner JWT.
drop policy if exists "Anyone can view archive record details" on public.archive_records;
create policy "Anyone can view archive record details"
on public.archive_records for select to anon, authenticated using (true);
