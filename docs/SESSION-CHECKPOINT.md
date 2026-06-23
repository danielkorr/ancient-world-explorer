# VIA — Session checkpoint (2026-06-20)

Working state of the mobile-redesign + Stadia-basemap effort. Two tracks, both specced.

---

## Track 1 — Stadia basemap

**Spec:** `docs/v1-spec-stadia-basemap.md`

**Decision (c):** Stamen is the **ancient-mode floor**, layered **on top of the retained
keyless sepia-CARTO base** (so the map never renders white if Stamen fails). Modern mode
stays **CARTO Voyager**. **DARE** atlas overlay and **Esri** satellite are untouched.
`ACTIVE_ANCIENT_FLOOR` = `terrain` (default) | `watercolor`.

**Auth:** domain-based. `danielkorr.github.io` whitelisted (all-subdomains, which also
covers the bare apex). `localhost` / `127.0.0.1` are keyless. **No API key in the repo.**
A phone on a LAN IP is an *unauthorized* origin → Stamen falls back to the CARTO base there.

**Branch state:** `stadia-maps-config-and-testing` holds the first commit (`00765f6`,
"Stadia Maps basemap migration + attribution"). Desktop/localhost render confirmed good;
all plumbing (roads, sites, click→detail) works. A LAN-IP test showed a blank white map —
that is what the fallback floor below fixes.

**PENDING — fallback-floor follow-up (do before merging):**
- Re-add the sepia CARTO floor as the keyless **base**; layer Stamen **above** it.
  Z-order (bottom→top): `ancientFallbackLayer` (CARTO) → Stamen floor → DARE → markers.
- Keep the sepia CSS filter on the base (only visible when Stamen doesn't cover it).
- Bump cache token **v81 → v82** on every changed asset in `index.html`.
- Ancient-mode attribution now also includes the CARTO base credit.
- Acceptance: from an unauthorized origin (LAN IP) ancient mode shows the **CARTO base, not
  white**; on localhost / the live domain, full Stamen renders.

---

## Track 2 — Mobile chrome redesign (Dock)

**Spec:** `docs/v1-spec-mobile-dock.md`

**Chosen layout: Dock** (over Sheet). Map stays open; chrome lives in a bottom dock; detail
and search appear as dismissible panels.

**Confirmed decisions:**
- Era toggle (ANCIENT/MODERN) stays pinned **top**, not in the dock.
- Key button keeps its **existing KEY/filter functionality**, just mounted in the dock
  (not downgraded to the mockup's simple legend).
- Attribution sits **bottom-left**, above the dock.
- Detail panel must **scroll/expand and preserve every field** — road detail is rich
  (photo, quest/verify CTA, certainty tag e.g. "Conjectured", ancient itinerary,
  contributor, source, "sites along this stretch" list). No truncation.
- **Zoom gesture fix:** today, double-tapping a quest site / city opens the detail panel
  instead of zooming, forcing a close → double-tap → re-tap loop. Add a **visible +/− zoom
  control** + ensure **pinch-to-zoom** works, so zoom never depends on double-tapping near a
  marker. Single tap = immediate detail. (Could be pulled out as a small standalone fix
  before the full Dock work if relief is wanted sooner.)

**Build status: NOT implemented yet** — the gorgeous Dock layout currently exists only in
the mockups and this spec, not in the app. The live mobile chrome is still the older v1.5
layout (top-bar search + large sliding panel).

**Branch state:** `mobile-dock-redesign` exists but was cut from **pre-Stadia** main
(`87e8877`). **Rebase it onto main after Stadia merges**, then run the Dock spec
discovery-first (inventory current controls → present mapping → confirm → build).

**Mockups (standalone, not in the app):** `via-ab-A-sheet.html`, `via-ab-B-dock.html`
(real Leaflet + Sepia/Terrain/Watercolor switcher). Reference only.

---

## Standing project rules (from AGENTS.md)

- No ES modules — plain global `<script>` tags, no `export`/`import`.
- Bump the `?v=N` cache token on **every** CSS/JS change (each sub-resource).
- No build, no package manager, **no test runner / no `tools/` dir**. QA is **manual,
  on-device (iPhone Safari)** — the original failure was a touch bug that only repro'd
  on-device. `tools/mobile-crawler.mjs` is *proposed, not built*.
- Do not touch: generated files (`js/roads-itinere.js`, `js/sites-pleiades.js`,
  `js/orbis-days.js`, `js/pleiades-photos.json`), the Supabase auth layer (`js/auth.js`,
  ES256 wedge), or the Pleiades-URI marker join key.
- Deploy = push to `main` (GitHub Pages).

## Housekeeping done & pushed (`87e8877`)

- Deleted empty `docs/agents.md`. Root `AGENTS.md` kept (Codex landmines + read-CLAUDE.md-first).
- Moved the "Rethinking Core Layers" (Itiner-e vs ORBIS) analysis into
  `docs/redesign/DATA-SOURCES.md`; decision recorded in `docs/redesign/DECISIONS.md`.

---

## Next 4 steps

1. Save both updated specs into `docs/`.
2. On `stadia-maps-config-and-testing`: run the fallback-floor follow-up → verify never-white
   on the LAN IP → commit.
3. Merge Stadia → `main` → final phone check on the live site.
4. Rebase `mobile-dock-redesign` on `main` → run the Dock spec (discovery-first).