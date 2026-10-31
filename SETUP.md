# Activate the Tylka Genealogical Log

The site uses Supabase for owner sign-in, record metadata, private file storage, and visitor attachment approvals.

## 1. Supabase project and owner account
1. Open your Supabase project: https://supabase.com/dashboard.
2. In **Authentication → Users**, create or confirm your owner account. Public sign-ups should remain disabled.
3. Confirm the owner account UUID matches the owner UUID already configured in `supabase/schema.sql` and `supabase/functions/record-access/index.ts`.

## 2. Public browser configuration
`supabase-config.js` contains only the project URL and publishable/anon key. Never put a service-role or secret key in the website.

## 3. Database setup
If you have not already run the original schema, run `supabase/schema.sql` in the Supabase SQL Editor first. Then run these migrations in order:
1. `supabase/location-registry-migration.sql` (if not already applied).
2. `supabase/activity-log-migration.sql` (if not already applied).
3. `supabase/visitor-access-migration.sql`.

The visitor migration makes record metadata publicly readable. Attachments remain in the private `family-archive` bucket. Do not make that bucket public.

## 4. Deploy the secure approval function
The request inbox and signed attachment access require the Supabase Edge Function in this repository. Install the Supabase CLI, then run these commands from the repository folder:

```sh
supabase login
supabase link --project-ref euupqaaxchpwhcpojlmx
supabase functions deploy record-access
```

The function uses Supabase's built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment variables. The service-role key is used only inside the hosted function and must never be copied into GitHub Pages or `supabase-config.js`.

## 5. How visitor approvals work
- Visitors can browse record titles, descriptions, dates, and locations.
- A visitor enters their name to request one attachment.
- The owner signs in and opens the envelope button to accept or deny requests.
- The visitor's open archive page checks for the decision and displays an on-site notice. Accepted images and PDFs are displayed in the page itself.
- Approval creates a short-lived signed URL for that one private file. The request token is stored only in that visitor's browser so the page can recognize the response if they return on the same browser.

## 6. Publish
GitHub Pages should publish the `main` branch from the repository root. After the SQL migration and Edge Function deployment are complete, test with a visitor browser/private window and your owner login separately.

## Security notes
- RLS keeps record inserts, updates, and deletes owner-only.
- The access-request table has no direct public read/write policies; all request operations pass through the Edge Function.
- The Edge Function checks the owner JWT before showing or deciding inbox requests.
- Uploaded files stay private; never publish a permanent public storage URL.
- Keep original scans backed up separately. Never commit passwords, service-role keys, or private API tokens to this public repository.
