# Task: Mobile chrome redesign — Dock layout

**File:** `docs/v1-spec-mobile-dock.md`
**Project:** VIA — Ancient World Explorer (static SPA, Leaflet, GitHub Pages)
**Status:** Ready for implementation — **discovery/confirm step required before any edits**
**Visual + interaction reference:** the approved mockup `via-ab-B-dock.html` (the "Dock" variant).

---

## 1. Why

The mobile UI is crowded: several translucent panels (search bar, era toggle, the
"Curated · N quests" detail slider, the bottom icon row, the KEY panel) float over the map
at once, colliding with each other and with map markers. This task **reorganizes the
existing controls into a single bottom dock + ephemeral panels**, so the map stays open and
chrome appears only on demand. It is a layout/interaction change, **not** new features and
**not** a data change. Desktop layout is unaffected.

## 2. Target layout (Dock)

Match the structure and interactions of `via-ab-B-dock.html`:

- **Top bar (unchanged in spirit):** VIA wordmark + the existing **ANCIENT / MODERN era
  toggle stay pinned at the top.** Do not move the era toggle into the dock.
- **Full-bleed map** behind everything; no persistent panel covering it.
- **Bottom dock** — one slim persistent bar holding: a **search** field, a **curation**
  button, and the **key** button. Tapping a dock button opens a small popover/panel; opening
  one closes the others.
- **Marker/road tap → a dismissible detail panel** anchored above the dock, with a close (×)
  and tap-map-to-dismiss. It must **scroll or expand to hold the full detail**, because the
  content varies a lot: a *site* may be a short blurb, but a *road* detail is rich — observed
  fields include a photo, a quest/verify call-to-action, a certainty tag (e.g. "Conjectured"),
  a narrative, an "Ancient itinerary" block, contributor, source, and a "Sites along this
  stretch" list with distances, plus a share action. **Every field shown in the current
  detail panel must be preserved.** A fixed-height compact card that truncates this is not
  acceptable — let it scroll, or expand (drag up) for the long cases.
- **Zooming must never be blocked by markers or the detail panel.** Today, double-tapping a
  quest site / city opens the detail panel instead of zooming, forcing a close → double-tap →
  re-tap loop. Fix: add a **visible +/− zoom control** and ensure **pinch-to-zoom** works, so
  zoom never depends on double-tapping near a marker. Position the zoom control so it doesn't
  collide with the dock or the detail panel (e.g. right edge, above the locate/dock control).
  Single tap on a marker opens detail and should open **immediately** (no artificial delay).
  *(Optional, evaluate on-device:* make a double-tap on a marker zoom instead of opening
  detail via a tap/double-tap discriminator — but only if the resulting single-tap delay is
  acceptable; otherwise rely on the zoom control + pinch.)*
- **Search** opens a temporary panel (with the results/sites list) over a scrim; dismiss to
  return to the open map.
- **Attribution:** Leaflet's native control, styled to the dark/gold theme, positioned
  **bottom-left**, riding just above the dock (out of the way of the dock and the card).
- Tapping the open map dismisses any open card/popover/panel.

## 3. CRITICAL — discover and confirm before changing anything

The current chrome's exact DOM/CSS/JS is the source of truth, not this spec's assumptions.
**Before editing, do all of the following and then PAUSE and report — do not rip anything
out until the plan is confirmed:**

1. Read `index.html`, `js/app.js`, and the relevant CSS. Inventory **every** existing
   on-screen control in mobile chrome: the search input, the era toggle, the
   "Curated · N quests" curation slider, every button in the bottom icon row, the KEY/filter
   panel, and anything else floating over the map.
2. For each control, state what it currently does and where its logic lives.
3. Produce a **mapping table**: each existing control → its new home in the Dock layout
   (dock button, popover, card, top bar, or removed). Use Section 4 as the proposed mapping,
   but correct it against what you actually find.
4. Call out anything in Section 4 that doesn't fit the real code, and any control that has
   no obvious home in the Dock layout.
5. **Stop and present the mapping + plan. Wait for confirmation before implementing.**

## 4. Proposed control mapping (confirm against real code)

- **Search box → dock search field.** Tapping it opens the search panel with the sites
  list. Preserve existing search behavior/results.
- **ANCIENT / MODERN toggle → stays in the top bar, unchanged.**
- **"Curated · N quests" slider → dock "curation" button → popover** containing the existing
  slider. Same underlying curation logic; only its container moves.
- **KEY → dock "key" button → opens the EXISTING KEY/filter panel.**
  *Decision (confirm):* keep the app's current KEY/filter functionality, just mounted from
  the dock — do **not** replace it with the mockup's simplified 3-type legend. (Interpreting
  "keep the Key button as it is" as: preserve current behavior, dock-mounted.)
