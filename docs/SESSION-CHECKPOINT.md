# VIA — Session checkpoint (updated 2026-07-08)

## Status at a glance
- **`main`** — clean, live on GitHub Pages. HEAD `a37389c`. Since the older "shipped"
  list below it has also shipped: client-side **ORBIS journey routing** + fastest /
  shortest / cheapest toggle, **road-panel deep-links** to exact Itiner-e segments +
  their Pleiades places, **live Pleiades enrichment** for thin/coverage places,
  Barrington-note modern-name backfill, the **data-regen playbook + `/regen-data` skill**,
  and a journey-primer / brand-affordance UI pass.
- **`alexander-module`** — active feature branch, **27 commits ahead of `main`, 0 behind**
  (merge-base = `main@a37389c`). `main` is fully contained in the branch, so merging is a
  clean **fast-forward** — the old `index.html` version-token conflict risks are GONE.
  HEAD `7e9a94d`. Not yet deployed. Holds the whole Alexander campaign MODE plus Codex's
  Rome hero-photo layer. ⏭ resume here.
- **Cache tokens (branch `index.html`):** `app.js` **v142**, `style.css` **v137**,
  `alexander.js` **v111**, `alexander-photos.js` **v4**, `site-photos.js` **v1**,
  `sites-linked-data.js` **v107**; `data.js` / `auth.js` / `basemap.js` still **v106**.

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
- **Cluster-tap overhaul** (`11c66fc` → `382c9ff` → `bdbb1b7` → `8fc27a8`) — several rounds
  on the Bay-of-Naples clusters (Cumae/Baiae/Puteoli/Paestum). (1) On touch, tapping a
  cluster ran a blind `setView(+2)` that leaked into a member panel; now resolves the
  cluster first. (2) Per-tier clusters let a **lone marker overlap a cluster from another
  tier** (Puteoli atop the Cumae+Baiae photo "2") — the touch handler now **geometrically
  hit-tests** cluster bubbles (not `e.target`) and the cluster wins on overlap (nearest
  bubble centre when several overlap). (3) Cluster ZOOM is now driven on **both desktop +
  touch** via `zoomIntoCluster` (native zoomToBounds/spiderfy OFF). **Final approach: a
  gentle fixed `+2` step centred on the cluster** — fit-to-bounds was tried and reverted
  (fitting ALL members stranded the pair when one is 91km off; fitting only the dense knot
  over-zoomed to street level / "nowheresville"). +2 keeps you oriented and the cluster
  visibly splits (the "3" → a centred "2"); click again to go deeper. Coincident / max-zoom
  still spiderfy. See [[project-cluster-overlap-tap]]. Verified on the WebKit+touch harness.
- **Chrome gold-outline unify** (`1d4a18f`) — desktop controls used a gradient of border
  strengths (era toggle 0.22 / search 0.28 / detail 0.32); bumped all to the chips' &
  legend's `rgba(212,168,83,0.4)` so every control reads as one family. Active toggles
  still brighten to full gold (`var(--gold)`) as their on-state cue.
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

## Alexander module — branch `alexander-module` ⏭ RESUME HERE

The Alexander campaign, built as a top-level **MODE over the shared map/engine** (not a
bolt-on layer) — a tab that swaps content + chrome via `setMode`. Isolated off `main`
until the image work settles, then fast-forward-merge. **27 commits ahead / 0 behind**
`main` (HEAD `7e9a94d`), ~5,600-line diff across 16 files. Origin-tracked.

**What's on the branch:**
- **Mode scaffold** — `#mode-tabs` (Roman ↔ Alexander), `setMode` content/chrome swap,
  mode-scoped search, `?mode=alexander` deep-link, bidirectional cross-mode link chips.
  Shipped read-only on purpose (check-ins deferred by design — see
  [[project-alexander-mode-quest-ready]]).
- **Campaign data** — `js/alexander.js` (`ALEXANDER_STOPS` + `ALEXANDER_ROUTES`, ~30
  curated stops with Pleiades ids, Livius links, campaign phases); specs + wireframes in
  `docs/v2-spec-alexander-layer.md`, `docs/v2-alexander-mode-architecture.md`,
  `docs/alexander-wireframes.html`, plus the Fable-5 handoff/review docs.
