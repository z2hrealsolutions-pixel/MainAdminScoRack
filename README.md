# ScoRack Admin Platform — Phase 2a through 2d

Auth, the tenant lifecycle, division setup, and now rosters: adding
teams and players by hand, or importing a whole division from a CSV.

## What's in this build

- Magic link sign-in via Supabase Auth, gated by `platform_admins`
- The console shell and honest dashboard with real counts
- **Tenants**: create, rename, change sport, move between active,
  suspended, and blocked
- **Divisions**: category, format, age/gender labels, draft/publish
- **Rosters**, new in this build:
  - The add-entrant form adapts to the division's category: one
    player for singles, two for doubles, a team-only form for league
    (players get added to it afterward, one at a time)
  - A team's detail page lets you edit its players inline and remove
    one if needed
  - **CSV import** (`/tenants/:id/divisions/:id/import`): one file
    format works for every division type, `team_name, player_name,
    gender, dupr_id, dupr_email, dupr_rating, is_45_plus`. Nothing
    imports until every row is valid, singles rows without a
    team_name default to the player's own name, doubles rows sharing
    a team_name become a pair, and a doubles group with anything
    other than exactly two players gets flagged rather than silently
    imported half-finished

This needs the new `scorack_phase1d_roster.sql` migration, run it
after Phase 1C in the same Supabase project before deploying this
build.

Bracket generation is still ahead.

## Deploy it, the same way DNL was deployed

**Run `scorack_phase1d_roster.sql` in the Supabase SQL Editor first**,
before deploying this build, it adds the one function rosters depend
on. Skip this and every add-team or CSV import will fail.

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