- **Other bottom-row icons (e.g. road/itinere layer, sites/museums, info/about) → report
  what each is.** Proposed default: fold layer toggles into the KEY/filter or a small layers
  control; route info/about to a single info affordance. **Flag each for confirmation** —
  these are the controls I have least visibility into.
- **Marker/road tap → dismissible, scrollable detail panel** (replaces whatever the current
  tap opens). **Preserve every field** the current detail shows — for roads that includes the
  photo, quest/verify CTA, certainty tag, narrative, ancient-itinerary block, contributor,
  source, and the "sites along this stretch" list. The panel scrolls/expands; it must not
  truncate. Inventory the current detail panel's full field set during Section 3 and carry
  all of it over.
- **Attribution → Leaflet native control, bottom-left, above the dock**, styled to theme.

## 5. Constraints (hold to these)

- **Static SPA, GitHub Pages, no backend.** No build step.
- **No ES modules.** Plain global `<script>` tags only — no `export`/`import`. New JS is a
  global function/IIFE; load order in `index.html` matters.
- **No new runtime dependencies, no framework, no bundler.**
- **Bump the cache token.** Bump every changed asset's `?v=N` token in `index.html` to the
  next number (whatever the repo is currently at — do **not** hardcode a value from another
  branch). Mobile Safari serves stale code otherwise.
- **Preserve all existing functionality.** Every control reachable today must remain
  reachable after the redesign — this is a relocation, not a feature cut. Search, era toggle,
  curation, KEY/filter, layer toggles, and marker detail all keep working.
- **Do not touch:** the marker data model and **Pleiades URI join key**; generated files
  (`js/roads-itinere.js`, `js/sites-pleiades.js`, `js/orbis-days.js`,
  `js/pleiades-photos.json`); the Supabase auth layer (`js/auth.js`, ES256 wedge); quest
  logic; the basemap layers (owned by the separate Stadia task).
- **Acceptance is manual and on-device.** No test harness exists; do not add one or create a
  `tools/` directory. The gate is iPhone Safari — and note the original mobile failure was a
  **tap/touch breakage that only reproduced on-device**, so a chrome rewrite must be
  re-verified there specifically.

## 6. Dock interaction details (from the mockup)

- The dock is always visible; only one of {search panel, detail card, curation popover, key
  panel} is open at a time — opening one closes the rest.
- A search panel opens over a scrim; tapping the scrim or "Cancel" closes it.
- The detail card has an explicit close (×) and is also dismissed by tapping the open map.
- Map controls that must stay reachable above the dock (e.g. a locate/recenter affordance)
  ride just above the dock, not under it.
- Nothing the dock opens should permanently cover the map; the map-first feel is the point.

## 7. Acceptance criteria

- [ ] Mapping table from Section 3 was produced and confirmed before edits.
- [ ] Top bar still shows VIA + a working ANCIENT/MODERN toggle (unchanged).
- [ ] Bottom dock present with search, curation, and key; opening one closes the others.
- [ ] **Zoom is never hijacked by markers/detail:** a visible +/− zoom control is present,
      pinch-to-zoom works, and the user can zoom into a dense marker area without first
      dismissing the detail panel. The old "close slider → double-tap → re-tap" loop is gone.
- [ ] Marker/road tap shows a dismissible, **scrollable/expandable** detail panel (close
      button + tap-map-to-dismiss); **every field** from today's detail is preserved,
      including the full road detail (photo, quest CTA, certainty tag, ancient itinerary,
      contributor, source, sites-along-the-stretch list). Nothing is truncated.
- [ ] Search opens a panel with the sites list and returns to the open map on dismiss.
- [ ] KEY/filter retains its **current** functionality, opened from the dock.
- [ ] Every control that worked before is still reachable (no lost features).
- [ ] Attribution control is bottom-left, above the dock, styled to theme, not clipped.
- [ ] `?v=` cache token bumped on every changed asset in `index.html`.
- [ ] No ES module syntax; map boots with no console errors.
- [ ] No test runner / package manager / `tools/` dir added; data model, Pleiades keying,
      generated files, and auth untouched; basemap layers unchanged.
- [ ] **On-device gate:** on a real iPhone in Safari — taps register, dock + card + panels
      behave, era toggle works, the screen no longer feels crowded; desktop unaffected.

## 8. Out of scope

- Basemap / tile layers (the separate Stadia task owns these).
- Marker clustering (separate task).
- Any data, quest, auth, or sync change.

## 9. Notes

- `via-ab-B-dock.html` is the visual + interaction reference; the real build wires the same
  pattern onto the actual controls rather than the mockup's placeholder list.
- Sequence: run this on a **fresh branch off an updated `main`** *after* the Stadia basemap
  branch is merged and signed off — this change is larger and shouldn't stack on an unmerged
  one.
- This is the change that addresses the original "mobile is crowded and clumsy" complaint;
  judge success by whether the screen feels uncrowded on the phone, not just reorganized.

