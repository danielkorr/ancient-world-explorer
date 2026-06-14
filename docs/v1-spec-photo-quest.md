# VIA v1 Spec — The Photo-Quest Contribution Loop

Status: DRAFT for build. Locked scope from the 2026-06-13 CEO review.
Reference: `~/.gstack/projects/danielkorr-ancient-world-explorer/ceo-plans/2026-06-13-traveler-uploads.md`

## The one-sentence goal

A signed-in traveler standing at a Photo-Quest site uploads a photo, watches it
count toward their progress, and — if approved and they were first — lands their
name on the panel everyone after them reads. One action, two payoffs (the fun
"I was first" moment + the scholarly "I documented this" framing).

## Scope (locked — build exactly this, nothing more)

| # | Item | Why it's in v1 |
|---|------|----------------|
| Core | Photo-Quest upload → private bucket, pending by default, dashboard moderation | The retention loop + the demand test |
| E2 | "First to document" permanent credit on the panel | Cheap, huge psychological pull |
| E6 | Affiliate "stay / tour" links on the panel | Near-zero build, commercial-intent test |
| Trust | RLS + private bucket + signed URLs + EXIF GPS strip + CC-BY consent + own-work attestation | Security boundary, 10x harder to retrofit |

Out of scope (deferred to TODOS.md): widening quest→contribution (E1), shareable
cards (E3), Commons re-detection auto-complete (E5), explorer profiles (E4),
leaderboards (E7), API/MCP. Do not build these now.

---

## 1. Data model — migration `0002_contributions.sql`

A photo is a richer object than a check-in (it needs moderation status, a license,
an attestation, a reviewer). The existing `checkins` table stays as-is — one row
per (user, site), the social "I was here" object. Photos get their own table.

```sql
-- ── CONTRIBUTIONS (photo submissions) ────────────────────
create table public.contributions (
  -- id is CLIENT-MINTED (crypto.randomUUID), not server-defaulted: the storage
  -- paths embed the id, but we need the paths filled on INSERT — so the client
  -- generates the id first, builds the paths from it, then inserts. (Codex #13)
  id             uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  site_pleiades  text not null,
  site_name      text not null,                 -- denormalized for admin lists
  original_path  text not null unique,          -- full-res STRIPPED webp, private bucket, never served (T1)
  display_path   text not null unique,          -- 1600px stripped webp, private until approved
  public_url     text,                          -- set on approve: permanent public-bucket URL of the display webp
  caption        text check (length(caption) <= 280),
  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected')),
  license        text not null default 'CC-BY-4.0',
  -- provenance / source (Codex #12 — so seeding doesn't force a false own_work):
  source         text not null default 'user'
                   check (source in ('user','editorial')),
  own_work       boolean not null default false,-- user attestation; required true for source='user'
  source_url     text,                          -- editorial seeds: where the photo came from
  author_credit  text,                          -- editorial seeds: original author / required attribution
  consent_at     timestamptz not null default now(),
  user_lat       numeric(9,6),                  -- GPS at capture (proof of presence) — NEVER publicly exposed (Codex #2)
  user_lng       numeric(9,6),
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,
  reject_reason  text,
  created_at     timestamptz not null default now()
);

-- per-site approved-photo lookup + "first documenter" (min created_at)
create index contributions_site_approved_idx
  on public.contributions (site_pleiades, created_at)
  where status = 'approved';
-- a user's own submissions (their pending queue)
create index contributions_user_idx
  on public.contributions (user_id, created_at desc);

-- ── ADMIN AUTHORITY (Codex #1 — NEVER a column on a user-writable row) ──
-- profiles.is_admin would be self-escalatable: profiles_update lets a user write
-- their own row (0001_init.sql:112), so `update profiles set is_admin=true` =
-- instant admin. Admin lives in its OWN table with NO write policy → the only way
-- in is the service role (SQL editor / dashboard), which bypasses RLS.
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- read: admins may see the roster; NO insert/update/delete policy exists, so RLS
-- denies all writes through the API. Grant yourself once via the SQL editor:
--   insert into public.admins (user_id) values ('<your-auth-uid>');
create policy admins_read on public.admins for select using (public.is_admin());

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
-- (SECURITY DEFINER bypasses RLS on admins, so admins_read calling is_admin()
--  does not recurse.)

-- ── RLS — contributions (Codex #2: raw table is NOT publicly readable) ──
alter table public.contributions enable row level security;

-- read: owner sees their own (any status); admin sees all. The PUBLIC does NOT
-- read this table directly — they read the sanitized `site_photos` view below,
-- which never exposes user_lat/user_lng, consent, or private paths.
create policy contributions_read on public.contributions for select using (
  auth.uid() = user_id or public.is_admin()
);
-- insert: a normal user may only insert their own pending, own-work, source='user'
-- row; an admin may insert editorial seeds (own_work=false, source='editorial').
create policy contributions_insert on public.contributions for insert with check (
  (auth.uid() = user_id and status = 'pending' and source = 'user' and own_work = true)
  or public.is_admin()
);
-- update: ONLY an admin may change a row (this is the moderation gate)
create policy contributions_update on public.contributions for update using (public.is_admin());
-- delete: owner may withdraw their own (still-pending) submission; admin may delete any
create policy contributions_delete on public.contributions for delete using (
  public.is_admin() or (auth.uid() = user_id and status = 'pending')
);

-- ── PUBLIC PROJECTION (Codex #2) ──────────────────────────
-- The only thing the public/anon role ever reads. A plain (definer-semantics)
-- view owned by postgres bypasses the table's restrictive RLS but exposes ONLY
-- safe columns, and only approved rows. No GPS, no consent, no private paths.
create view public.site_photos as
  select c.id, c.site_pleiades, c.site_name, c.public_url, c.created_at,
         c.source, c.source_url, c.author_credit,
         c.user_id, p.name as contributor_name
  from public.contributions c
  left join public.profiles p on p.id = c.user_id
  where c.status = 'approved' and c.public_url is not null;  -- hide not-yet-moved
grant select on public.site_photos to anon, authenticated;
```

