-- Add the identity shown in the homepage activity log.
-- Existing records receive a neutral label; new uploads store the signed-in owner's name or email.
alter table public.archive_records
add column if not exists created_by text not null default 'Archive owner';
