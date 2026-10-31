-- Add a dedicated location field to existing archive records.
-- Run once in Supabase SQL Editor to enable the Location Registry.
alter table public.archive_records
add column if not exists location text not null default '' check (char_length(location) <= 300);
