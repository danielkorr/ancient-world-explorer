# CLAUDE.md

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
