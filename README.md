# ScoreIt Admin Platform — Phase 2a through 2f

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

## Addresses to share (tenant page)

A tenant's page now lists the three addresses to hand out, when `VITE_USER_APP_URL` is set: the
spectator page, the TV board (`/tv`) and the referee page (`/referee`), each a link that opens in
a new tab. Without the setting it says what to set.

## Venue staff sign in to the same console (`scorack_phase1n_staff_access.sql`)

Venue organisers use this console too, and see only their own venue.

**Giving a venue its first owner.** Create the tenant as before and fill in "Owner's email" (or add
it later from the tenant's Team section). That person is sent a sign-in email straight away. When
they open the link, the venue appears for them, and they can add their own staff the same way. They
must sign in with exactly the address you entered.

If the email can't be sent, or you'd rather not rely on it, every pending invitation has a **Copy
message** button that puts a ready-made invitation (venue name, the console address, which email to
use) on the clipboard, to paste into WhatsApp or a text. The invitation works the same however they
find out about it.

**Roles.** An owner manages the team (adds, removes, changes roles). Staff do everything else at
the venue: divisions, rosters, seeding, groups, the bracket, results, referee codes. A venue always
has at least one owner, the last one can't be removed or demoted. The venue's address (slug),
sport and status stay with operators, an owner can only change the venue's name.

**What staff see.** One venue goes straight to it, several give a list to pick from. The Tenants
list, creating tenants and every other venue are for operators only.

**Suspended and blocked venues.**

| Status | Public pages and referee scoring | Venue staff |
|---|---|---|
| Active | on | everything |
| Suspended | off | view only: they can look at everything, a banner says so, and the database refuses every change |
| Blocked | off | locked out: they see a message saying access is blocked |

Operators are never affected by any of this. The Print button in a suspended venue's referee codes
section is disabled along with the other buttons, an operator can print instead.

**Invitations** last 30 days and can be sent again to refresh them. An invitation is only accepted
for an email address the person has confirmed by clicking a sign-in link, so nobody can claim one by
signing up with someone else's address.

Run `scorack_phase1n_staff_access.sql` before deploying this version. If this version is deployed
first, operators still sign in as normal and only the Team section shows an error until the SQL is
run.

## Email delivery: set this up before inviting anyone

ScoreIt sends no email of its own. Sign-in links and invitations are sent by Supabase Auth, and
**Supabase's built-in email sender only delivers to addresses on your Supabase organization's team**,
capped at about two emails an hour for the whole project. It is meant for testing. That is why
sign-in works for you (you're on the team) and an invited venue owner receives nothing, with no
error shown.

To fix it, give the project its own email provider:

1. Pick any provider that offers SMTP. Brevo, Resend, SendGrid and Amazon SES all work, and most
   have a free tier that is plenty for sign-in emails. For a quick test only, a Gmail account with an
   App Password also works, but it is not for real use. A provider will ask you to verify the address
   or domain emails are sent from, do that first.
2. In Supabase open your project, then **Authentication**, then **Emails** (in some versions
   **Project Settings, Authentication, SMTP Settings**). Switch on **Enable custom SMTP** and enter the
   sender email, sender name and the provider's host, port, username and password.
3. Still in **Authentication**, open **Rate Limits**. A new custom provider starts at 30 emails an
   hour. Raise it if you will invite many people at once.
4. Open **URL Configuration**. **Site URL** should be this console's address, so the link in the
   email brings people back here.
5. Optional but worth doing: in **Emails**, edit the **Magic Link** template (and the **Confirm
   signup** one, a brand new person may be sent either) so the email says ScoreIt. Suggested subject:
   `Sign in to ScoreIt`. Suggested body:

   ```html
   <h2>Sign in to ScoreIt</h2>
   <p>Open this link to sign in. It works once and expires in an hour.</p>
   <p><a href="{{ .ConfirmationURL }}">Sign in to ScoreIt</a></p>
   <p>If you didn't ask for this, you can ignore this email.</p>
   <p style="color:#6b7780">ScoreIt by Z2HxRealSolutions</p>
   ```
6. Test with an address that is NOT on your Supabase team: add yourself to a test venue with a
   personal email and check the sign-in link arrives (look in spam the first time).

Sign-in links expire after an hour. An invitation lasts 30 days, and adding the same person again
sends a fresh link.

## The sign-in link opens a Vercel login page

Vercel puts its own login in front of every address of a project **except the short production
address**. So `main-admin-sco-rack.vercel.app` is public, but the long auto-generated addresses (the
ones with random letters in the middle, like `main-admin-sco-rack-abc123-yourteam.vercel.app`) show
Vercel's login. A link that points at one of those sends the person to Vercel instead of ScoreIt.

Links in sign-in emails and invitation messages always use one fixed address. Set it once:

1. In the admin project on Vercel, go to **Settings, Environment Variables** and add
   `VITE_CONSOLE_URL` set to the short production address, for example
   `https://main-admin-sco-rack.vercel.app`. Redeploy so it takes effect.
2. In Supabase, **Authentication, URL Configuration**: set **Site URL** to that same address and
   add `https://main-admin-sco-rack.vercel.app/**` under **Redirect URLs**. A link whose address
   isn't on that list is replaced with the Site URL.
3. Open the console from that short address and bookmark it. Avoid the "Visit" button on a
   specific deployment in Vercel, that opens the long address.
4. If even the short address asks for a Vercel login: **Settings, Deployment Protection**, under
   **Vercel Authentication** choose **Standard Protection** (which leaves the production address
   public) or turn it off. Check the public and referee project the same way, spectators and
   referees must be able to open it without a Vercel account.

## Round of 16, tiebreakers, DUPR export and deleting (`scorack_phase1o_ranking_r16.sql`, `scorack_phase1p_delete_export.sql`)

Run both SQL files, `1O` then `1P`, before deploying this version. If this version goes up first,
the group tables fall back to the old standings until the SQL is run.

**One ranking everywhere.** Group tables, the cross-group bracket and the public pages all use the
same order: wins, then head-to-head between the teams that are level, then point difference, then the
team's original seed, then name. A league division is ranked by **points** first (that is how leagues
are scored) and then the same tiebreakers. Head-to-head among three or more level teams looks only at
the games between those teams; if that doesn't separate them, point difference decides.

**Seeded Round of 16** (singles and doubles divisions with **8 or 9 groups**). In the division's
Bracket section choose *Seeded Round of 16* instead of the cross-group bracket:

- **8 groups:** the top two of every group (16 teams) go straight into the Round of 16.
- **9 groups:** 18 qualify. Click **Create playoff** once every group match is finished: the 4 lowest
  runners-up play a round robin of 6 matches. It appears as a group called *Playoff*, with its own
  referee code (make it under Referee codes) and its own table. When it is finished, click **Build
  Round of 16**. The 9 group winners are seeds 1 to 9, the 5 best runners-up 10 to 14, the playoff's
  top two 15 and 16.
- **Seeds across groups:** group winners are ranked among themselves, and runners-up among themselves,
  by wins, then point difference, then original seed, then name.
- **Layout:** exactly the printed sheet. Round of 16 matches M1 to M8 are 1v16, 8v9, 5v12, 4v13, 3v14,
  6v11, 7v10, 2v15; quarterfinals M9 to M12; semifinals M13 and M14; final M15.
- **Same-group clashes:** if a group winner would meet their own group's runner-up, the runner-up
  swaps with the nearest neighbouring runner-up seed (the next seed down first, then up), only if that
  leaves no same-group pair. Group winners never move. After building you are told which seeds were
  swapped, and warned if a clash could not be resolved.
- **Rebuilding:** allowed freely until a Round of 16 result is recorded, then it is locked. The
  playoff can be recreated until it has results.

**Export to DUPR** (singles and doubles divisions). Mark the division **Completed**, then use *Export
to DUPR* on its page. One row per finished match (group, playoff and knockout), in the layout of the
DNL sample file. Edit the event name, venue address, score type (side-out or rally) and date before
downloading. Players with no DUPR ID are named, and you choose whether to leave their matches out.
Matches where a team has no player recorded are always left out. The venue address is saved on the
venue (operators under Details, owners under Venue details). League divisions can't be exported yet
because the console doesn't record who played each rubber. The file contains names and DUPR IDs only,
never emails or ratings.

**Deleting.** Both ask you to type `CONFIRM` exactly (the database checks it too), show what will be
lost first, and are permanent. A record of what was deleted, by whom and when is kept.

- *Delete division:* owners of the venue and operators, at the bottom of the division page.
- *Delete tenant:* ScoreIt operators only, at the bottom of the tenant page. It removes the venue and
  everything in it. People's sign-in accounts are kept.

## Branding

- **Banner:** the ScoreIt logo, then "by Z2HxRealSolutions", on every screen with a banner: the console,
  the sign-in and no-access pages, the printed referee code sheet (dark lettered logo, for white
  paper) and the browser tab title. It is `src/components/Brand.jsx`.
- **The logo file** is `src/assets/scoreit-logo-light.png`: your logo with the black lettering turned
  off-white so it reads on the dark console, the turquoise left exactly as it was. The browser tab
  icon is `public/favicon.png`, cut from the same logo.
- **Colour:** the accent is the logo's turquoise, `#0097b2` (`--lamp` in `src/styles/tokens.css`),
  used for buttons, highlights, LIVE markers and borders. Small text in the accent colour uses a
  lighter tint of the same turquoise (`--lamp-text`), because `#0097b2` itself is a touch too dim for
  small text on the darkest panels. Text on a turquoise button is dark (`--on-lamp`). `npm test` checks
  the contrast of every pairing, that no amber is left, and that the old name appears nowhere.
- Internal names (the GitHub repositories, Vercel projects, database functions, file names) still
  say "scorack". They are never shown, and renaming them would only risk breaking deployments.

## Your own groups (`scorack_phase1q_import_groups.sql`)

Instead of letting the system split the teams, a venue can decide its own groups. In a division's
**Groups** section, under *Use your own groups*:

1. **Download template for this division.** It lists the division's teams, one per row, with a
   `group_name` column to fill in (already filled with the current groups if there are any). *Download an
   example* gives a small sample file. A blank copy is also provided as `scoreit_groups_template.csv`.
2. Write each team's group next to it. Group names are yours: `Group A`, `Pool 1`, `Court 3`, anything up
   to 40 characters. Teams with the same group name end up together.
3. **Upload groups CSV.** The file is checked on screen and explained row by row before anything is saved.
   If it is fine you see the groups and their teams, and press *Import*.

The file has two columns, `team_name` and `group_name` (also accepted: `team`, `group`, `pool`). Spaces and
capital letters don't matter when matching names. Extra columns are ignored. A file saved from Excel is fine.

**Rules** (checked on screen and again by the database, all or nothing):

- every team in the division has to be in exactly one group, and every group needs at least 2 teams;
- team names have to match the division's teams (a team name that appears twice in the division makes
  the file ambiguous, rename one first);
