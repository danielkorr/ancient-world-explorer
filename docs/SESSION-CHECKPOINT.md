# VIA — Session checkpoint (updated 2026-06-24)

## STATUS AT A GLANCE
- **Track 1 — Stadia basemap: DONE.** Shipped, live, verified on-device.
- **Track 2 — Mobile Dock redesign: DONE.** Shipped to `main` (commit `560ea50`), live on
  `danielkorr.github.io`, verified on iPhone at `VIA v84`. The original "crowded and clumsy"
  complaint is fixed: chrome collapsed into one bottom dock (Search · DETAIL · KEY), map-first,
  +/- zoom control, detail panel scrolls without truncation, attribution ⓘ above the dock.
- **Track 3 — Mobile interaction fixes: IN PROGRESS.** Follow-up A (3a + 3b + 3d) DONE —
  on-device gated, ready to merge (commit `7610455`, v85, on `mobile-interaction-fixes`).
  Follow-up B (3c searchable roads) is the last remaining item. ← resume here.

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

## Track 3 — Mobile interaction fixes (Follow-up A DONE; 3c remaining) ⏭ RESUME HERE

Surfaced during on-device Dock testing. **Not** chrome-reorg items — they are about whether the
map *responds* the way a thumb expects, which is the core of the mobile UX this whole effort is
for. Treat as first-class. Spec each as its own discovery-first branch off a clean `main`;
manual on-device gate.

### Status & sequence
- **Follow-up A — map gesture + filter fixes (3a + 3b + 3d):** ✅ DONE — implemented and
  on-device gated. Commit `7610455`, **v85**, branch `mobile-interaction-fixes`, **not yet
  merged/pushed**. → next action: merge to `main` + live phone confirm.
- **Follow-up B — searchable roads (3c):** ← the last remaining Track 3 item.

### 3a. Double-tap a marker should zoom, not open detail ✅ DONE
- Implemented: mobile marker `touchend` runs a tap/double-tap discriminator — double-tap on the
  same pin zooms one level (repeatable); lone tap opens detail after a ~280 ms window. Desktop
  click/dblclick untouched. On-device confirmed.
- **Decision: pins-only — NOT extended to roads.** Roads are continuous lines with adjacent open
  map to double-tap for native zoom, and they're canvas segments (proximity-resolved) where a
  discriminator would cost more and tangle with the 3b threshold. "Double-tap-zoom on roads" is
  a **deferred maybe**, not planned.

### 3b. Secondary/smaller road segments don't respond to taps ✅ DONE
- Root cause (found via desktop repro): resolver/binding were FINE — desktop click within ~14px
  of a secondary already opened its panel. The gate was the touch path: the handler acted only
  on curated SVG paths and bailed on canvas taps. Fix: canvas taps now resolve the nearest
  segment themselves; threshold widened 14→26px **on coarse pointers only**. On-device confirmed:
  thin unnamed secondaries open their panel; named roads still tooltip + panel.
- **Watch (flagged, accepted):** in dense areas, tapping "empty" map near a road can now open
  that road's panel instead of dismissing (same as desktop already behaved). Dock close still
  works. Revisit only if it feels wrong in use.
- **Note (intended, not a bug):** on a long primary road, a contextual mini-panel keeps the road
  name (e.g. "Via Appia") visible while interacting with points along it, even after the detail
  panel is closed — keeps the road's identity in view. Feature, keep.

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

### 3d. Filter precedence — tier toggles vs the DETAIL slider ✅ DONE
- Root cause: `activeTiers` was **additive** (empty = "everything per slider"; selecting = "all
  those tiers, ignoring slider") — that inversion was the inconsistency.
- Implemented **subtractive** model: tiers default ON, **all legend rows lit at rest**; tapping a
  lit row hides that tier permanently regardless of slider ("off means off"); slider only
  sub-filters density among shown tiers; all tiers off → clean empty quest map. Proven headless
  (hiding Photo at full detail: 960→445 markers; slider cycle leaves 445 — slider can't revive a
  hidden tier) and confirmed on-device.

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

---

## Open product questions (not tied to a current track)

### Photo Quest submission pipeline — "Submit it / #VIAquest" (logged 2026-06-23)
The Photo Quest panel (step 3) tells users to share on social with **#VIAquest** and promises
"we'll relay confirmed submissions back to Pleiades' scholarly record." **That pipeline does
not exist yet — the copy currently overpromises.** Decisions to make (orthogonal to Track 3):

- **`#VIAquest` is a hashtag, not a handle.** No account is strictly required for the tag, but
  a tag no one monitors is a dead drop. Submissions only reach you if something/someone watches
  the tag, OR there's a non-social intake path. Resolve before the copy ships for real.
- **Human-in-the-loop is the right design, not a limitation.** The value is contributing to an
  *authoritative scholarly* record (Pleiades); that authority depends on verification (is the
  photo real, correctly located, usable?) — which can't be safely automated. Question is *who*
  curates and *how much friction*, not whether. For v1 the curator is almost certainly **Dano**.
- **Do NOT wire submitters directly to scholarly record-keepers.** Tension: a direct line dumps
  an unvetted firehose onto volunteer academics and routes around Pleiades' own contribution
  process/standards. Better model = three layers: **Intake** (hashtag monitor / form / email) →
  **Curation** (Dano vets) → **Hand-off** (verified items proposed to Pleiades *through Pleiades'
  own channels*).
- **Options, by effort:** (a) soften the copy to match reality now ("reviewed for inclusion",
  drop the firm Pleiades promise); (b) build a real intake you control (simple form: photo +
  coords + email) instead of relying on a social hashtag; (c) build the full pipeline with a
  curation queue + defined Pleiades hand-off (real project, later).
- **Leaning:** the copy overpromises today — fix that first via (a) or commit to monitoring an
  intake (b). "Direct to scholar" (c) appealing but route through Dano → Pleiades properly.
- **NEXT (Dano):** check Pleiades' actual contribution process to learn what's realistically
  promiseable and whether the copy can honestly say "Pleiades" at all.
