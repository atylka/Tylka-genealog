-- Public access to original scans and photographs in the family archive.
-- Run this in the Supabase SQL Editor after deploying the frontend.
update storage.buckets set public = true where id = 'family-archive';
-- Remove the retired visitor approval/mailbox workflow and its stored requests.
drop table if exists public.record_access_requests cascade;
