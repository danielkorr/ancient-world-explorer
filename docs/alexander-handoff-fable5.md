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
- [ ] Read `docs/v2-spec-alexander-layer.md` against `js/alexander.js` and `js/app.js`.
      For each v0.1 **acceptance criterion**, mark met / not-met / partial with evidence.
- [ ] List every stop whose `certainty` ≠ `secure` that is **missing** a `source_note`.
- [ ] List every stop missing a live source **link** (Step 5 gap). Recommend a link
      target per stop (Pleiades where a `pleiades` id maps cleanly; else Livius /
      Encyclopaedia Iranica / World History Encyclopedia, per the spec's source policy).
- [ ] Confirm the ~10 `ALEXANDER_ROUTES` are not over-claimed: each `reconstructed`/
      `uncertain` route must have a `source_note` that says it's a narrative connector,
      not a surveyed road.

### B. Historical / scholarly accuracy audit (highest scholar-value)
- [ ] Spot-check coordinates on all 32 stops (obvious errors, transposed lat/lng, wrong
      modern place). Note: stop records use `lat`/`lng` fields; **route `coords` are
      `[lng, lat]`** — flag any route point that looks lat/lng-swapped.
- [ ] Scrutinize the **disputed battlefields/routes** the spec calls out: Issus/Pinarus,
      Gaugamela, Persian Gate, Hydaspes, Gedrosia. Are coordinates and `certainty`
      labels defensible? Is uncertainty represented honestly?
- [ ] Check chronology: `year` ordering, `year_label` correctness, phase boundaries
      (does each stop's `phase` match its date and the phase's `years` range?).
- [ ] Sanity-check `ancient_sources` tags (e.g. is `Arrian 1.11` the right citation for
      the Hellespont crossing?). Flag anything you cannot corroborate — do not invent
      citations.

### C. Open questions — adjudicate (give a recommendation, not a survey)
The spec ends with 5 open questions. Answer each with a recommended default:
- [ ] Q1: Alexander default off always, or a `?layer=alexander` share param?
- [ ] Q2: Support `?alexander=gaugamela` deep-link restoration (mirroring the existing
      `via.return` / site-restore pattern in `app.js`)?
- [ ] Q3: Cross-link overlapping Roman sites ↔ Alexander stops in the panel (e.g.
      Babylon appears in both models)?
- [ ] Q4: Show a visible "approximate" badge on disputed markers, or panel-only?
- [ ] Q5: Phase filtering in the existing Key panel vs a dedicated campaign strip?

### D. Colorblind-safety check (hard constraint)
- [ ] Verify phase distinction survives with color removed: is each phase separable by
      **text label + marker/dash treatment**, not hue alone? Inspect the phase palette in
      `js/alexander.js` (`ALEXANDER_PHASES[*].color`) and the wireframe swatches.
- [ ] Verify route `certainty` reads via **dash pattern** (solid/dashed/dotted) as the
      primary channel, matching VIA's existing Itiner-e grammar — not color.

### E. Reusability / architecture (don't over-abstract, judge the seams)
- [ ] The spec's v0.4 goal is a generalized `CAMPAIGN_LAYERS` model (Hannibal, Caesar…).
      The spec says **do not abstract early.** Judge whether the current
      `showAlexanderPanel` / `findNearestAlexanderStop` / `searchAlexander` /
      `toggleLayer('alexander')` seams sit in the *right place* to generalize later, or
      whether anything hard-codes "alexander" in a way that will hurt. Recommend seam
      moves only, not a premature abstraction.
- [ ] Confirm `toggleLayer('alexander')` only shows/hides Alexander groups and does not
      mutate site tiers, road certainty filters, or quest progress (spec invariant).

### F. Merge-readiness (point to existing notes, don't rediscover)
- [ ] Read the **"Alexander module"** section of `docs/SESSION-CHECKPOINT.md` — the 4
      merge-integration risks are already documented (index.html `?v=` token conflict;
      the lone `alexander.js` script tag; the `toggleLayer` `else if` restructure;
      staleness → rebase `main` first). Confirm they still hold and add any you find.
- [ ] Note that the branch is behind `main` (linked-data, map polish, topbar, cache
      bumps). Recommend rebase-vs-merge and the `?v=` bump strategy, but **do not perform
      the merge** — that's a human decision.

### G. Deliverable
- [ ] Write findings back into this file (append a "## Fable 5 findings" section) or a
      sibling `docs/alexander-review-fable5.md`. Order by severity. For each: file:line,
      the issue, the fix, and a confidence rating.
- [ ] Do **not** commit corrections to `js/alexander.js` in the same pass as the review —
      propose them; let Dano approve. (Data edits are fine to *draft*; keep them separate
      from the analysis so the audit trail stays clean.)

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