Note: the `checkins` table already carries a `photo_url` column (migration 0001
line 46). Leave it unused for v1 — photos live in `contributions`, not on the
check-in row. Don't delete the column; it's harmless.

### "First to document" — derived, not stored

No extra column. The first documenter of a site is the earliest *surviving*
approved row, read straight off the public view:

```sql
select id, contributor_name, user_id, created_at
from site_photos
where site_pleiades = $1
order by created_at asc
limit 1;
```

Earlier `created_at` always wins, so it can't be re-earned by a later upload.

**Caveat (Codex #14): not "permanent by construction."** Admin deletion or
`auth.users ON DELETE CASCADE` (a contributor deletes their account) removes the
winning row, and the credit shifts to the next-oldest survivor — and the deleted
row's public object is orphaned. Acceptable for v1 (it's still honest: credit goes
to the earliest *existing* contribution), but don't market it as "forever." If we
ever want true permanence, snapshot the first-documenter onto a per-site row at
approval time; deferred.

---

## 2. Storage — two buckets, public-on-approve (design B)

Boring by default. No reliance on anon `createSignedUrl` respecting an RLS
subquery (unproven against the anon role, and a silent-failure footgun on a
static site with no server logs). Approved photos live in a plain public bucket
with permanent CDN URLs. Pending photos and full-res originals stay private.

Two buckets:

- **`via-uploads`** — **PRIVATE**. Holds, per submission, BOTH:
  - `{site_pleiades}/{contribution_id}/original.webp` — full-res but **EXIF-stripped**
    (T1, keep-stripped). Canvas-re-encoded at full resolution: keeps Commons-grade
    pixels, retains ZERO GPS/metadata. Never served publicly. (We do NOT keep raw
    camera bytes — two independent reviews flagged retained EXIF-GPS as a privacy/
    retention liability for a speculative feature.)
  - `{site_pleiades}/{contribution_id}/display.webp` — 1600px stripped webp, the
    moderation preview. Owner + admin only while pending.
- **`via-photos`** — **PUBLIC read**. Holds approved display webps only:
  `{site_pleiades}/{contribution_id}.webp`. Plain permanent URL, CDN-cached, no
  signing. This is the only image the public ever sees.