- `Playoff` is reserved for the playoff stage, and two groups can't share a name;
- it replaces the current groups, their matches and their referee codes, so it only works while no group
  match has a result, the same rule as generating groups. A bracket built from earlier groups is left
  alone, build it again afterwards.

Every team plays every other team in its group once, exactly as with generated groups, and the groups
behave the same afterwards: referee codes, scoring, tables, the Playoff and the Round of 16. Staff of an
active venue and operators can import. A suspended venue is view only.

Run `scorack_phase1q_import_groups.sql` before deploying this version. If the console goes up first, the
import button reports an error until the SQL is run, everything else works.

## Phones

The console works on a phone: the side menu moves above the content instead of beside it, and the top bar
wraps instead of overlapping. The Team list keeps an email on one line and puts the role and buttons under
it when there isn't room. These rules are guarded by `npm test`.

## Age category: 40+

The age category is called 40+ everywhere you see it: the roster CSV column is `is_40_plus` (TRUE or FALSE), the
roster template says the same, and the rubber type reads "Mixed 40+ doubles". Roster files from before still import:
a column called `is_45_plus` is read as `is_40_plus`. Inside the database the column and the rubber type keep their
original names (`is_45_plus`, `mixed_45_doubles`), nothing there was renamed and no data was converted. The updated
template is `scoreit_roster_template.xlsx`.

## The referee code sheet

Generate codes once the Playoff group (if there is one) and the bracket exist, and one sheet, or CSV, holds every
group's code, the Playoff's code and the knockout stage's code, with the knockout matches listed round by round.
Codes are stored scrambled and can't be shown again, so a sheet only holds the codes made in that batch. If some codes
were made earlier, the screen says "Not on this sheet" and names them. "Replace every code" makes one sheet with all of
them, and any code already handed out stops working.
