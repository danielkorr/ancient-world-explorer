# Task: Migrate basemap to Stadia Maps (Stamen) with domain auth + attribution

**File:** `docs/v1-spec-stadia-basemap.md`
**Project:** VIA — Ancient World Explorer (static SPA, Leaflet, GitHub Pages)
**Status:** Ready for implementation

---

## 1. Why

VIA currently serves base tiles from CARTO. CARTO's basemaps are clean data-viz
canvases; they fight VIA's antique identity. Stadia Maps hosts the Stamen styles
(Terrain, Watercolor) on a free tier, and those read as "old map," which suits the
ancient-world theme. This task swaps the basemap provider and wires attribution
correctly. Nothing about the marker model, Pleiades keying, quests, or auth flow
changes.

## 2. Scope

**In scope**
- Replace the CARTO tile layer with a Stadia Stamen tile layer.
- Wire credits through Leaflet's native attribution control, styled to the theme.
- Remove all CARTO URLs and CARTO attribution strings.

**Out of scope — do not touch**
- Marker data model and **Pleiades URI as the join key** (unchanged).
- Marker clustering (separate task — link the clustering spec once it lands).
- The mobile chrome redesign / sheet-vs-dock layout (separate task, pending a
  design decision — do not implement any chrome changes here).
- Quest logic, the Supabase auth layer (`js/auth.js`, ES256 wedge), and check-in sync.

## 3. Project constraints (hold to these)

- **Static SPA, GitHub Pages, no backend.** Build-time/static only.
- **No API key in the repo.** Auth is domain-based. `danielkorr.github.io` is already
  whitelisted in the Stadia dashboard; `localhost` / `127.0.0.1` are keyless. A key in
  client code would be public on deploy and is unnecessary here.
- **No new runtime dependencies.** Stadia is just a tile URL; Leaflet is already
  vendored. Do not add npm packages, a bundler, or a framework.
- **Bump the cache token.** Local assets carry a `?v=N` token in `index.html` (currently
  `v10`). This change edits JS, so bump every changed asset's token to `v11` in
  `index.html`. Skipping this means mobile Safari serves stale code and the change appears
  not to work. Bumping the page URL alone does NOT work — each sub-resource must be bumped.
- **Do not hand-edit generated files** (`js/roads-itinere.js`, `js/sites-pleiades.js`,
  `js/orbis-days.js`, `js/pleiades-photos.json`) and **do not touch the Supabase auth
  layer** (`js/auth.js`) — none of them are involved in a basemap swap.
- **Acceptance is manual and on-device.** Per `AGENTS.md` and `ARCHITECTURE.md` there is
  no test harness: `tools/mobile-crawler.mjs` is *proposed, not built* (the `tools/` dir
  does not exist), and even once built, headless Chromium cannot reproduce iOS Safari's
  touch behavior. Do **not** add a test runner, create `tools/`, or install a package
  manager for this task. The gate is: load the map (localhost or the deployed PR/site) on
  a **real iPhone in Safari**, confirm Stamen tiles render and markers/popups work, then a
  desktop check.

## 4. Authentication model (read before coding)

Do **not** embed an API key. Domain authentication covers production on every device
(phone, tablet, desktop) once the domain is whitelisted, which it is. Local dev on
`localhost` needs nothing. Phone-over-wifi testing uses a LAN IP, which is neither
localhost nor the prod domain — that is handled by the developer whitelisting the LAN
address in the Stadia dashboard, **not** by adding a key to code. Leave any
`STADIA_API_KEY` constant absent or empty.

## 5. Implementation

### 5.1 Basemap style — the one open decision