```sql
-- via-uploads (private): authenticated owner may write objects that map to a
-- pending row they own; owner + admin may read; nobody else can.
create policy uploads_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'via-uploads'
  and exists (
    select 1 from public.contributions c
    where c.user_id = auth.uid() and c.status = 'pending'
      and (name = c.original_path or name = c.display_path)
  )
);
create policy uploads_read on storage.objects for select using (
  bucket_id = 'via-uploads'
  and exists (
    select 1 from public.contributions c
    where (name = c.original_path or name = c.display_path)
      and (c.user_id = auth.uid() or public.is_admin())
  )
);
-- DELETE policy is REQUIRED for cleanup (Codex #7): without it, a failed-upload
-- object can never be removed, and deleting the row first would strip the very
-- authorization needed to delete the object. So: delete OBJECTS first, then row.
create policy uploads_delete on storage.objects for delete to authenticated using (
  bucket_id = 'via-uploads'
  and exists (
    select 1 from public.contributions c
    where (name = c.original_path or name = c.display_path)
      and (c.user_id = auth.uid() or public.is_admin())
  )
);
-- via-photos: marked PUBLIC at bucket creation → anon read needs no policy.
-- Writes happen only via the approval path (service-role / Edge Function),
-- never from the browser, so no INSERT policy for authenticated/anon.
```

