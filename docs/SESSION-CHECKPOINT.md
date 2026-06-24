# VIA — Session checkpoint (updated 2026-06-23)

## STATUS AT A GLANCE
- **Track 1 — Stadia basemap: DONE. Shipped to `main`, live, verified on-device.**
- **Track 2 — Mobile Dock redesign: specced, NOT started.** ← resume here.

---

## Track 1 — Stadia basemap ✅ COMPLETE

Merged to `main` and pushed; GitHub Pages is serving it. Verified on iPhone on both the
LAN IP (`10.0.0.218`) and the live domain (`danielkorr.github.io`). `VIA v83`.

**What shipped:**
- Ancient-mode floor is a stack (bottom→top): **keyless sepia-CARTO base → Stamen (Stadia)
  → Toner labels (watercolor only) → DARE**. When Stamen can't authenticate/load, its tiles
  render transparent and the CARTO base shows through — **ancient mode never goes white**.
  Pure layer stacking, no tileerror handler.
- Modern mode unchanged (CARTO Voyager). DARE + Esri satellite untouched.
- Constant is **`ACTIVE_ANCIENT_FLOOR`** (`terrain` default | `watercolor`) — controls the
  Stamen top layer only.
- Auth: **domain-based, no API key in repo.** Whitelisted in the Stadia dashboard:
  `danielkorr.github.io` (all-subdomains, covers apex) and the dev LAN IP `10.0.0.218`.
  `localhost`/`127.0.0.1` keyless. (LAN IP is DHCP — may need re-adding if it changes;
  consider a router reservation.)
- Attribution via Leaflet's native control; CARTO base credit now legitimately shows in
  ancient mode too.
- Cache token at **v83** (all 11 assets).

**Relevant commits on `main`:** `11c82d3` (rename) → `34a6c61` (fallback floor) →
`6404957` (docs) → `00765f6` (initial migration). Earlier IDE "2 diagnostic issues" were a
transient mid-rename name mismatch — resolved, confirmed by `grep` + `node --check`.

**Files:** `js/basemap.js` (`window.VIA_createAncientFloor()`), `js/app.js` (ancient stack
wiring), `css/style.css` (`.ancient-sepia-floor` filter), `index.html` (v83 tokens),
`docs/v1-spec-stadia-basemap.md`.

---

## Track 2 — Mobile Dock redesign ⏭ RESUME HERE

**Spec:** `docs/v1-spec-mobile-dock.md` — already on `main` (current version, includes the
rich-detail panel + zoom-fix). Build status: **not implemented.** The live app still has the
old crowded chrome (top search bar, floating DETAIL slider, 4-icon row, KEY).

### Confirmed Dock decisions (do not re-derive)
- Layout = **Dock** (chosen over Sheet). Map-first; chrome in a bottom dock + ephemeral panels.
- Era toggle (ANCIENT/MODERN) stays **top**, not in the dock.
- KEY button keeps its **existing KEY/filter functionality**, dock-mounted (not the simple legend).
- Attribution **bottom-left**, above the dock.
- Detail panel **scrolls/expands and preserves every field** (road detail is rich: photo,
  quest/verify CTA, certainty tag e.g. "Conjectured", ancient itinerary, contributor, source,
  "sites along this stretch" list). No truncation.
- **Zoom fix:** add a visible **+/− zoom control** + ensure **pinch-to-zoom**, so
  double-tapping a site/city no longer opens detail-instead-of-zoom (the close→double-tap→
  re-tap loop). Single tap = immediate detail.
- Reference mockup: `via-ab-B-dock.html`.

### RESUME PROCEDURE (start of next session)

1. Get on a clean, current main (PowerShell — separate lines, `&&` is not supported):
   ```
   git switch main
   git pull
   ```
2. **Inspect the stale Dock branch before touching it** — check whether it has any unique commits:
   ```
   git log main..mobile-dock-redesign --oneline
   ```
   - If this prints **nothing** → the branch has nothing main lacks. Safe to recreate (step 3a).
   - If it prints commits → they're unique work; read them before deciding (likely just an
     older copy of the dock spec — main's copy is the good one).
