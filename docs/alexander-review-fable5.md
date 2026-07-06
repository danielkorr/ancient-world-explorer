# Alexander Campaign Layer — Fable 5 Review Findings

> **Reviewer:** Claude Fable 5, 2026-07-06, per `docs/alexander-handoff-fable5.md`.
> **Branch:** `alexander-module` @ `77e41e9`. Analysis only — no code changed.
> Ordered by severity. Each finding: location, issue, recommended fix, confidence.

## Verdict in one paragraph

The scholarship is the strong part: all 32 stop coordinates check out against standard
identifications, every non-secure stop and all 12 routes carry honest `source_note`s,
and the ancient-source citations are accurate (I could not fault a single Arrian
reference). The engineering has two high-severity gaps that make the layer feel broken
in practice even though every piece renders: **search is dead code**, and **17 of 32
stops sit under foreground Roman site markers that steal their taps**. Both are fixable
with modest, well-scoped changes. Do not merge before F1, F2, and F4 are addressed.

---

## Findings

### F1 · HIGH — Search integration is dead code; acceptance criterion fails

`searchAlexander` (`js/app.js:1674`) and `alexanderSearchMeta` (`js/app.js:1694`) are
defined but **never called**. The search dispatcher (`js/app.js:1917–1922`) merges only
`searchSites` + `searchItinere` + `searchCoverage`; `renderSearchResults`
(`js/app.js:2143`) has no `kind === 'alexander'` branch. Consequences:

- Spec acceptance criterion *"Search can find at least major stops: Pella, Granicus,
  Issus…"* — **not met**. Searching "Gaugamela" finds nothing Alexander-related.
- Spec Step 3 requirement *"Selecting a result should turn on the Alexander layer if
  it is off"* — **not implemented anywhere**.

**Fix:** add `...searchAlexander(query)` to the `secondary` merge at `js/app.js:1922`;
add a render branch using the already-written `alexanderSearchMeta`; on select, if
`!layerState.alexander` call `toggleLayer('alexander')` first, then
`showAlexanderPanel(stop)`. All the hard parts are already written — this is wiring.
**Confidence: certain** (static trace; the functions have zero call sites).

### F2 · HIGH — 17 of 32 stops are occluded by foreground Roman site markers

Verified by joining `ALEXANDER_STOPS` against the runtime `SITES` global (±0.05°):
**pella, amphipolis, ilion, sardis, miletus, halicarnassus, tarsus, tyre, memphis,
alexandria-egypt, babylon-entry, susa, persepolis, ecbatana, taxila, pasargadae,
babylon-death** all coincide with an interactive site marker.

Alexander stops are `interactive: false` and resolve via `map.on('click')`
(`js/app.js:2640`) — correct per the CLAUDE.md iOS-tap doctrine. But site markers are
interactive DOM elements: a click/tap on one fires the marker handler (or the
COARSE_POINTER delegation) and **the map click never fires**. With default layers on,
more than half the campaign — including its narrative anchors Babylon, Tyre,
Alexandria, Persepolis — opens the Roman site panel instead, and the Alexander stop at
that location is effectively unreachable.

**Fix (recommended):** cross-link chip in the Roman site panel — when the opened site
matches an Alexander stop (join by `pleiades` id where possible, else proximity), render
an "Alexander was here · 331 BC" chip that calls `showAlexanderPanel(stop)`. This also
answers open question Q3 and adds traveler-and-scholar value rather than fighting the
hit-test. **Rejected alternatives:** giving Alexander stops hit priority in the marker
tap path (steals Roman taps — worse); relying on zoom separation (they're the same
pixel at campaign zoom). **Confidence: high** (static analysis + event-model reasoning;
verify one case live — e.g. tap Babylon with both layers on — before trusting the fix).

### F3 · MEDIUM — Step 5 source pass not done: zero source links, empty actions row

`js/alexander.js` contains **no `links:` arrays at all** (grep: 0 matches). The panel's
actions section (`js/app.js`, `showAlexanderPanel`) only renders buttons from
`stop.links`, so **every Alexander panel renders with an empty actions row** — no
Pleiades button, no source button. Spec acceptance requires "source buttons" and Step 5
requires every stop to have at least one source link.

**Fix (process, not invented data):** the 17 stops in F2 coincide with catalogued VIA
sites that already carry verified `pleiades` ids — inherit those (join by proximity,
confirm by name; do **not** trust my memory for Pleiades ids). For the remainder
(battle/march/crossing stops like granicus, issus, gaugamela, persian-gate, hydaspes,
hyphasis, gedrosian-route), link Livius per the spec's source policy — its Alexander
index covers all of these. Draft as a separate data commit for Dano's approval.
**Confidence: certain** on the gap; the fix is curation work.