- **Rendering** — route + stop groups on the shared canvas, phase styling,
  `showAlexanderPanel`, `findNearestAlexanderStop`, and a colorblind-first spotlight
  system (search **beacon** + legend phase/certainty **filters**, dual-tone so it reads
  under red-green vision); empire inset that follows the active mode (hidden on touch).
- **Hero photos (BOTH tabs)** — `js/alexander-photos.js` + `scripts/build-alexander-photos.mjs`
  (Pleiades → Wikidata P18 → Commons, per-file attribution); Codex's `js/site-photos.js`
  + `scripts/build-site-photos.mjs` (`SITE_PHOTOS`) do the same for Roman panels.
- **Recent UX fixes (this session, `cea2274`):** Hydaspes/Hyphasis river hero photos via
  their true Pleiades **river** ids (59837 Jhelum, 59839 Beas — NOT the conflated Sutlej
  60110); an honest "Pictured: the … river" caption (`#hero-caption`) so a river photo on
  a battle marker isn't misread; and a **persistent Alexander beacon + lit stop after the
  panel closes** — unselected stops render dim/near-invisible, so on mobile (panel covers
  the map) the selection used to vanish on the map-tap that dismissed the panel. Now it
  persists, is replaced on reselect, cleared on mode switch, dismissable via legend Clear.

**Merging is now a fast-forward.** `main` is fully contained in the branch, so the
earlier `index.html` token conflicts / `toggleLayer` restructure / staleness risks no
longer apply — do NOT re-plan around them. Just run the pre-merge gate below, FF-merge,
push. (Codex edits this branch in parallel on image work — reconcile before merging;
see [[feedback-codex-concurrent-git-status]].)

**Pre-merge gate — run this BEFORE merging `alexander-module` → `main`** (do NOT merge
until the image work has settled and all four pass; capture evidence for anything visual):
1. **Diff skim.** `git diff main...alexander-module --stat` then read the full diff of
   any shared/hot files (`app.js`, `index.html`, `css/style.css`, the `*-photos.js`
   data + their build scripts). Confirm no stray debug code, no half-finished Codex
   image work, and that every touched CSS/JS asset got its `?v=N` bumped (app.js/style.css
   kept matched). Codex edits in parallel — reconcile cache tokens so nothing collides.
2. **Deterministic regression.** `bash tests/run-journeys.sh` (Chromium, `?qa=1` fixture
   + `window.VIA` drive/assert). Must be green — this is the desktop-behavior net.
3. **Touch path.** `node tests/webkit-touch/test.mjs` (real WebKit + iPhone touchscreen).
   REQUIRED whenever marker/road/coverage taps or the `COARSE_POINTER` branch changed —
   e.g. the persistent-Alexander-beacon close behavior. Chromium/`browse` can't reach it.
4. **Mobile eyeball (ground truth).** On a real iPhone Safari, walk BOTH tabs: hero
   photos load with correct credit/license captions and legible framing; the river/battle
   `photo_caption` labels read right; tap a stop/site → close via map tap → the selection
   stays findable (Alexander beacon persists, Roman marker identifiable); Clear dismisses.
   Headless verification is NOT a substitute for this pass on the heavy map.

Merge mechanics: prefer rebasing the branch onto `main` first (risk #4) so the merge is
clean, then a fast-forward / no-op merge. Deploy = push `main` (Pages); confirm with
`git log --oneline -1` before calling it shipped.

**Not to be confused with:** the OneDrive "Cowork" density folder — that was an
*old-architecture* fork that bulk-injected ~900 Pleiades places into a monolithic
`data.js`; it was rejected (would regress the build-split site, and those places already
exist in the coverage layer). Alexander is unrelated new work.

---

## Standing project rules (full detail in `CLAUDE.md` / `AGENTS.md`)
- No ES modules — plain global `<script>` tags. No build / package manager / test
  runner (the dev-only `package.json` exists solely to pin Playwright for webkit-touch).
- **Bump `?v=N` on every CSS/JS change** so mobile Safari refetches. On `alexander-module`
  currently `app.js` **v142** / `style.css` **v137** (they've drifted — bump the one you
  touch; bump both together when a change spans both).
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
