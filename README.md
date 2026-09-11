# ScoRack Admin Platform — Phase 2a

Auth and the operator shell. This is the foundation every later screen
(tenants, divisions, brackets) gets built into.

## What's in this build

- Magic link sign-in via Supabase Auth, no password to manage
- A gate that checks the signed-in user against `platform_admins`
  (the `is_platform_admin()` function from the Phase 1 migration) and
  locks out anyone not on that list
- The console shell: top bar, side nav, and an honest empty dashboard
  that reads real counts from `tenants` and `platform_admins`

Nothing here writes any data yet. Tenant creation is Phase 2b.

## Deploy it, the same way DNL was deployed

1. **Create a new GitHub repository** and upload every file in this
   folder except anything already in `.gitignore` (GitHub's web
   uploader handles a whole folder at once, drag the contents in).
2. **Connect the repo to a new Vercel project.** Vercel auto-detects
   Vite, no build settings to change.
3. **Set the environment variables** in the Vercel project settings,
   under Environment Variables:
   - `VITE_SUPABASE_URL` — from Supabase: Project Settings → API
   - `VITE_SUPABASE_ANON_KEY` — same page, the anon/public key
   Redeploy after adding them, Vercel only bakes in env vars at build
   time.
4. **Allow the redirect URL.** In Supabase: Authentication → URL
   Configuration, add your Vercel deployment's URL (and
   `http://localhost:5173` if you ever preview locally) to Redirect
   URLs. Magic links are rejected otherwise.

## Bootstrapping your own access

`platform_admins` is deliberately not self-service, nobody can add
themselves through the app. The first operator has to be added by
hand:

1. Open the deployed site and sign in with your email. You'll land on
   the "not on the operator list" screen, that's expected the first
   time.
2. In Supabase's SQL Editor, find your new user's id:
   ```sql
   select id, email from auth.users order by created_at desc limit 5;
   ```
3. Insert yourself as an operator:
   ```sql
   insert into platform_admins (user_id) values ('paste-the-id-here');
   ```
4. Reload the site. You're in.

Repeat step 2–3 for any teammate who needs access, using their id
once they've signed in at least once.

## Local preview, if you ever want it

```
npm install
cp .env.example .env   # then fill in the two values
npm run dev
```

Not required for normal work, GitHub's web editor and Vercel's
auto-deploy cover the usual flow.
