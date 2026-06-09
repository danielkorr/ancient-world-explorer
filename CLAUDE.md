keep# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VIA — Ancient World Explorer. A static, single-page Leaflet map that overlays the Roman world on a modern basemap, surfaces ~95 ancient sites, 14 Roman roads, and flags "quests" (sites missing photos or verified coordinates in the Pleiades scholarly gazetteer).

## Running / Developing

No build, no package manager, no tests. It's plain HTML/CSS/JS with Leaflet loaded from a CDN.

- Open `index.html` directly in a browser, or serve the directory (e.g. `python -m http.server`) if you need a real origin (CORS, service workers, etc.).
- Deploy target is GitHub Pages — pushing to `main` ships the site.

## Architecture

Three files do everything; understanding how they interact matters more than any individual file:

- **`js/data.js`** — Holds `SITES_CURATED` (the rich hand-written sites) and `ROADS`. At the bottom it derives the global `SITES` by concatenating `SITES_CURATED` with any non-duplicate entries from `SITES_PLEIADES` (deduped by `pleiades` id). This is the entire content model. Site fields used by the UI: `id, name, modern, type, lat, lng, period, pleiades, rome_days, rome_mode, desc, quest`. Quest tier is set per-site via the optional `quest: "photo" | "location" | "text"` field — absence means "documented." `rome_days: 0` hides the ORBIS card.
- **`js/sites-pleiades.js`** — Auto-generated, do not hand-edit. Defines `SITES_PLEIADES` from the Pleiades CSV dump. Regenerate with `node scripts/build-sites.mjs` (uses `.cache/` for the downloaded dump; pass `--refresh` to re-fetch, `MAX_SITES=<n>` env var to change the cap).
- **`js/orbis-days.js`** — Auto-generated, do not hand-edit. Holds `ORBIS_BY_PLEIADES` (pleiades id → days/mode, from running Dijkstra over the ORBIS network from Rome) and `ORBIS_NODES` (the full reachable node table used for runtime nearest-node fallback when a site has no direct Pleiades match). Regenerate with `node scripts/build-orbis.mjs`. The runtime resolver lives in `app.js` (`orbisLookup`) and prefers direct match → nearest within 75km → the legacy hardcoded `rome_days` on curated sites.
- **`js/app.js`** — Runs top-to-bottom on load (no DOMContentLoaded guard; scripts are at end of `<body>`). Reads `SITES`/`ROADS` as globals, builds the Leaflet map, two tile layers (`ancientLayer` = DARE tiles, `modernLayer` = CARTO Voyager), and two `LayerGroup`s (`roadsGroup`, `sitesGroup`). The `TYPE` and `QUEST` config objects at the top of `app.js` map type/quest strings to colors and icons — they must stay in sync with the values used in `data.js`.
- **`index.html`** — Static DOM scaffold for the topbar, bottom controls, quest legend, and info panel. `app.js` populates these by `getElementById`; the panel uses fixed element IDs (`hero-icon`, `panel-name`, `orbis-card`, `panel-actions`, etc.) — changing IDs in HTML requires matching changes in `app.js`.

Interaction model:
- Era toggle (`setEra`) swaps `ancientLayer`/`modernLayer` and re-brings roads + sites to front. Site coordinates do not change.
- Layer toggle (`toggleLayer`) adds/removes the group from the map; state lives in the `layerState` object.
- Marker click → `showPanel(site)` which rewrites the right-hand info panel and pans the map (right-offset on desktop, up-offset on mobile, breakpoint `<=640px`).
- Info panel CSS class `.open` controls visibility; mobile vs desktop layout is pure CSS in `css/style.css`.

## Notes for editing

- Adding a site = append to `SITES` in `data.js`. No registration step.
- Adding a road = append to `ROADS`; coords are `[lng, lat]` pairs (note the order — flipped when fed to Leaflet at `app.js:46`).
- Adding a new `type` or `quest` value requires adding a matching entry to the `TYPE` / `QUEST` config objects in `app.js`.

## Social layer (auth + check-ins)

`js/auth.js` exposes a provider-agnostic API at `window.VIA.auth` — `currentUser`, `signIn(name)`, `signOut`, `checkIn(site)`, `removeCheckIn(site)`, `getCheckin(site)`, `getUserCheckins`, `getSiteVisitCount(site)`, `onChange(fn)`. Today it's backed by `LocalBackend` (localStorage); the file's data-model header doubles as the **Supabase schema spec** for when we provision the cloud backend.

**Migration path to Supabase**: replace `LocalBackend` with a `SupabaseBackend` object that satisfies the same shape — UI code in `app.js` consumes only `VIA.auth.*` and doesn't need to change. The `users` and `checkins` tables in `auth.js`'s header comment are the target schema; `lat/lng` on check-ins captures the user's actual GPS position at visit time (foundation for the future "near me" stage).

UI bindings live at the bottom of `app.js`:
- `refreshProfilePill` — topbar pill state (signed-in vs anonymous)
- `refreshCheckinRow` — info panel check-in button + visit-count line
- `refreshAllMarkers` — re-renders all site icons so the visited green badge appears/disappears live when check-ins change
- All three subscribe to `VIA.auth.onChange` so any backend write fans out to the UI without manual plumbing.

## gstack

This environment has the [gstack](https://github.com/garrytan/gstack) skill suite installed.

- Use the `/browse` skill for all web browsing, screenshots, and live-site testing.
- Never use the `mcp__claude-in-chrome__*` tools; `/browse` replaces them.

Available gstack skills:

`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.
