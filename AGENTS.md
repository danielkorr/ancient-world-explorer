# AGENTS.md — context for Codex / outside-voice reviewers

**Read `./CLAUDE.md` first.** It is the full project guide (architecture, data model,
the social/auth layer, and the build scripts). This file is just the short list of
landmines you most need before reviewing or suggesting changes.

VIA — Ancient World Explorer: a static, single-page Leaflet map overlaying the Roman
world on a modern basemap (~95 ancient sites, Roman roads, quests for missing
scholarly documentation). Supabase backs auth + check-ins.

## Landmines (do not relearn these the hard way)

- **ES256 auth wedge.** This Supabase project uses ES256 asymmetric signing keys, which
  hang essentially every `supabase.auth.*` method in supabase-js 2.49.4 (they call
  `getUser()` internally, which never returns). The code works around it by decoding
  JWTs by hand from `localStorage` and using ONLY `.from()` PostgREST queries (those
  authenticate fine via the Authorization header). See `js/auth.js`. Never suggest
  `sb.auth.getSession()`, `setSession()`, `signOut()`, etc. — they are poisoned here.
  Note: `sb.storage.*` is a *third* subsystem; whether it is wedge-safe is unverified —
  flag any plan that assumes it is without proof.

- **No build, no package manager, no tests.** Plain HTML/CSS/JS with Leaflet from a CDN.
  Don't propose webpack/vite/jest/a framework. "Run the tests" doesn't exist; QA is
  manual (`/browse` + dogfooding). Deploy = push to `main` (GitHub Pages).

- **Auto-generated files — never hand-edit.** `js/roads-itinere.js`,
  `js/sites-pleiades.js`, `js/orbis-days.js`, `js/pleiades-photos.json`. They are
  rebuilt by scripts in `scripts/`. Edits belong in the generators, not the output.

- **Cache busting.** Local assets carry a `?v=N` token in `index.html`. Bump it on EVERY
  css/js change or mobile Safari serves stale code. `?v=` on the page URL alone does NOT
  work — each sub-resource reference must be bumped.

- **Commit before you call anything shipped.** The local dev server serves uncommitted
  working-tree files, so a phone on the LAN IP can show brand-new code while production
  is stale. "It works on my phone" is not "it shipped." Always `git log --oneline -1` to
  confirm the change is actually committed — and Pages deploys ONLY `main`, so commits on
  a feature branch are not live until merged. When a previously-fixed feature looks broken
  on the live URL, suspect this deploy gap BEFORE blaming cache.

- **Content model.** Curated sites + roads live in `js/data.js`; it derives the global
  `SITES`. `TYPE` / `QUEST` config objects in `js/app.js` must stay in sync with the
  type/quest strings used in `data.js`. Quest tier data reality: photo≈279, location≈10,
  text=0, documented≈184 — don't assume all tiers are populated.

## Expected workflow

- **Discovery-first for any non-trivial change.** Inventory the real code first, present a
  short mapping/plan of exactly what you'll touch, pause for confirmation, then implement.
  Blind-editing on assumptions is how the truncation bug, the inverted filter, and the
  touch-path/binding mix-up each slipped in — reading the actual code first caught all three.

## Active work

In-progress spec: `docs/v1-spec-photo-quest.md` (the v1 Photo-Quest contribution loop:
new `contributions` table, two storage buckets, Edge Function move-on-approve, EXIF
strip, first-to-document credit, affiliate links). Roadmap + deferred items: `TODOS.md`.
