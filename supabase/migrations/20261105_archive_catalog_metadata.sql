-- Archival catalog metadata and accession numbers.
alter table public.archive_records
  add column if not exists accession_number text,
  add column if not exists collection_name text,
  add column if not exists record_type text,
  add column if not exists record_language text,
  add column if not exists repository text,
  add column if not exists source_reference text,
  add column if not exists provenance text,
  add column if not exists transcription_status text not null default 'not_assessed',
  add column if not exists translation_status text not null default 'not_assessed',
  add column if not exists preservation_notes text;

create sequence if not exists public.archive_accession_seq;

do $$
declare
  missing_record record;
  highest_number bigint;
begin
  for missing_record in
    select id from public.archive_records
    where accession_number is null or btrim(accession_number) = ''
    order by created_at, id
  loop
    update public.archive_records
    set accession_number = 'TGL-' || lpad(nextval('public.archive_accession_seq')::text, 6, '0')
    where id = missing_record.id;
  end loop;
  select coalesce(max(substring(accession_number from '^TGL-([0-9]+)$')::bigint), 0)
    into highest_number from public.archive_records;
  perform setval('public.archive_accession_seq', greatest(highest_number, 1), highest_number > 0);
end $$;

create unique index if not exists archive_records_accession_number_unique
  on public.archive_records (accession_number)
  where accession_number is not null and btrim(accession_number) <> '';

create or replace function public.assign_archive_accession_number()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.accession_number is null or btrim(new.accession_number) = '' then
    new.accession_number := 'TGL-' || lpad(nextval('public.archive_accession_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists archive_records_assign_accession_number on public.archive_records;
create trigger archive_records_assign_accession_number
before insert on public.archive_records
for each row execute function public.assign_archive_accession_number();
