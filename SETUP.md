# Activate the private Tylka archive

The website now includes a Supabase-backed sign-in and upload interface. It remains inactive until you connect a Supabase project and apply the database security rules.

## 1. Create a Supabase project
1. Create a project at https://supabase.com/dashboard.
2. In **Authentication → Users**, create your own user with your email and a strong password. Do not enable public sign-ups.
3. Open **Project Settings → API** and copy the Project URL and anon/public key. The anon key is intended for browser use; never use the service_role key in the website.

## 2. Set the website's public connection values
Edit `supabase-config.js` in this repository:
- Replace `YOUR_SUPABASE_PROJECT_URL` with the Project URL.
- Replace `YOUR_SUPABASE_ANON_KEY` with the anon/public key.

These two values are public browser configuration. The security boundary is Supabase Row Level Security and private Storage policies, not hiding the anon key.

## 3. Apply owner-only database and storage rules
1. In Supabase, open **Authentication → Users** and copy the UUID for the account you created.
2. Open **SQL Editor** and paste the contents of `supabase/schema.sql`.
3. Replace every occurrence of `OWNER_USER_UUID` in that SQL with your exact user UUID, then run the script.
4. Confirm the `family-archive` bucket is private in **Storage**.

The SQL restricts record rows and uploaded files to that single Auth user UUID. The bucket is private; file links are short-lived signed links created after sign-in.

## 4. Publish the website
Enable GitHub Pages for this repository (Settings → Pages → Deploy from a branch → `main` → `/ (root)`). Wait for the deployment, then open the archive page and sign in.

## Included safeguards
- No public account registration form.
- Database row-level security restricts select, insert, update, and delete to the configured owner UUID.
- Private Storage bucket with owner-only read, upload, and delete policies.
- 20 MB upload limit; accepted types are JPG, PNG, WEBP, TIFF, and PDF.
- Browser code uses only the Supabase anon/public key.

## Important
This is a personal family archive, not a substitute for encrypted offline backups. Keep original scans backed up separately. Never commit passwords, service-role keys, private API tokens, or sensitive identity documents to this public repository. For maximum privacy, consider making the GitHub repository private as well; the Supabase bucket and records remain private regardless of the repository's visibility.