Default to **Stamen Terrain** (most legible under VIA's marker density). **Watercolor**
is the documented alternative and is selected by a single constant. Watercolor differs
in three ways that the code must respect: it is served as `.jpg`, its tiles thin out
past zoom 16, it has **no labels of its own** (pair it with Stamen Toner labels), and
its attribution **omits the OpenMapTiles credit**.

### 5.2 Tile layer module

```js
// basemap.js — Stadia Stamen basemap for VIA
// Domain auth only: NO API key in code. localhost is keyless; production is
// authorized via danielkorr.github.io (whitelisted in the Stadia dashboard).

const ACTIVE_BASEMAP = 'terrain'; // 'terrain' (default) | 'watercolor'

const ATTR_OSM    = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ATTR_STADIA = '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>';
const ATTR_STAMEN = '&copy; <a href="https://stamen.com/">Stamen Design</a>';
const ATTR_OMT    = '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>';

const BASEMAPS = {
  terrain: {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
    options: { maxZoom: 18, attribution: [ATTR_STADIA, ATTR_STAMEN, ATTR_OMT, ATTR_OSM].join(' ') },
    labels: null
  },
  watercolor: {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    // NOTE: no OpenMapTiles credit for watercolor; caps at z16.
    options: { maxZoom: 16, attribution: [ATTR_STADIA, ATTR_STAMEN, ATTR_OSM].join(' ') },
    labels: 'https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png'
  }
};

export function addBasemap(map) {
  const cfg = BASEMAPS[ACTIVE_BASEMAP];
  L.tileLayer(cfg.url, cfg.options).addTo(map);
  if (cfg.labels) {
    // labels overlay carries no attribution to avoid duplicating the base credits
    L.tileLayer(cfg.labels, { maxZoom: 18, attribution: '' }).addTo(map);
  }
}
```

Wire `addBasemap(map)` in at the point where the CARTO layer is currently added.

### 5.3 Attribution

- Keep Leaflet's built-in attribution control enabled (`attributionControl: true`); let
  it populate from the layer `attribution` strings above. Do **not** hand-roll a
  separate credits widget for tiles.
- Style `.leaflet-control-attribution` to match VIA's dark/gold theme (dark pill,
  gold links) rather than the default white box. This control is the **legal home for
  the basemap credits** (OSM under ODbL, Stamen, Stadia, plus OpenMapTiles for Terrain).
- Data-source credits that are **not** tile credits — Pleiades (CC BY), Wikidata (CC0),
  and any CC-BY enrichment sources — stay in the existing info/KEY panel, separate from
  the tile attribution. Do not move those into the Leaflet control.

### 5.4 Remove CARTO

Delete the CARTO `L.tileLayer(...)` and its attribution string. Grep the repo for
`carto`, `basemaps.cartocdn`, and `cartodb` and remove all references.

### 5.5 Cache busting (do not skip)

After editing the JS/CSS, bump the `?v=N` query token on every changed local asset
reference in `index.html` from `v10` to `v11`. This is the project's stale-asset guard for
mobile Safari; the basemap won't appear to change on a phone without it.

## 6. Acceptance criteria

- [ ] Map renders the active Stadia Stamen style on `localhost` (keyless) **and** on the
      deployed `danielkorr.github.io` domain.
- [ ] No API key string exists anywhere in the repo.
- [ ] Leaflet attribution control shows the correct credits for the active style; all
      links resolve. Terrain includes OpenMapTiles; Watercolor does not.
- [ ] Attribution control is styled to the VIA theme, legible on mobile, not clipped.
- [ ] All three marker types render with working popups; **Pleiades keying unchanged**.
- [ ] No `carto` / `cartocdn` / `cartodb` references remain.
- [ ] `?v=N` cache token bumped to `v11` on every changed asset in `index.html`.
- [ ] If `ACTIVE_BASEMAP = 'watercolor'`: labels overlay loads, and panning past z16
      does not flood the console with broken-tile errors (expected thinning, handled).
- [ ] **On-device check (the gate):** map loads in real iPhone Safari — Stamen tiles
      render, markers/popups work, attribution is legible and not clipped; desktop check
      passes.
- [ ] No test runner or package manager was added, and no `tools/` directory was created.

## 7. Notes

- VIA runs as a nonprofit; Stadia's free tier and domain auth cover this with no cost.
  If VIA is monetized later, revisit Stadia's commercial tier and fold it into the
  existing CC-BY license audit before shipping a monetized build.
- The basemap style (`ACTIVE_BASEMAP`) is the only aesthetic value left open; it is a
  one-line change, so it can be flipped after on-device review without touching anything
  else.