3. **Recommended: recreate the Dock branch fresh from main** (avoids a rebase conflict on
   `docs/v1-spec-mobile-dock.md`, since main already has the current spec):
   ```
   git branch -D mobile-dock-redesign
   git switch -c mobile-dock-redesign
   ```
   *(Alternative if you'd rather keep the branch: `git switch mobile-dock-redesign;
   git rebase main` and, on any conflict in `docs/v1-spec-mobile-dock.md`, TAKE MAIN'S
   VERSION — it is the current one.)*
4. **Confirm the starting point** before handing off:
   - On `mobile-dock-redesign`, `docs/v1-spec-mobile-dock.md` exists and contains the words
     **"pinch"** and **"Conjectured"** (proves it's the current spec).
   - App still loads `VIA v83` with the Stamen basemap (you're building on the shipped basemap).
5. **Hand the spec to Claude Code (discovery-first):**
   ```
   Implement docs/v1-spec-mobile-dock.md. Per Section 3, FIRST inventory the current
   mobile chrome (index.html, app.js, CSS) and present the mapping table + plan — do NOT
   change anything until I confirm. No test runner, no tools/ dir. Bump the cache token to
   the next number (currently v83 → v84). Pause on anything ambiguous.
   ```
6. Review its mapping table (especially what the 4 bottom-row icons actually do — least-known
   area), confirm, let it build, then **test on a real iPhone** (the gate).

---

## Standing project rules (from AGENTS.md)
- No ES modules — plain global `<script>` tags.
- Bump `?v=N` cache token on every CSS/JS change (every sub-resource). **Currently v83.**
- No build / package manager / test runner / `tools/` dir. QA is **manual, on-device (iPhone Safari)**.
- Don't touch: generated files (`js/roads-itinere.js`, `js/sites-pleiades.js`,
  `js/orbis-days.js`, `js/pleiades-photos.json`), Supabase auth (`js/auth.js`, ES256 wedge),
  or the Pleiades-URI marker join key.
- Deploy = push to `main` (GitHub Pages).
- Agent guides: Claude Code reads `CLAUDE.md`; `AGENTS.md` is the Codex/outside-reviewer landmines doc.

## Out of scope for the Dock work
- Basemap/tiles (done). Marker clustering (separate). Any data/quest/auth/sync change.

---

## Track 3 — Mobile interaction fixes (NEW, captured 2026-06-22) ⏭ after Dock merges

These surfaced during on-device Dock testing. They are **not** chrome-reorg items — they are
about whether the map *responds* the way a thumb expects, which is the core of the mobile UX
this whole effort is for. A decluttered map you can't zoom-without-interruption, can't tap the
road you want, or can't search by the name you know is still clumsy. Treat as first-class.

Spec each as its own discovery-first branch **after the Dock is merged** (don't stack on the
Dock branch). Confirmed direction noted per item so we don't re-derive.

### 3a. Double-tap a marker should zoom, not open detail
- Today: tapping a site/city marker opens the detail panel, so double-tapping it opens detail
  instead of zooming → can't zoom incrementally on a marker. The +/− buttons added in the Dock
  help but don't satisfy this.
- **Wanted (confirmed):** double-tap *on a marker* zooms incrementally (repeatable); single tap
  opens detail; user summons detail when they choose. Implement via a tap/double-tap
  discriminator — accept the ~250–300ms single-tap detail delay as the cost. (Option rejected:
  moving detail to long-press.)

### 3b. Secondary/smaller road segments don't respond to taps
- Today: primary roads tap → detail panel fine (click→`showSegmentPanel` wiring is intact, NOT
  a Dock regression). Smaller arteries render (some named) but tapping/hovering does nothing.
- Likely cause: hit-target too thin (1–2px polyline vs a ~44px finger) and/or the click handler
  isn't bound to the secondary layer. Fix: widen tap tolerance / add an invisible click halo on
  secondary segments, and/or bind `showSegmentPanel` to that layer.
- To confirm cause when specced: on desktop, does hovering a secondary road change the cursor?
  No-on-desktop-too → handler/binding issue; works-on-desktop-not-touch → hit-target size.

### 3c. Roads should be searchable, with compound/alias matching
- Today: search indexes *sites* only; roads aren't searchable at all. So "Via Appia",
  "Appian Way", "Rome to Tibur" all miss. Also compound/multi-word and alias queries match
  weakly even for sites (looks like single-substring matching on one field).
- **Wanted:** index road segments with multiple searchable strings — Latin name (Via Appia),
  common English name (Appian Way), ancient-itinerary names, and an endpoint pair
  (Rome–Tibur) — and match on any token, not one substring. Note: Itiner-e name/itinerary
  coverage is uneven (per AGENTS.md), so some segments will have nothing to index — expected.
- This is the meatiest of the three (a real feature with a data/indexing dimension), and
  arguably highest user value: "search for the Appian Way" is how a visitor actually thinks.

### Suggested grouping
- **Follow-up A — map gesture fixes:** 3a + 3b (small, behavioral).
- **Follow-up B — searchable roads:** 3c (feature; data + matching).
- Sequence after Dock merge, discovery-first each, manual on-device gate.

### 3d. Filter precedence — tier toggles vs the DETAIL slider
- Today: the KEY tier toggles (Documented / Photo Quest / Location Quest) and the DETAIL
  slider both filter the same markers with no clear precedence. Result on-device: untoggling
  a tier sometimes leaves its markers on the map, toggles seem inconsistent, and the slider
  appears to re-introduce things you turned off. Likely pre-existing (the Dock just put the
  two controls side-by-side, exposing the conflict) — confirm on the live pre-Dock site.
- **Decision (confirmed):** **toggles are the master filter; the slider sub-filters within
  what the toggles allow.** A tier toggled OFF never appears, regardless of slider position
  ("off means off"). The slider only thins/expands density among the tiers left ON; it can
  never re-introduce an off tier. Rationale (user's words): the slider is a nice-to-have for
  the big arrival view; the toggles are the real tool for digging down.
- Empty state: all three toggles off → **no quest markers shown** (clean empty), not "slider
  still shows something." (Confirm if anything non-quest should remain, e.g. roads/base.)
- Grouping: behavioral/state fix — pairs naturally with **Follow-up A**.
