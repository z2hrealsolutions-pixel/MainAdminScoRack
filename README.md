# ScoRack Admin Platform — Phase 2a + 2b + 2c

Auth, the operator shell, the tenant lifecycle, and now division setup:
category, format, age and gender labels, and the draft/publish control
that keeps a division off the public view until it's ready.

## What's in this build

- Magic link sign-in via Supabase Auth, gated by `platform_admins`
- The console shell: top bar, side nav, honest dashboard with real counts
- **Tenants** (`/tenants`): every rented sub-platform, its sport, and
  its status at a glance
- **Create tenant** (`/tenants/new`): name, an auto-suggested slug you
  can override, and a sport picker
- **Tenant detail** (`/tenants/:id`): edit the name, slug, and sport,
  the status control that actually blocks a tenant, and the list of
  its divisions
- **Add division** (`/tenants/:id/divisions/new`): name, category
  (singles, doubles, league), format (knockout, or group stage then
  knockout), and free-text age/gender labels
- **Division detail** (`/tenants/:id/divisions/:divisionId`): edit
  those fields, and move the division between Draft, Published, and
  Completed. Draft stays hidden from the public even if the tenant
  itself is active, Phase 1's RLS enforces that, not this app

Rosters and bracket generation are still ahead.

## Deploy it, the same way DNL was deployed

1. **Create a new GitHub repository** and upload every file in this
   folder except anything already in `.gitignore` (GitHub's web
   uploader handles a whole folder at once, drag the contents in).
2. **Connect the repo to a new Vercel project.** Vercel auto-detects
   Vite, no build settings to change. `vercel.json` is included so
   routes like `/tenants/new` don't 404 on a hard refresh, that's a
   client-side router thing, not optional.
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

If you already deployed an earlier phase, this is just a normal
update: pull the new files into the same repo (or re-upload over
them) and push, Vercel redeploys automatically. No new environment
variables, no new migration, everything here runs against the schema
Phase 1 already set up.

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