Upload ordering + teardown (Codex #7):
1. **Insert** the `contributions` row FIRST (pending, with `id`, `original_path`,
   `display_path` all filled — the INSERT storage policy needs the row to exist).
2. **Upload** original.webp + display.webp to `via-uploads`.
3. **On failure**, clean up in this order: delete the uploaded OBJECTS first
   (while the row still exists to authorize it via `uploads_delete`), THEN delete
   the row. Deleting the row first would orphan the objects permanently.

### Move-on-approve — Edge Function on a database webhook (decided)

When an admin flips `status` to `approved`, the `display.webp` must be copied from
`via-uploads` → `via-photos` and `public_url` written back. Copying a storage object
needs a storage API call, so this can't be pure dashboard-clicks. We make it atomic
with the status flip via a **Supabase Edge Function** triggered by a **Database
Webhook** on `contributions` UPDATE. This closes the silent-failure hole of the
manual path (admin flips status, forgets to move the file → approved row with no
public photo, no error anywhere).

```
admin sets status='approved' in dashboard
        │
        ▼
Database Webhook (UPDATE on contributions)  ── fires AFTER commit, via pg_net
        │  POST { record, old_record }          (async dispatch, NOT guaranteed-
        ▼                                         retry; see reliability note)
Edge Function  approve-photo  (Deno, ~30 lines, service-role key)
        │  GUARD: process iff  record.status == 'approved'  &&  record.public_url IS NULL
        ├── storage.from('via-uploads').download(display_path)
        ├── storage.from('via-photos').upload(`${pleiades}/${id}.webp`, blob,
        │        { upsert: true })                 ← tolerate object already there
        └── update contributions
                set public_url = <public via-photos url>, reviewed_at = now()
              where id = record.id and public_url is null   ← the DB write is what
                                                              clears the guard
```

- **Service-role key** lives only in the Edge Function's secrets (server-side),
  never in the client. This is the ONLY place the service role is used.
- **Idempotency keyed on `public_url IS NULL`, not on a status transition**
  (Codex #6). The job is "this row is approved but not yet moved." Re-firing on an
  already-moved row hits the guard and no-ops. `upsert:true` tolerates a half-run
  where the object uploaded but the DB write didn't.
- **Reliability — there is ALWAYS a window of `approved + public_url=null`, and a
  dropped dispatch may never auto-retry** (Codex #4, #5: Supabase webhooks are
  post-commit async via `pg_net`, with response *logging*, not durable retry). Two
  mitigations, both cheap:
  - **Manual re-trigger:** because the guard is `public_url IS NULL`, ANY further
    UPDATE on a stuck row re-fires the webhook and the function completes. So the
    admin's recovery action is just "touch the row" (e.g. re-save it) — no special
    tooling. Document this.
  - **Backfill sweep (recommended):** a `pg_cron` job every few minutes that finds
    `status='approved' and public_url is null` older than N seconds and re-invokes
    the function (or POSTs the webhook). Closes the dropped-dispatch hole entirely.
- The client tolerates the window too: `getSitePhoto` ignores rows with null
  `public_url` (the `site_photos` view can keep them or filter them — filter is
  cleaner; add `and public_url is not null` to the view), so a not-yet-moved
  approval simply shows the gradient hero until the move lands. No crash, no blank.
- **Rejection path** stays pure-dashboard (`status='rejected'` + `reject_reason`;
  the guard's `status='approved'` check skips it).
- The project's first non-static component. Supabase-hosted (no infra you run),
  deployed with `supabase functions deploy approve-photo`.

---

## 3. Trust & safety mechanics

1. **Pending by default.** Nothing is public until an admin flips `status` to
   `approved`. RLS enforces it — not UI politeness.
2. **EXIF GPS strip — on BOTH copies (T1, keep-stripped).** Nothing with embedded
   EXIF is ever stored. The browser produces two canvas-re-encoded blobs, both via
   `canvas.toBlob('image/webp', q)` which drops ALL metadata including GPS:
   - **original.webp** — full resolution (no downscale), quality ~0.9. Commons-grade
     pixels, zero retained metadata.
   - **display.webp** — max edge 1600px, quality 0.82. The public/preview image.
   We capture coordinates separately from `navigator.geolocation` into
   `user_lat/user_lng` (structured, never publicly exposed — see the `site_photos`
   view). So: full-res preserved for a future Commons hand-off, GPS retained nowhere
   in any stored pixel, proof-of-presence kept as deliberate data we control.
   Guard: very large source images can exceed browser canvas limits — if the
   full-res `toBlob` returns null, fall back to capping the original at ~4000px.
3. **License + attestation, recorded per row.** Upload is blocked unless the user
   ticks "This is my own photo and I license it CC-BY 4.0." `own_work = true` and
   `consent_at` are written on the row; RLS rejects inserts without `own_work`.
4. **Admin identity.** A dedicated `admins` table with NO write policy (Codex #1).
   Grant yourself once via the SQL editor (`insert into admins (user_id) values
   ('<your-uid>')`) — the service role bypasses RLS; the API cannot. `is_admin()`
   gates every moderation action. Admin is NOT a column on the user-writable
   `profiles` row (that would be self-escalatable).
5. **Moderation surface (v1).** Supabase dashboard. Admin filters
   `contributions` for `status = 'pending'`, views the image in the Storage
   browser, sets `status` to `approved`/`rejected` (+ `reject_reason`,
   `reviewed_by`, `reviewed_at`). No in-app admin UI in v1.

---

## 4. `auth.js` API additions

Extend the `VIA.auth.*` surface. Implement in `SupabaseBackend`; stub in
`LocalBackend` so guest mode degrades gracefully (returns empty / throws
"sign in to contribute"). Keep the optimistic-then-reconcile pattern already
used by `checkIn`.

```
VIA.auth.submitPhoto(site, { originalBlob, displayBlob, caption, userLat, userLng })
  → 0) id = crypto.randomUUID(); build original_path/display_path from it (one
       shared path-builder used for BOTH the column value and the .upload() key);
    1) insert a pending contributions row { id, original_path, display_path, ... };
    2) upload originalBlob (full-res stripped webp) → via-uploads/.../original.webp;
    3) upload displayBlob (1600px stripped webp)    → via-uploads/.../display.webp.
    Returns the row. On any failure: delete the uploaded OBJECTS first, then the
    row (Codex #7 ordering). Throws if not signed in or own_work consent missing.
VIA.auth.getSitePhoto(site)
  → reads the public `site_photos` VIEW (never the raw table). Returns
    { publicUrl, contributorName, contributorId, approvedAt, source, authorCredit }
    for the FIRST approved+moved photo of the site, or null. publicUrl is the plain
    public-bucket URL — no signing. (Editorial seeds carry source/authorCredit so
    the panel can attribute them correctly.)
VIA.auth.getMyContributions()
  → the signed-in user's submissions across all statuses (their pending queue),
    read from contributions under the owner RLS path.
```

Caching: add a `_sitePhotos` Map (site_pleiades → first-photo meta) loaded on boot
alongside `_loadSiteCounts` — a single `select ... from site_photos order by
created_at`, deduped to first-per-site — so the panel shows the documenter line +
hero photo with no per-open round trip. Refresh after `submitPhoto` and on the
realtime approval event if/when wired.

---

## 5. UI flow

### Upload entry point (the panel)

Photo-Quest sites already render a quest banner in `showPanel` (`app.js:390`).
Add an "Upload a photo" affordance there, and wire the existing check-in flow so
that on a Photo-Quest site the upload is the primary contribution action.

Flow:
1. Tap "Add the missing photo" on a photo-quest panel.
2. If signed out → existing `openAuthModal()` (same wall as check-in,
   `onCheckInClick` at `app.js:727`).
3. File picker (`<input type="file" accept="image/*" capture="environment">` so
   mobile opens the camera).
4. Build TWO **canvas-re-encoded** blobs from the picked file (both EXIF-stripped):
   `originalBlob` = full-res `toBlob('image/webp', 0.9)` (fall back to ~4000px cap
   if full-res returns null), `displayBlob` = 1600px `toBlob('image/webp', 0.82)`.
   Show `displayBlob` as the preview. (We never keep the raw camera file — T1.)
5. Consent checkbox (CC-BY + own-work). Submit disabled until ticked.
6. `navigator.geolocation.getCurrentPosition` for `user_lat/user_lng` (optional,
   same pattern as the future near-me work; don't block submit if denied).
7. `VIA.auth.submitPhoto(site, { originalBlob, displayBlob, ... })`. Show
   "Submitted — pending review. You'll be credited when it's approved." Progress
   meter ticks (a pending submission counts toward the user's own progress; see §5
   progress-meter note).

### Progress meter — count contributions, not just check-ins

The existing `updateQuestProgress` (`app.js:707`) counts distinct check-ins whose
`site_pleiades` is in `QUEST_PLEIADES`. A photo submission is NOT a check-in, so
without a change the upload loop's headline payoff silently fails to move the bar.
Per the `quest-tier-data-reality` learning there are 279 photo-quests — this is the
main event. Fix: `updateQuestProgress` unions the user's check-in `site_pleiades`
set with the user's contribution `site_pleiades` set (via `getMyContributions()`),
so an upload ticks the meter immediately. Decide whether a *pending* submission
counts or only an *approved* one — recommend pending counts (instant feedback;
the meter is personal, not the public record).

### First-documenter credit line (E2)

In `showPanel`, after the description, render the documenter line when
`getSitePhoto(site)` returns a row:

> 📷 First documented by **{name}** · {date}

If the site has an approved photo, also paint it as the panel hero (replace the
`#panel-hero` gradient placeholder for that site with the public-URL image).

### Affiliate links (E6)

Append to the `panel-actions` block (`app.js:436`). Pure client, deep links built
from `site.lat/site.lng` and `site.modern`. Partner IDs live in `config.js` as
placeholders until real affiliate accounts exist.

```
🛏  Stay near {modern}      → Booking.com affiliate deep link
🎟  Tours & tickets         → GetYourGuide / Viator affiliate search by geo
```

Gate behind a `VIA_CONFIG.AFFILIATES` flag so they're easy to hide until the
accounts are live. Label them honestly ("affiliate") — trust matters to the
scholar half of the audience.

### Files touched

- `supabase/migrations/0002_contributions.sql` — new: `contributions` table,
  `admins` table, `is_admin()`, `site_photos` view, all RLS (table + storage,
  incl. the storage DELETE policy), optional `pg_cron` backfill sweep.
- `supabase/functions/approve-photo/index.ts` — new (Edge Function: move-on-approve).
- `supabase/README.md` — bucket creation, **admin grant via `admins` insert** (not a
  profile flag), webhook + function deploy, the backfill sweep, moderation steps.
- `js/auth.js` — `submitPhoto`, `getSitePhoto` (reads `site_photos` view),
  `getMyContributions`, `_sitePhotos` cache, `_loadSitePhotos`; a shared
  `contributionPaths(id, pleiades)` builder; LocalBackend stubs. **Pre-req cleanup:**
  hoist the `projectRef` derivation (copy-pasted at auth.js:78, 196, 282, 314) into
  one helper before adding a 5th use.
- `js/app.js` — upload modal, `showPanel` documenter line + hero photo, affiliate
  buttons, the two-blob canvas encoder, `updateQuestProgress` union with contributions.
- `js/config.js` — `AFFILIATES` block (Booking/GYG/Viator partner IDs, placeholder).
- `index.html` — upload modal DOM, documenter line element; bump every asset `?v=` token.
- `css/style.css` — upload modal, consent row, documenter line, hero-photo styling.

---

## 6. Build order

0. **Storage-wedge spike (GATING — do before the migration).** The whole loop runs
   through `sb.storage.from().upload()` from the browser, and storage is a THIRD
   supabase-js subsystem — not proven safe under the ES256 wedge like `.from()` is.
   In the console on the live site, signed in, run an actual authenticated
   `VIA_SB.storage.from('via-uploads').upload(...)` with a hard timeout. If it
   hangs, the storage design needs a pre-signed-URL / direct-REST escape hatch and
   the auth.js surface changes. Storage uses direct HTTP so it's *likely* fine, but
   unproven — find out before building on it. (Codex #3 + Claude subagent agree.)
1. **Migration + buckets** (0002; `via-uploads` private + `via-photos` public; the
   `admins` table; grant yourself admin via `insert into admins`; table + storage
   RLS incl. DELETE; the `site_photos` view; optional pg_cron sweep). Verify RLS in
   the SQL editor — especially that a non-admin CANNOT self-grant admin and CANNOT
   read another row's `user_lat/user_lng`.
1.5. **Public/private boundary spike.** Put a webp in `via-photos`, open its public
   URL logged-out → renders. Put one in `via-uploads`, logged-out → DENIED.
2. **Edge Function** `approve-photo` + **auth.js methods**. Console-test the full
   move: `submitPhoto` → approve → function moves file + sets `public_url` →
   `getSitePhoto` returns it → photo loads logged-out. Test the reconcile lever
   (touch a stuck `approved + public_url null` row → it completes).
3. **Upload modal + panel wiring** in app.js/html/css (incl. the two-blob encoder).
4. **Documenter line + hero photo** (E2) + **progress-meter union** (§5).
5. **Affiliate links** (E6) — last, trivial, behind the config flag.
6. Cache-bust `?v=` (bump the token per the `cache-bust-version-token` learning),
   deploy, dogfood the full loop on mobile (camera → pending → approve → photo
   appears logged-out → name credited → meter ticked).
7. **SEED FIRST, THEN OPEN (T3).** Before exposing the upload UI to the public,
   seed a wedge region (Bay of Naples) to ~80% via the EDITORIAL path
   (`source='editorial'`, `own_work=false`, `source_url` + `author_credit` filled —
   the schema supports honest third-party attribution; Codex #12). Never launch an
   empty game. The dashboard-only path proves "photos look good," not "people will
   contribute" — so seed, then ship the real loop to users.

---

## 7. Decisions

### Resolved (2026-06-13 eng review + Codex outside-voice round)
- **Separate `contributions` table** (not a column on `checkins`). ACCEPTED.
- **Storage = design B** (two buckets, public-on-approve). ACCEPTED. Codex #10
  confirmed the private/public split over a single-public-bucket shortcut.
- **Keep originals, but FULL-RES STRIPPED** (T1). Canvas-re-encoded at full
  resolution — Commons-grade pixels, zero retained EXIF/GPS. Two reviews flagged
  retaining raw EXIF-GPS as a privacy liability; this keeps the asset, kills the risk.
- **Progress meter** unions check-ins + contributions; pending submissions count.
- **Move-on-approve = Edge Function on a database webhook**, idempotency keyed on
  `public_url IS NULL` + a reconcile lever / pg_cron sweep (Codex #4–6).
- **Admin authority = dedicated `admins` table, no write policy** (Codex #1). NOT a
  `profiles` column (self-escalatable).
- **Public reads go through the `site_photos` view, never the raw table** (Codex #2)
  — no GPS/consent/path leakage.
- **Seed first via the editorial path, THEN open** (T3); schema carries
  `source/source_url/author_credit` for honest third-party attribution (Codex #12).

### Still open
- **Affiliate partners.** Booking.com / GetYourGuide / Viator. Need accounts for
  real IDs. Build with placeholders + flag OFF; flip on when IDs exist. Which first?
- **Geolocation required for upload?** Assumed optional (don't block submit if
  denied) so desktop "upload my trip photo later" works. GPS is bonus proof, not a gate.
- **One photo per site or a gallery?** v1 shows the FIRST approved. Other approved
  photos are stored + count toward their contributor's progress; gallery is later.

---

## 8. Eng-review outputs (2026-06-13)

### What already exists (reused, not rebuilt)
- `checkins` optimistic-then-reconcile pattern (`auth.js:327`) → `submitPhoto` mirrors it.
- `openAuthModal()` sign-in wall (`app.js:729`) → reused verbatim as the upload gate.
- Quest banner render in `showPanel` (`app.js:390`) → upload affordance hangs off it.
- `_loadSiteCounts` boot-query pattern (`auth.js:424`) → `_loadSitePhotos` copies it.
- `scripts/detect-pleiades-photos.mjs` Commons→Wikidata→Pleiades pipeline → the
  future E5 promotion target the (stripped) full-res originals feed into.
- `crypto.randomUUID` (already in auth.js `uuid()`) → client-minted contribution id.

### NOT in scope (deferred, with reason)
- **Commons hand-off (E5).** v1 only PRESERVES originals + provenance; the actual
  upload to Wikimedia Commons is v1.5. Reason: Commons OAuth + upload API + scope
  rules would blow the v1 timeline.
- **In-app admin/moderation UI.** Dashboard-only for v1. Reason: one admin (you),
  low volume; an admin UI is premature.
- **Realtime "photo just approved" push.** `checkins` is already in the realtime
  publication; wiring a live approval pulse is deferred. Reason: not needed for the loop.
- **Gallery / multiple photos per site on the panel.** First-approved only. Reason:
  scope; storage + progress still capture the rest.
- **Trusted-reviewer roles.** Schema supports it; not built. Reason: single admin v1.
- **Affiliate real partner IDs.** Flag-off placeholders. Reason: needs partner accounts.

### Failure modes (each new codepath, one realistic prod failure)
| Codepath | Failure | Test? | Error handling? | User sees |
|----------|---------|-------|-----------------|-----------|
| `submitPhoto` row+upload | Upload dies after row insert → orphan row + objects | dogfood | Delete OBJECTS first, then row (Codex #7) | Retry prompt (must build) |
| Move-on-approve | Webhook dispatch dropped → row stuck `approved + public_url null` | dogfood | pg_cron sweep + touch-to-refire (Codex #4–6) | gradient hero until move lands |
| `getSitePhoto` | reads `site_photos`; null-url rows already filtered by the view | QA | view excludes `public_url is null` | No photo, no crash |
| canvas re-encode | Huge/odd image → full-res toBlob returns null | QA | Fall back to ~4000px cap, then error toast | "Couldn't process image" |
| `updateQuestProgress` union | Regression: breaks check-in-only count | **CRITICAL regression test** | n/a | Wrong progress number |
| RLS self-escalation | user tries `update profiles set is_admin` | **must-verify in SQL editor** | `admins` table has no write policy (Codex #1) | denied |
| Geolocation | User denies / times out | QA | Optional, null coords | Submit still works |

**Closed since the first pass:** the manual-move silent-failure is gone (Edge
Function + reconcile). The new watch-item is webhook *dispatch loss* — covered by
the pg_cron backfill sweep and the touch-to-refire lever.

### Parallelization
Mostly sequential — the migration + storage boundary is the foundation everything
else stands on, and the UI all lives in `app.js`. One genuine parallel lane:
- **Lane A** (blocks everything): migration + buckets + storage spike + auth.js methods.
- **Lane B** (independent, can start anytime): affiliate links (E6) — pure client,
  `config.js` + `app.js:436` panel-actions, touches nothing in Lane A.
Lanes A and B both edit `app.js` → merge-coordinate, or just do B last (it's trivial).
```

