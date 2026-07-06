# Alexander Campaign Layer — Handoff to Fable 5

> **For:** Claude Fable 5, analysis + critique pass.
> **From:** Claude Code (Opus 4.8), 2026-07-06.
> **Branch:** `alexander-module` (HEAD `bcea734`, branched from `main @ 988705b`).
> **Do NOT deploy.** This branch is not merged to `main` and not on GitHub Pages.

## Your charge (read this first)

This is an **analysis-and-critique pass, not an implementation pass.** The branch is
far enough along (Steps 1–3 of the spec's plan are built and working) that the
highest-value contribution now is to **pressure-test the design, data, and code before
it merges and becomes load-bearing.** Prefer sharp recommendations over exhaustive
surveys. When you find a problem, name the file and line, state the fix, and say how
confident you are.

Two hard constraints on the human reviewer (Dano) that must shape every suggestion:

1. **Dual audience — traveler AND scholar.** Every feature must excite both the curious
   traveler and the working scholar, never just one. The scholar side is unforgiving on
   accuracy; the traveler side is unforgiving on clutter. See `MEMORY.md` →
   *Dual audience*.
2. **Dano is red-green colorblind.** Never let color be the sole signal. Phase/certainty
   distinction must also carry in text, shape, dash pattern, or glyph. See `MEMORY.md` →
   *User is red-green colorblind*.

## What this layer is

Alexander the Great's lifetime conquests as a dated, tappable route across VIA's
existing ancient-world map: **stops, generalized route segments, six chronological
phases, and honest uncertainty.** It is a *narrative campaign spine* (Macedon → Asia
Minor → Egypt → Persia → Central Asia/India → return and death at Babylon), deliberately
kept **separate** from the Roman `SITES`/`ROADS` model. Governing doc:
`docs/v2-spec-alexander-layer.md`.

## What's on the branch (the map)

| File | Role | State |
|---|---|---|
| `docs/v2-spec-alexander-layer.md` | Governing spec: goal, non-goals, schema, 5-step plan, source policy, acceptance criteria, 5 open questions, v0.2–v0.4 roadmap. | Complete |
| `docs/alexander-wireframes.html` | Standalone visual mockups (panel, legend, phase palette, marker/route treatment). Open in a browser. | Complete |
| `js/alexander.js` | Data (hand-curated v0.1): `ALEXANDER_PHASES` (6), `ALEXANDER_STOPS` (**32**), `ALEXANDER_ROUTES` (**~10** connector polylines). | Built; source pass unfinished |
| `js/app.js` | +255 lines: `alexanderRouteGroup`/`StopsGroup`, render, `showAlexanderPanel` (~L620), `findNearestAlexanderStop` (~L607), `searchAlexander` (~L1674), `layerState.alexander` + `toggleLayer('alexander')`, map-click resolution (~L2640). | Steps 2–3 built |
| `index.html` | +5 lines: Alexander layer button, legend row, `alexander.js?v=N` script tag. | Built |
| `css/style.css` | +21 lines: `.swatch-campaign`, `.legend-line.alexander`, `#info-panel.alexander-panel`. | Built |

Diff vs main: 6 files, ~2,026 insertions. `docs/SESSION-CHECKPOINT.md` (on `main`) has
the original handoff note and merge risks.

## Build status vs the spec's 5-step plan

- **Step 1 — Spec + data skeleton:** ✅ done.
- **Step 2 — Render layer toggle:** ✅ done (button, routes, markers, toggle isolation).
- **Step 3 — Panel + search:** ✅ done (`showAlexanderPanel`, `searchAlexander`,
  `findNearestAlexanderStop`, map-click resolution all present).
- **Step 4 — Phase filter:** ❌ **NOT built.** No `phaseFilter`/`filterPhase`/`phaseState`
  anywhere in `app.js`. The Key-panel phase rows the spec describes do not exist.
- **Step 5 — Source pass:** ⚠️ **incomplete.** `js/alexander.js` has **zero `links:`
  arrays** — stops carry only `ancient_sources` text tags (e.g. `Arrian 1.11`), not the
  clickable source buttons the panel spec and acceptance criteria require. **10 stops**
  have `certainty` of `approximate`/`disputed`; confirm each has an honest `source_note`
  (the schema requires it when certainty ≠ secure).

## Do NOT touch

- `js/auth.js` and the ES256 auth wedge (CLAUDE.md documents why it's load-bearing).
- Any generated `js/*` data file (`roads-itinere*.js`, `sites-*.js`, `orbis-days.js`,
  `pleiades-photos.json`). `js/alexander.js` is **hand-curated**, so it IS editable —
  it is the one data file you may correct.
- Supabase / check-ins / quest pipeline — the spec explicitly puts these out of scope
  for v0.1.

---

## Execution checklist for Fable 5

Work top to bottom. Each item is a deliverable: a written finding with file:line refs
and a recommendation. Check the box and add a one-line verdict as you go.

### A. Spec-vs-reality gap
- [x] Read `docs/v2-spec-alexander-layer.md` against `js/alexander.js` and `js/app.js`.
      For each v0.1 **acceptance criterion**, mark met / not-met / partial with evidence.
      → Most met; **search criterion FAILS** (dead code, F1) and **source buttons FAIL** (F3).
- [x] List every stop whose `certainty` ≠ `secure` that is **missing** a `source_note`.
      → **None missing**: 11/11 non-secure stops have honest notes.
- [x] List every stop missing a live source **link** (Step 5 gap). → **All 32** (zero
      `links:` arrays); fix process in review F3 (inherit Pleiades ids from the 17
      overlapping VIA sites; Livius for battles/marches).
- [x] Confirm the ~10 `ALEXANDER_ROUTES` are not over-claimed. → **Confirmed**: 12/12
      routes have notes, none claims `attested`.

### B. Historical / scholarly accuracy audit (highest scholar-value)
- [x] Spot-check coordinates on all 32 stops. → **PASS**: all match standard
      identifications; no lat/lng transposition in stops or route coords.
- [x] Scrutinize the **disputed battlefields/routes**. → **PASS**: Issus, Gaugamela,
      Persian Gate, Hydaspes, Gedrosia all carry defensible coords, correct certainty
      tiers, and honest notes.
- [x] Check chronology. → **PASS**: array in campaign order, phases match year ranges;
      two defensible-choice remarks (Alexandria 332/331, Sogdian Rock 328/327) in review.
- [x] Sanity-check `ancient_sources` tags. → **PASS**: every Arrian/Diodorus/Plutarch
      citation checks out against the source structure; nothing uncorroborated.

### C. Open questions — adjudicate (give a recommendation, not a survey)
The spec ends with 5 open questions. Answer each with a recommended default:
- [x] Q1 → Default off; **add `?layer=alexander`** (mirrors existing param patterns).
- [x] Q2 → Yes, **v0.2**; ride the `via.return` restore machinery. Not merge-blocking.
- [x] Q3 → **Yes, and it's load-bearing**: 17 stops are occluded by site markers (F2);
      the cross-link chip is the fix, not a nice-to-have.
- [x] Q4 → **Panel-only** for v0.1; 5px markers can't carry a legible badge.
- [x] Q5 → **Existing Key panel**, rows visible only when the layer is on.

### D. Colorblind-safety check (hard constraint)
- [x] Verify phase distinction survives with color removed. → **PARTIAL FAIL (F5)**:
      on-map markers encode phase by fill hue only, and the palette pairs green against
      three brown-reds. Panel text carries phase correctly. Recommendation: accept
      panel-text as the channel for v0.1 (record the decision), numeric badge with v0.2.
- [x] Verify route `certainty` reads via **dash pattern**. → **PASS**: solid/dashed/
      dotted is the primary channel, matching the Itiner-e grammar.

### E. Reusability / architecture (don't over-abstract, judge the seams)
- [x] Judge the seams for a future `CAMPAIGN_LAYERS` model. → **Sound**: everything is
      data-driven off `ALEXANDER_*` globals; hard-codings are shallow/rename-level. The
      one seam to watch is the `map.on('click')` resolution order — registry later.
- [x] Confirm `toggleLayer('alexander')` isolation. → **Confirmed**: only
      `refreshAlexanderLayer` + `fitAlexanderBoundsOnce`; tiers/filters/quests untouched.

### F. Merge-readiness (point to existing notes, don't rediscover)
- [x] Confirm the 4 documented risks. → **All still hold** (branch pins `?v=106` incl.
      the `alexander.js` tag; `main` at `v116` — token conflict guaranteed). Added: the
      `map.on('click')` and search-dispatcher areas evolved on `main` — rebase first,
      write the F1 fix against main's current code.
- [x] Rebase-vs-merge recommendation. → **Rebase onto `main`**, fix F1/F2/F4 + F3
      curation, run both harnesses, bump `?v=`, then merge — merge not performed.

### G. Deliverable
- [x] Findings written to **`docs/alexander-review-fable5.md`** — 8 findings ordered by
      severity (2 HIGH, 3 MEDIUM, 2 LOW, 1 INFO), each with file:line, fix, confidence,
      plus the full accuracy-audit record and a recommended order of work.
- [x] No corrections committed to `js/alexander.js` — all data fixes proposed only.

---

## Quick-start commands

```bash
git checkout alexander-module          # you should already be here
open docs/alexander-wireframes.html     # see the intended visual design
# Serve to see it live (auth/Supabase not needed for the map):
python -m http.server 8000              # then load http://localhost:8000, turn on "Alexander"
```

The Alexander layer defaults **off**; enable it from the desktop controls or the mobile
Key panel. There is no phase filter yet (Step 4). Search for `Gaugamela`, `Issus`,
`Tyre`, `Persepolis`, `Hydaspes` to exercise `searchAlexander` → panel → pan/zoom.
