bgore # VIA · Supabase backend

The cloud half of VIA's social layer. Pure Postgres + Supabase's batteries (auth,
RLS, realtime). The frontend stays a static site; this directory holds the
database schema and the migration plan to swap `LocalBackend` for a Supabase
implementation behind the existing `window.VIA.auth` interface.

## Why Supabase

Same Postgres under the hood. We chose batteries-included over building auth,
realtime, RLS, REST, and storage from scratch. Migration cost out is a `pg_dump`.

See decision rationale in `CLAUDE.md` (Social layer section).

## Schema overview

| Table | Purpose | Notable fields |
|---|---|---|
| `profiles` | Public traveler identity, keyed to `auth.users` | `name`, `avatar_url`, `bio` |
| `checkins` | One row per (user, site). Core social object. | `site_pleiades`, `lat/lng`, `user_lat/user_lng` (GPS at visit time), `note`, `photo_url`, `visited_at` |
| `journeys` | Curated themed itineraries (Alexander, Paul, Trajan) | `waypoints text[]` of Pleiades ids |
| `journey_progress(uid)` | Function returning per-journey visit counts | derived from `checkins ⨯ journeys` |

**RLS posture:** profiles + checkins are publicly readable (social proof on the
map); only the owner can write their own rows. `journeys` is read-only for
clients; we curate via the Supabase dashboard.

**Realtime:** `checkins` is added to the `supabase_realtime` publication so the
client can subscribe to live "X just checked in at Y" events.

**PostGIS:** enabled at the bottom of `0001_init.sql`. Not used yet; Stage 2's
"near me" will use `ST_DWithin(ST_MakePoint(lng,lat), <user>, 5000)`.

## One-time setup

1. Create a Supabase project at <https://supabase.com>.
2. In the dashboard → SQL Editor → paste the contents of
   `migrations/0001_init.sql` → Run.
3. In Authentication → Providers → enable **Email** (magic link, no password).
4. In Project Settings → API, copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY` (safe to commit, public by design)
5. Add both to `js/config.js` (see migration plan step 2).

## Local development (optional)

The Supabase CLI gives you a local Postgres + auth stack for offline work:

```bash
npm install -g supabase
supabase init
supabase start          # spins up Postgres + auth + realtime locally
supabase db push        # applies migrations/*.sql
```

Not required. The hosted free tier is fine through launch.

## Migration plan (LocalBackend → SupabaseBackend)

Designed so we can ship each phase independently, with `LocalBackend` as the
fallback at every step.

### Phase 1 — Wire the client (no behavior change)

- Add `js/config.js` exporting `SUPABASE_URL` + `SUPABASE_ANON_KEY`.
- Load the Supabase JS client from CDN in `index.html` (no build step).
- Initialize a global `window.VIA_SB` client, but don't use it yet.

**Acceptance:** `window.VIA_SB.auth.getSession()` resolves in the console.

### Phase 2 — Build SupabaseBackend behind the same API

- New backend object in `js/auth.js` implementing the same shape as
  `LocalBackend`: `currentUser`, `signIn`, `signOut`, `checkIn`,
  `removeCheckIn`, `getCheckin`, `getUserCheckins`, `getSiteVisitCount`.
- Pick backend at boot via `window.VIA_USE_SUPABASE` flag (default off until
  Phase 3 lands).

**Acceptance:** flipping the flag on a dev build runs all check-in operations
against Supabase with no UI changes.

### Phase 3 — Swap the sign-in UX

- Auth modal becomes: email field → "Send magic link" → check inbox.
- Keep a "Continue as guest" option that routes to `LocalBackend` so users can
  still try the app without an account.
- On successful sign-in, prompt: "We see you have N local check-ins. Import
  them?" → migrate to Supabase via a one-shot `importLocalCheckins()`.

**Acceptance:** sign in on phone, sign in on laptop, see the same check-ins.

### Phase 4 — Realtime social layer

- Subscribe to `checkins` inserts.
- For each event within ~500 km of the map viewport, briefly pulse that site's
  marker and increment its visit count without a refetch.

**Acceptance:** open the site in two browsers; check in on A, see the pulse on B.

### Phase 5 — Journeys

- Seed `journeys` with the 10 curated itineraries.
- Client fetches `journeys` + per-user progress via `journey_progress(uid)`.
- New UI: journey switcher in topbar, glowing polyline on map, prev/next
  navigation in the site panel when a journey is active.

**Acceptance:** sign in, pick "Alexander's Campaign," see the route, check in at
3 waypoints, see "3 of 14" reflected everywhere.

## Cost & scaling

- Free tier: 500 MB DB, 50 K MAU, 5 GB storage, 1 GB egress. Fine through soft
  launch.
- Pro tier ($25/mo): kicks in at ~10 K MAU or 500 MB DB.
- Exit path: `pg_dump` produces a portable Postgres dump. The only Supabase
  surfaces we depend on are auth (replaceable with Auth0/Clerk/Lucia) and
  realtime (replaceable with PG `LISTEN/NOTIFY` + a WebSocket layer).
