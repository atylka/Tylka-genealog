# Activate the Tylka Genealogical Log

The site uses Supabase for owner sign-in, public archive metadata, and public viewing of uploaded record scans and photographs. Only the designated archive owner can add, edit, or delete records and upload or delete files.

## 1. Supabase project and owner account
1. Open the [Supabase dashboard](https://supabase.com/dashboard).
2. In **Authentication → Users**, create or confirm the archive owner's account. Public sign-ups should remain disabled.
3. Confirm the owner account UUID matches the owner UUID configured in `supabase/schema.sql`.

## 2. Public browser configuration
`supabase-config.js` contains only the project URL and publishable/anon key. Never put a service-role or secret key in the website.

## 3. Database setup
For a new project, run `supabase/schema.sql` in the Supabase SQL Editor first. Then run these migrations in order. For an existing project, run any migration that has not already been applied:

1. `supabase/location-registry-migration.sql`
2. `supabase/activity-log-migration.sql`
3. `supabase/migrations/20261102_stability_fixes.sql`
4. `supabase/migrations/20261102_multiple_ancestor_faces.sql`
5. `supabase/migrations/20261105_archive_catalog_metadata.sql`
6. `supabase/public-record-attachments-migration.sql`

The catalog migration adds archival metadata columns and assigns stable accession numbers to existing records. It does not overwrite existing titles, descriptions, dates, locations, people, or attachments.

The final attachment migration sets `family-archive` to **public** so visitors can view record scans and photographs through the public URLs used by the site. Public bucket access means anyone with an asset URL can retrieve that file. Uploading, replacing, and deleting files remain restricted by Storage policies to the designated owner. Do not upload private or sensitive documents to this public collection.

The old `visitor-access-migration.sql` belongs to the retired attachment-request workflow and is not part of the current setup. Do not deploy the old `record-access` Edge Function for the current public-viewing design. If that old migration was previously applied, the unused request table can remain; the current site does not use it.

## 4. Publish
GitHub Pages should publish the `main` branch from the repository root. After applying the SQL migrations, test the site in a signed-out/private browser window and separately with the archive owner's account:
- Visitors should be able to browse record metadata and open public scans.
- Only the designated owner should see record editing, adding, and deletion controls.
- A non-owner authenticated account must not be able to upload, replace, or delete archive files.

## Security and preservation notes
- Record metadata is publicly readable; record inserts, updates, and deletes are owner-only.
- The `family-archive` bucket is public for viewing, but Storage write/delete operations remain owner-only.
- Anyone with a public asset URL can access that file. Only upload material intended for public family-history access.
- Keep untouched master scans backed up separately. Do not overwrite original scans with enhanced or annotated copies.
- Never commit passwords, service-role keys, or private API tokens to this public repository.
