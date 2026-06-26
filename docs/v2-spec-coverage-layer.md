# v2 Spec — Documented Coverage Layer

> Status: **Phases A + B SHIPPED (A v95, B v97).** Phase C not started. Captures the
> approach agreed before touching the `MAX_SITES` cap, so we expand coverage *without*
> eroding the simplicity and "logical pathway" the map depends on.
>
> **Phase B (shipped, v97) — coverage as a map layer.** Rather than the separate "opt-in
> toggle + auto zoom-reveal" this spec first imagined, Phase B **extends the existing detail
> slider** with a 4th stop — `Curated → Quest detail → Full detail → Documented` — because
> that slider is already the app's progressive-disclosure control (one mental model beats two).
> At the "Documented" stop the ~25k coverage places render as small, quiet **canvas dots**
> (`coverageDotsGroup`, a shared `L.canvas()`): light fill + thin dark outline so they read by
> **size + luminance, not hue** (colorblind-safe), clearly subordinate to the curated icons.
> The dots are **viewport-culled** (re-rendered on move/zoom) and **zoom-gated** (`MIN_COVERAGE_ZOOM
> = 7`, hard cap `MAX_COVERAGE_DOTS = 4000`) so we never paint 25k at once; below the zoom gate
> the readout says "zoom in to reveal". Taps resolve to the nearest dot (`findNearestCoverage`,
> same nearest-point model as the roads since canvas paths aren't DOM nodes), wired into both
> `map.on('click')` and the mobile `touchend` **after** roads/markers, and only when the dots
> are actually showing. Selecting one opens the same honest-thin panel as search
> (`focusCoverage`). The desktop hover readout also names the nearest dot. Verified:
> `run-journeys.sh` green (desktop + mobile) and a real-browser e2e (slider→Documented→zoom→dots
> render→tap a dot→panel opens). **The see-vs-click gap is now closed on the map itself** — at the
> Documented level, places like Euphranta are visible *and* tappable, not just searchable.
>
> One-line: turn the full Pleiades long tail into a **quiet, opt-in, searchable background
> layer** beneath the curated + quest foreground — the same move we already made for roads
> (faint Itiner-e baseline under the 14 curated named roads).
>
> **Phase A (shipped, v95) — data + search, zero default visual change.**
> `scripts/build-sites.mjs` now also emits `js/sites-coverage.js`
> (`window.SITES_COVERAGE`, **24,978** documented Pleiades places, ~500 KB gzip) — the
> relaxed long tail (Roman + coords + known precision, **no** 80-char desc gate, null-island
> dropped), minus the 400 foreground ids. It is **lazy-loaded on first search** (not in cold
> start), deduped at runtime against the global `SITES` by `pleiades`, and folded into the
> search index as a **"More places · Pleiades"** group after the Itiner-e roads. Selecting a
> result (`focusCoverage`) drops a temporary VIA pin at the spot, opens an **honest-thin
> panel** (name / type / period / coords + Pleiades link + a "minimal record" note, no ORBIS
> card), and pans there. **Euphranta/Macomades (pleiades 363959)** — the basemap-only label
> that motivated this — is now searchable and openable. Verified: node matcher test,
> `run-journeys.sh` green (desktop + mobile), and a real-browser e2e (type → lazy-load →
> click → panel). The map is unchanged until you search; cold start is untouched.

## Problem

VIA renders ~95 curated + 400 Pleiades + ~492 vici ≈ **~900 clickable sites**. The DARE
basemap underneath is a *finished picture* with thousands of labelled places (Euphranta,
Arae Philaenorum, and most of what a user sees) **baked into the tiles**. So the map shows
far more than it can answer for: users click a basemap label, nothing happens, and the map
feels broken. The literal complaint that started this: *"there are many sites/locations and
roads on the map that just don't register when I click on them."*

The naive fix — raise `MAX_SITES` from 400 to thousands — closes the see-vs-click gap but
**breaks four things we care about more**:

1. **Quest-signal dilution (worst).** The map's hook is the quests — "this place is *missing*
   something you can fix." That only reads because quests stand out against a curated ~900.
   Flood the map with 10k–40k mostly-*documented* dots and the quests drown. We'd trade our
   sharpest pathway (where to contribute) for raw completeness.
2. **Thin-panel disappointment.** Curated sites are rich (desc, ORBIS days, photos). The
   Pleiades long tail is often just *name + coords + type*. Thousands of near-empty panels
   teach users that clicking isn't worth it — *worse* than a label that visibly does nothing.
3. **Visual clutter / cognitive load.** "Everything looks equally important" is the opposite
   of a logical pathway.
4. **Performance.** ~900 divIcon markers is fine; many thousands is not, especially mobile
   Safari. Plain markers don't scale to 5K–40K (already flagged as the Phase-2 canvas-hybrid).

## Design principles (the guardrails)

- **Foreground stays curated.** Curated sites + quests are always-on, prominent, unchanged.
  They are the *story*. The coverage layer is *reference*, visually subordinate at all times.
- **Progressive disclosure, not a flood.** World view tells the story; zooming in / opting in
  reveals completeness. The pathway is "here's the story" → "here's everything," on demand.
- **Coverage is reference, not a quest.** Documented coverage sites must never compete with
  quest markers for attention or be mistaken for one. Different (smaller, quieter) treatment.
- **Colorblind-safe (load-bearing).** The user is red-green colorblind. Foreground/background
  and tier distinctions ride on **size + shape + opacity**, never hue alone — same rule as the
  road certainty dashes.
- **Honesty about thinness.** A coverage panel is minimal-but-honest, never a fake-rich panel;
  it always offers the Pleiades link as the authoritative next step.
- **Cold start is sacred.** The long tail must not cost the first paint. Separate file,
  lazy-loaded. The default experience for a first-time traveler is unchanged.

## North star: we already solved this once (for roads)

The Itiner-e layer is the template. ~14,800 anonymous road segments render as a **faint canvas
baseline** beneath the 14 curated named roads; they're non-interactive DOM-wise and taps
resolve to the **nearest segment** via `findNearestItinere` rather than per-feature handlers.
Coverage sites are the marker analogue: a quiet canvas layer of the documented long tail,
beneath the curated/quest markers, with taps resolved to the nearest point.

## Data model & pipeline

### New build output: `js/sites-coverage.js` (auto-generated, lazy-loaded)

Keep the foreground exactly as-is. Split the build so the long tail is a **separate artifact**
that the page does **not** load at cold start.

- `scripts/build-sites.mjs` keeps emitting `js/sites-pleiades.js` as the **foreground** Pleiades
  set (the richness-ranked top-N — current cap, possibly retuned, but *small*, e.g. ≤400–600,
  chosen for description quality + quest signal). No change to `data.js`'s `SITES` assembly.
- A new emission (flag `--coverage` or a sibling `scripts/build-coverage.mjs`) writes
  `js/sites-coverage.js` defining `window.SITES_COVERAGE` — the **remaining** documented
  Pleiades places (everything below the foreground cut, up to a much higher ceiling, e.g.
  5K → 40K), deduped against the foreground by `pleiades` id.
- Record shape is the **same** site schema (`id, name, modern, type, lat, lng, period,
  pleiades`) but coverage records carry **no `quest`** (they are documented by definition) and
  a marker `coverage: true`. Minimal fields → small payload; gzip is the real budget.
- **Quest sites never live here.** Photo/location/text quests always promote into the
  foreground (`sites-pleiades.js`), regardless of the cap — a missing photo/GPS is a stronger
  signal than description richness. Coverage is documented-only, by construction.

### Size budget

| Tier | ~count | Render | Load |
|---|---|---|---|
| Curated | ~95 | divIcon (rich) | cold start |
| Foreground Pleiades + vici | ~900 | divIcon, clustered (today) | cold start |
| **Documented coverage** | 5K → 40K | **canvas circleMarkers** | **lazy** |

Target: `sites-coverage.js` gzip stays in the low hundreds of KB even at the high end (mirror
the roads file, which is ~0.55 MB gzip for 14.8k segments / 80k vertices). If 40K busts the
budget, ship in zoom/region chunks (see Open questions).

## Rendering

Do **not** add the long tail to the existing `markerClusterGroup`s — that path is divIcon-based
and won't scale, and clustering the long tail *with* the foreground would let coverage dots
absorb curated pins into shared bubbles (signal loss).

- **Coverage layer = a dedicated `L.canvas()` renderer** drawing small `L.circleMarker`s (or a
  hand-rolled canvas scatter), held in its own permanently-on `LayerGroup` (mobile-safe: mutate
  contents, never toggle membership — see the LayerGroup landmine in `CLAUDE.md`).
- **Taps resolve to nearest point**, exactly like roads: a flat indexed array
  (`coverageSegs`-equivalent) + a `findNearestCoverage(latlng, cp)` with a px threshold and a
  zoom-sized bbox prefilter. Reuse the desktop/touch threshold split (fine 22 / coarse 26).
  Wire into the same `map.on('click')` + the COARSE_POINTER `touchend` delegation already built
  for roads — coverage resolves only when a curated marker / road did **not** win.
- **Visual treatment:** small (≈3–4px) low-opacity dots in a single neutral coverage colour;
  no glyph, no label, no badge. Clearly *beneath* and *quieter* than the 9–11px curated dots
  and the quest markers. Colorblind-safe because the distinction is **size + opacity**, not hue.

## Interaction model

### Visibility: zoom-gated + opt-in (both, layered)

- **Default (traveler):** coverage is **hidden** at world/region zoom. The map shows curated +
  quests — the story, uncluttered.
- **Zoom reveal:** past a zoom threshold (e.g. when a single region fills the viewport), fade
  the coverage layer in automatically at low opacity, so detail appears as you commit to an area
  — a pathway, not a wall. (Gate on `map.getZoom()` in the existing zoom-staged `updateBasemaps`
  hook.)
- **Explicit opt-in (scholar):** a layer toggle — "Show all documented places" — in the
  existing layer controls / Key FAB, independent of zoom, for users who want completeness now.
  State in the `layerState` object alongside `roads`/`sites`. First activation triggers the
  lazy load (below).

### Lazy load

`SITES_COVERAGE` is **not** in `index.html`'s cold-start script list. It's fetched on the
**first** trigger — first zoom past the threshold *or* first opt-in toggle — via a dynamic
`<script>` inject (or `fetch` + eval of the same file). A one-frame "loading coverage…" hint;
build the canvas layer once on arrival; subsequent toggles are instant. Protects TTI for the
99% of sessions that never need it.

### Panel (honest-thin)

A coverage marker opens the normal info panel but in a **reference** register: name, type,
modern location, period if known, coordinates — and the **Pleiades link as the primary action**
("View in the Pleiades gazetteer"). No fake ORBIS card (`rome_days: 0` semantics), no checkin
encouragement copy beyond the standard control, no quest banner. A short standing line:
*"Documented place from the Pleiades gazetteer — minimal record."* sets the expectation.

### Search (ships first — this is the Euphranta fix)

Coverage sites enter the **search index even while hidden on the map** — exactly how the 6,185
Itiner-e road names became searchable without on-map labels. Searching "Euphranta" then:

1. matches the coverage record,
2. flies to it and opens its (honest-thin) panel,
3. ensures the coverage layer is loaded + that one marker is shown/highlighted even if the layer
   is otherwise off.

This alone resolves the original "I can't search for it" complaint, decoupled from the heavier
render work — so it can land in Phase A before any visual change.

## Dual-audience mapping (the explicit win)

| | Traveler (default) | Scholar (opt-in / zoomed) |
|---|---|---|
| Sees | curated + quests, legible | + full documented coverage |
| Search | curated + foreground + roads | + every documented place |
| Map reads as | "here's the story" | "here's everything" |

Same data, layered access — the dual-audience principle made literal, and the same shape as
curated-roads (foreground) vs Itiner-e (baseline).

## Phasing

- **Phase A — data + search (no default visual change).** Split the build; emit
  `js/sites-coverage.js`; integrate coverage into the search index with lazy load + fly-to +
  honest-thin panel. **Outcome:** Euphranta (and thousands more) become *searchable and
  openable* with zero added map clutter and zero cold-start cost. Lowest risk, immediate payoff.
- **Phase B — the canvas coverage layer.** Dedicated canvas renderer, `findNearestCoverage`
  tap resolution wired into the existing click/touch paths, the opt-in toggle, and zoom-reveal.
  **Outcome:** the see-vs-click gap closes on the map itself, still subordinate to the story.
- **Phase C — polish + defaults.** Tune the zoom threshold, coverage dot styling, density
  fade, and the traveler/scholar default; revisit the foreground cap (richness retune) now that
  the tail has a home.

## Non-goals

- **Not** raising the *foreground* cap or making coverage compete with curated/quests.
- **Not** rendering 40K divIcon markers, and **not** clustering coverage with the foreground.
- **Not** enriching coverage panels into fake-rich ones — thin-but-honest, Pleiades-linked.
- **Not** an offline coverage→Itiner-e/segment join (no such field in the static dumps; live
  API only — same hard limit recorded in the Itiner-e spec).

## Open questions

- **Coverage ceiling.** 5K? 40K? Pick from the gzip budget + a perceived-clutter test at the
  reveal zoom, not from "all of Pleiades on principle."
- **One file vs zoom/region chunks.** If a single `sites-coverage.js` busts the budget at the
  high end, shard by region/zoom and fetch the visible shard. Adds complexity; defer unless the
  budget forces it.
- **Reveal threshold.** Which zoom level reads as "committed to a region"? Needs a real-device
  eyeball (mobile especially), not a guessed constant.
- **Coverage vs quest collision.** Confirm coverage dots are unmistakably *not* quest markers at
  the reveal zoom — verify with the colorblind-safe size/opacity gap, on device.
- **Checkins on coverage sites.** Allowed (it's a real place) or foreground-only? Leaning
  allowed — visiting a thin place is still a real visit and a future enrichment seed.
```
