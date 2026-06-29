# VIA — Session checkpoint (updated 2026-06-29)

## Status at a glance
- **`main`** — clean, current, everything below shipped & live on GitHub Pages.
  Cache tokens: `app.js` / `style.css` = **v111**, `sites-linked-data.js` = **v107**
  (the data files config/orbis/pleiades/vici still ride **v106**, unchanged).
- **`alexander-module`** — new feature branch (origin-tracked), the Alexander
  campaign layer isolated off `main`. Not deployed. See its section below. ⏭ resume there.
- HEADs: `main` = `0c07cd3`, `alexander-module` = `bcea734`
  (branch now **6 commits behind** `main`: linked-data + map polish + topbar + the
  v109–v111 map-features/declutter work below).

---

## Shipped this session (on `main`, live)

- **Dual-name labels + Empire inset** (`8af3474`) — two OrganicMaps-inspired features.
  *Names* layer chip (bottom controls) paints permanent on-map labels pairing the
  ancient name (Cinzel gold) over the modern one (dim Inter), e.g. *Londinium / London*;
  gated three ways so it never clutters: layer on **+** zoom ≥ `MIN_LABEL_ZOOM` (7) **+**
  marker individually visible (not clustered). Non-interactive tooltips (never steal a
  tap); `refreshNameLabels()` re-runs on view change and whenever the marker set changes.
  *Empire inset* = a fixed top-left locator (desktop only, **collapsed by default** to a
  "The Empire ▸" pill) showing the DARE atlas at empire scale over a keyless sepia CARTO
  floor, with a gold rectangle tracking the main viewport; click to fly there. Own
  tile-layer instances; skipped in `?qa=1`.
- **Chrome declutter** (`3326a05`) — fixed a **pre-existing** desktop double-toggle: the
  legend's Roman Roads / Sites & Cities rows are meant to be mobile-only but
  `.legend-row{display:flex}` was beating `.legend-layer-row{display:none}` on source
  order, so they leaked onto desktop and duplicated the bottom-left chips. Scoped the
  hide/show rules to `#quest-legend .legend-layer-row` so they win. Also moved the empire
  inset out of the bottom-left corner (it collided with `#bottom-controls`) into the free
  top-left slot below the era toggle.
- **Hover-label cleanup** (`0c07cd3`) — desktop hover stacked two labels wherever a
  curated road overlaps the Itiner-e baseline. Trimmed the curated-road tooltip from
  name+desc+date (3 lines) to just the road name (full desc/date still open in the road
  panel on click), and the cursor-following segment-name readout now suppresses itself
  while a `.road-tip` is open (it named the same road). The new dual-name layer was NOT
  the culprit — verified correctly gated off below zoom 7.
- **Pleiades Linked Data Sidebar** — site panels show a "Primary sources &
  evidence" card: inbound scholarly cross-refs (EDH inscriptions, ToposText texts,
  Nomisma coins, MANTO myth, AGO, PAThs). **Evidence-only by design** — Vici, Itiner-e,
  and identity hubs (Wikidata/GeoNames/Getty/VIAF/Trismegistos/WHG) are excluded
  (already in VIA or one Pleiades click away). Built for all **960 foreground markers**
  (470 have data); coverage long-tail excluded. Builder `scripts/build-linked-data.mjs`
  reads the `pleiades.datasets` GitHub bulk `data/sidebar/` (sidesteps the live-site
  bot wall), caches `.cache/pleiades-sidebar/`, emits `js/sites-linked-data.js`.
  Commits `414661b` (spike) → `fa63a6a` (foreground) → `8d7201a` (cache).
- **Map polish** (`988705b`): primary roads toned down (casing 6→4.5 @ opacity 0.7,
  saffron core 3→2 @ 0.92 — quieter on first load, keeps luminance contrast);
  documented markers 9→11px; coverage dots now scale with zoom (3px→7px at z14+);
  search-select pulse 2→4 rings.
- **Topbar desktop fixes** (`bdd57c3`): "Ancient World Explorer" subtitle 8→11px @
  opacity 0.45→0.72; Sign-in pill enlarged + full-gold text + gold-dim border (peer
  of the era toggle). **Mobile subtitle stays hidden** — at 375px it collides with the
  centered era toggle (verified); comment in the mobile CSS records why.
