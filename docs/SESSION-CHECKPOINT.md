# VIA — Session checkpoint (updated 2026-06-23)

## STATUS AT A GLANCE
- **Track 1 — Stadia basemap: DONE.** Shipped, live, verified on-device.
- **Track 2 — Mobile Dock redesign: DONE.** Shipped to `main` (commit `560ea50`), live on
  `danielkorr.github.io`, verified on iPhone at `VIA v84`. The original "crowded and clumsy"
  complaint is fixed: chrome collapsed into one bottom dock (Search · DETAIL · KEY), map-first,
  +/- zoom control, detail panel scrolls without truncation, attribution ⓘ above the dock.
- **Track 3 — Mobile interaction fixes: captured, NOT started.** ← resume here.

> Lesson logged: the local dev server serves *uncommitted working-tree* files, so the phone on
> the LAN IP showed v84 while production was still v83 — the Dock work had never actually been
> committed despite the plan saying it would. **Always `git log --oneline -1` to confirm a
> commit exists before calling something shipped.**

---

## Track 1 — Stadia basemap ✅ SHIPPED

On `main`, live on GitHub Pages, verified on iPhone (LAN IP + live domain).

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
- Attribution via Leaflet's native control; CARTO base credit shows in ancient mode too.

**Key commits:** `11c82d3` (rename) → `34a6c61` (fallback floor) → `00765f6` (initial migration).
**Files:** `js/basemap.js` (`window.VIA_createAncientFloor()`), `js/app.js` (ancient stack),
`css/style.css` (`.ancient-sepia-floor`), `index.html`, `docs/v1-spec-stadia-basemap.md`.

---

## Track 2 — Mobile Dock redesign ✅ SHIPPED

Shipped to `main` (commit `560ea50`), live, verified on iPhone at `VIA v84`.

**What shipped:** chrome collapsed into one bottom **dock (Search · DETAIL · KEY)**; map is
full-bleed/map-first; era toggle + VIA wordmark + profile pill stay in the top bar; **+/− zoom
control** added (bottom-right) and pinch-zoom confirmed working; detail panel **scrolls the
full road/site detail with no truncation** (removed the `-webkit-line-clamp` on `#panel-desc`
and `.quest-banner-text`); KEY panel holds the roads/sites master toggles plus tier/certainty
filters; attribution **ⓘ popover repositioned above the dock** (kept the ⓘ pattern from commit
`548de9c` rather than a persistent native credit line). One-closes-others + tap-map-to-dismiss
working. Cache token **v84**.

**Spec:** `docs/v1-spec-mobile-dock.md`. Dead branch `mobile-dock-redesign` can be deleted
(the work landed directly on `main`; the branch never held it).

**Optional polish noted, not done:** sticky panel title (road name stays pinned while the body
scrolls); the representative image scrolls away with content, which is fine/expected.

---

## Track 3 — Mobile interaction fixes ⏭ RESUME HERE

Surfaced during on-device Dock testing. **Not** chrome-reorg items — they are about whether the
map *responds* the way a thumb expects, which is the core of the mobile UX this whole effort is
for. Treat as first-class. Spec each as its own discovery-first branch off a clean `main`;
manual on-device gate. Confirmed direction noted per item so we don't re-derive.

### Suggested grouping & sequence
- **Follow-up A — map gesture + filter fixes:** 3a + 3b + 3d (behavioral, smaller).
- **Follow-up B — searchable roads:** 3c (feature; data + matching, meatier).
- Do A first, then B (or reprioritize B if "search the Appian Way" is the priority).

### 3a. Double-tap a marker should zoom, not open detail
- Today: tapping a site/city marker opens the detail panel, so double-tapping it opens detail
  instead of zooming → can't zoom incrementally on a marker. The +/− buttons help but don't
  satisfy this.
- **Wanted (confirmed):** double-tap *on a marker* zooms incrementally (repeatable); single tap
  opens detail; user summons detail when they choose. Implement via a tap/double-tap
  discriminator — accept the ~250–300 ms single-tap detail delay as the cost. (Rejected:
  moving detail to long-press.)

### 3b. Secondary/smaller road segments don't respond to taps
- Today: primary roads tap → detail panel fine (click→`showSegmentPanel` wiring intact, NOT a
  Dock regression). Smaller arteries render (some named) but tapping/hovering does nothing.
- Likely cause: hit-target too thin (1–2 px polyline vs ~44 px finger) and/or the click handler
  isn't bound to the secondary layer. Fix: widen tap tolerance / invisible click halo on
  secondary segments, and/or bind `showSegmentPanel` to that layer.
- Confirm cause when specced: on desktop, does hovering a secondary road change the cursor?
  No-on-desktop-too → handler/binding issue; works-on-desktop-not-touch → hit-target size.

### 3c. Roads should be searchable, with compound/alias matching
- Today: search indexes *sites* only; roads aren't searchable. So "Via Appia", "Appian Way",
  "Rome to Tibur" all miss. Compound/multi-word and alias queries match weakly even for sites
  (looks like single-substring matching on one field).
- **Wanted:** index road segments with multiple searchable strings — Latin name (Via Appia),
  common English name (Appian Way), ancient-itinerary names, and an endpoint pair (Rome–Tibur)
  — and match on any token, not one substring. Itiner-e name/itinerary coverage is uneven (per
  AGENTS.md), so some segments will have nothing to index — expected.
- Meatiest of the set (real feature, data/indexing dimension); arguably highest user value —
  "search for the Appian Way" is how a visitor actually thinks.

### 3d. Filter precedence — tier toggles vs the DETAIL slider
- Today: the KEY tier toggles (Documented / Photo Quest / Location Quest) and the DETAIL slider
  both filter the same markers with no clear precedence. On-device: untoggling a tier sometimes
  leaves its markers on, toggles feel inconsistent, slider appears to re-introduce things you
  turned off. Likely pre-existing (Dock just put the two controls side-by-side) — confirm on a
  pre-Dock view.
- **Decision (confirmed):** **toggles are the master filter; the slider sub-filters within what
  the toggles allow.** A tier toggled OFF never appears, regardless of slider position ("off
  means off"). The slider only thins/expands density among tiers left ON; it can never
  re-introduce an off tier. Rationale: the slider is a nice-to-have for the big arrival view;
  the toggles are the real tool for digging down.
- Empty state: all three toggles off → **no quest markers shown** (clean empty). (Confirm if
  anything non-quest should remain, e.g. roads/base.)

---

## Standing project rules (from AGENTS.md)
- No ES modules — plain global `<script>` tags.
- Bump `?v=N` cache token on every CSS/JS change (every sub-resource). **Currently v84.**
- No build / package manager / test runner / `tools/` dir. QA is **manual, on-device (iPhone Safari)**.
- Don't touch: generated files (`js/roads-itinere.js`, `js/sites-pleiades.js`,
  `js/orbis-days.js`, `js/pleiades-photos.json`), Supabase auth (`js/auth.js`, ES256 wedge),
  or the Pleiades-URI marker join key.
- Deploy = push to `main` (GitHub Pages). **Verify with `git log --oneline -1` that work is
  actually committed before calling it shipped — the local server serves uncommitted files.**
- Agent guides: Claude Code reads `CLAUDE.md`; `AGENTS.md` is the Codex/outside-reviewer landmines doc.