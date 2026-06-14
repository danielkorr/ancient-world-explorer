# CLAUDE.md — VIA (Ancient World Explorer)

> This file is loaded by Claude Code at the start of every session. Keep it lean.
> Detailed docs live in `/docs` and `/docs/redesign`. Read them when the task touches their area.
>
> **Status:** proposed umbrella doc. The facts below are reconciled against the actual
> repo (2026-06). The current source-of-truth guide is still the root `/CLAUDE.md`;
> this file is staged to replace/merge with it once the redesign direction is locked.

## What this project is
**VIA — Ancient World Explorer.** An interactive map app that overlays the ancient
Roman world on the modern map: Roman roads, ancient sites/cities, and location-based
"quests" (sites missing photos or verified coordinates in the Pleiades gazetteer).
It draws on scholarly ancient-world data (Pleiades, ORBIS, Itiner-e) and lets users
record visits and submit photos of sites.

- **Live:** https://danielkorr.github.io/ancient-world-explorer/
- **Repo:** https://github.com/danielkorr/ancient-world-explorer (public)
- **Maintainer:** solo (Daniel). Side project, mission-first, with a path to modest revenue.
- **Workflow:** developed via Claude Code CLI inside PyCharm on Windows (PowerShell).

## Architecture in one paragraph
Static single-page app on GitHub Pages. **Vanilla JS, no build step, no package
manager, no tests, no framework** — Leaflet loaded from a CDN. **Supabase** is the
backend-as-a-service handling passwordless (email magic-link) auth and cross-device
sync. The app is **local-first**: guests use it with data in localStorage, then import
into a synced account on sign-in. This static + Supabase shape is intentional and
**should be kept** — see `/docs/redesign/DECISIONS.md` → D-01 before proposing a re-architecture.

Three runtime files do the work: `js/data.js` (curated content), `js/app.js` (the whole
map + UI), `js/auth.js` (the Supabase/local auth layer). Several `js/*.js` data files are
**auto-generated** — never hand-edit them.

## The one keystone decision
**Every ancient site is keyed on its Pleiades place ID.** This is the universal join key
that makes every other classical database plug in for free. **Already implemented:** sites
carry a `pleiades` field and the global `SITES` list dedups on it. Store third-party IDs
(Wikidata, DARE, Vici, etc.) as cross-references on the record, never a private ID scheme.
See `/docs/redesign/DATA-SOURCES.md`.

## What already exists (don't rebuild it)
- **Ingestion pipeline is live.** `scripts/build-sites.mjs` (Pleiades dump → `sites-pleiades.js`),
  `build-roads.mjs` (Itiner-e atlas → `roads-itinere.js`), `build-orbis.mjs` (ORBIS Dijkstra →
  `orbis-days.js`), `detect-pleiades-photos.mjs` (Wikidata P18 fan-out → `pleiades-photos.json`).
  These run at build time and emit cached JS the static app reads. The "stand up an ingestion
  script" task in the redesign is **already done** — the work is *enriching* it (see below).
- **Pleiades→Wikidata fan-out exists but is shallow:** today it only resolves portrait photos
  (P18). The redesign's richer Site schema (`xref{}`, `media[]`, `texts[]` with per-item
  license) is the real expansion, not a greenfield build.
- **Supabase schema is provisioned:** `supabase/migrations/0001_init.sql` defines `profiles`,
  `checkins`, `journeys` with RLS on. Public creds live in `js/config.js` (safe to commit).
- **Mobile tap breakage is fixed** (iOS `touchend` delegation in `app.js`). Keep a crawler as
  a regression gate, but the originating bug is closed.

## Hard "don'ts" (these encode real constraints)
- **Don't** call `supabase.auth.*` methods. This project uses **ES256 signing keys**, which
  hang every `sb.auth.*` call in supabase-js 2.49.4 (internal `getUser()` never returns). The
  code works around it by decoding JWTs by hand from localStorage and using ONLY `.from()`
  PostgREST queries. See `js/auth.js` and root `/CLAUDE.md` → "ES256 auth wedge". This is the
  single most load-bearing constraint in the codebase.
- **Don't** hand-edit the auto-generated files: `js/sites-pleiades.js`, `js/roads-itinere.js`,
  `js/orbis-days.js`, `js/pleiades-photos.json`. Edit the generators in `scripts/`, then rebuild.