- **WebKit/touch test harness** — `tests/webkit-touch/` (Playwright WebKit + iPhone,
  real `touchscreen.tap()`), the only test that exercises the `COARSE_POINTER`/`touchend`
  path Chromium/`browse` can't. Also installed machine-wide as the **`/webkit-touch`
  skill** (`~/.claude/skills/webkit-touch/`, local-only — `.claude/` is gitignored;
  VIA's `tests/webkit-touch/` is the portable reference). One-time setup: `npm install`
  + `npx playwright install webkit` (no Mac needed). Gotcha: WebKit-on-Windows reports
  `maxTouchPoints=0`, so the test asserts the `coarse||maxTouch||ontouchstart` composite.

---

## Alexander module — branch `alexander-module` ⏭ RESUME HERE for that work

In-progress campaign-route layer, deliberately isolated off `main` so the live site
stays focused. Pushed to origin (tracking set).

**What's on the branch** (commit `bcea734`, branched from `main @ 988705b`):
- `js/alexander.js` (`ALEXANDER_STOPS` data), `docs/v2-spec-alexander-layer.md`,
  `docs/alexander-wireframes.html`.
- `app.js`: `alexanderRouteGroup`/`StopsGroup`, route+stop rendering, phase styling,
  `showAlexanderPanel`, `findNearestAlexanderStop`, `searchAlexander`, `layerState`
  + `toggleLayer('alexander')`, map-click resolution, panel-class reset.
- `index.html`: Alexander layer button + legend row + `alexander.js` script tag.
- `css`: `.swatch-campaign`, `.legend-line.alexander`, `#info-panel.alexander-panel`.

**Behind `main` by 2 commits** it doesn't have: `515ac15` (cache v107) and `bdd57c3`
(topbar fix v108). It DOES include the map-polish (`988705b` was its branch point).

**Integration risks when merging back into `main` (read before merging):**
1. **`index.html` version-token conflict.** Branch still has `app.js`/`style.css`
   `?v=106` (+ `alexander.js?v=106`); `main` moved them to `v108`. A merge WILL
   conflict on those `<script>`/`<link>` token lines. Resolve = take `main`'s `v108`
   for app/css, then bump again to bust cache, and re-add the `alexander.js` tag at the
   same version.
2. **`alexander.js` script tag lives only on the branch** — confirm it survives the
   merge (it's the one new asset main has never seen).
3. **`toggleLayer` restructure.** The branch changed the curated-roads `} else {` into
   `} else if (which === 'sites')` to add an `alexander` branch. Merge against main's
   current `app.js` and verify that chain is intact (no keyword-collision; it's the one
   Alexander change with no "alexander" string in it).
4. **Staleness.** Best to `git rebase main` (or merge main in) on the branch BEFORE
   resuming, to pull in road polish/topbar/cache bumps and shrink the eventual diff.

**Not to be confused with:** the OneDrive "Cowork" density folder — that was an
*old-architecture* fork that bulk-injected ~900 Pleiades places into a monolithic
`data.js`; it was rejected (would regress the build-split site, and those places already
exist in the coverage layer). Alexander is unrelated new work.

---

## Standing project rules (full detail in `CLAUDE.md` / `AGENTS.md`)
- No ES modules — plain global `<script>` tags. No build / package manager / test
  runner (the dev-only `package.json` exists solely to pin Playwright for webkit-touch).
- **Bump `?v=N` on every CSS/JS change** so mobile Safari refetches. Currently **v111**
  (app/css). Keep `app.js` and `style.css` matched.
- Don't hand-edit generated files: `js/roads-itinere.js`, `js/sites-pleiades.js`,
  `js/sites-coverage.js`, `js/sites-vici.js`, `js/sites-linked-data.js`, `js/orbis-days.js`,
  `js/pleiades-photos.json`. Don't touch Supabase auth (`js/auth.js`, ES256 wedge).
- Deploy = push to `main` (Pages). **`git log --oneline -1` to confirm a commit landed
  before calling it shipped** — the dev server serves uncommitted working-tree files.
- Mobile final sign-off = real iPhone Safari; `tests/webkit-touch/` is the headless net.

---

## Open threads (not done — condensed; expand from git history if revisited)
- **Photo Quest `#VIAquest` pipeline overpromises.** Panel step-3 promises confirmed
  submissions relayed to Pleiades, but no intake/curation pipeline exists. Right model =
  Intake → Dano curates → hand-off through Pleiades' own channels. Near-term: soften the
  copy OR stand up a real intake form. Dano to check Pleiades' contribution process for
  what's honestly promisable.
- **Top-chrome hierarchy.** The ANCIENT/MODERN era toggle is visually loud but
  functionally minor (set-once). Consider shrinking/subordinating it (search + nav are
  primary). Partly touched by the topbar fix; the toggle demotion itself is still open.
