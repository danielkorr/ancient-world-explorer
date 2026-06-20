# Task: Stamen (Stadia) ancient-mode floor + attribution

**File:** `docs/v1-spec-stadia-basemap.md`
**Project:** VIA — Ancient World Explorer (static SPA, Leaflet, GitHub Pages)
**Status:** Ready for implementation

---

## 1. Why

VIA's ancient-mode floor is currently CARTO `light_all` with a sepia CSS tint — a hack to
fake an old-map feel out of a modern basemap. Stadia hosts the Stamen styles (Terrain,
Watercolor), which read as a genuine antique map. This task replaces the sepia CARTO floor
in **ancient mode** with a Stamen layer, and wires its attribution. Modern mode, the DARE
atlas overlay, the Esri satellite layer, the marker model, Pleiades keying, quests, and
auth are all unchanged.

## 2. The existing basemap architecture (read first)

VIA does **not** have a single basemap. `js/app.js` runs a four-layer system tied to the
era toggle and a zoom-based reveal:

1. `ancientLayer` — **DARE** Roman atlas tiles; overlay that fades in z7–z11. *Not CARTO.* **Keep.**
2. `ancientFallbackLayer` — **CARTO `light_all`, sepia-tinted**; the permanent floor under
   DARE in ancient mode. **← this is what we replace with Stamen.**
3. `modernLayer` — **CARTO Voyager**; the basemap in modern mode. **Keep.**
4. `satelliteLayer` — **Esri World Imagery**; fades in at deep zoom. *Not CARTO.* **Keep.**

## 3. Scope

**In scope**
- Replace `ancientFallbackLayer` (sepia CARTO `light_all`) with a Stamen floor.
- Drop the sepia CSS filter from that layer — Stamen is already warm-toned.
- Add the new layer's attribution to Leaflet's native control.

**Out of scope — do not touch**
- `modernLayer` (CARTO Voyager). Modern mode should look modern; Voyager stays, and its
  CARTO attribution stays with it. (This is decision **(c)** — Stamen is the *ancient*
  floor only, not a global basemap replacement.)
- `ancientLayer` (DARE) and `satelliteLayer` (Esri). Untouched.
- Marker data model and **Pleiades URI as the join key** (unchanged).
- Marker clustering (separate task — link the clustering spec once it lands).
- The mobile chrome redesign / sheet-vs-dock layout (separate task, pending a
  design decision — do not implement any chrome changes here).
- Quest logic, the Supabase auth layer (`js/auth.js`, ES256 wedge), and check-in sync.

**Explicitly dropped from an earlier draft:** the criterion "no carto references remain."
It was based on a wrong one-basemap model. CARTO Voyager intentionally survives in modern
mode; only the *sepia CARTO ancient floor* is removed.

## 4. Project constraints (hold to these)

- **Static SPA, GitHub Pages, no backend.** Build-time/static only.
- **No ES modules.** VIA loads every script as a plain global `<script>` tag (no
  `type="module"`). The new file must define a **global function**, not `export` anything,
  and load via `<script src="js/basemap.js?v=81"></script>`. An `export` would throw and
  the map would not boot.
- **No API key in the repo.** Auth is domain-based. `danielkorr.github.io` is whitelisted
  in the Stadia dashboard; `localhost` / `127.0.0.1` are keyless. Leave any
  `STADIA_API_KEY` absent/empty. (Phone-over-wifi via a LAN IP needs the developer to
  whitelist that LAN address in the dashboard — not a code change.)
- **No new runtime dependencies.** Stadia is just a tile URL; Leaflet is already vendored.
  Do not add npm packages, a bundler, or a framework.
- **Bump the cache token.** Local assets carry a `?v=N` token in `index.html` — the repo is
  currently at **`v80`**. This change edits JS, so bump every changed asset's token to
  **`v81`** in `index.html`. Bumping the page URL alone does NOT work — each sub-resource
  must be bumped.
- **Do not hand-edit generated files** (`js/roads-itinere.js`, `js/sites-pleiades.js`,
  `js/orbis-days.js`, `js/pleiades-photos.json`) and **do not touch the Supabase auth
  layer** (`js/auth.js`).
- **Acceptance is manual and on-device.** Per `AGENTS.md` and `ARCHITECTURE.md` there is no
  test harness: `tools/mobile-crawler.mjs` is *proposed, not built* (`tools/` does not
  exist), and even once built, headless Chromium cannot reproduce iOS Safari touch
  behavior. Do **not** add a test runner, create `tools/`, or install a package manager.
  The gate is: load the map (localhost or the deployed PR/site) on a **real iPhone in
  Safari** and confirm it renders correctly, plus a desktop check.

## 5. Implementation

### 5.1 Ancient-floor style — the one open decision

The Stamen style backing the ancient floor is chosen by a single constant. Default to
**Terrain** (most legible under marker density). **Watercolor** is the documented
alternative. Watercolor differs: it is `.jpg`, its tiles thin past zoom 16 (the Esri
satellite already fades in at deep zoom and covers that range), it has **no labels of its
own** (pair it with Stamen Toner labels), and its attribution **omits OpenMapTiles**.

### 5.2 New file: `js/basemap.js` (global script, NOT a module)