### F4 · MEDIUM — `.alexander-panel` class leaks into the Roman site panel

`showAlexanderPanel` adds `alexander-panel` to `#info-panel`. `showSegmentPanel`
removes it (`js/app.js:2603`) and `closePanel` removes it — but **`showPanel` does
not** (it removes only `segment-panel`, ~line 175 of the function body). Repro: open an
Alexander stop, then open a Roman site while the panel is still open (search select, or
the F2 occlusion path). The site panel inherits `#info-panel.alexander-panel` CSS: 128px
hero and 42px Cinzel hero-icon (`css/style.css` additions). The badge does **not** leak
(`showPanel` rewrites `style.cssText` wholesale — checked).

**Fix:** one line — `panel.classList.remove('alexander-panel')` in `showPanel`,
mirroring the `segment-panel` removal. Per the project's verify-visible rule, confirm
with a visual check, not DOM-only. **Confidence: certain** on the code path; the visual
severity needs the live check.

### F5 · MEDIUM — Phase distinction on markers is color-only (colorblind constraint)

The spec itself requires: *"Phase distinction should also appear in text labels and
marker treatment"* — on-map, it doesn't. All stops share radius/shape; phase is encoded
solely in `fillColor` (`alexanderStopStyle`, `js/app.js`). The palette pairs
`#5e8b4f` (green) against `#b07848`/`#8f6f3f`/`#8c5b5b` (orange-brown/brown/red-brown)
— a red-green-confusable set for the project's own reviewer.

