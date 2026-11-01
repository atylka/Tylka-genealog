-- Tylka Genealogical Log: structured dates and shared ancestor portraits
alter table public.archive_records add column if not exists record_date text;

create table if not exists public.ancestor_portraits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  portrait_url text not null,
  source_record_id uuid null references public.archive_records(id) on delete set null,
  source_title text,
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  unique (lower(name))
);
alter table public.ancestor_portraits enable row level security;
drop policy if exists "Public can read ancestor portraits" on public.ancestor_portraits;
create policy "Public can read ancestor portraits" on public.ancestor_portraits for select using (true);
drop policy if exists "Owner can insert ancestor portraits" on public.ancestor_portraits;
create policy "Owner can insert ancestor portraits" on public.ancestor_portraits for insert with check (auth.uid() = created_by);
drop policy if exists "Owner can update ancestor portraits" on public.ancestor_portraits;
create policy "Owner can update ancestor portraits" on public.ancestor_portraits for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
drop policy if exists "Owner can delete ancestor portraits" on public.ancestor_portraits;
create policy "Owner can delete ancestor portraits" on public.ancestor_portraits for delete using (auth.uid() = created_by);