```js
// js/basemap.js — Stamen ancient-mode floor for VIA (Stadia-hosted).
// Plain global script — NO ES module, NO export. Load via:
//   <script src="js/basemap.js?v=81"></script>
// Domain auth only: NO API key. localhost is keyless; production is authorized via
// danielkorr.github.io (whitelisted in the Stadia dashboard).

// Stamen style for the ANCIENT-mode floor. Modern mode stays CARTO Voyager.
var ACTIVE_ANCIENT_FLOOR = 'terrain'; // 'terrain' (default) | 'watercolor'

(function () {
  var ATTR_OSM    = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  var ATTR_STADIA = '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>';
  var ATTR_STAMEN = '&copy; <a href="https://stamen.com/">Stamen Design</a>';
  var ATTR_OMT    = '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>';

  var FLOORS = {
    terrain: {
      url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
      options: { maxZoom: 18, attribution: [ATTR_STADIA, ATTR_STAMEN, ATTR_OMT, ATTR_OSM].join(' ') },
      labels: null
    },
    watercolor: {
      url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
      // no OpenMapTiles credit; thins past z16 (Esri satellite covers deep zoom)
      options: { maxZoom: 16, attribution: [ATTR_STADIA, ATTR_STAMEN, ATTR_OSM].join(' ') },
      labels: 'https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png'
    }
  };

  // Builds the Stamen layer that REPLACES the old sepia CARTO ancientFallbackLayer.
  // Watercolor needs a labels overlay, so return a LayerGroup in that case so the floor
  // and its labels are added/removed together by the existing era/zoom logic.
  window.makeAncientFloor = function () {
    var cfg = FLOORS[ACTIVE_ANCIENT_FLOOR] || FLOORS.terrain;
    var base = L.tileLayer(cfg.url, cfg.options);
    if (!cfg.labels) return base;
    var labels = L.tileLayer(cfg.labels, { maxZoom: 18, attribution: '' });
    return L.layerGroup([base, labels]);
  };
})();
```

### 5.3 Wire it into `js/app.js`

- Replace the construction of `ancientFallbackLayer` with `var ancientFallbackLayer =
  makeAncientFloor();`. Keep its name, role, and position in the era toggle + zoom-reveal
  logic exactly as they are — only the layer's source changes.
- Remove the sepia CSS filter that was applied to the old CARTO floor (class/style on those
  tiles), since Stamen is already warm-toned.
- Add `<script src="js/basemap.js?v=81"></script>` in `index.html` **before** `app.js`, so
  `makeAncientFloor` is defined when `app.js` runs.

### 5.4 Attribution

- Keep Leaflet's built-in attribution control enabled and let it aggregate the
  attributions of whatever layers are currently active. Do **not** hand-roll a tile-credits
  widget.
- **Preserve** the existing attribution strings on `ancientLayer` (DARE), `modernLayer`
  (CARTO Voyager), and `satelliteLayer` (Esri). The CARTO credit legitimately remains in
  modern mode.
- The new Stamen floor carries its own attribution (set in `basemap.js` above): Stadia +
  Stamen + OSM, plus OpenMapTiles for Terrain only.
- Style `.leaflet-control-attribution` to match VIA's dark/gold theme (dark pill, gold
  links), legible and not clipped on a narrow mobile viewport. Data-source credits that are
  not tile credits — Pleiades (CC BY), Wikidata (CC0) — stay in the existing info/KEY panel.

## 6. Acceptance criteria

- [ ] **Ancient mode** floor renders the active Stamen style on `localhost` (keyless) and
      on deployed `danielkorr.github.io`; the sepia CARTO floor is gone and the sepia
      filter is removed.
- [ ] **Modern mode** still shows CARTO Voyager; the era toggle behaves as before.
- [ ] DARE overlay still fades in z7–z11; Esri satellite still fades in at deep zoom.
- [ ] `js/basemap.js` is a plain global script (no `export`); `makeAncientFloor` is defined
      before `app.js` runs; the map boots with no console errors.
- [ ] Attribution control aggregates the correct credits per mode (ancient: Stamen/Stadia/
      OSM, +OpenMapTiles for terrain, + DARE; modern: CARTO Voyager; + Esri at deep zoom);
      styled to theme, legible on mobile.
- [ ] No API key string anywhere in the repo.
- [ ] `?v=` cache token bumped to **`v81`** on every changed asset in `index.html`.
- [ ] If `ACTIVE_ANCIENT_FLOOR = 'watercolor'`: Toner labels overlay loads with the floor,
      and panning past z16 does not flood the console (expected thinning; satellite covers
      deep zoom).
- [ ] Markers (all types) + popups + **Pleiades keying** unchanged.
- [ ] No test runner / package manager added; no `tools/` directory created.
- [ ] **On-device check (the gate):** map loads in real iPhone Safari — ancient Stamen
      floor renders, era toggle works, markers/popups work, attribution legible and not
      clipped; desktop check passes.

## 7. Notes

- VIA runs as a nonprofit; Stadia's free tier and domain auth cover this at no cost. If VIA
  is monetized later, revisit Stadia's commercial tier and fold it into the existing CC-BY
  license audit.
- `ACTIVE_ANCIENT_FLOOR` (terrain | watercolor) is the only aesthetic value left open — a
  one-line flip, judged on-device. Watercolor + the existing Esri deep-zoom reveal may pair
  especially well, since satellite takes over right where Watercolor thins out.