Mitigations already in place: the **panel** carries phase as text (name, years, evidence
rows) ✓; route **certainty** uses dash pattern as the primary channel ✓ (compliant with
VIA's Itiner-e grammar); phases are also inherently sequential/geographic, so position
carries much of the signal.

**Fix:** don't redesign the palette or cram glyphs into 5px dots. Minimal honest options:
(a) accept panel-text as the phase channel for v0.1 and record that decision in the
spec; (b) if on-map distinction matters before the v0.2 timeline, a small numeric phase
badge (1–6) on hover/active is the cheapest non-color channel. Recommend (a) now, (b)
with the timeline. **Confidence: high.**

### F6 · LOW — Schema drift: `gedrosian-route` uses stop certainty `'uncertain'`

The spec's stop schema allows `secure | approximate | disputed`; `'uncertain'` is a
*route* certainty value. `js/alexander.js:504` uses it on a stop. The panel happens to
handle it (the label map in `showAlexanderPanel` includes `uncertain`), so nothing
breaks. **Fix:** amend the spec to admit `uncertain` for stops (recommended — the
Gedrosian march genuinely is) or change the value to `disputed`. **Confidence: certain.**

### F7 · LOW — Step 4 (phase filter) not built

No `phaseFilter`/`phaseState`/Key-panel phase rows exist in `js/app.js`. Known gap,
already flagged in the handoff. Recommend building it **after** F1/F2/F4 land, in the
existing Key panel per Q5 below. **Confidence: certain.**

### F8 · INFO — `attested` route style is never exercised

All 12 routes are `reconstructed` or `uncertain`. This is honest — none of the
polylines are surveyed itineraries — and the style table entry is harmless. No action.

---

## B · Historical / scholarly accuracy audit — PASS with remarks

- **Coordinates (32/32 spot-checked): sound.** All match standard identifications
  (Pella, Vergina/Aegae, Hisarlik/Ilion, Sart/Sardis, Balat/Miletus,
  Bodrum/Halicarnassus, Yassıhöyük/Gordium, Mit Rahina/Memphis, Balkh/Bactra,
  Shush/Susa, Marvdasht/Persepolis, Hamadan/Ecbatana, Taxila, Pasargadae…). No
  transposed lat/lng in stops; route `coords` verified `[lng,lat]` against their
  endpoint stops — no swaps.
- **Disputed battlefields handled correctly.** Issus (`approximate`, Pinarus debate
  noted), Gaugamela (`disputed`, near-Mosul/Tel Gomel region), Persian Gate
  (`approximate`, generalized pass), Hydaspes (`approximate`, Jhelum placement),
  Gedrosia (`uncertain`, highly generalized) — each with an honest `source_note`.
  This is exactly the uncertainty posture the spec asked for.
- **Source-note completeness: 11/11** non-secure stops have notes; **12/12** routes
  have notes; **no route claims `attested`** — nothing over-claimed.
- **Citations: no faults found.** Every Arrian reference checks against the Anabasis
  structure (1.11 departure/crossing/Ilion; 2.3 Gordium; 2.6–12 Issus; 2.15–24 Tyre;
  2.25–27 Gaza; 3.3–4 Siwa; 3.16 Babylon+Susa; 3.18 Persian Gate+Persepolis; 4.18–19
  Sogdian Rock/Roxane; 5.9–19 Hydaspes; 5.25–29 Hyphasis; 6.22–27 Gedrosia; 6.29
  Pasargadae/Cyrus' tomb; 7.8–12 Opis; 7.24–27 death). Diodorus 16.91–94 (Philip's
  assassination) and 17.70–72 (Persepolis burning), Plutarch 3/27/75–77 — all correct.
- **Chronology: consistent.** Array is in campaign order; every stop's `year` falls in
  its phase's range. Two defensible-choice remarks (no change required):
  Alexandria's foundation is dated winter 332/331 by some — `331 BC` is the
  conventional pick; the Sogdian Rock is dated 328 by some scholars vs Arrian's
  implied 327 — the `disputed` certainty already covers it, though the `source_note`
  could mention the date as well as the location.

## C · Open questions — adjudicated

- **Q1 — default off vs share param:** Keep default **off**; add `?layer=alexander`.
  Cheap (mirrors the existing `?signin=1`/`?guest=1` param pattern), enables sharing
  without touching cold start.
- **Q2 — `?alexander=<stop-id>` deep-link:** Yes, but **v0.2** — ride the existing
  `via.return`/restore machinery. Not merge-blocking.
- **Q3 — Roman↔Alexander cross-links:** **Yes, and sooner than the spec assumed** —
  F2 makes this load-bearing, not a nice-to-have. Site-panel chip for the 17 overlaps
  (join by `pleiades` id), reverse link from the Alexander panel where a VIA site
  exists. This is the dual-audience win: traveler gets "Alexander was here," scholar
  gets the Pleiades identity join.
- **Q4 — approximate badge on markers:** **Panel-only** for v0.1. Certainty is already
  in the panel badge text; a 5px marker cannot carry a legible badge. Revisit with the
  v0.2 timeline.
- **Q5 — phase filter placement:** **Existing Key panel**, rows visible only when the
  layer is on (spec's own v0.1 suggestion). A dedicated campaign strip only if/when the
  v0.2 timeline justifies it.

## E · Architecture / seams — sound; do not abstract yet

- Rendering, search, and panel code are all data-driven off the `ALEXANDER_*` globals;
  hard-codings are shallow and rename-level (the `'A'` hero glyph, the `ALEXANDER ·`
  badge prefix, the `layerState.alexander` key, the style tables). The seams sit where
  a future `CAMPAIGN_LAYERS` generalization would want them. The one seam to watch:
  the `map.on('click')` resolution order (alexander → itinere → coverage → pin) will
  need a small registry when a second campaign lands — fine to defer.
- **Spec invariant verified:** `toggleLayer('alexander')` only calls
  `refreshAlexanderLayer` + `fitAlexanderBoundsOnce`; it does not touch site tiers,
  road certainty filters, or quest state.
- **SESSION-CHECKPOINT risk #3 confirmed intact:** the curated-roads `} else {` became
  `} else if (which === 'sites')` with a new `else if (which === 'alexander')` branch —
  exactly as documented, and it's the one Alexander change with no "alexander"-adjacent
  string in the sites hunk.

## F · Merge readiness

All four documented risks in `docs/SESSION-CHECKPOINT.md` **still hold**. Confirmed
concretely: the branch's `index.html` pins everything at `?v=106` including the
`alexander.js` tag; `main` is at `v116` — the token-line conflict is guaranteed.
Additions from this review:

- The `map.on('click')` hunk and the search dispatcher are both areas `main` has
  evolved (coverage pins, journey routing) — **rebase onto `main` first**, then write
  the F1 fix against main's current search code rather than porting a stale hunk.
- After rebase + fixes: run `bash tests/run-journeys.sh` and
  `node tests/webkit-touch/test.mjs` (the F2 fix touches the tap path — the WebKit
  touch harness is the only headless net for it), bump `?v=` tokens, then merge.
  Merge itself is Dano's call — not performed.

## Recommended order of work (post-review)

1. Rebase `alexander-module` onto `main`.
2. **F4** (one-line class fix) and **F1** (search wiring) — small, unblock everything.
3. **F2/Q3** cross-link chip (the real design decision; do it deliberately).
4. **F3** source-link curation pass on `js/alexander.js` (separate data commit,
   Dano approves).
5. F6 spec amendment, then Step 4 phase filter (F7) when ready.
6. Harnesses, cache-bust, merge decision.
