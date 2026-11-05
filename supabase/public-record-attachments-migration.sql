-- Public access to original scans and photographs in the family archive.
-- Public object retrieval bypasses Storage RLS; upload, update, and delete
-- operations remain governed by the owner-only storage.objects policies.
-- This migration intentionally preserves any legacy visitor-request rows.
update storage.buckets
set public = true
where id = 'family-archive';
