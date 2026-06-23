# VIA — Session checkpoint (updated 2026-06-22)

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