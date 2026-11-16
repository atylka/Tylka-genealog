-- Multiple supporting sources and images per archive event.
-- Existing primary attachments remain in file_path and are copied into the JSON list by the app when edited.
alter table public.archive_records
  add column if not exists source_attachments jsonb not null default '[]'::jsonb;

comment on column public.archive_records.source_attachments is
  'Additional source files and images attached to this archive event; existing primary file_path remains unchanged.';
