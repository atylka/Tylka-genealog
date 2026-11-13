-- Editable thumbnail choices and crop settings. Original archive scans are never changed.
alter table public.archive_records
  add column if not exists thumbnail_settings jsonb not null default '{}'::jsonb;

alter table public.ancestor_portraits
  add column if not exists thumbnail_settings jsonb not null default '{}'::jsonb;

comment on column public.archive_records.thumbnail_settings is
  'Owner-selected thumbnail source record and crop settings; original file_path is preserved.';
comment on column public.ancestor_portraits.thumbnail_settings is
  'Owner-selected thumbnail source record and crop settings for this person; original portraits are preserved.';
