# ScoRack Admin Platform — Phase 2a through 2f

Auth, the tenant lifecycle, division setup, rosters, and now the full
auto-generation engine: seeding, groups, and the knockout bracket.

## What's in this build

- Magic link sign-in via Supabase Auth, gated by `platform_admins`
- The console shell and honest dashboard with real counts
- **Tenants**: create, rename, change sport, move between active,
  suspended, and blocked
- **Divisions**: category, format, age/gender labels, draft/publish
- **Rosters**: adaptive add-entrant form, inline-editable players,
  a remove button on every team (blocked with a clear message if that
  team already has matches scheduled), CSV import
- **Seeding**: rank teams by average DUPR rating
- **Groups**, new in this build: "Generate groups" splits a
  group-then-knockout division's teams into however many groups you
  choose, snake seeded so the strongest teams are spread out, and
  builds the round robin schedule inside each one, every team plays
  every other team in its group once. Refuses to regenerate once any
  group match has a real result, so a re-click can't erase a live
  event's scores.
- **Bracket**, new in this build: "Generate bracket" builds the full
  knockout tree in one go, every round, correctly wired, byes handled
  automatically for team counts that aren't a clean power of two. For
  knockout-only divisions it seeds directly from DUPR rating; for
  group-then-knockout divisions it seeds from actual group standings
  once you tell it how many teams advance per group. Click a team's
  name on a playable match to declare the winner, it's placed straight
  into its next round slot. Also refuses to regenerate once the
  bracket has a real result.

- **Group results**, new in this build: every group match in the
  Groups section is now a link to its own results page.
  - Singles and doubles: enter the two scores and save. The winner
    gets the division's "Standings points per group win" (a new
    setting on the division page, default 1), the match is marked
    complete, and the group table above updates with live points and
    matches played. Saving again corrects a mistake without double
    counting, and "Clear result" reopens the match entirely.
  - League: add the rubbers you set up for that tie (type, points for
    the winner, each team's score), then "Mark tie complete". A rubber
    with no scores yet is saved as not played.
  - Generate Bracket now tells you how many group matches are still
    unplayed before it seeds from the standings.

This needs two new migrations, `scorack_phase1f_groups.sql` and
`scorack_phase1g_bracket.sql`, run them in that order after Phase 1E,
before deploying this build. The bracket migration also makes two
existing columns (`matchups.team_a_id`, `team_b_id`) nullable, that's
expected, a round 2 match genuinely doesn't know its teams until its
round 1 feeders are decided.

**Bracket layout for group-then-knockout divisions.** Groups are paired
(A with B, C with D...). In round 1 each pair's teams cross, A1 v B2
and B1 v A2 for two advancing, A1 v B4, A2 v B3, A3 v B2, A4 v B1 for
four. The first group's odd ranks and the second group's even ranks
fill the top half of the bracket, the second group's odd ranks and the
first group's even ranks fill the bottom half, so with two advancing a
group's 1st and 2nd place can only meet in the final. Needs an even
number of groups and a power of two advancing total (it says so if not).
Re-run the whole `scorack_phase1g_bracket.sql`, it's safe to run again,
it adds a `bracket_position` column so matches always display in
bracket order.

**Event day tools**, new in this build (`scorack_phase1i_event_day.sql`):
- **Schedule**: every match page has Court, Date and Time. They show on the group
  match rows and on bracket cards, and bracket cards now link to their match page.
- **Referee codes, one per group**: whoever scores Group A uses the same code for every
  Group A match, and the whole knockout stage shares one code of its own. The Referee
  codes section of the division page lists every group plus the knockout stage, each with
  Generate / new code, Remove, or your own 4 to 8 digit code. "Generate codes for
  everything without one" does them all at once, with a CSV and a print sheet that lists
  the matches each code covers. Codes are shown once and stored scrambled, so write them
  down or print before leaving the page. Running it again never breaks codes already
  handed out. Regenerating a division's groups removes that division's group codes along
  with the groups, make new ones afterwards. The knockout code is kept.
- **Swap two teams between groups**, in the Groups section. The round robin keeps its
  shape, each team takes over the other's matches, and court and time stay on those
  matches. Each group keeps its own code. Refused once either team has a recorded result.

**Security change in 1I, please read.** Referee code hashes used to sit in a column on
the public matchups table, which meant anyone with the public API key could read them
and crack a 6 digit code offline. They now live in their own table the public cannot
touch, and `submit_score` locks a group (or the knockout stage) for ten minutes after five
wrong codes. The trade off: someone could lock a whole group on purpose, an admin unlocks
it by generating a new code, or enters scores from the results page meanwhile. It also
now returns a JSON result (`ok`, or an `error` of `invalid_code`, `locked`,
`tenant_inactive`, `invalid_score` or `match_not_found`) instead of raising an error,
which the referee app will use. Any code already set is carried over. Every elevated
database function now also has its search_path pinned.

## Deploy it, the same way DNL was deployed

**Run `scorack_phase1f_groups.sql`, `scorack_phase1g_bracket.sql`,
`scorack_phase1h_results.sql`, then `scorack_phase1i_event_day.sql` in the Supabase SQL Editor, in that
order, after Phase 1E**, before deploying this build. Anything you
already ran from that list, skip. The 1H migration adds the win points
column and four small functions, and replaces the standings view so it
also counts plain "singles" and "doubles" matches in the win/loss
columns, it keeps its security_invoker setting.

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

Run `scorack_phase1i_event_day.sql` **before** deploying this version of the app,
the match page reads from the new codes table.

**Referee codes moved from per match to per group in 1J.** Run
`scorack_phase1j_group_codes.sql` after `scorack_phase1i_event_day.sql`, before deploying
this version of the app. It removes any per match codes you made, they can't be converted
to group codes, so generate group codes afterwards.

## Referee scoring and admin corrections (`scorack_phase1k_referee.sql`)

Referees now score from their phones in a separate app (`scorack-user`, its own zip and Vercel
project). Finishing a match counts immediately, so the admin side is where mistakes get fixed:

- **Live matches** show as LIVE in the group lists and on bracket cards, and the match page says
  a referee is scoring it.
- **Singles and doubles, group or knockout**: the match results page now handles both. Saving a
  knockout result moves the winner into the next round, correcting the winner swaps them there.
  "Clear result" works on a finished or live match, and on a knockout match it takes the winner
  back out of the next round.
- **League knockout ties**: add rubbers as before, declare the winner from the bracket, and use
  "Reopen tie" on the match page to take it back.
- **Safety**: none of these will change a result while the next round's match is live or finished,
  it tells you to reopen that one first. Regenerating groups or the bracket, and swapping teams,
  are also refused while any match is live, not just finished.
- The Referee codes section shows the referee app's address (set `VITE_USER_APP_URL`, see
  `.env.example`) and the print sheet includes it.

Run `scorack_phase1k_referee.sql` before deploying this version. It replaces `submit_score` (it
now takes an optional `p_finish`), `record_match_result` and `clear_match_result`, and adds
`verify_referee_code` and `reopen_knockout_match`.