- **Don't** forget the `?v=N` cache-bust token in `index.html` on every css/js change, or
  mobile Safari serves stale code. Bump every sub-resource reference, not just the page URL.
- **Don't** call volunteer-run scholarly APIs (Pleiades, Vici, etc.) live at runtime. Pull
  them in the build-time pipeline, cache to our own store. (See ARCHITECTURE → Ingestion.)
- **Don't** put secrets in client code or gate "paid" features in the browser. Static front
  end ships all its code to the user; client-side gating is not security. The `sb_publishable_*`
  key in `config.js` is safe; a `sb_secret_*`/service-role key never is. (D-01.)
- **Don't** ingest **CC-BY-NC** or unknown-license data into anything monetized. Audit each
  source's license first. (See DATA-SOURCES → licensing matrix, D-06.)
- **Don't** push raw user photos straight into scholarly records. Contributions back to
  Pleiades/Pelagios must be vetted + attributed. (See DESIGN → Contribution, D-07.)

## Revenue model (shapes priorities, not the stack)
NGO + corporate (travel/hospitality) **sponsorships**, plus travel **affiliate links**.
All visibility-based — no paywall, no protected backend required. Keep NGO/partner
placements visually separate from commercial ones. A config-driven placements layer is
**not built yet** (`config.js` holds only Supabase creds today). See DESIGN → Monetization,
and reconcile with the detailed `docs/v1-spec-photo-quest.md` (E6 affiliate slice).

## Known issues
- **Ancient map tiles** intermittently unavailable (falls back to a sepia-tinted modern map).
  Candidate fix: a reliable period-tile source (AWMC / DARE / Pelagios). Verify licenses first.
- ~~Mobile control breakage~~ — **fixed** (iOS touchend delegation). A `tools/mobile-crawler.mjs`
  Playwright gate is *proposed* (`tools/` dir does not exist yet) to keep it from regressing.

## Open questions — genuinely undecided (the rest are now answered above)
- [ ] **D-08 Product identity:** mission-first heritage tool vs. commercial-first travel
      product. Current lean: mission-first. Sets guardrails for all monetization work.
- [ ] **D-02 Hosting/repo:** stay on Pages (+Pro for private repo) vs. Cloudflare Pages
      (private repo, free tier). Pure cost/consolidation call — private repo ≠ private app.
- [ ] **Front-end evolution:** stay vanilla, or refactor the view/state layer toward
      `UI = f(state)`? The multi-modal state in `app.js` (era × layers × filters × panel) is
      a likely bug source as features grow. Not urgent; flag when it bites.

## Doc map
- `/CLAUDE.md` (root) — **current** source-of-truth guide: full architecture, the ES256
  wedge in detail, build scripts, the social/auth layer, gstack skills. Read this first.
- `/docs/redesign/ARCHITECTURE.md` — target system design, richer data model, ingestion, hosting.
- `/docs/redesign/DESIGN.md` — product vision, monetization, quests, contribution model, UX.
- `/docs/redesign/DATA-SOURCES.md` — integration registry + per-source licensing matrix.
- `/docs/redesign/DECISIONS.md` — decision log (the *reasoning* behind the choices above).
- `/docs/v1-spec-photo-quest.md` — the detailed, eng-reviewed build spec for the Photo-Quest
  contribution loop. Sits *underneath* this umbrella; the redesign's contribution + placements
  sections describe the same work at higher altitude. Keep the two in sync.

## Suggested next tasks (revised — the spine's first three are already built)
1. **Settle the two forks** (D-08 identity, D-02 hosting) — they gate everything downstream.
2. **Enrich the ingestion pipeline:** extend the Wikidata fan-out beyond P18 to fill the full
   Site schema (`xref{}`, `media[]`, `texts[]`), tagging every asset with `license` +
   `commercial_ok`. Add the license-filter build step (D-06).
3. **Add the placements config layer** (partner vs. commercial slots); reconcile with v1-spec E6.
4. **Fix the ancient-tile source** (reliable period basemap, license-checked).
5. Stand up `tools/mobile-crawler.mjs` as a release gate so the mobile fix can't regress.
