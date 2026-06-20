// basemap.js — Stadia Stamen ANCIENT-MODE FLOOR for VIA
// Domain auth only: NO API key in code. localhost / 127.0.0.1 are keyless;
// production is authorized via danielkorr.github.io (whitelisted in the Stadia
// dashboard). A key in client code would be public on deploy and is unnecessary.
//
// This is the permanent floor beneath the DARE atlas in ANCIENT mode — it
// replaces the old sepia-tinted CARTO light_all fallback. Stamen reads as "old
// map," so it suits the ancient view with no CSS sepia filter. MODERN mode keeps
// CARTO Voyager (see modernLayer in app.js); ACTIVE_BASEMAP controls the ANCIENT
// floor style only — modern mode is Voyager regardless.
//
// Loaded as a classic global <script> (VIA uses no ES modules): exposes
// window.VIA_createAncientFloor(). Tile config + attribution mirror
// docs/v1-spec-stadia-basemap.md; the only adaptation is global-function wiring
// (no `export`) so the existing era toggle + zoom-staged reveal keep working.

(function () {
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

  // Build the ancient-floor tile layer(s) WITHOUT adding them to the map — the
  // caller (app.js) owns layer membership so the era toggle and zoom-staged
  // opacity reveal stay in control. Returns { base, labels }; labels is null for
  // terrain (it has its own labels) and the Stamen Toner labels overlay for
  // watercolor (which ships no labels of its own).
  window.VIA_createAncientFloor = function () {
    const cfg  = BASEMAPS[ACTIVE_BASEMAP];
    const base = L.tileLayer(cfg.url, cfg.options);
    // labels overlay carries no attribution to avoid duplicating the base credits
    const labels = cfg.labels ? L.tileLayer(cfg.labels, { maxZoom: 18, attribution: '' }) : null;
    return { base, labels };
  };
})();
