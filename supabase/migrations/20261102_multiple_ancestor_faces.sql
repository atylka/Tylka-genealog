-- Tylka Genealogical Log: allow multiple face crops for each named ancestor.
alter table public.ancestor_portraits
  add column if not exists portraits jsonb not null default '[]'::jsonb;

-- Preserve the existing single portrait as the first item in the new collection.
update public.ancestor_portraits
set portraits = jsonb_build_array(
  jsonb_build_object(
    'url', portrait_url,
    'source_record_id', source_record_id,
    'source_title', source_title,
    'created_at', updated_at
  )
)
where portrait_url is not null
  and (portraits is null or portraits = '[]'::jsonb);
