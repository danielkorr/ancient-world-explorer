// basemap.js — ANCIENT-MODE FLOOR for VIA (sepia CARTO base + Stamen on top)
// Domain auth only: NO API key in code. localhost / 127.0.0.1 are keyless;
// production is authorized via danielkorr.github.io (whitelisted in the Stadia
// dashboard). A key in client code would be public on deploy and is unnecessary.
//
// The ANCIENT-mode floor beneath the DARE atlas is TWO stacked layers:
//   1. a KEYLESS sepia-tinted CARTO light_all base that ALWAYS renders, and
//   2. the Stadia-hosted Stamen layer ON TOP for the antique look.
// Stamen needs domain auth; when it fails (auth miss, outage, an un-whitelisted
// LAN IP), its tiles render transparent in Leaflet and the sepia CARTO base shows
// through — so ancient mode never goes white. No tileerror handler is needed; the
// stacking does it. MODERN mode keeps CARTO Voyager (see modernLayer in app.js);
// ACTIVE_ANCIENT_FLOOR controls the ANCIENT Stamen style only — modern mode is Voyager
// regardless.
//
// Loaded as a classic global <script> (VIA uses no ES modules): exposes
// window.VIA_createAncientFloor(). Tile config + attribution mirror
// docs/v1-spec-stadia-basemap.md; the only adaptation is global-function wiring
// (no `export`) so the existing era toggle + zoom-staged reveal keep working.

(function () {
  const ACTIVE_ANCIENT_FLOOR = 'terrain'; // 'terrain' (default) | 'watercolor'

  const ATTR_OSM    = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const ATTR_CARTO  = '&copy; <a href="https://carto.com/attributions">CARTO</a>';
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

  // Build the ancient-floor tile layers WITHOUT adding them to the map — the
  // caller (app.js) owns layer membership so the era toggle and zoom-staged
  // opacity reveal stay in control. Returns { carto, stamen, labels }:
  //   carto  — KEYLESS sepia CARTO light_all base; always renders, shows through
  //            wherever stamen fails. Carries `className: 'ancient-sepia-floor'`
  //            so css/style.css can apply the sepia filter.
  //   stamen — the Stadia/Stamen layer that sits ON TOP of carto (domain-auth'd).
  //   labels — Stamen Toner labels overlay for watercolor only (null for terrain,
  //            which has its own labels); carries no attribution to avoid dupes.
  window.VIA_createAncientFloor = function () {
    const cfg = BASEMAPS[ACTIVE_ANCIENT_FLOOR];

    const carto = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        className: 'ancient-sepia-floor',
        attribution: [ATTR_OSM, ATTR_CARTO].join(' ')
      }
    );

    const stamen = L.tileLayer(cfg.url, cfg.options);
    const labels = cfg.labels ? L.tileLayer(cfg.labels, { maxZoom: 18, attribution: '' }) : null;
    return { carto, stamen, labels };
  };
})();
