// ═══════════════════════════════════════════════════════════
//  VIA — Ancient World Explorer  |  app.js
// ═══════════════════════════════════════════════════════════

// ── TYPE CONFIG ──────────────────────────────────────────

// Documented-site palette. Deliberately cool/muted so the warm quest signal
// colors (photo-orange, location-red, text-purple) own the "go do something"
// end of the spectrum. The old city terracotta (#e07a5f) collided with
// photo-quest orange (#e07a3a) at marker size — they were indistinguishable,
// which is what made the map read as undifferentiated orange. City is now a
// muted parchment-stone; capitals stay bright gold so they still pop.
const TYPE = {
  capital: { color:'#e8c25a', icon:'⚡' },
  city:    { color:'#b89a6a', icon:'⊕' },
  port:    { color:'#5e9fd4', icon:'⚓' },
  fortress:{ color:'#7bc47b', icon:'⚔' },
};

// Colorblind-safe palette + shape coding (see makeIcon). Colors must mirror
// the --quest-* CSS variables; shapes give a color-independent signal for
// red-green color vision.
const QUEST = {
  photo: {
    color: '#ff9e2c',
    shape: 'circle',
    icon:  '📷',
    label: 'Photo Quest · Open',
    text:  'This place has no portrait photo in the scholarly record. Be the traveler who closes the gap.',
    pitch: 'No one has ever submitted a portrait photograph of this place to humanity’s authoritative atlas of the ancient world. You can change that.',
    cta:   'Take this Quest →',
  },
  location: {
    color: '#2b8cde',
    shape: 'diamond',
    icon:  '📍',
    label: 'Location Quest · Open',
    text:  'The coordinates for this place are unverified. A field GPS confirmation would lock it into the record.',
    pitch: 'Pleiades flags this site’s position as approximate. A traveler on the ground with a GPS reading would give scholars certainty.',
    cta:   'Take this Quest →',
  },
  text: {
    color: '#b15ad6',
    shape: 'triangle',
    icon:  '📜',
    label: 'Text Quest · Open',
    text:  'This place is known only from ancient texts. The physical site has never been confirmed.',
    pitch: 'Mentioned by ancient authors but not yet located on the ground. If your travels take you near, look carefully.',
    cta:   'Take this Quest →',
  },
};

// ── ORBIS LOOKUP ─────────────────────────────────────────
// ORBIS_BY_PLEIADES and ORBIS_NODES come from js/orbis-days.js
// (auto-generated from the Stanford ORBIS network via Dijkstra from Rome).
// At marker click time we resolve a site's travel-to-Rome cost in this order:
//   1. exact Pleiades id match in ORBIS_BY_PLEIADES
//   2. nearest ORBIS node within 75km (haversine)
//   3. legacy hardcoded site.rome_days (only the original curated sites have this)

const ORBIS_NEAREST_KM = 75;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function orbisLookup(site) {
  if (typeof ORBIS_BY_PLEIADES !== 'undefined' && site.pleiades) {
    const hit = ORBIS_BY_PLEIADES[site.pleiades];
    if (hit) return { days: hit.days, mode: hit.mode, source: 'direct' };
  }
  if (typeof ORBIS_NODES !== 'undefined') {
    let best = null, bestDist = Infinity;
    for (const n of ORBIS_NODES) {
      const d = haversineKm(site.lat, site.lng, n.lat, n.lng);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    if (best && bestDist <= ORBIS_NEAREST_KM) {
      return { days: best.days, mode: best.mode, source: 'nearest', distKm: bestDist };
    }
  }
  if (site.rome_days > 0) {
    return { days: site.rome_days, mode: site.rome_mode || 'road', source: 'legacy' };
  }
  return null;
}

function orbisFormatDays(days) {
  if (days < 0.5)  return '<1';
  if (days < 1.5)  return '1';
  return String(Math.round(days));
}

function orbisDetailLine(orbis) {
  const modeLabel = {
    road:  'by road',
    sea:   'by sea',
    river: 'by river',
    ferry: 'by ferry',
    mixed: 'via the network',
  }[orbis.mode] || 'via the network';
  const parts = [`${modeLabel} · summer · civilian`];
  if      (orbis.source === 'nearest') parts.push(`ORBIS node ~${Math.round(orbis.distKm)} km away`);
  else if (orbis.source === 'legacy')  parts.push('estimate · not on ORBIS network');
  else                                 parts.push('ORBIS network model');
  return parts.join(' · ');
}

// ── MAP INIT ─────────────────────────────────────────────

const ancientLayer = L.tileLayer(
  'https://dh.gu.se/tiles/imperium/{z}/{x}/{y}.png',
  {
    // DARE only ships tiles to z11. maxNativeZoom lets Leaflet upscale those
    // z11 tiles past 11 instead of dropping the layer entirely (which used to
    // make the ancient map silently vanish on deep zoom). maxZoom matches the
    // sepia fallback so both layers cover the same zoom range.
    maxNativeZoom: 11,
    maxZoom: 18,
    attribution:'© <a href="https://dh.gu.se/dare/" target="_blank">Digital Atlas of the Roman Empire</a>',
  }
);

// The ancient-mode floor beneath DARE is TWO stacked layers (built in
// js/basemap.js): a KEYLESS sepia CARTO light_all base that always renders, and
// the Stadia/Stamen layer ON TOP for the antique look. Stamen needs domain auth;
// when it fails (auth miss, outage, un-whitelisted LAN IP) its tiles render
// transparent and the sepia CARTO base shows through — so ancient mode never goes
// white. Where DARE 404s (panning outside the empire, or a server hiccup), the
// floor shows through naturally too — no mode swap, no banner. ACTIVE_ANCIENT_FLOOR
// picks terrain/watercolor; attribution rides on each layer and the Leaflet
// control aggregates it while ancient mode is active. `ancientFallbackLabels` is
// the Stamen Toner labels overlay (watercolor only; null for terrain), kept in
// lockstep with the floor through the era toggle + reveal.
const _ancientFloor = VIA_createAncientFloor();
const ancientFallbackLayer  = _ancientFloor.carto;   // keyless sepia CARTO base
const ancientStamenLayer    = _ancientFloor.stamen;  // Stamen on top (Stadia)
const ancientFallbackLabels = _ancientFloor.labels;  // null for terrain

const modernLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  { maxZoom:19, attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>' }
);

// Boot the ancient stack bottom→top: sepia CARTO base, Stamen on top of it,
// (Toner labels for watercolor), then DARE on top. Leaflet stacks tile layers
// in the order they're added, so CARTO-first keeps the antique + DARE on top.
const map = L.map('map', {
  center: [38.5, 17.0],
  zoom: 5,
  zoomControl: false,
  layers: [ancientFallbackLayer, ancientStamenLayer, ...(ancientFallbackLabels ? [ancientFallbackLabels] : []), ancientLayer],

  // Navigation feel. Leaflet's defaults make a small flick fling the map a long
  // way (inertiaMaxSpeed is Infinity by default) and scroll-zoom jumps fast.
  // Tame both so the map tracks the finger/cursor calmly instead of darting.
  inertiaDeceleration: 4500,   // stop the glide sooner (default 3000)
  inertiaMaxSpeed: 1200,       // cap fling speed (default Infinity) — the big one
  easeLinearity: 0.2,
  wheelPxPerZoomLevel: 140,    // ~2.3x more scroll per zoom step (default 60)
  wheelDebounceTime: 60,       // default 40
  maxZoom: 19,                 // satellite is sharp to z19 — allow the deep reveal
});

// Satellite imagery, revealed at deep zoom. Lives in its OWN pane ABOVE the
// tile pane (z200) but BELOW the overlay/marker panes (z400+), so it covers the
// atlas/street maps but never the roads or site markers. It fades IN as you
// zoom (see updateBasemaps), dissolving the map into real aerial ground — the
// "spot the ruins" payoff. Critically, the street basemap stays at full opacity
// underneath as a safety floor: if an Esri tile is missing/slow, you still see a
// real map, never a blank void. Esri World Imagery: free, no key.
// maxNativeZoom 18 (not 19) so the deepest step upscales from z18 tiles instead
// of requesting z19 tiles Esri lacks in some areas (its opaque "Map data not yet
// available" placeholder was the blank-ish deep zoom over rural sites).
map.createPane('satellite');
map.getPane('satellite').style.zIndex = 350;   // above tilePane (200), below overlayPane (400)
const satelliteLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    pane: 'satellite',
    maxNativeZoom: 18,
    maxZoom: 19,
    attribution: 'Imagery © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics',
  }
);

// Expose the map handle for automated QA / browser tooling (and ad-hoc console
// debugging). Harmless in production — read-only convenience, no behavior hangs
// off it. window.VIA is the existing app namespace (see auth.js).
window.VIA = window.VIA || {};
window.VIA.map = map;

// Visible +/− zoom control. Desktop stays the minimalist no-control map (CSS
// hides it there); on mobile it's pinned above the dock so zoom never depends on
// double-tapping near a marker (which used to open the detail panel instead).
// Pinch-to-zoom (Leaflet touchZoom) works alongside it. Mounted in the TOP-right
// Leaflet container — unlike bottom-right, that container isn't display:none'd on
// mobile — then CSS fixes it above the dock.
L.control.zoom({ position: 'topright' }).addTo(map);

// QA / test mode (?qa=1). A deterministic fixture state for headless Playwright
// journeys: it SKIPS the ~14,800-segment Itiner-e canvas build (the layer that
// melts headless Chromium and made open-ended visual testing unreliable) and
// suppresses the welcome modal + mobile guide so the UI boots into a known,
// stable state. A drive+assert API is attached to window.VIA at the end of this
// file. Harmless in production — gated behind the explicit ?qa=1 flag.
const QA = /[?&]qa=1/.test(location.search);

let currentEra = 'ancient';

// L.LayerGroup has no bringToFront. Re-add each group in stacking order
// (bottom to top) to put them above any tile layer just inserted under
// them. Itiner-e baseline first, named roads next, sites on top.
function raiseOverlays() {
  if (typeof itinereRoadsGroup !== 'undefined' && map.hasLayer(itinereRoadsGroup)) {
    map.removeLayer(itinereRoadsGroup); map.addLayer(itinereRoadsGroup);
  }
  if (map.hasLayer(roadsGroup)) { map.removeLayer(roadsGroup); map.addLayer(roadsGroup); }
  if (map.hasLayer(roadHighlightGroup)) { map.removeLayer(roadHighlightGroup); map.addLayer(roadHighlightGroup); }
  // Sites now live in per-tier cluster groups (siteClusters); raise each so they
  // stay above any tile layer just slid underneath on an era swap.
  if (typeof siteClusters !== 'undefined') {
    for (const k of TIER_KINDS) {
      if (map.hasLayer(siteClusters[k])) { map.removeLayer(siteClusters[k]); map.addLayer(siteClusters[k]); }
    }
  }
}

// ── ROADS ────────────────────────────────────────────────
// Two-layer roads model:
//   itinereRoadsGroup — ~14,800 segments / 80k vertices from the Itiner-e
//     scholarly dataset (CC BY 4.0, De Soto et al. 2025). Rendered on a
//     shared Canvas for performance, styled as a subtle amber baseline
//     so the eye reads "Roman road network density" without competing
//     with the curated highlights.
//   roadsGroup — the 14 hand-curated named roads (Via Appia, Via Egnatia,
//     etc.). Road-casing style: dark outer stroke + bright inner stroke.
//     Luminance contrast (dark→bright→map) reads unambiguously to all
//     color-vision types, so the named roads pop on sepia/DARE tiles
//     without depending on hue alone.
// Order matters: itinere group added first → curated covers it on
// overlap, and the Itiner-e baseline fills the rest of the empire.

const itinereRenderer = L.canvas({ padding: 0.2 });
const itinereRoadsGroup = L.layerGroup().addTo(map);
const roadsGroup        = L.layerGroup().addTo(map);
// Selection highlight for a searched road. Lives above roadsGroup, permanently
// on the map (mobile-safe: we mutate its CONTENTS, never add/remove the group —
// see the LayerGroup landmine in CLAUDE.md). Persists after the panel is
// dismissed so the user can still see and follow the road they searched for;
// cleared only on a new search or an explicit deselect.
const roadHighlightGroup = L.layerGroup().addTo(map);

// Per-certainty styling (Itiner-e Segment_s → meta.cert). The user is red-green
// colorblind, so the DASH PATTERN is the primary "how sure are we" channel and
// hue/opacity only reinforce it: solid = Certain, dashed = Conjectured, dotted =
// Hypothetical. Stays a quiet underlay beneath the curated named roads.
const ITINERE_CERT_STYLE = {
  c: { color: '#a9763a', weight: 1.4, opacity: 0.62, dashArray: null  }, // Certain — solid, strongest
  j: { color: '#8a6a3a', weight: 1.0, opacity: 0.42, dashArray: '4,5' }, // Conjectured — dashed
  h: { color: '#7d6a52', weight: 1.0, opacity: 0.34, dashArray: '1,5' }, // Hypothetical — dotted
};
const ITINERE_DEFAULT_STYLE = { color: '#8a6a3a', weight: 1, opacity: 0.42, dashArray: null };

// Flat index for nearest-segment tap lookup. Canvas-rendered polylines are NOT
// individual DOM nodes, so neither marker.on('click') nor the closest('path')
// touch delegation can hit them (see the roads landmine in CLAUDE.md). Instead we
// keep them non-interactive and resolve a tap → nearest segment ourselves off the
// map click/tap point. Each entry caches its latlng bbox for a cheap prefilter.
const itinereSegs = [];

if (!QA && typeof ROADS_ITINERE !== 'undefined') {
  const META = (typeof ROADS_ITINERE_META !== 'undefined') ? ROADS_ITINERE_META : [];
  for (const seg of ROADS_ITINERE) {
    const meta = seg.m != null ? META[seg.m] : null;
    const st = (meta && ITINERE_CERT_STYLE[meta.cert]) || ITINERE_DEFAULT_STYLE;
    // coords are [lng, lat] from the build script; Leaflet wants [lat, lng].
    const latlngs = seg.coords.map(c => [c[1], c[0]]);
    const pl = L.polyline(latlngs, {
      renderer: itinereRenderer,
      color: st.color,
      weight: st.weight,
      opacity: st.opacity,
      ...(st.dashArray ? { dashArray: st.dashArray } : {}),
      interactive: false,
      lineCap: 'butt',
      lineJoin: 'round',
    });
    pl.addTo(itinereRoadsGroup);

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const ll of latlngs) {
      if (ll[0] < minLat) minLat = ll[0];
      if (ll[0] > maxLat) maxLat = ll[0];
      if (ll[1] < minLng) minLng = ll[1];
      if (ll[1] > maxLng) maxLng = ll[1];
    }
    // `pl` ref lets the certainty filter show/hide this segment by mutating the
    // group's contents (mobile-safe), never toggling group membership.
    itinereSegs.push({ ll: latlngs, meta, pl, minLat, maxLat, minLng, maxLng });
  }
  // CC BY 4.0 attribution — required by the dataset license.
  map.attributionControl.addAttribution(
    'Roads: <a href="https://itiner-e.org" target="_blank" rel="noopener">Itiner-e</a> (CC BY 4.0)'
  );
}

// Name index for Itiner-e road search. Every rendered segment carries a scholarly
// name (endpoint-pair, e.g. "Coptos-Berenike"); a named road is the set of all
// segments that share it. Grouping by name turns ~14.8k anonymous canvas segments
// into ~6.2k searchable, highlightable named roads. Built once at load from refs
// into itinereSegs (normalizeSearchText is a hoisted function — safe to call here).
const ITINERE_NAME_INDEX = [];
(function buildItinereNameIndex() {
  const byName = new Map();
  for (const s of itinereSegs) {
    const nm = s.meta && s.meta.name;
    if (!nm) continue;
    const key = normalizeSearchText(nm);
    if (!key) continue;
    let e = byName.get(key);
    if (!e) {
      e = { name: nm, norm: key, segs: [], meta: s.meta };
      byName.set(key, e);
      ITINERE_NAME_INDEX.push(e);
    }
    e.segs.push(s);
  }
  ITINERE_NAME_INDEX.sort((a, b) => a.name.localeCompare(b.name));
})();

// Pixel distance from point p to segment a-b (all L.Point in container space).
function _distToSegPx(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Nearest Itiner-e segment to a tap, or null if none within THRESH px. The
// latlng bbox prefilter is sized from the current zoom (degrees-per-pixel) so it
// never wrongly excludes a segment that's within THRESH px at low zoom.
function findNearestItinere(latlng, cp, threshPx) {
  if (!map.hasLayer(itinereRoadsGroup)) return null;
  // Touch needs a fatter catch than a mouse: a finger on a 1px secondary line
  // can't land within 14px the way a cursor can, which is why secondary roads
  // read as unresponsive on mobile (Track 3 / 3b). The catch is also widened on
  // desktop because VIA's faint Itiner-e lines don't pixel-align with the bold
  // roads drawn into the DARE basemap — users aim at the basemap road, so a tight
  // catch missed VIA's line entirely. 28/32px is still tight enough that a click on
  // empty map doesn't over-resolve, and the desktop hover readout uses this same
  // value so "if you see the name, a click lands it."
  const THRESH = threshPx != null ? threshPx : (COARSE_POINTER ? 32 : 28);
  const c0 = map.containerPointToLatLng(L.point(0, 0));
  const c1 = map.containerPointToLatLng(L.point(THRESH, THRESH));
  const margin = Math.max(Math.abs(c1.lat - c0.lat), Math.abs(c1.lng - c0.lng));
  let best = null, bestD = THRESH;
  for (const s of itinereSegs) {
    if (latlng.lat < s.minLat - margin || latlng.lat > s.maxLat + margin ||
        latlng.lng < s.minLng - margin || latlng.lng > s.maxLng + margin) continue;
    let prev = map.latLngToContainerPoint(s.ll[0]);
    for (let i = 1; i < s.ll.length; i++) {
      const cur = map.latLngToContainerPoint(s.ll[i]);
      const d = _distToSegPx(cp, prev, cur);
      if (d < bestD) { bestD = d; best = s; }
      prev = cur;
    }
  }
  return best;
}

// ── ROADS CERTAINTY FILTER ───────────────────────────────
// A roads-only filter parallel to the site quest legend: tap a certainty to show
// only those segments. Implemented by mutating itinereRoadsGroup's CONTENTS
// (clearLayers + re-add the matching subset) — never toggling group membership,
// which is the mobile-safe pattern. Rows are inert while the Roads layer is off.
const ITINERE_CERTS = ['c', 'j', 'h'];
const activeCert    = new Set();   // empty = show all certainties
const certCounts    = itinereSegs.reduce((acc, s) => {
  const c = s.meta && s.meta.cert;
  if (c) acc[c] = (acc[c] || 0) + 1;
  return acc;
}, {});

function refreshVisibleRoads() {
  itinereRoadsGroup.clearLayers();
  const filtering = activeCert.size > 0;
  for (const s of itinereSegs) {
    const c = s.meta && s.meta.cert;
    if (!filtering || (c && activeCert.has(c))) itinereRoadsGroup.addLayer(s.pl);
  }
}

function syncRoadsFilterUI() {
  const legend = document.getElementById('quest-legend');
  if (!legend) return;
  legend.classList.toggle('roads-filtering', activeCert.size > 0);
  legend.querySelectorAll('.legend-row[data-cert]').forEach(row => {
    row.classList.toggle('active', activeCert.has(row.dataset.cert));
  });
}

// Stamp counts onto the roads rows and dim them when the Roads layer is off
// (filtering hidden roads is meaningless). CSS-only — never mutates the group.
function decorateRoadsLegend() {
  document.querySelectorAll('#quest-legend .legend-row[data-cert]').forEach(row => {
    const n = certCounts[row.dataset.cert] || 0;
    let badge = row.querySelector('.legend-count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'legend-count';
      row.appendChild(badge);
    }
    badge.textContent = n.toLocaleString();
    row.classList.toggle('disabled', !layerState.roads || n === 0);
  });
}

function toggleCert(cert) {
  if (!certCounts[cert] || !layerState.roads) return;  // inert when roads off
  const adding = !activeCert.has(cert);
  if (adding) activeCert.add(cert);
  else        activeCert.delete(cert);
  if (adding) showRoadsToast(cert);
  syncRoadsFilterUI();
  refreshVisibleRoads();
}

function showRoadsToast(cert) {
  const info = CERT_INFO[cert];
  const el   = document.getElementById('legend-toast');
  if (!info || !el) return;
  document.getElementById('legend-toast-title').textContent = `${info.label} roads · ${(certCounts[cert] || 0).toLocaleString()}`;
  document.getElementById('legend-toast-body').textContent  = info.blurb;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 4800);
}

const ROAD_CASING_COLOR = '#1a0e00';     // deep umber — dark enough vs both sepia and DARE
const ROAD_CASING_WEIGHT = 4.5;          // toned down from 6 — less overwhelming on first load
const ROAD_FILL_COLOR    = '#ffd66b';     // bright saffron — high luminance vs casing
const ROAD_FILL_WEIGHT   = 2;            // toned down from 3 — slimmer saffron core

// Open the road-segment panel for a tap/click at `latlng`: the nearest Itiner-e
// segment wins; otherwise fall back to the curated road's own rich copy. The
// fallback is load-bearing for the named roads (Via Appia, Via Maris, …) — their
// hand-drawn geometry drifts away from any Itiner-e segment as you zoom in, so
// without it the panel only opened at the one zoom where the two happened to
// coincide. Returns true if a panel was opened.
function openRoadPanelAt(latlng, curatedRoad) {
  const seg = latlng && findNearestItinere(latlng, map.latLngToContainerPoint(latlng));
  if (seg) { showSegmentPanel(seg.meta, seg.ll); return true; }
  if (curatedRoad) {
    const rll = curatedRoad.coords.map(c => [c[1], c[0]]);
    showSegmentPanel({ name: curatedRoad.name, main: 1, desc: curatedRoad.desc }, rll);
    return true;
  }
  return false;
}

ROADS.forEach(road => {
  const latlngs = road.coords.map(c => [c[1], c[0]]);
  // Casing first, then fill on top — same coords, different stroke weight.
  L.polyline(latlngs, {
    color: ROAD_CASING_COLOR,
    weight: ROAD_CASING_WEIGHT,
    opacity: 0.7,
    lineCap: 'round',
    lineJoin: 'round',
    interactive: false,
  }).addTo(roadsGroup);
  L.polyline(latlngs, {
    color: ROAD_FILL_COLOR,
    weight: ROAD_FILL_WEIGHT,
    opacity: 0.92,
    lineCap: 'round',
    lineJoin: 'round',
    interactive: false,          // purely the visible stroke; the hit-line below handles taps
  }).addTo(roadsGroup);
  // Invisible fat hit-line. A 2px road is nearly impossible to land a finger on,
  // and the name tooltip used to be hover-only (no hover exists on touch — that's
  // why road names vanished on mobile). This wide transparent stroke makes the road
  // tappable, and `click` opens the name on a phone while hover still works on desktop.
  const hit = L.polyline(latlngs, {
    color: '#000', weight: 22, opacity: 0, lineCap: 'round', lineJoin: 'round',
  })
   // Hover shows just the road NAME — a compact one-line label, not a paragraph.
   // The full desc + date live in the road panel that a click opens (and used to
   // make this hover box 3 lines tall, which overlapped the cursor readout).
   .bindTooltip(
     `<b style="color:#d4a853">${road.name}</b>`,
     { className:'road-tip', sticky:true }
   )
   .on('click', function (e) {
     // Desktop: open the name tooltip AND the segment panel, then stop the event
     // so the map-level click doesn't re-resolve (and possibly close) the panel.
     // Mobile routes curated-road taps through the overlayPane touchend handler,
     // which preventDefaults the synthesized click — so this rarely runs on touch.
     this.openTooltip(e.latlng);
     L.DomEvent.stopPropagation(e);
     openRoadPanelAt(e.latlng, this._curatedRoad);
   });
  // Stash the curated road so a tap can open its panel directly, without
  // depending on an Itiner-e segment happening to sit under the finger.
  hit._curatedRoad = road;
  hit.addTo(roadsGroup);
});

// ── SITE MARKERS ─────────────────────────────────────────

// Touch screens get a larger invisible tap target wrapped around the visible
// dot. The dots are 9-11px — fine for a mouse cursor, but far below Apple's
// ~44px guidance, so on a phone fingers miss them and "no panel appears". The
// hit padding makes the clickable box ~37-39px without growing the visible dot
// (which would clutter the map). Detected once at load via the pointer media
// query rather than user-agent sniffing.
// Three signals, not one — a single media query is too fragile for a load-bearing
// hit target. If ANY says "this is a touch device", pad the tap area. iOS Safari,
// Android, and touch-laptops all trip at least one of these.
const COARSE_POINTER = !!(
     (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  || (navigator.maxTouchPoints > 0)
  || ('ontouchstart' in window)
);
// 18px of padding around an 11px dot = a 47px tap target (50px on the 14px quests),
// clearing Apple's 44px minimum. Visible dot size is unchanged — only the
// invisible hit box grows, so the map looks identical but fingers stop missing.
const HIT_PAD = COARSE_POINTER ? 18 : 0;

// Per-tier shape so quests are distinguishable without color (red-green color
// vision). Returns the CSS that turns the inner box into a circle, diamond, or
// triangle. White outline + glow makes quests pop against the busy map.
function shapeStyle(shape, sz, color, border) {
  const glow = `box-shadow:0 0 9px ${color}, 0 0 3px rgba(255,255,255,0.75);`;
  if (shape === 'diamond') {
    return `width:${sz}px;height:${sz}px;background:${color};border:2px solid ${border};border-radius:2px;transform:rotate(45deg);${glow}`;
  }
  if (shape === 'triangle') {
    // clip-path clips the border, so lean on a bright drop-shadow for contrast.
    return `width:${sz}px;height:${sz}px;background:${color};clip-path:polygon(50% 0,100% 100%,0 100%);filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px ${color});`;
  }
  return `width:${sz}px;height:${sz}px;background:${color};border:2px solid ${border};border-radius:50%;${glow}`;
}

function makeIcon(site, hovered) {
  const quest  = site.quest ? QUEST[site.quest] : null;
  const color  = quest ? quest.color : (TYPE[site.type]?.color || '#d4a853');
  // Quests render larger than documented dots — they're the actionable layer
  // and need to be easy to spot.
  const sz     = hovered ? 20 : (quest ? 14 : 11);
  const hit    = sz + HIT_PAD * 2;  // transparent tap area around the dot
  const shape  = quest ? (quest.shape || 'circle') : 'circle';

  let dotStyle;
  if (quest) {
    const border = hovered ? '#ffffff' : 'rgba(255,255,255,0.92)';
    dotStyle = shapeStyle(shape, sz, color, border) + 'transition:all .15s;';
  } else {
    // Documented dots stay small, muted, circular — deliberately the quiet
    // background layer so the shaped quest markers carry the eye.
    const border = hovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
    const glow   = hovered ? `box-shadow:0 0 12px ${color};` : `box-shadow:0 0 5px ${color}55;`;
    dotStyle = `width:${sz}px;height:${sz}px;background:${color};border:2px solid ${border};border-radius:50%;${glow}transition:all .15s;`;
  }

  // Pulsing ring on quests — a motion cue that reads regardless of color, the
  // strongest accessibility signal for "act here". Always circular even around
  // a diamond/triangle; it's an attention halo, not an outline.
  const ring = quest && !hovered
    ? `<div class="quest-ring" style="color:${color};"></div>`
    : '';
  const pulse = (typeof pulseSiteId !== 'undefined' && pulseSiteId === site.id)
    ? `<div class="selected-marker-pulse" style="color:${color};"></div>`
    : '';

  // Visited badge: a check on a gold ring around any site the user checked in
  // to. Gold + the ✓ glyph (not green alone) so it survives red-green vision.
  const visited = (typeof VIA !== 'undefined' && VIA.auth && VIA.auth.currentUser())
    ? !!VIA.auth.getCheckin(site)
    : false;
  const visitedBadge = visited
    ? `<div style="position:absolute;inset:-5px;border:1.5px solid #ffd66b;border-radius:50%;box-shadow:0 0 6px rgba(255,214,107,0.6);pointer-events:none;"></div>
       <div style="position:absolute;top:-9px;right:-9px;width:11px;height:11px;border-radius:50%;background:#ffd66b;color:#1a0e00;font-size:8px;line-height:11px;text-align:center;font-weight:700;pointer-events:none;">✓</div>`
    : '';

  // Outer box = tap target (transparent, centers its child). Inner relative
  // box = dot size, so .quest-ring and the visited badge still anchor to the
  // dot, not the padded hit area.
  return L.divIcon({
    className: '',
    html: `<div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;">
             <div style="position:relative;width:${sz}px;height:${sz}px;">
               <div data-testid="site-marker" style="${dotStyle}"></div>
               ${ring}
               ${pulse}
               ${visitedBadge}
             </div>
           </div>`,
    iconSize:   [hit, hit],
    iconAnchor: [hit/2, hit/2],
  });
}

// Site markers live in per-tier MARKER CLUSTER groups so dense regions collapse
// into a numbered bubble instead of an un-tappable pile (the mobile clumping
// problem). One group PER TIER (documented / photo / location / text) so counts
// never mix: a "12" photo-quest bubble is a contribute prompt, a "30" sites
// bubble is a browse prompt. Groups stay permanently on the map; we only mutate
// their contents (the mobile-safe pattern) — disclosure + KEY filter add/remove
// markers from these groups, never toggle group membership.
const TIER_KINDS    = ['documented', 'photo', 'location', 'text'];
const CLUSTER_COLOR = {
  documented: '#b89a6a',
  photo:      QUEST.photo.color,
  location:   QUEST.location.color,
  text:       QUEST.text.color,
};
function clusterOpts(kind) {
  return {
    maxClusterRadius: 56,             // px; aggressive enough to clear small screens
    // Both native click behaviours are OFF — we drive cluster clicks ourselves
    // (zoomIntoCluster) on BOTH desktop (clusterclick) and touch (the touchend
    // delegation). markercluster's own zoomToBounds fits the bounding BOX, whose
    // centre is the midpoint of the extremes; a cluster with one far-flung member
    // then drops you between them and strands the dense members at the corner.
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,       // no hover on touch; avoids stray polygons
    zoomToBoundsOnClick: false,
    chunkedLoading: true,             // don't stall the main thread on the dense set
    spiderfyDistanceMultiplier: 1.6,  // wider fan for fat-finger taps
    iconCreateFunction: cluster => L.divIcon({
      html: `<div class="via-cluster via-cluster--${kind}" data-testid="site-marker">${cluster.getChildCount()}</div>`,
      className: 'via-cluster-wrap',
      iconSize: L.point(44, 44),      // 44px floor = mobile touch target
    }),
  };
}
const siteClusters = {};
TIER_KINDS.forEach(k => { siteClusters[k] = L.markerClusterGroup(clusterOpts(k)); map.addLayer(siteClusters[k]); });

// Cluster click/tap action, shared by desktop and touch. Zoom in CENTRED on the
// cluster centre and zoom in a GENTLE, fixed amount — a predictable drill-in, not
// a teleport. Fitting the members' bounds was wrong both ways: fitting ALL of them
// strands the dense pair at the edge when one member is far off (the "3" west of
// Italy is Cumae + Baiae + Paestum, Paestum 91km south); fitting only the dense
// knot over-zoomed to street level and dropped you in "nowheresville" with no
// context. Instead step in two zoom levels centred on the cluster, so you stay
// oriented and the cluster visibly splits (the "3" becomes a "2" + a separated
// member near the centre); click again to go deeper. Coincident members / max
// zoom spiderfy instead.
function zoomIntoCluster(cluster) {
  if (!cluster || typeof cluster.getLatLng !== 'function') return;
  const b = cluster.getBounds && cluster.getBounds();
  const atMax = map.getZoom() >= map.getMaxZoom();
  const coincident = b && b.isValid() && b.getNorthEast().equals(b.getSouthWest());
  if ((atMax || coincident) && typeof cluster.spiderfy === 'function') { cluster.spiderfy(); return; }
  const z = Math.min(map.getZoom() + 2, map.getMaxZoom());
  map.setView(cluster.getLatLng(), z, { animate: true });
}
// Desktop drives this off the synthesized clusterclick (touch can't — handled in
// the touchend delegation instead).
TIER_KINDS.forEach(k => siteClusters[k].on('clusterclick', e => zoomIntoCluster(e.layer)));

// Master marker lists. allMarkers = every marker (icon-refresh, touch lookup);
// markersByTier = the source-of-truth per category so filters are pure
// add/remove into the clusters, never a rebuild-from-scratch.
const markersByTier = { documented: [], photo: [], location: [], text: [] };
const allMarkers    = [];

let   activeMarker = null;
let   pulseSiteId  = null;
let   pulseTimer   = null;
let   pendingClosePulseSiteId = null;
let   focusToken   = 0;   // guards against stale async reveal callbacks (race)

function setActiveMarker(marker) {
  if (activeMarker === marker) return;
  if (activeMarker) {
    activeMarker.setIcon(makeIcon(activeMarker._site, false));
    activeMarker.setZIndexOffset(activeMarker._site.quest ? 500 : 0);
  }
  activeMarker = marker || null;
  if (activeMarker) {
    activeMarker.setIcon(makeIcon(activeMarker._site, true));
    activeMarker.setZIndexOffset(1000);
  }
}

function triggerMarkerPulse(marker) {
  if (!marker || !marker._site) return;
  const prevPulseId = pulseSiteId;
  clearTimeout(pulseTimer);
  pulseSiteId = marker._site.id;
  if (prevPulseId && prevPulseId !== pulseSiteId) {
    const prev = allMarkers.find(m => m._site && m._site.id === prevPulseId);
    if (prev) prev.setIcon(makeIcon(prev._site, prev === activeMarker || prev === previewMarker));
  }
  marker.setIcon(makeIcon(marker._site, true));
  pulseTimer = setTimeout(() => {
    pulseSiteId = null;
    marker.setIcon(makeIcon(marker._site, marker === activeMarker || marker === previewMarker));
  }, 2850);   // 4 broadcast rings (0.7s each) — see .selected-marker-pulse
}

function markerForSite(site) {
  return allMarkers.find(m => m._site === site) || null;
}

function clusterGroupForSite(site) {
  return siteClusters[site.quest || 'documented'] || null;
}

function revealSiteMarker(site, onReady) {
  const marker = markerForSite(site);
  if (!marker) {
    if (onReady) onReady(null);
    return;
  }

  const wasSitesOff = !layerState.sites;
  let refreshed = false;
  ensureSitesLayerOn();
  // Don't let a hidden tier swallow the site we're focusing on — un-hide just
  // that tier (leave the user's other choices intact).
  const focusTier = siteTier(site);
  if (hiddenTiers.has(focusTier)) {
    hiddenTiers.delete(focusTier);
    syncFilterUI();
    refreshed = true;
  }
  if (!siteVisibleAtLevel(site, detailLevel)) {
    setDetailLevel(2);
  } else if (refreshed || wasSitesOff) {
    refreshVisibleMarkers();
  }

  if (QA) {
    if (onReady) onReady(marker);
    return;
  }

  const group = clusterGroupForSite(site);
  if (group && typeof group.zoomToShowLayer === 'function') {
    group.zoomToShowLayer(marker, () => onReady && onReady(marker));
  } else if (onReady) {
    onReady(marker);
  }
}

function focusSite(site, opts) {
  const pulse = !!(opts && opts.pulse);
  const pulseOnClose = !!(opts && opts.pulseOnClose);
  // zoomToShowLayer is async; if a newer focus fires first, the older callback
  // must not reopen its (now stale) site/panel. Token-guard the callback.
  const myToken = ++focusToken;
  revealSiteMarker(site, marker => {
    if (myToken !== focusToken) return;
    if (marker) setActiveMarker(marker);
    showPanel(site);
    if (marker && pulse) {
      if (window.innerWidth <= 640 && pulseOnClose && !QA) {
        pendingClosePulseSiteId = site.id;
      } else {
        triggerMarkerPulse(marker);
      }
    }
  });
}

// Curated sites are the ~95 hand-written entries in SITES_CURATED. The global
// SITES array spreads those same object references in first (see data.js), so
// identity membership is exact. Used for progressive disclosure: the landing
// shows only these, the dense Pleiades set reveals as you zoom in.
const CURATED_SET = new Set(typeof SITES_CURATED !== 'undefined' ? SITES_CURATED : []);

SITES.forEach(site => {
  const marker = L.marker([site.lat, site.lng], {
    icon: makeIcon(site, false),
    title: site.name,
    zIndexOffset: site.quest ? 500 : 0,
  });

  marker._site = site;

  marker.on('mouseover', function() {
    this.setIcon(makeIcon(this._site, true));
    this.setZIndexOffset(2000);
  });

  marker.on('mouseout', function() {
    if (activeMarker !== this) {
      this.setIcon(makeIcon(this._site, false));
      this.setZIndexOffset(this._site.quest ? 500 : 0);
    }
  });

  marker.on('click', function(e) {
    L.DomEvent.stopPropagation(e);
    // Re-clicking the already-selected marker must NOT re-run showPanel's 0.4s
    // pan animation — that churn was eating the next click and blocking the
    // double-click-to-zoom. Panel's already showing this site; do nothing.
    if (activeMarker === this) return;
    setActiveMarker(this);
    showPanel(this._site);
  });

  // Double-click a pin to zoom in one level, like double-clicking the map — but
  // a marker normally swallows the dblclick so the map's zoom never fired over a
  // pin (you had to land just off it). Handle it here and keep the pin in the
  // visible area beside the panel.
  marker.on('dblclick', function(e) {
    L.DomEvent.stop(e);
    panToWithPanelOffset(this.getLatLng(), Math.min(map.getZoom() + 1, map.getMaxZoom()));
  });

  const tier = site.quest || 'documented';
  (markersByTier[tier] || markersByTier.documented).push(marker);
  allMarkers.push(marker);
});

// ── DUAL-NAME LABELS ─────────────────────────────────────
// OrganicMaps-style "local + alternate" naming, our own slant: the ancient name
// over the modern one (Londinium / London). Off by default (the "Names" chip).
// Permanent Leaflet tooltips, but gated three ways so they never become soup:
//   • the Names layer must be on,
//   • zoom must be deep enough that markers have declustered (MIN_LABEL_ZOOM),
//   • the marker must be individually visible (not folded into a cluster and
//     actually in its tier group at the current detail level).
let labelsOn = false;
const MIN_LABEL_ZOOM = 7;

function escLabel(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}
function nameLabelHtml(site) {
  const modern = site.modern && site.modern !== site.name
    ? `<span class="vnl-modern">${escLabel(site.modern)}</span>` : '';
  return `<span class="vnl-ancient">${escLabel(site.name)}</span>${modern}`;
}
function refreshNameLabels() {
  const show = labelsOn && map.getZoom() >= MIN_LABEL_ZOOM;
  for (const m of allMarkers) {
    let want = false;
    if (show) {
      const grp = siteClusters[m._site.quest || 'documented'];
      // hasLayer → marker is in its tier group at this detail level;
      // getVisibleParent === m → it's standing alone, not inside a cluster.
      want = grp && map.hasLayer(grp) && grp.hasLayer(m) && grp.getVisibleParent(m) === m;
    }
    if (want) {
      if (!m.getTooltip()) {
        m.bindTooltip(nameLabelHtml(m._site), {
          permanent: true, direction: 'right', offset: [10, 0],
          className: 'via-name-label', interactive: false,
        });
      }
      m.openTooltip();
    } else if (m.getTooltip()) {
      m.unbindTooltip();
    }
  }
}
// Re-evaluate on every view change (declustering happens on both) and whenever
// the marker set itself changes (detail slider / tier filters call this too).
map.on('zoomend moveend', refreshNameLabels);

// ── EMPIRE INSET ─────────────────────────────────────────
// A fixed locator map (desktop only — CSS hides #empire-inset on mobile). Shows
// the DARE atlas at empire scale with a keyless sepia CARTO floor underneath (so
// it never goes blank where DARE 404s, same floor logic as the main map). A gold
// rectangle tracks the main map's viewport; clicking flies the main map there.
// Its own fresh tile-layer instances — a Leaflet TileLayer belongs to one map.
let empireInset = null;
function buildEmpireInset() {
  const host = document.getElementById('empire-inset-map');
  if (!host || empireInset) return;
  const insetBase = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', { maxZoom: 11 });
  const insetDare = L.tileLayer(
    'https://dh.gu.se/tiles/imperium/{z}/{x}/{y}.png', { maxNativeZoom: 11, maxZoom: 11 });
  const insetMap = L.map(host, {
    center: [40, 19], zoom: 4, zoomControl: false, attributionControl: false,
    dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, touchZoom: false, tap: false,
    inertia: false, fadeAnimation: false, layers: [insetBase, insetDare],
  });
  // Viewport rectangle — non-interactive so clicks fall through to the map.
  const rect = L.rectangle(map.getBounds(), {
    color: '#d4a853', weight: 1.5, fillColor: '#d4a853', fillOpacity: 0.14,
    interactive: false,
  }).addTo(insetMap);
  const syncRect = () => rect.setBounds(map.getBounds());
  map.on('move zoom', syncRect);
  // Click anywhere on the inset → fly the main map to that point (keep its zoom).
  insetMap.on('click', e => map.flyTo(e.latlng, map.getZoom()));
  empireInset = { map: insetMap, rect };

  // Collapse / expand. Collapsed = header pill only; invalidate size on expand so
  // tiles lay out correctly after being display:none.
  const toggle = document.getElementById('empire-inset-toggle');
  const wrap = document.getElementById('empire-inset');
  if (toggle && wrap) {
    toggle.addEventListener('click', () => {
      const collapsed = wrap.classList.toggle('collapsed');
      toggle.textContent = collapsed ? '▸' : '▾';
      toggle.setAttribute('aria-label', collapsed ? 'Expand the empire inset' : 'Collapse the empire inset');
      if (!collapsed) setTimeout(() => insetMap.invalidateSize(), 0);
    });
  }
  // The host can be sized 0 at boot (just-laid-out flex/grid); settle it once.
  setTimeout(() => insetMap.invalidateSize(), 0);
}
// Skip in QA mode — deterministic fixture keeps chrome minimal and avoids extra
// tile fetches that slow the headless journeys.
if (!QA) buildEmpireInset();

// iOS Safari does NOT synthesize a `click` from a tap on a Leaflet divIcon — the
// ?debug=1 overlay confirmed `touchstart on [DIV]` with no click ever firing, so
// marker.on('click') (which Leaflet drives off the synthesized click) never runs.
// Handle the tap ourselves: a delegated touchend on the marker pane, matched back
// to its marker, opens the panel directly. Touch-only (COARSE_POINTER) so desktop
// click is untouched; preventDefault suppresses any late synthesized click so we
// never double-fire.
// Window in which a second tap on the same marker counts as a double-tap (zoom)
// rather than two single taps. Also the delay a single tap waits before opening
// detail, so a double-tap can pre-empt it — the accepted cost of 3a.
const MARKER_DBLTAP_MS = 280;
if (COARSE_POINTER) {
  const markerPane = map.getPane('markerPane');
  let _tStart = null;
  let _lastMarkerTap = null;   // {id, t, timer} of the last single-tap awaiting open
  markerPane.addEventListener('touchstart', e => {
    const t = e.changedTouches && e.changedTouches[0];
    _tStart = t ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  markerPane.addEventListener('touchend', e => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    // Ignore drags — only a near-stationary touch counts as a tap.
    if (_tStart && (Math.abs(t.clientX - _tStart.x) > 12 || Math.abs(t.clientY - _tStart.y) > 12)) return;

    // CLUSTER WINS ON OVERLAP. A finger covers ~44px, so a lone marker (e.g.
    // Puteoli, documented tier) can sit on top of a cluster bubble from a
    // DIFFERENT tier (the Cumae+Baiae photo "2"). Trusting e.target meant tapping
    // the marker's side of the cluster opened that marker's panel instead of
    // zooming. So GEOMETRICALLY hit-test every visible cluster icon against the
    // touch point — the cluster wins wherever the finger lands inside its bubble —
    // and run markercluster's own zoom-or-spiderfy (the click path iOS never
    // synthesizes) to spread the pile apart.
    const cx = t.clientX, cy = t.clientY;
    let cluster = null, bestD = Infinity;
    for (const k of TIER_KINDS) {
      const fg = siteClusters[k] && siteClusters[k]._featureGroup;
      if (!fg) continue;
      for (const l of fg.getLayers()) {
        if (!l._icon || typeof l.getChildCount !== 'function') continue;   // L.MarkerCluster only
        const r = l._icon.getBoundingClientRect();
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
          // Several tier clusters can overlap under one finger; pick the one whose
          // bubble centre is nearest the touch (the one actually aimed at), not the
          // first tier in iteration order.
          const dx = (r.left + r.right) / 2 - cx, dy = (r.top + r.bottom) / 2 - cy;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; cluster = l; }
        }
      }
    }
    if (cluster) {
      e.preventDefault();
      zoomIntoCluster(cluster);   // same centred zoom/spiderfy the desktop click uses
      return;
    }

    // An individual marker (rendered un-clustered): open its panel. Markers live
    // in cluster groups now, so match against the master list, not a single group.
    const iconEl = e.target.closest && e.target.closest('.leaflet-marker-icon');
    if (!iconEl) return;
    let hit = null;
    for (const m of allMarkers) { if (m._icon === iconEl) { hit = m; break; } }
    if (!hit) return;
    e.preventDefault();   // suppress any late synthesized click → no double-open

    // Tap vs double-tap discriminator (Track 3 / 3a). A double-tap on the SAME
    // marker zooms in one level — like double-tapping the map — so you can zoom
    // incrementally on a pin without detail hijacking every tap. A lone tap opens
    // detail, but only after the double-tap window so a second tap can cancel it.
    const now = Date.now();
    if (_lastMarkerTap && _lastMarkerTap.id === hit._site.id && (now - _lastMarkerTap.t) < MARKER_DBLTAP_MS) {
      clearTimeout(_lastMarkerTap.timer);
      _lastMarkerTap = null;
      const z = Math.min(map.getZoom() + 1, map.getMaxZoom());
      // Offset for the panel only when one is actually open; otherwise centre on
      // the pin so the zoom stays put under the finger.
      if (document.getElementById('info-panel').classList.contains('open')) panToWithPanelOffset(hit.getLatLng(), z);
      else map.setView(hit.getLatLng(), z, { animate: true });
      return;
    }
    if (_lastMarkerTap) clearTimeout(_lastMarkerTap.timer);   // a pending open on another marker — last tap wins
    const openTimer = setTimeout(() => {
      _lastMarkerTap = null;
      setActiveMarker(hit);
      showPanel(hit._site);
    }, MARKER_DBLTAP_MS);
    _lastMarkerTap = { id: hit._site.id, t: now, timer: openTimer };
  }, { passive: false });
}

// Roads hit the same iOS wall (SVG paths, ~1 tap in 10). Delegate touchend on the
// overlay pane, match the tapped <path> to its road layer, open the name tooltip.
// Window in which a second tap near the first counts as a double-tap (zoom)
// rather than two single taps — and the delay a lone road tap waits before
// opening detail, so a double-tap can pre-empt it. Mirrors MARKER_DBLTAP_MS.
const ROAD_DBLTAP_MS = 280;
if (COARSE_POINTER) {
  const overlayPane = map.getPane('overlayPane');
  let _rStart = null;
  let _lastRoadTap = null;   // {t, x, y, timer} of the last road tap awaiting open
  overlayPane.addEventListener('touchstart', e => {
    const t = e.changedTouches && e.changedTouches[0];
    _rStart = t ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  overlayPane.addEventListener('touchend', e => {
    const t = e.changedTouches && e.changedTouches[0];
    if (_rStart && t && (Math.abs(t.clientX - _rStart.x) > 12 || Math.abs(t.clientY - _rStart.y) > 12)) return;

    // On mobile the detail panel covers the map. If one is already open, a tap on
    // the visible map/road should return you to the map (dismiss) — not stack
    // another panel you can't locate under the panel. (Desktop keeps switch-panel
    // behavior: the sidebar leaves the whole map visible.)
    if (document.getElementById('info-panel').classList.contains('open')) {
      e.preventDefault();
      closePanel();
      return;
    }

    const px = t ? t.clientX : 0, py = t ? t.clientY : 0;
    const now = Date.now();

    // Double-tap ON a road zooms one level, like double-tapping the map — without
    // this, tap 1 opened the road panel and tap 2 just closed it, so roads could
    // never be double-tap-zoomed. A second tap inside the window & near the first
    // cancels the pending single-tap open and zooms toward the point instead.
    if (_lastRoadTap && (now - _lastRoadTap.t) < ROAD_DBLTAP_MS &&
        Math.abs(px - _lastRoadTap.x) < 30 && Math.abs(py - _lastRoadTap.y) < 30) {
      clearTimeout(_lastRoadTap.timer);
      _lastRoadTap = null;
      e.preventDefault();
      let zll; try { zll = map.mouseEventToLatLng(t); } catch (_) {}
      const z = Math.min(map.getZoom() + 1, map.getMaxZoom());
      if (zll) map.setZoomAround(zll, z);   // keep the tapped point under the finger
      return;
    }

    let ll; try { ll = map.mouseEventToLatLng(t); } catch (_) {}

    // A curated named road (SVG path) directly under the finger wins; otherwise a
    // nearby Itiner-e CANVAS segment (the ~14,800 secondaries are non-DOM canvas
    // paths iOS won't synthesize a click for). Resolve which one this tap hits now.
    const pathEl = e.target.closest && e.target.closest('path');
    let road = null;
    if (pathEl) roadsGroup.eachLayer(l => { if (l._path === pathEl && l.getTooltip && l.getTooltip()) road = l; });
    const cp  = ll ? map.latLngToContainerPoint(ll) : null;
    const seg = (!road && ll) ? findNearestItinere(ll, cp) : null;
    // A documented-coverage dot, but only when no road won and the dots are showing.
    const cov = (!road && !seg && ll) ? findNearestCoverage(ll, cp) : null;
    // …or the searched place's pin (reopen its panel even when dots aren't showing).
    const pin = (!road && !seg && !cov && ll) ? nearestPinnedCoverage(ll, cp) : null;

    // Nothing under the finger → don't preventDefault, so Leaflet's own map
    // double-tap zoom and map.on('click') (panel close) still run on empty canvas.
    if (!road && !seg && !cov && !pin) return;

    e.preventDefault();   // we own this tap → suppress the late synthesized click

    // Defer the panel open past the double-tap window so a second tap can pre-empt
    // it with a zoom (above). A lone tap falls through and opens detail.
    const doOpen = () => {
      _lastRoadTap = null;
      if (road) {
        roadsGroup.eachLayer(l => { if (l.closeTooltip) l.closeTooltip(); });  // one at a time
        road.openTooltip(ll);
        roadBannerFromTap = true;   // tap-opened banner: clear it when the card closes
        // Nearest Itiner-e segment wins, else the curated road's own rich copy so
        // the named roads (Via Appia etc.) always open a panel. Same resolver the
        // desktop click path uses.
        if (ll) openRoadPanelAt(ll, road._curatedRoad);
      } else if (seg) {
        showSegmentPanel(seg.meta, seg.ll);
      } else if (cov) {
        focusCoverage(cov);
      } else if (pin) {
        focusCoverage(pin);
      }
    };
    if (_lastRoadTap) clearTimeout(_lastRoadTap.timer);
    _lastRoadTap = { t: now, x: px, y: py, timer: setTimeout(doOpen, ROAD_DBLTAP_MS) };
  }, { passive: false });
}

// ── INFO PANEL ───────────────────────────────────────────

// One-line "what is VIA" pitch appended to the quest emails — most recipients
// have never heard of VIA, so the email doubles as a recruit. Kept to a sentence.
const VIA_BLURB = "What's VIA? It overlays the ancient Roman world on today's map and turns the gaps in the scholarly record — places missing a photo or a verified location — into quests anyone can help close.";

// vici hero photos are stored at cover/w1600xh1600 — a 1600px image for a hero
// strip ~360px wide, which is why the photo crawled in. Rewrite the transform to
// a right-sized image, and blur up: paint a tiny placeholder instantly (decodes
// in ~1 frame), then swap to the sharp one once it loads. `grad` is the gradient
// overlay, kept on top through the swap. No-ops gracefully if the URL has no
// cover/wNxhN transform to rewrite.
function viciSized(url, w) {
  return url.replace(/\/cover\/w\d+xh\d+\//, `/cover/w${w}xh${w}/`);
}
function setHeroPhoto(hero, heroIcon, url, grad) {
  const thumb = viciSized(url, 48);
  const full  = viciSized(url, 800);
  hero.style.background  = `${grad}, url("${thumb}") center/cover no-repeat`;
  heroIcon.style.opacity = '0';
  const img = new Image();
  img.onload = () => {
    hero.style.background = `${grad}, url("${full}") center/cover no-repeat`;
  };
  img.src = full;
}

function showPanel(site) {
  hideLegendToast();
  closeDockPanels();      // the detail card is the one open surface now
  // A pending close-pulse is a one-shot tied to the site just focused via search.
  // Opening any other panel (e.g. a marker tap) cancels it so it can't pulse a
  // stale site after this panel closes. focusSite re-sets it after this returns.
  pendingClosePulseSiteId = null;

  const tc    = TYPE[site.type] || TYPE.city;
  const quest = site.quest ? QUEST[site.quest] : null;
  const color = quest ? quest.color : tc.color;

  // Re-show anything a prior road-segment panel hid (showSegmentPanel hides the
  // site-only sections). Resetting to '' reverts to the stylesheet default; the
  // per-site logic below re-applies real visibility.
  currentPanelKind = 'site';
  currentSegmentMeta = null;
  document.getElementById('quest-progress').style.display = '';
  document.getElementById('checkin-row').style.display    = '';
  document.getElementById('panel-desc').style.whiteSpace  = '';
  document.getElementById('segment-evidence').style.display = 'none';
  const _segNear = document.getElementById('segment-nearby');
  if (_segNear) _segNear.style.display = 'none';

  // Hero. Any site with a vici.org photo shows it as the hero with a credit/
  // license caption (the "imagery exists in the wild" made literal); elevation
  // candidates additionally get the "help elevate" banner below. Sites with no
  // vici photo keep the tinted gradient.
  const hero = document.getElementById('panel-hero');
  const heroIcon = document.getElementById('hero-icon');
  let heroCredit = document.getElementById('hero-credit');
  if (!heroCredit) {
    heroCredit = document.createElement('div');
    heroCredit.id = 'hero-credit';
    hero.appendChild(heroCredit);
  }
  if (site.vici && site.vici.image) {
    setHeroPhoto(hero, heroIcon, site.vici.image,
      'linear-gradient(180deg, rgba(17,10,0,0.05) 0%, rgba(17,10,0,0.85) 100%)');
    const by = site.vici.creator ? `© ${site.vici.creator}` : 'vici.org';
    heroCredit.textContent = `${by}${site.vici.license ? ' · ' + site.vici.license : ''} · via vici.org`;
    heroCredit.style.display = '';
  } else {
    hero.style.background = `radial-gradient(ellipse at center, ${color}18 0%, #110a00 70%)`;
    heroIcon.style.opacity = '';
    heroCredit.style.display = 'none';
  }
  heroIcon.textContent = tc.icon;
  document.getElementById('hero-coords').textContent =
    `${Math.abs(site.lat).toFixed(4)}°${site.lat>=0?'N':'S'}  ${Math.abs(site.lng).toFixed(4)}°${site.lng>=0?'E':'W'}`;
  document.getElementById('hero-modern').textContent = site.modern;

  // Quest banner
  const banner = document.getElementById('panel-quest-banner');
  if (quest) {
    banner.style.background  = `${quest.color}14`;
    banner.style.borderColor = `${quest.color}33`;
    banner.className = `visible quest-${site.quest}`;
    document.getElementById('quest-banner-icon').textContent  = quest.icon;
    document.getElementById('quest-banner-title').textContent = quest.label;
    document.getElementById('quest-banner-text').textContent  = quest.text;
    document.getElementById('quest-banner-title').style.color = quest.color;
    document.getElementById('quest-banner-cta').textContent   = quest.cta;
    // Elevation photo-quest: a photo already exists on vici, just not in the
    // scholarly record. Reframe the ask from "no photo anywhere" to "help elevate".
    if (site.elevation) {
      document.getElementById('quest-banner-title').textContent = 'Photo Quest · Help elevate';
      document.getElementById('quest-banner-text').textContent  =
        'A photo of this place already exists on vici.org but isn’t yet in the scholarly record. Help get it into Wikidata / Wikimedia Commons so it counts.';
      document.getElementById('quest-banner-cta').textContent   = 'See it on vici.org →';
    }
  } else {
    banner.className = '';
  }

  // Type badge
  const badge = document.getElementById('panel-badge');
  badge.textContent     = site.type.toUpperCase();
  badge.style.cssText   = `color:${color};background:${color}18;border:1px solid ${color}40;display:inline-block;font-size:9px;letter-spacing:2px;padding:3px 9px;border-radius:3px;margin-bottom:9px;font-family:'Cinzel',serif;font-weight:600;`;

  document.getElementById('panel-name').textContent        = site.name;
  document.getElementById('panel-modern-name').textContent = site.modern || '';
  document.getElementById('panel-period').innerHTML        = `<span style="font-size:13px">⏳</span>&nbsp;${site.period}`;
  // Coverage places carry no curated description — show an honest-thin note that
  // points at Pleiades (the primary action below) instead of an empty panel.
  document.getElementById('panel-desc').textContent        = site.coverage
    ? 'Documented place from the Pleiades gazetteer — a minimal record. Open Pleiades below for sources, dating, and cross-references.'
    : (site.desc || '');

  // ORBIS card — live values from the Stanford ORBIS network.
  // Direct Pleiades match wins; else nearest ORBIS node within 75km;
  // else fall back to the curated hardcoded estimate on the site.
  const orbisCard = document.getElementById('orbis-card');
  // Coverage places get no ORBIS card — a nearest-node travel estimate for an
  // obscure thin record would read as fabricated certainty (honest-thin).
  const orbis = site.coverage ? null : orbisLookup(site);
  if (orbis) {
    const dStr = orbisFormatDays(orbis.days);
    document.getElementById('orbis-days').textContent = dStr;
    // "<1" is a sub-day count, still singular ("less than 1 day").
    const isSingular = dStr === '1' || dStr === '<1';
    document.getElementById('orbis-unit').textContent = isSingular ? 'day to Rome' : 'days to Rome';
    document.getElementById('orbis-detail').textContent = orbisDetailLine(orbis);
    orbisCard.classList.add('visible');
  } else {
    orbisCard.classList.remove('visible');
  }

  // Action buttons
  const gmUrl  = `https://maps.google.com/?q=${site.lat},${site.lng}`;
  // Satellite: pin the exact place AND force the aerial layer (data=!3m1!1e3).
  // The old @-centred URL dropped no pin, so it looked like a slightly-zoomed
  // Google Maps rather than a clearly different aerial view of the same spot.
  const satUrl = `https://www.google.com/maps/place/${site.lat},${site.lng}/@${site.lat},${site.lng},1000m/data=!3m1!1e3`;
  const plUrl  = `https://pleiades.stoa.org/places/${site.pleiades}`;

  // vici.org — René Voorburg's crowdsourced atlas. The link comes from the
  // elevation layer's own record (site.vici, sites-vici.js) when present, else
  // from VICI_LINKS (the ~54 Pleiades-backlinked sites). Conditional either way.
  const viciUrl = (site.vici && site.vici.url) ? site.vici.url
                : (window.VICI_LINKS && site.pleiades && VICI_LINKS[site.pleiades]) ? VICI_LINKS[site.pleiades].url
                : null;
  const viciSub = site.elevation ? 'A photo lives here — help elevate it' : 'Community archaeology · plans &amp; photos';
  const viciBtn = viciUrl ? `
    <a href="${viciUrl}" onclick="saveReturnState()" class="p-btn p-btn-vici">
      <span class="p-btn-icon">🏛️</span>
      <div><div class="p-btn-main">Vici.org Atlas</div><div class="p-btn-sub">${viciSub}</div></div>
      <span class="p-btn-ext" aria-hidden="true">↗</span>
    </a>` : '';

  // "Email this quest" — only on quest sites. A mailto: link (NOT the OS share
  // sheet) so it opens the default mail app with a real Subject + body prefilled.
  // Same payload as the quest-modal email button (one helper, can't drift).
  let emailBtn = '';
  if (quest) {
    const pay = siteQuestEmailPayload(site);
    emailBtn = `
    <a href="${questMailto(pay.subject, pay.body)}" class="p-btn p-btn-email" data-testid="panel-email">
      <span class="p-btn-icon">✉️</span>
      <div><div class="p-btn-main">Email this quest</div><div class="p-btn-sub">Opens your mail app — subject &amp; message ready</div></div>
    </a>`;
  }

  // External links navigate in the SAME tab so the browser Back button/gesture
  // — the one "go back" action that works identically on every device,
  // including mobile — returns you to VIA. saveReturnState() stashes the open
  // site + home view first, so the Back reload drops you right where you were
  // instead of a cold start. The ↗ signals the button leaves VIA.
  document.getElementById('panel-actions').innerHTML = `
    <a href="${gmUrl}" onclick="saveReturnState()" class="p-btn p-btn-maps">
      <span class="p-btn-icon">🗺️</span>
      <div><div class="p-btn-main">Google Maps</div><div class="p-btn-sub">Modern streets, places &amp; directions</div></div>
      <span class="p-btn-ext" aria-hidden="true">↗</span>
    </a>
    <a href="${satUrl}" onclick="saveReturnState()" class="p-btn p-btn-sat">
      <span class="p-btn-icon">🛰️</span>
      <div><div class="p-btn-main">Satellite View</div><div class="p-btn-sub">Aerial photo — spot the ruins from above</div></div>
      <span class="p-btn-ext" aria-hidden="true">↗</span>
    </a>
    <a href="${plUrl}" onclick="saveReturnState()" class="p-btn p-btn-gold">
      <span class="p-btn-icon">📜</span>
      <div><div class="p-btn-main">Pleiades Gazetteer</div><div class="p-btn-sub">The authoritative scholarly place record</div></div>
      <span class="p-btn-ext" aria-hidden="true">↗</span>
    </a>${viciBtn}${emailBtn}
  `;

  // Pleiades Linked Data Sidebar — scholarly cross-references for this place.
  renderLinkedData(site);

  // Remember where the map was the first time the panel opens, so closing it
  // returns you whence you came instead of stranding you at the last offset
  // pan. Only capture on the initial open — tapping a second marker while the
  // panel is still up must not overwrite the original "home" view.
  const panel = document.getElementById('info-panel');
  panel.classList.remove('segment-panel');
  if (!panel.classList.contains('open')) {
    panelReturnView = { center: map.getCenter(), zoom: map.getZoom() };
  }
  panel.classList.add('open');
  dismissMobileGuide(true);
  currentPanelSite = site;
  refreshCheckinRow();
  // Offset the pan so the marker lands in the part of the map the panel doesn't
  // cover (left of it on desktop, above it on mobile). This MUST be a pixel
  // offset, not a lat/lng one: a fixed degree shift (the old `lng - 2`) is ~170km
  // here and scales wrong with zoom/latitude — at a deep zoom it flung the marker
  // clean off-screen (clicking Pompeii centered the map on the Pontine Islands).
  // Project the marker to screen pixels, shift by half the panel's size, unproject.
  panToWithPanelOffset([site.lat, site.lng]);
}

// Centre a latlng in the part of the map the panel doesn't cover (left of it on
// desktop, above it on mobile), via a pixel offset so it's zoom/latitude-proof.
// Pass `zoom` to also change zoom (setView); omit it to just pan at the current
// zoom. The pixel offset is computed AT the target zoom so it lands right.
function panToWithPanelOffset(latlng, zoom) {
  const panelEl = document.getElementById('info-panel');
  const isMobile = window.innerWidth <= 640;
  const z  = (zoom != null) ? zoom : map.getZoom();
  const pt = map.project(latlng, z);
  let center;
  if (isMobile) {
    // Bottom sheet covers the lower part — push the marker up into the top strip.
    const off = (panelEl.offsetHeight || window.innerHeight * 0.84) / 2;
    center = map.unproject(pt.add(L.point(0, off)), z);
  } else {
    // Side panel covers the right — push the marker into the left area.
    const off = (panelEl.offsetWidth || 360) / 2;
    center = map.unproject(pt.add(L.point(off, 0)), z);
  }
  if (zoom != null) map.setView(center, z, { animate: true });
  else              map.panTo(center, { animate: true, duration: 0.4 });
}

function closePanel() {
  const panel = document.getElementById('info-panel');
  const pulseSiteIdAfterClose = pendingClosePulseSiteId;
  panel.classList.remove('open');
  panel.classList.remove('segment-panel');
  if (activeMarker) {
    activeMarker.setIcon(makeIcon(activeMarker._site, false));
    activeMarker.setZIndexOffset(activeMarker._site.quest ? 500 : 0);
    activeMarker = null;
  }
  currentPanelSite = null;
  currentPanelKind = null;
  currentSegmentMeta = null;
  // Clear the road mini-banner (the curated-road name tooltip) when the detail
  // card closes — but ONLY when it was opened by a tap. On touch the sticky
  // tooltip has no mouseout to dismiss it, so it lingers and overlays the lit
  // road (option 2, 3c gate). On desktop the tooltip is hover-managed and a tap
  // never sets this flag, so we leave it alone: force-closing it here tore it
  // down mid-gesture and raced the desktop click→panel path (v88 regression).
  if (roadBannerFromTap && typeof roadsGroup !== 'undefined') {
    roadsGroup.eachLayer(l => { if (l.closeTooltip) l.closeTooltip(); });
    roadBannerFromTap = false;
  }
  // Glide back to the view you came from, undoing the offset pan that opening
  // the panel applied. Without this you're left stranded wherever the last
  // marker tap dragged the map.
  if (panelReturnView) {
    map.flyTo(panelReturnView.center, panelReturnView.zoom, { duration: 0.4 });
    panelReturnView = null;
  }
  pendingClosePulseSiteId = null;
  if (pulseSiteIdAfterClose && window.innerWidth <= 640) {
    const pulseMarker = allMarkers.find(m => m._site && m._site.id === pulseSiteIdAfterClose);
    if (pulseMarker) {
      setTimeout(() => triggerMarkerPulse(pulseMarker), 140);
    }
  }
}

// Search lives in the top bar and resolves to the same site-panel flow as a
// marker tap. That keeps keyboard, desktop, and mobile selection behavior on
// one code path.
const SEARCH_LIMIT = 8;
let currentSearchResults = [];
let activeSearchIndex = -1;
let previewMarker = null;

function normalizeSearchText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Search rows are built with innerHTML, and SITES carries generated upstream
// Pleiades/vici strings. Escape every interpolated value so a name containing
// <, ", or </button> can't break the DOM or inject markup.
function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Linked Data Sidebar (Pleiades inbound scholarly cross-references) ──
// Renders #linked-data-card from window.SITES_LINKED_DATA (built by
// scripts/build-linked-data.mjs from the Pleiades sidebar collection). Each source
// is a native <details> disclosure so a link-rich place stays compact. The ★/☆ glyph
// encodes reciprocity (filled = the external dataset and Pleiades reference each
// other) as SHAPE, not color — colorblind-safe. External links open same-tab +
// saveReturnState() so the Back gesture returns to VIA, matching panel-actions.
function renderLinkedData(site) {
  const el = document.getElementById('linked-data-card');
  if (!el) return;
  const data = site && site.pleiades && window.SITES_LINKED_DATA
    ? window.SITES_LINKED_DATA[site.pleiades] : null;
  if (!data || !data.sources || !data.sources.length) { el.innerHTML = ''; return; }

  const sources = data.sources.map((s) => {
    const star = s.recip ? '★' : '☆';
    const starTitle = s.recip
      ? 'Reciprocated — Pleiades and this dataset link each other'
      : 'One-way link into Pleiades';
    const links = s.items.map((it) =>
      `<li><a href="${escapeHtml(it.u)}" onclick="saveReturnState()" rel="noopener">` +
      `${escapeHtml(it.t)}<span class="p-btn-ext" aria-hidden="true">↗</span></a></li>`
    ).join('');
    const more = s.n > s.items.length ? `<li class="ld-more">+ ${s.n - s.items.length} more</li>` : '';
    return `<details class="ld-src">` +
      `<summary><span class="ld-star" title="${starTitle}">${star}</span>` +
      `<span class="ld-label">${escapeHtml(s.label)}</span><span class="ld-n">${s.n}</span></summary>` +
      `<ul class="ld-links">${links}${more}</ul></details>`;
  }).join('');

  const n = data.sources.length;
  el.innerHTML =
    `<div class="ld-head"><span class="ld-head-icon">🔎</span>Primary sources &amp; evidence` +
    `<span class="ld-sub">via Pleiades · ${n} dataset${n > 1 ? 's' : ''}</span></div>` +
    `<div class="ld-sources">${sources}</div>`;
}

function siteSearchEntries(site) {
  return {
    name: normalizeSearchText(site.name),
    modern: normalizeSearchText(site.modern),
    period: normalizeSearchText(site.period),
    type: normalizeSearchText(site.type),
    id: normalizeSearchText(site.id),
    pleiades: normalizeSearchText(site.pleiades),
  };
}

function rankSearchMatch(site, query) {
  if (!query) return null;
  const entry = siteSearchEntries(site);
  const wordPrefix = (text) => text.split(/[\s,()/.-]+/).some(part => part.startsWith(query));
  if (entry.name === query) return { score: 0, bucket: 'site', match: 'Exact site' };
  if (entry.name.startsWith(query)) return { score: 1, bucket: 'site', match: 'Site name' };
  if (wordPrefix(entry.name)) return { score: 2, bucket: 'site', match: 'Site name' };
  if (entry.name.includes(query)) return { score: 3, bucket: 'site', match: 'Site name' };
  if (entry.modern === query) return { score: 4, bucket: 'location', match: 'Modern location' };
  if (entry.modern.startsWith(query)) return { score: 5, bucket: 'location', match: 'Modern location' };
  if (wordPrefix(entry.modern)) return { score: 6, bucket: 'location', match: 'Modern location' };
  if (entry.modern.includes(query)) return { score: 7, bucket: 'location', match: 'Modern location' };
  if (entry.period.includes(query)) return { score: 8, bucket: 'context', match: 'Period' };
  if (entry.type.includes(query)) return { score: 9, bucket: 'context', match: 'Type' };
  if (entry.id === query || entry.pleiades === query) return { score: 10, bucket: 'context', match: 'Identifier' };
  // Compound fallback: a multi-word query the single-field checks above all
  // missed (e.g. "appia via", "pompeii italy", "rome city") still matches when
  // EVERY token word-prefixes some field. Single-token queries never reach here
  // (length <= 1 short-circuits), so existing one-word search is untouched.
  const tokens = searchQueryTokens(query);
  if (tokens.length > 1) {
    const strings = [entry.name, entry.modern, entry.period, entry.type].filter(Boolean);
    if (tokensMatchStrings(tokens, strings)) {
      const nameWords = entry.name.split(SEARCH_SPLIT);
      const nameHit = tokens.some(tok => nameWords.some(w => w.startsWith(tok)));
      return nameHit
        ? { score: 2.5, bucket: 'site', match: 'Site name' }
        : { score: 7.5, bucket: 'location', match: 'Multiple terms' };
    }
  }
  return null;
}

function searchSites(query) {
  const q = normalizeSearchText(query);
  if (!q) return [];
  return SITES
    .map(site => ({ site, rank: rankSearchMatch(site, q) }))
    .filter(hit => !!hit.rank)
    .sort((a, b) => {
      if (a.rank.score !== b.rank.score) return a.rank.score - b.rank.score;
      const aCurated = CURATED_SET.has(a.site) ? 0 : 1;
      const bCurated = CURATED_SET.has(b.site) ? 0 : 1;
      if (aCurated !== bCurated) return aCurated - bCurated;
      return a.site.name.localeCompare(b.site.name);
    })
    .slice(0, SEARCH_LIMIT)
    .map(hit => ({ site: hit.site, bucket: hit.rank.bucket, match: hit.rank.match, score: hit.rank.score }));
}

function siteSearchMeta(site) {
  const bits = [];
  if (site.modern && normalizeSearchText(site.modern) !== normalizeSearchText(site.name)) bits.push(site.modern);
  if (site.type) bits.push(site.type[0].toUpperCase() + site.type.slice(1));
  if (site.quest) bits.push((QUEST[site.quest] || {}).label?.replace(' · Open', '') || 'Quest');
  return bits.join(' · ');
}

// ── ROAD SEARCH (3c) ─────────────────────────────────────
// Only the 14 curated ROADS are indexed; Itiner-e segment names are consciously
// deferred (uneven coverage, ~14k dup-named segments — a later pass, not an
// oversight). A road carries an alias bundle (data.js `search`): Latin name,
// common English name, an endpoint pair, and extra aliases. Endpoints are
// tokenized individually (see SEARCH_SPLIT) so "Rome to Brundisium",
// "Rome-Brundisium" and "Rome Brundisium" all match.
const SEARCH_SPLIT = /[\s,()/.\-–—]+/;
const SEARCH_STOPWORDS = new Set(['to', 'and', 'the', 'of']);

// Normalize + split a query into matchable tokens, dropping route connectors.
function searchQueryTokens(query) {
  return normalizeSearchText(query).split(SEARCH_SPLIT).filter(t => t && !SEARCH_STOPWORDS.has(t));
}

// Token-AND match: every query token must word-prefix some string in `strings`.
// "appian way" → needs a string with a word starting "appian" AND one starting
// "way" (both satisfied by "appian way"); a single stray token fails the whole.
function tokensMatchStrings(tokens, strings) {
  if (!tokens.length) return false;
  return tokens.every(tok =>
    strings.some(str => str.split(SEARCH_SPLIT).some(w => w.startsWith(tok)))
  );
}

function roadSearchStrings(road) {
  const s = road.search || {};
  const parts = [road.name, s.en, s.from, s.to, road.desc, road.built];
  if (Array.isArray(s.alt)) parts.push(...s.alt);
  return parts.filter(Boolean).map(normalizeSearchText);
}

// Precomputed once — 14 entries, cheap.
const ROAD_SEARCH_INDEX = ROADS.map(road => ({
  road,
  name: normalizeSearchText(road.name),
  strings: roadSearchStrings(road),
}));

function searchRoads(query) {
  const tokens = searchQueryTokens(query);
  if (!tokens.length) return [];
  const joined = normalizeSearchText(query);
  const hits = [];
  for (const entry of ROAD_SEARCH_INDEX) {
    let score;
    if (entry.name === joined) score = 0;
    else if (entry.name.startsWith(joined)) score = 1;
    else if (tokensMatchStrings(tokens, entry.strings)) score = 2;
    else continue;
    hits.push({ road: entry.road, kind: 'road', bucket: 'road', match: 'Roman road', score });
  }
  return hits.sort((a, b) => a.score - b.score || a.road.name.localeCompare(b.road.name));
}

function roadSearchMeta(road) {
  const s = road.search || {};
  const bits = [];
  if (s.en && normalizeSearchText(s.en) !== normalizeSearchText(road.name)) bits.push(s.en);
  if (s.from && s.to) bits.push(`${s.from} → ${s.to}`);
  else if (road.desc) bits.push(road.desc);
  if (road.built) bits.push('est. ' + road.built);
  return bits.join(' · ');
}

// ── ITINER-E ROAD SEARCH ─────────────────────────────────
// The ~6,185 named scholarly roads from the Itiner-e atlas (ITINERE_NAME_INDEX).
// Same token-AND matcher as curated roads, but against the endpoint-pair name
// only. Two-char minimum so a single letter can't dump thousands of rows.
const ITINERE_SEARCH_LIMIT = 8;
function searchItinere(query) {
  const tokens = searchQueryTokens(query);
  if (!tokens.length) return [];
  const joined = normalizeSearchText(query);
  if (joined.length < 2) return [];
  const hits = [];
  for (const entry of ITINERE_NAME_INDEX) {
    let score;
    if (entry.norm === joined) score = 0;
    else if (entry.norm.startsWith(joined)) score = 1;
    else if (tokensMatchStrings(tokens, [entry.norm])) score = 2;
    else continue;
    hits.push({ itinere: entry, kind: 'itinere', bucket: 'itinere', match: 'Itiner-e road', score });
  }
  hits.sort((a, b) => a.score - b.score || a.itinere.name.localeCompare(b.itinere.name));
  return hits.slice(0, ITINERE_SEARCH_LIMIT);
}

function itinereSearchMeta(entry) {
  const ci = entry.meta && CERT_INFO[entry.meta.cert];
  const bits = [];
  if (ci) bits.push(ci.label);
  const n = entry.segs.length;
  bits.push(n === 1 ? '1 segment' : `${n} segments`);
  return bits.join(' · ');
}

// ── DOCUMENTED COVERAGE SEARCH (v2 Phase A) ──────────────
// The ~25k documented Pleiades long tail (sites-coverage.js, lazy-loaded). This
// is what makes basemap-only places like Euphranta findable without rendering a
// single extra marker. Loaded on first search; until then searchCoverage returns
// [] and the loader re-runs the query when the data lands.
let _coverageState = 'idle';   // idle | loading | ready | error
let _coverageData  = null;     // processed, deduped, site-shaped records
let _coverageVisibleCount = 0; // dots painted in the last render — drives the adaptive catch

function ensureCoverageLoaded() {
  if (QA || _coverageState !== 'idle') return;   // QA stays light; load once
  _coverageState = 'loading';
  const s = document.createElement('script');
  s.src = 'js/sites-coverage.js?v=' + BUILD;     // same cache token as the app
  s.async = true;
  s.onload = () => {
    const raw = (typeof window.SITES_COVERAGE !== 'undefined') ? window.SITES_COVERAGE : [];
    // Dedup against everything already interactive (curated + foreground Pleiades
    // + vici), by pleiades id. Site-shape the thin records so showPanel can render
    // them, and precompute the normalized name so search doesn't re-normalize 25k
    // strings per keystroke.
    const existing = new Set(SITES.map(x => x.pleiades).filter(Boolean));
    _coverageData = [];
    for (const r of raw) {
      if (r.pleiades && existing.has(r.pleiades)) continue;
      r.id = 'cov-' + r.pleiades;
      r.modern = '';
      r.desc = '';
      r.rome_days = 0;
      r.coverage = true;
      r._n = normalizeSearchText(r.name);
      _coverageData.push(r);
    }
    _coverageState = 'ready';
    // Re-run the in-flight query so coverage hits appear now that we have them.
    const input = document.getElementById('site-search-input');
    if (input && input.value.trim()) updateSearchResults(input.value);
    // If the slider is already on "Documented", paint the dots now (Phase B).
    renderCoverageDots();
    if (typeof syncDetailUI === 'function') syncDetailUI();
  };
  s.onerror = () => { _coverageState = 'error'; };
  document.head.appendChild(s);
}

const COVERAGE_SEARCH_LIMIT = 6;
function searchCoverage(query) {
  if (_coverageState !== 'ready' || !_coverageData) return [];
  const tokens = searchQueryTokens(query);
  if (!tokens.length) return [];
  const joined = normalizeSearchText(query);
  if (joined.length < 2) return [];
  const hits = [];
  for (const r of _coverageData) {
    let score;
    if (r._n === joined) score = 0;
    else if (r._n.startsWith(joined)) score = 1;
    else if (tokensMatchStrings(tokens, [r._n])) score = 2;
    else continue;
    hits.push({ coverage: r, kind: 'coverage', bucket: 'coverage', match: 'Pleiades place', score });
  }
  hits.sort((a, b) => a.score - b.score || a.coverage.name.localeCompare(b.coverage.name));
  return hits.slice(0, COVERAGE_SEARCH_LIMIT);
}

function coverageSearchMeta(r) {
  const bits = [];
  if (r.type) bits.push(r.type[0].toUpperCase() + r.type.slice(1));
  if (r.period) bits.push(r.period);
  return bits.join(' · ');
}

// ── DOCUMENTED COVERAGE MAP LAYER (v2 Phase B) ───────────
// The top stop of the detail slider ("Documented") renders the ~25k coverage
// places as small, quiet canvas dots — subordinate to the curated icons (size +
// luminance carry it, never hue: the user is red-green colorblind). They are
// VIEWPORT-CULLED and zoom-gated so we never paint 25k dots at once. Taps resolve
// to the nearest dot (canvas paths aren't DOM nodes — same model as the roads),
// only when the layer is showing. The group stays permanently on the map; we only
// mutate its contents (the mobile-safe pattern).
const coverageRenderer  = L.canvas({ padding: 0.3 });
const coverageDotsGroup = L.layerGroup().addTo(map);
const MIN_COVERAGE_ZOOM = 7;       // slider "Documented": dots from here, everywhere you pan
const AUTO_REVEAL_ZOOM  = 10;      // Phase C: zoom in this deep and dots auto-reveal, no slider
const MAX_COVERAGE_DOTS = 4000;    // hard cap per render — bounds worst-case cost
const COVERAGE_DOT_STYLE = {
  renderer: coverageRenderer, radius: 3,
  color: '#2a1c0c', weight: 0.6, opacity: 0.7,   // thin dark outline = luminance edge
  fillColor: '#e8dcc0', fillOpacity: 0.85,        // light fill, quiet neutral (no hue cue)
  interactive: false,
};

// Should coverage be on screen right now? Either the slider is explicitly on
// "Documented" (past the floor zoom), OR you've zoomed in deep enough that
// committing to an area auto-reveals it (Phase C). Drives the lazy load too.
function coverageWanted() {
  if (_coverageState === 'error') return false;
  const z = map.getZoom();
  return (detailLevel >= 3 && z >= MIN_COVERAGE_ZOOM) || (z >= AUTO_REVEAL_ZOOM);
}
// …and is it actually paintable (wanted AND the lazy data has arrived).
function coverageVisible() {
  return _coverageState === 'ready' && !!_coverageData && coverageWanted();
}

// Density fade (Phase C): on auto-reveal the dots fade in over a two-zoom band so
// they don't pop. Full strength when the slider is explicitly on "Documented".
function coverageDotFill() {
  if (detailLevel >= 3) return 0.85;
  const t = Math.max(0, Math.min(1, (map.getZoom() - AUTO_REVEAL_ZOOM) / 2));
  return 0.30 + t * 0.5;   // 0.30 at the reveal edge → 0.80 two zooms deeper
}

// Coverage dots scale up as you zoom into finer levels so they stop reading as
// pinpricks against the detailed deep-zoom basemap. Quiet (3px) at the reveal
// floor where they're dense; larger (up to 7px) once you've committed to an area.
function coverageDotRadius() {
  const z = map.getZoom();
  if (z >= 14) return 7;
  if (z >= 13) return 6;
  if (z >= 12) return 5;
  if (z >= 11) return 4.5;
  if (z >= 10) return 4;
  return 3;
}

function renderCoverageDots() {
  coverageDotsGroup.clearLayers();
  if (!coverageVisible()) return;
  const fill  = coverageDotFill();
  const style = Object.assign({}, COVERAGE_DOT_STYLE, { radius: coverageDotRadius(), fillOpacity: fill, opacity: Math.min(0.7, fill + 0.05) });
  const b = map.getBounds().pad(0.2);
  let n = 0;
  for (const r of _coverageData) {
    if (!b.contains([r.lat, r.lng])) continue;
    L.circleMarker([r.lat, r.lng], style).addTo(coverageDotsGroup);
    if (++n >= MAX_COVERAGE_DOTS) break;
  }
  _coverageVisibleCount = n;   // feeds coverageCatchPx() — the catch tracks dot density
  maybeHintCoverage();         // one-time "what are these dots" nudge
}

// Adaptive tap-catch radius for coverage dots. A fixed radius can't win at both
// ends: tight enough to disambiguate dense low-zoom dots is far too small to hit a
// lone dot at high zoom (the bug — a 28px island in a 200px-empty sea). So size the
// catch to the LOCAL dot spacing: estimate average neighbour distance from the dots
// actually on screen (~sqrt(viewportArea / count), a cheap density proxy that tracks
// both zoom AND regional density), and own half of it — the Voronoi half-spacing, i.e.
// "snap to the visibly-nearest dot." Floored at the old fixed value (never tighter,
// so dense areas don't regress) and capped so a click in genuine emptiness still
// falls through to closePanel instead of yanking in a far-off dot.
function coverageCatchPx() {
  const floor = COARSE_POINTER ? 30 : 28;
  const cap   = COARSE_POINTER ? 90 : 80;
  const n = _coverageVisibleCount;
  if (!n) return floor;
  const sz = map.getSize();                       // container px {x:w, y:h}
  const spacing = Math.sqrt((sz.x * sz.y) / n);   // avg px between neighbouring dots
  return Math.max(floor, Math.min(cap, spacing * 0.5));
}

// Nearest coverage place to a tap, or null. Only resolves when the dots are
// actually showing, so a coverage tap can't fire on an invisible layer.
function findNearestCoverage(latlng, cp, threshPx) {
  if (!coverageVisible()) return null;
  const THRESH = threshPx != null ? threshPx : coverageCatchPx();
  const c0 = map.containerPointToLatLng(L.point(0, 0));
  const c1 = map.containerPointToLatLng(L.point(THRESH, THRESH));
  const margin = Math.max(Math.abs(c1.lat - c0.lat), Math.abs(c1.lng - c0.lng));
  let best = null, bestD = THRESH;
  for (const r of _coverageData) {
    if (Math.abs(latlng.lat - r.lat) > margin || Math.abs(latlng.lng - r.lng) > margin) continue;
    const p = map.latLngToContainerPoint([r.lat, r.lng]);
    const d = Math.hypot(cp.x - p.x, cp.y - p.y);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

// One-time nudge the first time coverage dots ever paint — so an auto-reveal
// (dots appearing on deep zoom without touching the slider) isn't mysterious.
// Reuses the legend toast; gated by localStorage so it shows at most once ever.
let _coverageHintShown = false;
function maybeHintCoverage() {
  if (_coverageHintShown) return;
  _coverageHintShown = true;   // once per session regardless of storage availability
  try { if (localStorage.getItem('via.coverageHinted') === '1') return; } catch (e) {}
  try { localStorage.setItem('via.coverageHinted', '1'); } catch (e) {}
  const el = document.getElementById('legend-toast');
  const t  = document.getElementById('legend-toast-title');
  const b  = document.getElementById('legend-toast-body');
  if (!el || !t || !b) return;
  t.textContent = 'Documented places';
  b.textContent = 'These faint dots are documented places from the Pleiades gazetteer — tap one to open it. Drag Detail to “+ Documented” to keep them on.';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 6500);
}

// Merge site + road hits into one ranked list. Sites are pre-sorted (with the
// curated/name tiebreak); a stable sort by score keeps that order and slots
// equal-score roads in after. Itiner-e roads + documented coverage append as
// labeled groups after the curated content, with a few reserved slots so they
// always surface even when curated sites fill the list.
function searchAll(query) {
  const siteHits = searchSites(query).map(h => ({ ...h, kind: 'site' }));
  const roadHits = searchRoads(query);
  const primary = [...siteHits, ...roadHits].sort((a, b) => a.score - b.score);
  // Itiner-e first, then coverage — keeps each as a contiguous, single-labeled
  // group when renderSearchResults emits bucket headers.
  const secondary = [...searchItinere(query), ...searchCoverage(query)];
  if (!secondary.length) return primary.slice(0, SEARCH_LIMIT);
  const reserve = Math.min(3, secondary.length);
  const primaryKeep   = primary.slice(0, Math.max(SEARCH_LIMIT - reserve, 0));
  const secondaryKeep = secondary.slice(0, SEARCH_LIMIT - primaryKeep.length);
  return [...primaryKeep, ...secondaryKeep];
}

// The road currently lit up by a search selection (null when none).
let highlightedRoad = null;

// Paint a bright, thick glow over a road so it reads as "the one you searched
// for" — and stays readable once the panel is dismissed. The user is red-green
// colorblind, so WIDTH + LUMINANCE do the work (a wide cyan halo under a bright
// white core), never hue alone. Drawn above the curated saffron road, which
// stays visible underneath.
function highlightRoad(road) {
  clearRoadHighlight();
  const latlngs = road.coords.map(c => [c[1], c[0]]);
  L.polyline(latlngs, {
    color: '#7ad7ff', weight: 16, opacity: 0.4,
    lineCap: 'round', lineJoin: 'round', interactive: false,
    className: 'road-highlight-glow',
  }).addTo(roadHighlightGroup);
  L.polyline(latlngs, {
    color: '#fffbe9', weight: 5, opacity: 0.95,
    lineCap: 'round', lineJoin: 'round', interactive: false,
  }).addTo(roadHighlightGroup);
  highlightedRoad = road;
}

function clearRoadHighlight() {
  if (!highlightedRoad && !roadHighlightGroup.getLayers().length) return;
  roadHighlightGroup.clearLayers();
  highlightedRoad = null;
}

// Same cyan-halo-under-white-core highlight as a curated road, but painted across
// every segment of a named Itiner-e road (it spans many canvas segments). Returns
// the flattened [lat,lng] list so the caller can fit the map to the whole road.
function highlightItinere(entry) {
  clearRoadHighlight();
  const all = [];
  for (const s of entry.segs) {
    L.polyline(s.ll, {
      color: '#7ad7ff', weight: 14, opacity: 0.4,
      lineCap: 'round', lineJoin: 'round', interactive: false,
      className: 'road-highlight-glow',
    }).addTo(roadHighlightGroup);
    L.polyline(s.ll, {
      color: '#fffbe9', weight: 4, opacity: 0.95,
      lineCap: 'round', lineJoin: 'round', interactive: false,
    }).addTo(roadHighlightGroup);
    for (const ll of s.ll) all.push(ll);
  }
  // Sentinel so clearRoadHighlight/QA export treat the road as highlighted; only
  // `.name` is ever read off it (line ~2975), so a bare {name} object is enough.
  highlightedRoad = { name: entry.name, itinere: true };
  return all;
}

// Open a named Itiner-e road from search: light up all its segments, show the
// segment panel (carrying the road's certainty + nearby-sites context), and fit
// the map to the whole road. Mirrors focusRoad for the curated 14.
function focusItinere(entry) {
  if (typeof roadsGroup !== 'undefined') {
    roadsGroup.eachLayer(l => { if (l.closeTooltip) l.closeTooltip(); });
    roadBannerFromTap = false;
  }
  const all = highlightItinere(entry);
  const meta = entry.meta ? { ...entry.meta, name: entry.name } : { name: entry.name };
  showSegmentPanel(meta, all);
  // The road is the star — drop the return-view snapshot so closePanel keeps the
  // framing + highlight instead of flying back to the pre-search view.
  panelReturnView = null;
  if (all.length) {
    const bounds = L.latLngBounds(all);
    requestAnimationFrame(() => map.fitBounds(bounds, roadFitPadding()));
  }
}

// ── DOCUMENTED COVERAGE FOCUS (v2 Phase A) ───────────────
// Coverage places have no permanent marker (no map layer in Phase A), so opening
// one from search drops a temporary highlight pin at its spot, opens the honest-
// thin panel, and pans there. The pin is what answers "where IS this?" — the
// thing the basemap label never could. Cleared on the next search / pin / close.
const coveragePinGroup = L.layerGroup().addTo(map);
let _pinnedCoverage = null;   // the coverage place dropped by a search selection
function clearCoveragePin() {
  _pinnedCoverage = null;
  if (coveragePinGroup.getLayers().length) coveragePinGroup.clearLayers();
}
function showCoveragePin(site) {
  clearCoveragePin();
  _pinnedCoverage = site;
  // Reuse the active-marker icon so it reads as a real VIA pin (the point of the
  // exercise: this place IS now in VIA).
  L.marker([site.lat, site.lng], { icon: makeIcon(site, true), zIndexOffset: 1800, interactive: false })
    .addTo(coveragePinGroup);
}

// The search pin persists after the panel closes so you can still see the place —
// but a coverage record has no permanent marker, so without this a tap on the pin
// did nothing (single-click = nothing, double-click just zoomed). Resolve a tap
// near the pinned place so it reopens its panel, regardless of the detail level
// (you don't need the Documented dots showing to get back to what you searched).
function nearestPinnedCoverage(latlng, cp) {
  if (!_pinnedCoverage) return null;
  const p = map.latLngToContainerPoint([_pinnedCoverage.lat, _pinnedCoverage.lng]);
  return Math.hypot(cp.x - p.x, cp.y - p.y) <= 30 ? _pinnedCoverage : null;
}

function focusCoverage(record) {
  clearRoadHighlight();
  showCoveragePin(record);
  showPanel(record);
  panelReturnView = null;   // the place is the star; closePanel keeps the framing
  const z = Math.max(map.getZoom(), 8);
  requestAnimationFrame(() => panToWithPanelOffset([record.lat, record.lng], z));
}

// Open a curated road: highlight it on the map first (the road is the star and
// the highlight outlives the panel), then show its panel and fitBounds on the
// next frame so we can measure the now-open panel and pad the map so the whole
// road clears it (and the dock on mobile).
function focusRoad(road) {
  const latlngs = road.coords.map(c => [c[1], c[0]]);
  // A search selection is marked by the highlight, not the tap tooltip — drop any
  // stray road mini-banner left open from an earlier tap so it can't overlay the
  // freshly lit road.
  if (typeof roadsGroup !== 'undefined') {
    roadsGroup.eachLayer(l => { if (l.closeTooltip) l.closeTooltip(); });
    roadBannerFromTap = false;
  }
  highlightRoad(road);
  showSegmentPanel({ name: road.name, main: 1, desc: road.desc }, latlngs);
  // The road is the star and we fit the map TO it. Drop the return-view snapshot
  // showSegmentPanel just took so closePanel doesn't fly back to the pre-search
  // view and abandon the road — the framing (and the highlight) stay put.
  panelReturnView = null;
  const bounds = L.latLngBounds(latlngs);
  requestAnimationFrame(() => map.fitBounds(bounds, roadFitPadding()));
}

// Lowest pixel occupied by the fixed top chrome (topbar + era toggle), so road
// framing keeps the road clear of the era toggle — not just the panel. Measured
// live because the toggle sits below the topbar and both vary by breakpoint.
function topChromeBottom() {
  let bottom = 0;
  for (const id of ['topbar', 'era-toggle-wrap']) {
    const el = document.getElementById(id);
    if (!el || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    if (r.height) bottom = Math.max(bottom, r.bottom);
  }
  return bottom;
}

function roadFitPadding() {
  const panel = document.getElementById('info-panel');
  const open = panel && panel.classList.contains('open');
  const padTop = Math.round(topChromeBottom()) + 16;
  if (window.innerWidth <= 640) {
    // Mobile: the detail card is anchored at the bottom above the dock. Pad the
    // map below by the distance from the viewport bottom to the card's top, so
    // the road sits in the strip above the card (and therefore above the dock).
    let padBottom = 96;
    if (open) padBottom = Math.round(window.innerHeight - panel.getBoundingClientRect().top) + 12;
    return { paddingTopLeft: [24, Math.max(72, padTop)], paddingBottomRight: [24, padBottom] };
  }
  // Desktop: the panel overlays the right edge — pad right by its width.
  let padRight = 40;
  if (open) padRight = Math.round(panel.getBoundingClientRect().width) + 24;
  return { paddingTopLeft: [40, Math.max(40, padTop)], paddingBottomRight: [padRight, 40] };
}

function closeSearchResults() {
  const list = document.getElementById('site-search-results');
  const input = document.getElementById('site-search-input');
  currentSearchResults = [];
  activeSearchIndex = -1;
  clearPreviewMarker();
  if (list) {
    list.classList.remove('open');
    list.innerHTML = '';
  }
  if (input) input.setAttribute('aria-expanded', 'false');
}

function clearPreviewMarker() {
  if (!previewMarker || previewMarker === activeMarker) {
    previewMarker = null;
    return;
  }
  previewMarker.setIcon(makeIcon(previewMarker._site, false));
  previewMarker.setZIndexOffset(previewMarker._site.quest ? 500 : 0);
  previewMarker = null;
}

function previewSearchResult(index) {
  clearPreviewMarker();
  const hit = currentSearchResults[index];
  if (!hit || hit.kind !== 'site') return;  // only sites have a marker to preview
  const marker = markerForSite(hit.site);
  if (!marker || marker === activeMarker) return;
  previewMarker = marker;
  previewMarker.setIcon(makeIcon(previewMarker._site, true));
  previewMarker.setZIndexOffset(1500);
}

function setActiveSearchIndex(index) {
  activeSearchIndex = index;
  const rows = document.querySelectorAll('#site-search-results [data-testid="site-search-result"]');
  rows.forEach((row, i) => {
    const active = i === activeSearchIndex;
    row.classList.toggle('active', active);
    row.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  previewSearchResult(activeSearchIndex);
}

function renderSearchResults(results, query) {
  const list = document.getElementById('site-search-results');
  const input = document.getElementById('site-search-input');
  if (!list || !input) return;
  currentSearchResults = results.slice();
  activeSearchIndex = results.length ? 0 : -1;
  if (!query) {
    closeSearchResults();
    return;
  }
  if (!results.length) {
    list.innerHTML = '<div class="site-search-empty">No matching site, road, or location.</div>';
  } else {
    const labels = { site: 'Sites', location: 'Locations', context: 'Context', road: 'Roads', itinere: 'Itiner-e roads', coverage: 'More places · Pleiades' };
    let html = '';
    let lastBucket = null;
    results.forEach((hit, index) => {
      let name, meta;
      if (hit.kind === 'road') { name = hit.road.name; meta = roadSearchMeta(hit.road); }
      else if (hit.kind === 'itinere') { name = hit.itinere.name; meta = itinereSearchMeta(hit.itinere); }
      else if (hit.kind === 'coverage') { name = hit.coverage.name; meta = coverageSearchMeta(hit.coverage); }
      else { name = hit.site.name; meta = siteSearchMeta(hit.site); }
      if (hit.bucket !== lastBucket) {
        html += `<div class="site-search-group-label">${labels[hit.bucket] || 'Matches'}</div>`;
        lastBucket = hit.bucket;
      }
      html += `
        <button
          type="button"
          class="site-search-result${index === 0 ? ' active' : ''}"
          data-testid="site-search-result"
          data-kind="${hit.kind}"
          data-site-id="${hit.kind === 'site' ? escapeHtml(hit.site.id) : ''}"
          role="option"
          aria-selected="${index === 0 ? 'true' : 'false'}"
        >
          <span class="site-search-name">${escapeHtml(name)}</span>
          <span class="site-search-meta">${escapeHtml(meta)} <span class="site-search-match">· ${escapeHtml(hit.match)}</span></span>
        </button>
      `;
    });
    list.innerHTML = html;
  }
  list.classList.add('open');
  input.setAttribute('aria-expanded', 'true');
  previewSearchResult(activeSearchIndex);
}

function selectSearchResult(index) {
  const hit = currentSearchResults[index];
  const input = document.getElementById('site-search-input');
  if (!hit) return false;
  if (hit.kind === 'road') {
    if (input) input.value = hit.road.name;
    closeSearchResults();
    focusRoad(hit.road);
    return true;
  }
  if (hit.kind === 'itinere') {
    if (input) input.value = hit.itinere.name;
    closeSearchResults();
    focusItinere(hit.itinere);
    return true;
  }
  if (hit.kind === 'coverage') {
    if (input) input.value = hit.coverage.name;
    closeSearchResults();
    focusCoverage(hit.coverage);
    return true;
  }
  if (input) input.value = hit.site.name;
  closeSearchResults();
  clearRoadHighlight();   // selecting a site supersedes any lit-up road
  focusSite(hit.site, { pulse: true, pulseOnClose: true });
  return true;
}

function updateSearchResults(query) {
  renderSearchResults(searchAll(query), query);
}

function bindSiteSearch() {
  const wrap = document.getElementById('topbar-search');
  const input = document.getElementById('site-search-input');
  const list = document.getElementById('site-search-results');
  if (!wrap || !input || !list || wrap.dataset.bound === '1') return;
  wrap.dataset.bound = '1';

  input.addEventListener('input', () => {
    clearRoadHighlight();   // a fresh search retires the previously lit road
    clearCoveragePin();     // …and the previously pinned coverage place
    ensureCoverageLoaded(); // lazy-load the documented long tail on first keystroke
    updateSearchResults(input.value);
  });
  input.addEventListener('focus', () => {
    ensureCoverageLoaded();
    if (input.value.trim()) updateSearchResults(input.value);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeSearchResults();
      input.blur();
      return;
    }
    if (!currentSearchResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSearchIndex((activeSearchIndex + 1) % currentSearchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSearchIndex((activeSearchIndex - 1 + currentSearchResults.length) % currentSearchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectSearchResult(activeSearchIndex < 0 ? 0 : activeSearchIndex);
    }
  });

  list.addEventListener('click', e => {
    const row = e.target.closest && e.target.closest('[data-testid="site-search-result"]');
    if (!row) return;
    const index = Array.from(list.querySelectorAll('[data-testid="site-search-result"]')).indexOf(row);
    if (index >= 0) selectSearchResult(index);
  });
  list.addEventListener('mousemove', e => {
    const row = e.target.closest && e.target.closest('[data-testid="site-search-result"]');
    if (!row) return;
    const index = Array.from(list.querySelectorAll('[data-testid="site-search-result"]')).indexOf(row);
    if (index >= 0) setActiveSearchIndex(index);
  });
  list.addEventListener('mouseleave', () => {
    clearPreviewMarker();
    if (activeSearchIndex >= 0) previewSearchResult(activeSearchIndex);
  });

  // Dismiss on outside interaction. iOS Safari taps on the map/markers go
  // through custom touchend + preventDefault and never synthesize a click, so a
  // click-only handler leaves the sheet stuck open over the map. Listen for
  // touchstart too. (Both are capture-phase and guard on the search wrap.)
  const dismissIfOutside = e => {
    if (wrap.contains(e.target)) return;
    closeSearchResults();
  };
  document.addEventListener('click', dismissIfOutside, true);
  document.addEventListener('touchstart', dismissIfOutside, { capture: true, passive: true });
  // A map pan/zoom (drag) also means the user left the search interaction.
  map.on('movestart', closeSearchResults);
}

// ── MOBILE DOCK ──────────────────────────────────────────
// One slim bottom bar with a search field, a Detail (curation) button, and a Key
// button. Exactly one of {search overlay, curation popover, key panel, detail
// card} is open at a time — opening any dock panel closes the others AND the
// detail card; opening a marker/road detail card closes any dock panel. The
// search input is reparented into the dock's search overlay so search stays on
// the single bindSiteSearch code path. Mobile only; the buttons are display:none
// on desktop and the panels keep their existing desktop homes.
const DOCK_PANELS = ['search', 'curation', 'key'];
const DOCK_BTN_ID = { search: 'dock-search', curation: 'dock-curation', key: 'dock-key' };

function syncDockButtons() {
  const open = DOCK_PANELS.find(p => document.body.classList.contains('dock-' + p + '-open'));
  for (const p of DOCK_PANELS) {
    const btn = document.getElementById(DOCK_BTN_ID[p]);
    if (btn) btn.setAttribute('aria-expanded', p === open ? 'true' : 'false');
  }
}

function closeDockPanels() {
  let had = false;
  for (const p of DOCK_PANELS) {
    if (document.body.classList.contains('dock-' + p + '-open')) had = true;
    document.body.classList.remove('dock-' + p + '-open');
  }
  // The KEY panel's visible state is #quest-legend.mobile-open (shared with the
  // legacy toggleLegend path); keep them in lockstep.
  const lg = document.getElementById('quest-legend');
  if (lg) lg.classList.remove('mobile-open');
  syncDockButtons();
  return had;
}

function openDockPanel(which) {
  const wasOpen = document.body.classList.contains('dock-' + which + '-open');
  closeDockPanels();
  if (wasOpen) return;                       // tapping the active button closes it
  // Only one map surface at a time — opening a dock panel dismisses the detail card.
  if (document.getElementById('info-panel').classList.contains('open')) closePanel();
  document.body.classList.add('dock-' + which + '-open');
  if (which === 'key') {
    const lg = document.getElementById('quest-legend');
    if (lg) lg.classList.add('mobile-open');
  } else if (which === 'search') {
    const input = document.getElementById('site-search-input');
    if (input) setTimeout(() => input.focus(), 60);
  }
  dismissMobileGuide(true);
  syncDockButtons();
}

function bindDock() {
  // Reparent the topbar search into the dock's search overlay — mobile only, so
  // desktop keeps its in-topbar search untouched.
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const host   = document.getElementById('dock-search-panel');
  const search = document.getElementById('topbar-search');
  if (isMobile && host && search && search.parentElement !== host) host.appendChild(search);

  const sBtn = document.getElementById('dock-search');
  const cBtn = document.getElementById('dock-curation');
  const kBtn = document.getElementById('dock-key');
  if (sBtn) sBtn.addEventListener('click', () => openDockPanel('search'));
  if (cBtn) cBtn.addEventListener('click', () => openDockPanel('curation'));
  if (kBtn) kBtn.addEventListener('click', () => openDockPanel('key'));

  const cancel = document.getElementById('dock-search-cancel');
  if (cancel) cancel.addEventListener('click', () => { closeSearchResults(); closeDockPanels(); });
  const scrim = document.getElementById('dock-scrim');
  if (scrim) scrim.addEventListener('click', () => { closeSearchResults(); closeDockPanels(); });

  // Panning the map (movestart) dismisses any open dock panel; a tap on the open
  // map is handled by the map 'click' handler below.
  map.on('movestart', closeDockPanels);
}

// Plain-language read on each Itiner-e certainty class. The blurb doubles as the
// seed of the Step-2 "verify this stretch" quest framing (conjectured/hypothetical
// roads are exactly the field-verification opportunities Itiner-e's model exposes).
const CERT_INFO = {
  c: { label: 'Certain',      blurb: 'The course of this stretch is securely attested — its line is field-verified or directly documented in the evidence.' },
  j: { label: 'Conjectured',  blurb: 'The general course is inferred from the evidence but not field-verified. Someone on the ground could help confirm the alignment.' },
  h: { label: 'Hypothetical', blurb: 'This stretch is hypothesised — a plausible connection with little direct evidence. Prime territory for field research.' },
};
// Chip colours are decorative only (the label text carries the meaning, so this
// stays colorblind-safe); Hypothetical leans neutral-violet to separate it from
// the amber roads without relying on a red/green contrast.
const CERT_COLOR = { c: '#c79a4e', j: '#b89a6a', h: '#9a86b8' };

// ── ROADS ↔ SITES BRIDGE ─────────────────────────────────
// "Places along this stretch": for a tapped road segment, the nearest sites.
// Bridges the two layers so the map reads as one world. Distances use a local
// equirectangular projection (km), good for the short ranges in play.

function _distToSegPlanar(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Min distance (km) from a point to a polyline of [lat,lng] vertices.
function kmPointToPolyline(plat, plng, ll) {
  const k  = Math.cos(plat * Math.PI / 180);     // lng compression at this latitude
  const px = plng * k, py = plat;
  let best = Infinity;
  for (let i = 0; i + 1 < ll.length; i++) {
    const d = _distToSegPlanar(px, py, ll[i][1] * k, ll[i][0], ll[i + 1][1] * k, ll[i + 1][0]);
    if (d < best) best = d;
  }
  return best * 111.32;                            // degrees → km
}

function nearestSitesToSegment(ll, maxKm = 10, limit = 5) {
  if (!ll || ll.length < 2 || typeof SITES === 'undefined') return [];
  const out = [];
  for (const s of SITES) {
    if (typeof s.lat !== 'number' || typeof s.lng !== 'number') continue;
    const km = kmPointToPolyline(s.lat, s.lng, ll);
    if (km <= maxKm) out.push({ site: s, km });
  }
  out.sort((a, b) => a.km - b.km);
  return out.slice(0, limit);
}

// Road-segment panel. Reuses the #info-panel DOM but writes Itiner-e road content
// and hides the site-only sections (ORBIS, check-in, quest progress, quest banner).
// No per-segment URI exists in the static dump, so the external link points at the
// Itiner-e atlas rather than a deep segment link. `latlngs` (the segment geometry)
// drives the "Places along this stretch" bridge.
function showSegmentPanel(meta, latlngs) {
  hideLegendToast();
  closeDockPanels();      // the detail card is the one open surface now

  const cert = meta && meta.cert;
  const ci   = CERT_INFO[cert] || { label: 'Roman road', blurb: 'A segment of the Itiner-e Roman road network.' };
  const col  = CERT_COLOR[cert] || '#b89a6a';

  currentPanelKind = 'segment';
  currentPanelSite = null;
  currentSegmentMeta = meta || null;
  if (activeMarker) {
    activeMarker.setIcon(makeIcon(activeMarker._site, false));
    activeMarker.setZIndexOffset(activeMarker._site.quest ? 500 : 0);
    activeMarker = null;
  }

  // Hero. Roads have no imagery of their own, but a site along the stretch often
  // does — borrow the nearest such vici photo so the road panel is as rich as a
  // site panel. Honestly captioned ("<site> · © creator …") so it never reads as
  // a photo OF the road. Falls back to the tinted gradient + 🛣️ when no nearby
  // site has a photo.
  const hero = document.getElementById('panel-hero');
  const heroIcon = document.getElementById('hero-icon');
  heroIcon.textContent = '🛣️';
  let heroCredit = document.getElementById('hero-credit');
  if (!heroCredit) {
    heroCredit = document.createElement('div');
    heroCredit.id = 'hero-credit';
    hero.appendChild(heroCredit);
  }
  let heroPhoto = null;
  if (latlngs) {
    const cands = nearestSitesToSegment(latlngs, 80, 12);
    heroPhoto = cands.find(x => x.site && x.site.vici && x.site.vici.image) || null;
  }
  if (heroPhoto) {
    const v = heroPhoto.site.vici;
    setHeroPhoto(hero, heroIcon, v.image,
      'linear-gradient(180deg, rgba(17,10,0,0.05) 0%, rgba(17,10,0,0.88) 100%)');
    const by = v.creator ? `© ${v.creator}` : 'vici.org';
    heroCredit.textContent = `${heroPhoto.site.name} · ${by}${v.license ? ' · ' + v.license : ''} · via vici.org`;
    heroCredit.style.display = '';
  } else {
    hero.style.background = `radial-gradient(ellipse at center, ${col}18 0%, #110a00 70%)`;
    heroIcon.style.opacity = '';
    heroCredit.style.display = 'none';
  }
  document.getElementById('hero-coords').textContent = (meta && meta.name) ? meta.name : 'Roman road';
  document.getElementById('hero-modern').textContent = (meta && meta.main) ? 'Main road · Itiner-e' : 'Secondary road · Itiner-e';

  // Road Quest banner — conjectured/hypothetical stretches are field-verification
  // opportunities (the literal payoff of Itiner-e's certainty model). Certain
  // roads carry no banner. The CTA shares the stretch (no road contribution
  // pipeline yet — that's a later phase).
  const banner = document.getElementById('panel-quest-banner');
  if (cert === 'j' || cert === 'h') {
    banner.style.background  = `${col}14`;
    banner.style.borderColor = `${col}33`;
    banner.className = 'visible';
    document.getElementById('quest-banner-icon').textContent  = '🧭';
    const bt = document.getElementById('quest-banner-title');
    bt.textContent  = 'Road Quest · Verify this stretch';
    bt.style.color  = col;
    document.getElementById('quest-banner-text').textContent = (cert === 'h')
      ? 'Hypothetical route, little direct evidence. Field photos or notes here can improve the map.'
      : 'Inferred route, not field-verified. Walking or photographing it can confirm the alignment.';
    document.getElementById('quest-banner-cta').textContent  = 'Share this stretch →';
  } else {
    banner.className = '';
  }

  // Certainty badge.
  const badge = document.getElementById('panel-badge');
  badge.textContent   = ci.label.toUpperCase();
  badge.style.cssText = `color:${col};background:${col}18;border:1px solid ${col}40;display:inline-block;font-size:9px;letter-spacing:2px;padding:3px 9px;border-radius:3px;margin-bottom:9px;font-family:'Cinzel',serif;font-weight:600;`;

  document.getElementById('panel-name').textContent        = (meta && meta.name) ? meta.name : 'Roman road segment';
  document.getElementById('panel-modern-name').textContent = (meta && meta.main) ? 'Main road' : 'Secondary road';
  document.getElementById('panel-period').innerHTML        = `<span style="font-size:13px">🏛️</span>&nbsp;Roman road network · Itiner-e`;

  let desc = (meta && meta.desc) ? meta.desc : ci.blurb;
  const evidence = [];
  if (meta) {
    if (meta.itin) evidence.push(['Ancient itinerary', meta.itin]);
    if (meta.cite) evidence.push(['Contributor', meta.cite]);
    if (meta.bib)  evidence.push(['Source', meta.bib]);
  }
  const descEl = document.getElementById('panel-desc');
  descEl.textContent = desc;
  descEl.style.whiteSpace = '';

  const evidenceEl = document.getElementById('segment-evidence');
  if (evidenceEl) {
    evidenceEl.innerHTML = evidence.map(([label, value]) =>
      `<div class="seg-evidence-row"><span>${label}</span><strong>${value}</strong></div>`
    ).join('');
    evidenceEl.style.display = evidence.length ? 'block' : 'none';
  }

  // Hide site-only sections.
  document.getElementById('orbis-card').classList.remove('visible');
  document.getElementById('quest-progress').style.display = 'none';
  document.getElementById('checkin-row').style.display    = 'none';
  document.getElementById('linked-data-card').innerHTML   = '';  // site-only

  // Places along this stretch — the roads↔sites bridge. Each row jumps to that
  // site's panel. Photo thumb when the site has a vici image. The catalogue is
  // sparse over much of the empire, so when nothing sits within a day-stage
  // (~30 km) we fall back to the nearest catalogued site(s) — honestly relabelled
  // by distance — rather than hiding the section and looking broken.
  const nearbyEl = document.getElementById('segment-nearby');
  if (nearbyEl) {
    nearbyEl.innerHTML = '';
    let list = nearestSitesToSegment(latlngs, 30, 5);
    let heading = 'Sites along this stretch';
    if (!list.length) {
      list = nearestSitesToSegment(latlngs, 250, 2);
      heading = 'Nearest catalogued sites';
    }
    // The section is ALWAYS shown on a road panel — list rows when there are
    // any sites in range, else an explicit empty-state. Never silently hidden
    // (an invisible empty-state reads as a broken feature).
    const label = document.createElement('div');
    label.className = 'seg-near-label';
    label.textContent = heading;
    nearbyEl.appendChild(label);
    if (list.length) {
      for (const { site, km } of list) {
        const row = document.createElement('button');
        row.className = 'seg-near-row';
        const photo = site.vici && site.vici.image;
        const thumb = document.createElement('span');
        thumb.className = 'seg-near-thumb' + (photo ? '' : ' empty');
        if (photo) thumb.style.backgroundImage = `url("${photo}")`;
        else thumb.textContent = (TYPE[site.type] || TYPE.city).icon;
        const name = document.createElement('span');
        name.className = 'seg-near-name';
        name.textContent = site.name;
        const dist = document.createElement('span');
        dist.className = 'seg-near-km';
        dist.textContent = (km < 1 ? '<1' : Math.round(km)) + ' km';
        row.append(thumb, name, dist);
        row.addEventListener('click', (e) => { e.stopPropagation(); showPanel(site); });
        nearbyEl.appendChild(row);
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'seg-near-empty';
      empty.textContent = 'No catalogued sites in this region yet.';
      nearbyEl.appendChild(empty);
    }
    // Explicit 'block' — NOT '' . The CSS default is `display:none`, so clearing
    // the inline style (='') would fall back to that and keep the section hidden.
    nearbyEl.style.display = 'block';
  }

  // "Email this quest" on verification-quest stretches (conjectured/hypothetical),
  // matching the site flow. mailto: with a real subject + body.
  let emailBtn = '';
  if (cert === 'j' || cert === 'h') {
    const eName = (meta && meta.name) ? meta.name : 'a Roman road';
    const eUrl  = 'https://danielkorr.github.io/ancient-world-explorer/';
    const eSubj = `A VIA quest: help verify the Roman road ${eName} (${ci.label.toLowerCase()})`;
    const eBody = `${ci.label} Roman road: ${eName}.\n\nThis stretch of the ancient road network isn't field-verified. Walking or photographing it can help confirm the alignment.\n\nExplore it on VIA:\n${eUrl}\n\n${VIA_BLURB}\n\n#VIAquest`;
    emailBtn = `
    <a href="${questMailto(eSubj, eBody)}" class="p-btn p-btn-email" data-testid="panel-email">
      <span class="p-btn-icon">✉️</span>
      <div><div class="p-btn-main">Email this quest</div><div class="p-btn-sub">Opens your mail app — subject &amp; message ready</div></div>
    </a>`;
  }

  // Itiner-e atlas (opens a new tab) + the email-this-quest action when relevant.
  document.getElementById('panel-actions').innerHTML = `
    <a href="https://itiner-e.org" target="_blank" rel="noopener" class="p-btn p-btn-gold">
      <span class="p-btn-icon">🗺️</span>
      <div><div class="p-btn-main">Itiner-e Atlas</div><div class="p-btn-sub">Scholarly Roman road dataset · CC BY 4.0</div></div>
      <span class="p-btn-ext" aria-hidden="true">↗</span>
    </a>${emailBtn}`;

  const panel = document.getElementById('info-panel');
  panel.classList.add('segment-panel');
  // A road tap opens this panel WITHOUT panning the map, so there's nothing to
  // "return" from. Snapshotting a view here meant closePanel later flew you back
  // to it — and if you'd zoomed in to inspect the road while the panel was open,
  // a stray click (a gap in the line, no segment under the finger) yanked you all
  // the way back out. Keep your current view; closePanel won't fly anywhere.
  // (Search → focusRoad/focusItinere set their own framing via fitBounds.)
  panelReturnView = null;
  panel.classList.add('open');
  dismissMobileGuide(true);
}

// Called just before an external action link navigates away (same tab). Stash
// the open site + the "home" view so that when the browser Back gesture reloads
// VIA, restoreReturnState() can drop you right back where you were. Uses
// sessionStorage so it's scoped to this tab and self-clears on a fresh visit.
function saveReturnState() {
  if (!currentPanelSite) return;
  const home = panelReturnView || { center: map.getCenter(), zoom: map.getZoom() };
  try {
    sessionStorage.setItem('via.return', JSON.stringify({
      id:   currentPanelSite.id,
      lat:  home.center.lat,
      lng:  home.center.lng,
      zoom: home.zoom
    }));
  } catch (e) {}
}

// Map click: an Itiner-e road segment near the tap wins (open its panel);
// otherwise a click on the empty map closes any open panel. This single handler
// covers desktop clicks AND mobile taps — map-level click fires reliably on iOS
// for taps on the canvas/background (it already drove panel-close on mobile),
// unlike the layer-level clicks that forced the marker/road touch delegation.
map.on('click', (e) => {
  closeDockPanels();      // a tap on the open map dismisses any dock popover
  const seg = findNearestItinere(e.latlng, e.containerPoint);
  if (seg) { showSegmentPanel(seg.meta, seg.ll); return; }
  const cov = findNearestCoverage(e.latlng, e.containerPoint);  // only resolves when dots show
  if (cov) { focusCoverage(cov); return; }
  const pin = nearestPinnedCoverage(e.latlng, e.containerPoint);  // reopen a searched place's panel
  if (pin) { focusCoverage(pin); return; }
  if (document.getElementById('info-panel').classList.contains('open')) closePanel();
});

// ── SECONDARY-ROAD HOVER READOUT (desktop) ───────────────
// The ~14,800 Itiner-e segments are canvas paths, not DOM nodes, so they have no
// native hover and you can't tell which faint line is tappable. As the cursor
// nears one we resolve the closest segment (same threshold as the click) and show
// its name by the cursor — so "if you can read it, a click opens it." Touch
// devices skip this (no hover); throttled to one resolve per animation frame.
if (!COARSE_POINTER) {
  const readout = document.createElement('div');
  readout.id = 'road-hover-readout';
  readout.setAttribute('aria-hidden', 'true');
  document.body.appendChild(readout);
  let _hoverRaf = 0, _lastMove = null, _hoverClickable = false;
  const mapEl = map.getContainer();
  // Roads + coverage dots are canvas paths, not DOM nodes, so the browser never
  // paints a pointer cursor over them — they read as dead even though a click
  // resolves to the nearest one. Drive the cursor off the SAME resolver the click
  // uses: pointer exactly when a click would land something, so "if it's a hand,
  // it's clickable" (the deep-zoom catch radius is tiny and otherwise invisible).
  const setClickable = (on) => {
    if (on === _hoverClickable) return;
    _hoverClickable = on;
    mapEl.style.cursor = on ? 'pointer' : '';   // '' reverts to Leaflet's grab
  };
  const hide = () => { readout.classList.remove('show'); setClickable(false); };
  map.on('mousemove', (e) => {
    _lastMove = e;
    if (_hoverRaf) return;
    _hoverRaf = requestAnimationFrame(() => {
      _hoverRaf = 0;
      const ev = _lastMove;
      if (!ev) return;
      const seg = findNearestItinere(ev.latlng, ev.containerPoint);
      let name = seg && seg.meta && seg.meta.name;
      // A click resolves on any nearby segment (even unnamed), a coverage dot, or
      // a pinned search result — track that for the cursor, the name for the label.
      let clickable = !!seg;
      if (!name) {   // no named road nearer → name the nearest coverage dot, if any show
        const cov = findNearestCoverage(ev.latlng, ev.containerPoint);
        if (cov) { name = cov.name; clickable = true; }
      }
      if (!clickable && nearestPinnedCoverage(ev.latlng, ev.containerPoint)) clickable = true;
      setClickable(clickable);
      // Don't stack the cursor readout on top of a curated-road tooltip — that
      // tooltip already names the road under the cursor, so the readout would be
      // a redundant second label overlapping the first.
      const roadTipOpen = !!document.querySelector('.leaflet-tooltip.road-tip');
      if (name && !roadTipOpen) {
        readout.textContent = name;
        readout.style.left = (ev.originalEvent.clientX + 14) + 'px';
        readout.style.top  = (ev.originalEvent.clientY + 16) + 'px';
        readout.classList.add('show');
      } else {
        readout.classList.remove('show');
      }
    });
  });
  map.on('mouseout', hide);
}

// ── ERA TOGGLE ───────────────────────────────────────────

function setEra(era) {
  if (era === currentEra) return;
  currentEra = era;
  document.getElementById('btn-ancient').classList.toggle('active', era === 'ancient');
  document.getElementById('btn-modern').classList.toggle('active',  era === 'modern');

  if (era === 'ancient') {
    if (map.hasLayer(modernLayer)) map.removeLayer(modernLayer);
    if (!map.hasLayer(ancientFallbackLayer)) map.addLayer(ancientFallbackLayer);
    if (!map.hasLayer(ancientStamenLayer))   map.addLayer(ancientStamenLayer);
    if (ancientFallbackLabels && !map.hasLayer(ancientFallbackLabels)) map.addLayer(ancientFallbackLabels);
    if (!map.hasLayer(ancientLayer))         map.addLayer(ancientLayer);
  } else {
    if (map.hasLayer(ancientLayer))         map.removeLayer(ancientLayer);
    if (map.hasLayer(ancientStamenLayer))   map.removeLayer(ancientStamenLayer);
    if (map.hasLayer(ancientFallbackLayer)) map.removeLayer(ancientFallbackLayer);
    if (ancientFallbackLabels && map.hasLayer(ancientFallbackLabels)) map.removeLayer(ancientFallbackLabels);
    if (!map.hasLayer(modernLayer))         map.addLayer(modernLayer);
  }
  updateBasemaps();  // re-apply zoom-staged opacity + satellite reveal for the new era
  raiseOverlays();
}

// ── LAYER TOGGLES ────────────────────────────────────────

const layerState = { roads:true, sites:true, names:false };

function toggleLayer(which) {
  dismissMobileGuide(true);
  layerState[which] = !layerState[which];
  const btn = document.getElementById('btn-' + which);
  btn.classList.toggle('active', layerState[which]);
  // Keep the dock KEY panel's folded-in master row in lockstep with the chip.
  const lrow = document.getElementById('legend-' + which + '-toggle');
  if (lrow) lrow.classList.toggle('active', layerState[which]);
  if (which === 'names') {
    // Dual-name labels (ancient · modern) painted beside each visible site.
    // Pure label layer — touches no marker group, so it's immune to the mobile
    // add/remove repaint bug. Cluster + zoom gating lives in refreshNameLabels.
    labelsOn = layerState.names;
    refreshNameLabels();
    return;
  }
  if (which === 'roads') {
    // The "roads" toggle covers both the curated named roads and the Itiner-e
    // baseline — the user thinks of them as one concept.
    for (const g of [itinereRoadsGroup, roadsGroup]) {
      if (!g) continue;
      layerState.roads ? map.addLayer(g) : map.removeLayer(g);
    }
    // Reflect roads on/off into the certainty rows (they grey out when off).
    // CSS-only — does not mutate the group, so it can't trip the mobile repaint
    // bug that membership + content changes in one handler would.
    decorateRoadsLegend();
  } else {
    // Sites & Cities is the MASTER layer switch, conceptually above the tier
    // filter. Operating it un-hides every tier so the toggle always means the
    // full sites layer. Without this, a leftover hidden tier would make "Sites &
    // Cities" silently omit a category every time it's switched on.
    hiddenTiers.clear();
    syncFilterUI();   // re-light every legend row to match
    // The group stays on the map PERMANENTLY; we only change its contents.
    // Re-adding a layer group then mutating it in the same tap handler does not
    // repaint on mobile Safari (the "filter changes show nothing from an empty
    // map" bug). Never removing the group sidesteps it: refreshVisibleMarkers shows
    // nothing when sites is off.
    refreshVisibleMarkers();
  }
}

// Filtering quests is meaningless with the sites layer hidden, so engaging any
// quest filter turns Sites & Cities back on. The group is always on the map now,
// so this only flips state + the button; the caller's refreshVisibleMarkers paints.
function ensureSitesLayerOn() {
  if (!layerState.sites) {
    layerState.sites = true;
    document.getElementById('btn-sites').classList.add('active');
  }
}

// ── KEYBOARD ─────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeLegendInfo(); closeQuestModal(); closeAuthModal(); closePanel(); }
});

// ── AUTH + CHECK-INS ─────────────────────────────────────
// All identity + visit storage lives in js/auth.js behind VIA.auth so the
// UI here doesn't care whether the backend is localStorage or Supabase.

let currentPanelSite = null;
let currentPanelKind = null;  // 'site' | 'segment' — what the info panel is showing
let currentSegmentMeta = null; // the Itiner-e meta backing a 'segment' panel
let panelReturnView  = null;  // {center, zoom} captured when the panel opens
// True when the road mini-banner (curated-road tooltip) was opened by a TAP —
// the only case that needs clearing on card close. On desktop the tooltip is
// hover-managed (closes on mouseout), and a TAP never sets this, so closePanel
// must NOT force-close it there: doing so tore down the tooltip mid-gesture and
// raced the desktop click→panel path (v88 regression). See closePanel.
let roadBannerFromTap = false;

function refreshProfilePill() {
  const user = VIA.auth.currentUser();
  const pill  = document.getElementById('profile-pill');
  const glyph = document.getElementById('profile-pill-glyph');
  const label = document.getElementById('profile-pill-label');
  if (user) {
    pill.classList.add('signed-in');
    glyph.textContent = user.name.slice(0, 1).toUpperCase();
    label.textContent = user.name.split(/\s+/)[0];
    pill.title = `Signed in as ${user.name}`;
  } else {
    pill.classList.remove('signed-in');
    glyph.textContent = '⊙';
    label.textContent = 'Sign in';
    pill.title = 'Sign in';
  }
}

// Drives the modal's data-state attribute. CSS shows the matching panel.
function setAuthState(state) {
  document.getElementById('auth-modal').setAttribute('data-state', state);
}

function openAuthModal() {
  // On mobile the bottom-sheet panel + the modal would otherwise stack
  // visibly. Close the panel first so the modal owns the viewport.
  if (window.innerWidth <= 640 && document.getElementById('info-panel').classList.contains('open')) {
    closePanel();
  }
  const modal = document.getElementById('auth-modal');
  const user  = VIA.auth.currentUser();
  if (user) {
    if (VIA.auth.isGuest()) {
      document.getElementById('auth-guest-name').textContent = user.name;
      const n = VIA.auth.getUserCheckins().length;
      document.getElementById('auth-guest-count').textContent = `${n} ${n === 1 ? 'site' : 'sites'} visited`;
      setAuthState('guest');
    } else {
      document.getElementById('auth-user-name').textContent = user.name;
      const n = VIA.auth.getUserCheckins().length;
      document.getElementById('auth-checkin-count').textContent = `${n} ${n === 1 ? 'site' : 'sites'} visited`;
      setAuthState('signed-in');
    }
  } else {
    resetToEmail();
    setTimeout(() => document.getElementById('auth-email-input').focus(), 60);
  }
  modal.classList.add('open');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
}

function resetToEmail() {
  document.getElementById('auth-error').textContent = '';
  setAuthState('signed-out');
}

async function submitSignIn() {
  const errEl = document.getElementById('auth-error');
  const btn   = document.getElementById('auth-submit-btn');
  errEl.textContent = '';
  const input = document.getElementById('auth-email-input');
  const value = (input ? input.value : '').trim();
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    const result = await VIA.auth.signIn(value);
    if (result && result.pending) {
      document.getElementById('auth-link-email').textContent = result.email;
      setAuthState('link-sent');
    } else {
      closeAuthModal();
    }
  } catch (e) {
    errEl.textContent = (e && e.message) ? e.message : 'Sign-in failed. Try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Sign-in Link';
  }
}

async function signOutAndClose() {
  await VIA.auth.signOut();
  closeAuthModal();
}

function continueAsGuest() {
  VIA.auth.enterGuestMode();
}

function leaveGuestAndSignIn() {
  VIA.auth.leaveGuestMode();
}

// First-cloud-sign-in helpers (modal state E)
let pendingImportCount = 0;

function showImportPromptIfNeeded() {
  if (VIA.auth.backend !== 'supabase') return;
  if (!VIA.auth.currentUser()) return;
  const n = VIA.auth.localCheckinCount();
  if (n <= 0) return;
  pendingImportCount = n;
  document.getElementById('auth-import-name').textContent = VIA.auth.currentUser().name;
  document.getElementById('auth-import-count').textContent = n;
  setAuthState('import');
  document.getElementById('auth-modal').classList.add('open');
}

async function confirmImport() {
  const btn = document.getElementById('auth-import-btn');
  btn.disabled = true;
  btn.textContent = 'Importing…';
  try {
    await VIA.auth.importLocalCheckins();
    closeAuthModal();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Import Travels';
    document.getElementById('auth-error') && (document.getElementById('auth-error').textContent = 'Import failed: ' + (e.message || ''));
  }
}

function skipImport() {
  // Leave local data alone — user may want to keep it or import later.
  closeAuthModal();
}

function refreshCheckinRow() {
  const row   = document.getElementById('checkin-row');
  if (!currentPanelSite) { row.style.display = 'none'; return; }
  row.style.display = 'flex';

  const btn   = document.getElementById('checkin-btn');
  const stats = document.getElementById('checkin-stats');
  const user  = VIA.auth.currentUser();
  const existing = user ? VIA.auth.getCheckin(currentPanelSite) : null;
  const total = VIA.auth.getSiteVisitCount(currentPanelSite);

  stats.textContent = total === 0
    ? 'Be the first traveler to mark a visit here.'
    : `${total} ${total === 1 ? 'traveler has' : 'travelers have'} checked in.`;

  if (!user) {
    btn.textContent = 'Sign in to check in';
    btn.classList.remove('visited');
  } else if (existing) {
    const when = new Date(existing.visited_at).toLocaleDateString();
    btn.textContent = `✓ Visited ${when} — undo`;
    btn.classList.add('visited');
  } else {
    btn.textContent = '◎ Check in here';
    btn.classList.remove('visited');
  }

  updateQuestProgress(user);
}

// Quest progress meter: how many distinct quest sites the signed-in user has
// checked in to, out of TOTAL_QUESTS. Hidden when signed out (the check-in
// button already prompts sign-in there). Updates live via refreshCheckinRow,
// which fires on every check-in and auth change.
function updateQuestProgress(user) {
  const wrap = document.getElementById('quest-progress');
  if (!wrap) return;
  if (!user) { wrap.classList.remove('visible'); return; }

  const visited = new Set(
    VIA.auth.getUserCheckins()
      .map(c => c.site_pleiades)
      .filter(p => QUEST_PLEIADES.has(p))
  );
  const done   = visited.size;
  const pctRaw = TOTAL_QUESTS ? (done / TOTAL_QUESTS) * 100 : 0;
  // Floor a non-zero count at a visible sliver — 1/289 is 0.3% and would
  // otherwise render as an empty bar despite real progress.
  const pct = done > 0 ? Math.max(2, pctRaw) : 0;
  document.getElementById('qp-count').textContent = `${done} / ${TOTAL_QUESTS}`;
  document.getElementById('qp-fill').style.width = pct + '%';
  wrap.classList.add('visible');
}

function onCheckInClick() {
  if (!currentPanelSite) return;
  if (!VIA.auth.currentUser()) { openAuthModal(); return; }
  const existing = VIA.auth.getCheckin(currentPanelSite);
  if (existing) VIA.auth.removeCheckIn(currentPanelSite);
  else          VIA.auth.checkIn(currentPanelSite);
}

// Refresh marker icons after sign-in / check-in changes so the visited
// badge appears/disappears live.
function refreshAllMarkers() {
  allMarkers.forEach(m => m.setIcon(makeIcon(m._site, m === activeMarker)));
}

let _lastAuthUserId = null;

VIA.auth.onChange(() => {
  refreshProfilePill();
  refreshCheckinRow();
  refreshAllMarkers();
  // Detect transitions from signed-out → signed-in (cloud only) so we can
  // offer to import any localStorage check-ins from prior guest sessions.
  const user = VIA.auth.currentUser();
  const currentId = user ? user.id : null;
  if (_lastAuthUserId === null && currentId && VIA.auth.backend === 'supabase') {
    showImportPromptIfNeeded();
  }
  _lastAuthUserId = currentId;
});

refreshProfilePill();

// On boot: if the URL has ?signin=1 (set by guest-mode → cloud transition),
// pop the sign-in modal automatically.
try {
  const url = new URL(window.location.href);
  if (url.searchParams.get('signin') === '1') {
    setTimeout(openAuthModal, 80);
    url.searchParams.delete('signin');
    history.replaceState(null, '', url.toString());
  }
} catch {}

// ── QUEST MODAL + FILTER ─────────────────────────────────
// The signature feature: surface "Pleiades has no portrait photo here"
// (and the other quest tiers) as an open call to travelers.

function openQuestModal() {
  if (!currentPanelSite || !currentPanelSite.quest) return;
  const q     = QUEST[currentPanelSite.quest];
  const site  = currentPanelSite;
  const orbis = orbisLookup(site);

  document.getElementById('quest-modal-glyph').textContent = q.icon;
  document.getElementById('quest-modal-title').textContent = `${q.label.replace(' · Open','')} · ${site.name}`;
  document.getElementById('quest-modal-pitch').textContent = q.pitch;

  // Step 1's "Travel there." sub-line gets concrete coords + ORBIS days if known.
  const coords = `${Math.abs(site.lat).toFixed(3)}°${site.lat>=0?'N':'S'}, ${Math.abs(site.lng).toFixed(3)}°${site.lng>=0?'E':'W'}`;
  const days   = orbis
    ? `, ~${orbisFormatDays(orbis.days)} ${orbisFormatDays(orbis.days)==='1'?'day':'days'} from Rome via the ${({road:'ORBIS road network',sea:'sea routes',river:'river routes',ferry:'ferry network',mixed:'ORBIS network'}[orbis.mode]||'ORBIS network')}`
    : '';
  document.getElementById('quest-modal-coords').textContent = `${coords}${days}.`;

  document.getElementById('quest-modal').classList.add('open');
}

function closeQuestModal() {
  document.getElementById('quest-modal').classList.remove('open');
}

// Build a mailto: href with a prefilled subject + plain-text body. Used by the
// "Email this quest" buttons — opens the OS default mail app with a real Subject
// line (the OS share sheet can't set one). Plain text only: no image.
function questMailto(subject, body) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Subject + body for emailing a SITE quest. Single source of truth shared by the
// panel button and the quest-modal button so they can't drift. Dedupe-safe: the
// photo-quest text already ends with the "closes the gap" CTA, so only append it
// for the other tiers.
function siteQuestEmailPayload(site) {
  const q     = QUEST[site.quest] || QUEST.photo;
  const label = q.label.replace(' · Open', '');
  const where = site.modern ? `${site.name} (${site.modern})` : site.name;
  const url   = `https://danielkorr.github.io/ancient-world-explorer/?site=${site.pleiades}`;
  const cta   = /closes the gap/i.test(q.text) ? '' : ' Be the traveler who closes the gap.';
  return {
    subject: `A VIA quest: help document ${site.name} (${label})`,
    body: `${label}: ${where}.\n\n${q.text}${cta}\n\nExplore it on VIA:\n${url}\n\n${VIA_BLURB}\n\n#VIAquest`,
  };
}

// Quest-modal "Email this quest" button → opens the mail app for the open site.
function emailCurrentQuest() {
  if (!currentPanelSite) return;
  const pay = siteQuestEmailPayload(currentPanelSite);
  window.location.href = questMailto(pay.subject, pay.body);
}

async function shareQuest() {
  if (!currentPanelSite) return;
  const site  = currentPanelSite;
  const q     = QUEST[site.quest] || QUEST.photo;
  const label = q.label.replace(' · Open', '');
  const where = site.modern ? `${site.name} (${site.modern})` : site.name;
  // A VIA deep-link, NOT the raw Pleiades page: it opens the actual place in VIA
  // (Pleiades is one tap away in the panel) and unfurls with the OG card.
  const url   = `https://danielkorr.github.io/ancient-world-explorer/?site=${site.pleiades}`;
  // Put EVERYTHING — context + the one link — in a single text block, and do NOT
  // pass navigator.share's separate `url` field. Share targets cherry-pick fields
  // inconsistently (Gmail keeps only `url`, Outlook keeps only `text`, neither
  // sets a subject), so a self-contained message is the only way every target
  // shows the full thing with exactly one link. Social surfaces still unfurl the
  // VIA card from the URL inside the text.
  // Dedupe-safe: photo-quest text already ends with the CTA — don't repeat it.
  const cta = /closes the gap/i.test(q.text) ? '' : ' Be the traveler who closes the gap.';
  const message =
    `${label}: ${where}.\n${q.text}${cta}\n${url}\n#VIAquest`;

  if (navigator.share) {
    try { await navigator.share({ title: `${site.name} — VIA quest`, text: message }); return; }
    catch { /* fall through to clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(message);
    const btn = document.getElementById('quest-share-btn');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied — paste anywhere';
    setTimeout(() => { btn.textContent = orig; }, 2400);
  } catch {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`, '_blank');
  }
}

// The quest-banner CTA is shared between site panels and road-segment panels;
// dispatch by which kind is open. (Inline onclick in index.html stays stable.)
function onQuestCtaClick() {
  if (currentPanelKind === 'segment') shareRoadSegment();
  else openQuestModal();
}

// Share a road stretch with #VIAquest — the road analogue of shareQuest. No
// modal (and no contribution pipeline yet); this just spreads the quest.
async function shareRoadSegment() {
  const m = currentSegmentMeta;
  if (!m) return;
  const certLabel = (CERT_INFO[m.cert] || {}).label || 'Roman';
  const name = m.name || 'a Roman road';
  // Share a VIA link, not itiner-e.org — that bare external page never showed the
  // VIA card and dropped people outside the app. No per-segment deep-link exists
  // (the static Itiner-e dump has no stable segment id), so use the VIA home URL:
  // it unfurls the VIA card and lands the recipient in the experience.
  const url  = 'https://danielkorr.github.io/ancient-world-explorer/';
  // Single self-contained message (see shareQuest) — context + one link, no
  // separate `url` field, so every share target shows the full thing.
  const message =
    `Roman road quest: ${name} (${certLabel.toLowerCase()} route).\n` +
    `Help verify this stretch of the ancient network — walk it, photograph it, confirm the alignment.\n` +
    `${url}\n#VIAquest`;

  if (navigator.share) {
    try { await navigator.share({ title: `${name} — VIA road quest`, text: message }); return; }
    catch { /* fall through to clipboard */ }
  }
  const btn = document.getElementById('quest-banner-cta');
  try {
    await navigator.clipboard.writeText(message);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied — paste anywhere';
      setTimeout(() => { btn.textContent = orig; }, 2400);
    }
  } catch {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`, '_blank');
  }
}

// Marker visibility is governed by two things: zoom-staged disclosure when no
// filter is active, and an explicit tier filter when the user taps legend rows.
// A single Set of active tiers drives the legend, so the filter state stays
// consistent even as the map detail slider changes the visible zoom stage.
// (allMarkers + markersByTier are populated in the marker build loop above.)

const QUEST_TIERS  = ['photo', 'location', 'text'];
// SUBTRACTIVE tier filter (Track 3 / 3d). Tiers are ON by default — every legend
// row is lit at rest. Tapping a lit row drops that tier into hiddenTiers and its
// markers vanish, regardless of the DETAIL slider ("off means off"). The slider
// only sets disclosure density AMONG the tiers still on; it can never re-introduce
// a hidden tier. All quest tiers hidden → a clean empty quest map.
const hiddenTiers  = new Set();              // empty = all tiers shown
const siteTier     = site => site.quest || 'documented';

// How many sites sit in each tier. Drives the legend counts and disables tiers
// with nothing in them (e.g. Text Quest is 0 today) so tapping can't filter to
// an empty map.
const tierCounts = SITES.reduce((acc, s) => {
  const t = siteTier(s);
  acc[t] = (acc[t] || 0) + 1;
  return acc;
}, {});

// Quest-progress denominator + the set of quest Pleiades ids a check-in can
// count against. The denominator is used for the profile progress meter and the
// detail slider readout.
const questSites     = SITES.filter(s => !!s.quest);
const TOTAL_QUESTS   = questSites.length;
const QUEST_PLEIADES = new Set(questSites.map(s => s.pleiades).filter(Boolean));

// Quest tiers that actually have sites. The legend uses these to hide empty
// rows like Text Quest until data exists.
const presentQuestTiers = QUEST_TIERS.filter(t => tierCounts[t]);

// Plain-language explanation of each tier, surfaced by the legend toast (on
// tap) and the "?" explainer modal. Quest blurbs echo the per-site copy in
// QUEST so the language is consistent end to end.
const TIER_INFO = {
  documented: {
    label: 'Documented',
    color: '#b89a6a',
    blurb: 'A known site — located, photographed, and recorded in the Pleiades scholarly gazetteer. The established Roman world.',
  },
  photo: {
    label: 'Photo Quest',
    color: QUEST.photo.color,
    blurb: 'No portrait photo exists in the scholarly record. Visit one and photograph it to close the gap.',
  },
  location: {
    label: 'Location Quest',
    color: QUEST.location.color,
    blurb: 'The coordinates are unverified. A GPS reading on the ground would lock the site into the record.',
  },
  text: {
    label: 'Text Quest',
    color: QUEST.text.color,
    blurb: 'Known only from ancient texts — the physical site has never been confirmed on the ground.',
  },
};

// Content disclosure is now driven by the DETAIL slider, not zoom — clustering
// carries the density load, so we no longer thin markers by zoom. Three levels:
//   0 Highlights   — the ~95 hand-written cities (clean landing, the default).
//   1 Quests       — curated + every quest (the actionable game layer).
//   2 All sites    — the entire foreground Pleiades set.
//   3 + Documented — adds the ~25k Pleiades long-tail coverage dots (lazy).
// Markers always cluster, so even level 2 reads as a handful of bubbles, not
// 473 dots of orange measles.
let detailLevel = 0;

function siteVisibleAtLevel(site, level) {
  if (level >= 2) return true;
  if (level >= 1) return CURATED_SET.has(site) || !!site.quest;
  return CURATED_SET.has(site);
}

function refreshVisibleMarkers() {
  TIER_KINDS.forEach(k => siteClusters[k].clearLayers());
  if (!layerState.sites) return;   // sites hidden: groups stay on the map but empty
  TIER_KINDS.forEach(tier => {
    // Master filter: a hidden tier never appears, whatever the slider says.
    if (hiddenTiers.has(tier)) return;
    // Sub-filter: the detail level always governs density WITHIN a shown tier.
    // Bulk addLayers keeps chunkedLoading happy.
    const subset = markersByTier[tier].filter(m => siteVisibleAtLevel(m._site, detailLevel));
    if (subset.length) siteClusters[tier].addLayers(subset);
  });
  // The visible marker set just changed (slider / tier filter / sites toggle);
  // keep the dual-name labels matched to it. No-op when the Names layer is off.
  if (typeof refreshNameLabels === 'function') refreshNameLabels();
}

// Reflect the active tier set onto the legend rows (and dim the rest).
function syncFilterUI() {
  const legend = document.getElementById('quest-legend');
  if (legend) {
    // A row is "active" (lit) when its tier is SHOWN — the default for all rows.
    // Hiding a tier un-lights its row; `.filtering` dims the un-lit rows.
    legend.classList.toggle('filtering', hiddenTiers.size > 0);
    legend.querySelectorAll('.legend-row[data-tier]').forEach(row => {
      row.classList.toggle('active', !hiddenTiers.has(row.dataset.tier));
    });
  }
}

const DETAIL_LABELS = ['Highlights', 'Quests', 'All sites', '+ Documented'];

function detailStatsForLevel(level) {
  const idx = Math.max(0, Math.min(DETAIL_LABELS.length - 1, level));
  const questCount = SITES.filter(s => !!s.quest && siteVisibleAtLevel(s, idx)).length;
  const siteCount  = SITES.filter(s => siteVisibleAtLevel(s, idx)).length;
  return { level: idx, label: DETAIL_LABELS[idx], questCount, siteCount };
}

function syncDetailUI() {
  const slider = document.getElementById('detail-slider');
  const readout = document.getElementById('detail-readout');
  if (!slider || !readout) return;
  const stats = detailStatsForLevel(detailLevel);
  if (document.activeElement !== slider) slider.value = String(stats.level);
  slider.setAttribute('aria-valuenow', String(stats.level));
  // The "Documented" stop reports coverage state, not a quest count: it's a
  // different layer (the ~25k Pleiades long tail), lazy + zoom-gated.
  let text;
  if (stats.level >= 3) {
    if (_coverageState === 'idle' || _coverageState === 'loading') text = '+ Documented · loading…';
    else if (_coverageState === 'error') text = '+ Documented · unavailable';
    else if (map.getZoom() < MIN_COVERAGE_ZOOM) text = '+ Documented · zoom in to reveal';
    else text = `+ Documented · ${(_coverageData ? _coverageData.length : 0).toLocaleString()} places`;
  } else if (stats.level === 1) {
    // "Quests": the count that matters is the quest tally (the game layer).
    text = `Quests · ${stats.questCount.toLocaleString()} quests`;
  } else {
    // "Highlights" (0) and "All sites" (2) count SITES, not quests, so the
    // number visibly moves between stops instead of repeating the quest tally.
    text = `${stats.label} · ${stats.siteCount.toLocaleString()} sites`;
  }
  slider.setAttribute('aria-valuetext', text);
  readout.textContent = text;
}

// The slider sets WHAT is shown (curated / +quests / all), not the zoom.
// Clustering handles density, so this is a pure content filter into the groups.
function setDetailLevel(level) {
  detailLevel = Math.max(0, Math.min(DETAIL_LABELS.length - 1, level));
  if (detailLevel > 0) ensureSitesLayerOn();   // revealing more turns sites on
  if (coverageWanted()) ensureCoverageLoaded(); // "Documented" stop (or deep zoom) needs the tail
  refreshVisibleMarkers();
  renderCoverageDots();   // show/clear the coverage dots for the new level
  syncDetailUI();
}

function bindDetailSlider() {
  const slider = document.getElementById('detail-slider');
  if (!slider || slider.dataset.bound === '1') return;
  slider.dataset.bound = '1';
  slider.addEventListener('input', e => {
    setDetailLevel(Number(e.target.value));
  });
}

// Tap a lit legend tier to HIDE it; tap a hidden tier to bring it back. Empty
// tiers (e.g. Text Quest today) are inert. Subtractive: default all shown.
function toggleTier(tier) {
  if (!tierCounts[tier]) return;
  const hiding = !hiddenTiers.has(tier);
  if (hiding) {
    hiddenTiers.add(tier);
  } else {
    hiddenTiers.delete(tier);
    ensureSitesLayerOn();   // bringing a tier back is meaningless with sites off
  }
  showLegendToast(tier);    // explain the tier on either action
  syncFilterUI();
  refreshVisibleMarkers();
}

// ── LEGEND EXPLANATIONS ──────────────────────────────────
// A toast on tap (in-the-moment context) + a "?" modal (the full key, anytime).

let _toastTimer = null;

function hideLegendToast() {
  const el = document.getElementById('legend-toast');
  if (el) el.classList.remove('show');
  clearTimeout(_toastTimer);
}

function showLegendToast(tier) {
  const info = TIER_INFO[tier];
  const el   = document.getElementById('legend-toast');
  if (!info || !el) return;
  document.getElementById('legend-toast-title').textContent = `${info.label} · ${tierCounts[tier]}`;
  document.getElementById('legend-toast-body').textContent  = info.blurb;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 4800);
}

// Build + open the "?" explainer. Lists only tiers that have sites, with the
// matching shape swatch so the colorblind shape key is reinforced here too.
// Mobile: collapse/expand the quest legend behind the FAB (desktop ignores
// this — the legend is always shown there). Tap-away closes it.
function toggleLegend() {
  dismissMobileGuide(true);
  const lg = document.getElementById('quest-legend');
  if (!lg) return;
  const open = lg.classList.toggle('mobile-open');
  const fab = document.getElementById('legend-fab');
  if (fab) fab.setAttribute('aria-expanded', open ? 'true' : 'false');
}
document.addEventListener('click', (e) => {
  const lg = document.getElementById('quest-legend');
  if (!lg || !lg.classList.contains('mobile-open')) return;
  // Stay open when tapping inside the legend (filtering), the legacy FAB, or the
  // dock Key button (its own handler toggles the panel).
  if (lg.contains(e.target) ||
      (e.target.closest && (e.target.closest('#legend-fab') || e.target.closest('#dock-key')))) return;
  lg.classList.remove('mobile-open');
  document.body.classList.remove('dock-key-open');
  const fab = document.getElementById('legend-fab');
  if (fab) fab.setAttribute('aria-expanded', 'false');
  if (typeof syncDockButtons === 'function') syncDockButtons();
}, true);

function openLegendInfo() {
  const list = document.getElementById('legend-info-list');
  if (!list) return;
  const shapeClass = { location: 'diamond', text: 'triangle' };
  list.innerHTML = ['documented', 'photo', 'location', 'text']
    .filter(t => tierCounts[t])
    .map(t => {
      const info = TIER_INFO[t];
      const cls  = shapeClass[t] || '';
      return `<div class="li-row">
                <div class="li-dot ${cls}" style="background:${info.color}"></div>
                <div class="li-text">
                  <div class="li-title">${info.label}<span class="li-count">${tierCounts[t]}</span></div>
                  <div class="li-blurb">${info.blurb}</div>
                </div>
              </div>`;
    }).join('');
  document.getElementById('legend-info').classList.add('open');
}

function closeLegendInfo() {
  document.getElementById('legend-info').classList.remove('open');
}

// Stamp each legend row with its tier count. Tiers with no sites (Text Quest
// today) are hidden entirely — a dead, do-nothing row just confuses. The row
// reappears automatically once data for that tier exists.
function decorateLegend() {
  document.querySelectorAll('#quest-legend .legend-row[data-tier]').forEach(row => {
    const n = tierCounts[row.dataset.tier] || 0;
    row.style.display = n === 0 ? 'none' : '';
    if (n === 0) return;
    let badge = row.querySelector('.legend-count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'legend-count';
      row.appendChild(badge);
    }
    badge.textContent = n;
  });
}

// DARE only becomes legible around z7; at the z5 landing its shrunk atlas
// plate is pure label noise, while the sepia terrain fallback underneath is
// clean and beautiful. Fade DARE in as you zoom so the ancient world resolves
// the deeper you go — turning zoom into a reveal.
//
// Deep-zoom reveal. The atlas/street layers carry normal zoom, but they run out
// of real detail: DARE has tiles only to z11 (an upscaled blur beyond), and the
// CARTO basemaps are minimal street maps with almost no terrain. So as you zoom
// in, fade them out and let the satellite pane beneath show through — a fuzzy
// deep zoom becomes sharp aerial ground. Roads + site markers stay on top.

// DARE: sharp through z11, blurry past it. Reveal in low, fade fully out by z12
// once the satellite starts taking over on top so its upscaled mush never shows.
function ancientOpacityForZoom(z) {
  if (z <= 5)  return 0;          // landing: clean terrain, atlas plate is noise
  if (z < 7)   return 0.5;        // resolving in
  if (z <= 11) return 1;          // full Roman atlas — DARE is sharp through z11
  return 0;                       // z12+: satellite fades in on top, drop the mush
}

// Satellite reveal. Fades IN on its own pane (above the basemaps) as you zoom:
// nothing at atlas/street zoom, blending in through the teens, pure aerial by
// z14. The street basemap below stays full — so this is a clean dissolve TO
// imagery, never a fade to nothing.
function satOpacityForZoom(z) {
  if (z <= 10) return 0;          // atlas / street era — no aerial yet
  if (z >= 14) return 1;          // pure aerial ground
  return (z - 10) / 4;            // z11→.25, z12→.5, z13→.75
}

function updateBasemaps() {
  const z = map.getZoom();
  // Satellite tiles are heavy — only mount the layer once it's about to be
  // revealed (z11+), and drop it when zoomed back out.
  const sat = satOpacityForZoom(z);
  if (sat > 0) {
    if (!map.hasLayer(satelliteLayer)) map.addLayer(satelliteLayer);
    satelliteLayer.setOpacity(sat);
  } else {
    if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
  }

  // Street basemap is the always-on floor (opacity 1). The ancient atlas rides
  // above it and fades out by z12; the satellite covers both as it ramps in.
  if (currentEra === 'ancient') {
    ancientLayer.setOpacity(ancientOpacityForZoom(z));
    ancientFallbackLayer.setOpacity(1);
    ancientStamenLayer.setOpacity(1);
    if (ancientFallbackLabels) ancientFallbackLabels.setOpacity(1);
  } else {
    modernLayer.setOpacity(1);
  }
}

// Visible build stamp in the attribution line (bottom-right). Derived from
// app.js's own ?v= token so it always matches the deployed asset version —
// glance at it to know whether a browser is serving fresh code or a stale
// cache. GitHub Pages won't let us send cache-control headers, so an on-screen
// version is the most reliable "am I current?" check there is.
const BUILD = (document.querySelector('script[src*="app.js"]')
  ?.getAttribute('src')?.match(/v=(\d+)/) || [])[1] || '?';
// The version is wrapped in a bold span whose inline `!important` styles beat
// the faint 9px attribution defaults in style.css, so "VIA v52" is actually
// readable in the corner while the licence credits stay subtle.
map.attributionControl.setPrefix(
  '<b style="color:rgba(240,230,211,0.92)!important;font-size:11px!important;letter-spacing:.4px">VIA '
  + (BUILD !== '?' ? 'v' + BUILD : 'dev') + '</b>'
  + ' · <a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>'
);

const buildBadge = document.getElementById('build-badge');
if (buildBadge) buildBadge.textContent = `VIA ${BUILD !== '?' ? 'v' + BUILD : 'dev'}`;

// Mobile attribution. The on-map credit (Itiner-e CC BY 4.0 + OSM/CARTO/Leaflet)
// has nowhere uncrowded to live on a phone, so on mobile (CSS hides the native
// control) it collapses behind a one-tap "ⓘ" by the Key FAB. The popover reads
// the live attribution control's HTML, so it always shows the exact same credit
// — including Itiner-e, which is added only after the roads dataset loads.
(function setupMobileAttribution() {
  const toggle = document.createElement('button');
  toggle.id = 'attrib-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Map data sources and credits');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = 'ⓘ';
  const pop = document.createElement('div');
  pop.id = 'attrib-popover';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Map data sources');
  document.body.appendChild(pop);
  document.body.appendChild(toggle);

  const closePop = () => { pop.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };
  const openPop = () => {
    const src = map.attributionControl && map.attributionControl.getContainer();
    pop.innerHTML =
      '<div style="font-family:Cinzel,serif;font-size:9px;letter-spacing:1.4px;'
      + 'text-transform:uppercase;color:rgba(212,168,83,0.7);margin-bottom:6px">Sources</div>'
      + (src ? src.innerHTML : '');
    pop.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
  };
  toggle.addEventListener('click', () => {
    pop.classList.contains('open') ? closePop() : openPop();
  });
  const dismiss = e => { if (!pop.contains(e.target) && !toggle.contains(e.target)) closePop(); };
  document.addEventListener('click', dismiss, true);
  document.addEventListener('touchstart', dismiss, { capture: true, passive: true });
  map.on('movestart', closePop);
})();

map.on('zoomend', () => {
  updateBasemaps();
  // Marker visibility is governed by the DETAIL slider, not zoom, and
  // markercluster re-clusters by itself — so there's nothing to recompute
  // here beyond the zoom-staged basemap opacity + satellite reveal…
  if (coverageWanted()) ensureCoverageLoaded();  // deep zoom auto-reveals coverage (Phase C)
  renderCoverageDots();   // …except the coverage dots, which are viewport-culled + zoom-gated
  if (typeof syncDetailUI === 'function') syncDetailUI();   // refresh the "zoom in" hint
});
// Coverage dots are culled to the viewport, so re-render after a pan too (only
// does work when the "Documented" level is active — otherwise an instant no-op).
map.on('moveend', () => { renderCoverageDots(); });

// Prime at boot (zoom 5, ancient era): sepia landing + curated sites only.
updateBasemaps();
decorateLegend();
decorateRoadsLegend();
syncFilterUI();
syncRoadsFilterUI();
refreshVisibleMarkers();
bindDetailSlider();
syncDetailUI();
bindSiteSearch();
bindDock();

// Keyboard activation for the legend filter rows (they're role="button"). Site
// tier rows carry data-tier; roads certainty rows carry data-cert.
const _legendEl = document.getElementById('quest-legend');
if (_legendEl) {
  _legendEl.addEventListener('keydown', e => {
    const ds = e.target && e.target.dataset ? e.target.dataset : null;
    if (!ds || (e.key !== 'Enter' && e.key !== ' ')) return;
    if (ds.tier)       { e.preventDefault(); toggleTier(ds.tier); }
    else if (ds.cert)  { e.preventDefault(); toggleCert(ds.cert); }
    else if (ds.layer) { e.preventDefault(); toggleLayer(ds.layer); }
  });
}

// ── Welcome modal ──
// First-time arrivals land cold; this is the one-screen "what is this." Shown
// once (gated on localStorage), reopenable any time by tapping the brand.
function openWelcome() {
  const el = document.getElementById('welcome-modal');
  if (el) el.classList.add('open');
}
function closeWelcome() {
  const el = document.getElementById('welcome-modal');
  if (el) el.classList.remove('open');
  try { localStorage.setItem('via.welcomed', '1'); } catch (e) {}
  showMobileGuide();
}

function mobileGuideDismissed() {
  try { return localStorage.getItem('via.mobileGuideDismissed') === '1'; }
  catch (e) { return true; }
}

function showMobileGuide() {
  const el = document.getElementById('mobile-guide');
  if (!el || window.innerWidth > 640 || mobileGuideDismissed()) return;
  if (document.getElementById('welcome-modal')?.classList.contains('open')) return;
  if (document.getElementById('info-panel')?.classList.contains('open')) return;
  el.classList.remove('hidden');
}

function dismissMobileGuide(persist) {
  const el = document.getElementById('mobile-guide');
  if (el) el.classList.add('hidden');
  if (persist) {
    try { localStorage.setItem('via.mobileGuideDismissed', '1'); } catch (e) {}
  }
}

// Auto-show on the very first visit. Skip when a magic-link reload is about to
// auto-open the sign-in modal (?signin=1) so we don't stack two modals at boot.
(function maybeShowWelcome() {
  if (QA) return;                       // deterministic test boot: no modals/guide
  let welcomed = false;
  try { welcomed = localStorage.getItem('via.welcomed') === '1'; } catch (e) {}
  const autoSignin = /[?&]signin=1/.test(location.search);
  if (!welcomed && !autoSignin) openWelcome();
  else showMobileGuide();
})();

// Keyboard activation for the brand (role="button").
const _brandEl = document.getElementById('app-brand');
if (_brandEl) {
  _brandEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWelcome(); }
  });
}

// ── Return from an external link ──
// If we got here via the browser Back gesture after an action button sent the
// tab to Google Maps / Pleiades, saveReturnState() left a breadcrumb. Restore
// the home view and reopen that site's panel so coming back feels seamless —
// you land exactly where you left, not on a cold map. Self-clears so a normal
// reload or fresh visit isn't affected.
(function restoreReturnState() {
  let raw = null;
  try { raw = sessionStorage.getItem('via.return'); } catch (e) {}
  if (!raw) return;
  try { sessionStorage.removeItem('via.return'); } catch (e) {}
  let st;
  try { st = JSON.parse(raw); } catch (e) { return; }
  const site = SITES.find(s => s.id === st.id);
  if (!site) return;
  map.setView([st.lat, st.lng], st.zoom, { animate: false });
  showPanel(site);  // re-pans to the panel framing and recaptures the home view
})();

// ── Deep-link: ?site=<pleiades id> ──
// The share links point here so a shared VIA URL opens the actual place (panel
// + map framing), not a cold map. Runs last so it takes precedence: dismiss the
// generic welcome and frame the site.
(function openSharedSite() {
  let id = null;
  try { id = new URL(location.href).searchParams.get('site'); } catch (e) {}
  if (!id) return;
  const site = SITES.find(s => String(s.pleiades) === String(id));
  if (!site) return;
  const wm = document.getElementById('welcome-modal');
  if (wm) wm.classList.remove('open');           // don't stack over the shared site
  dismissMobileGuide(false);
  map.setView([site.lat, site.lng], Math.max(map.getZoom(), 9), { animate: false });
  showPanel(site);
  try {
    const u = new URL(location.href);
    u.searchParams.delete('site');
    history.replaceState(null, '', u.toString());
  } catch (e) {}
})();

// ── QA drive + assert API (?qa=1) ──
// A small, stable surface for deterministic Playwright journeys: drive the app
// by intent (openSite/setEra/…) and read a flat state snapshot to assert against,
// instead of hunting canvas pixels or synthesising marker taps. Always attached
// (read-only/no side effects until called) but the journeys only rely on it in
// ?qa=1 mode, where the heavy road layer is skipped for headless stability.
window.VIA.qa = QA;
window.VIA.ready = true;                       // journeys wait on this flag
window.VIA.build = BUILD;
window.VIA.openSite = function (key) {
  const s = SITES.find(x => x.id === key || String(x.pleiades) === String(key));
  if (!s) return false;
  focusSite(s);
  return true;
};
window.VIA.searchSites = function (query) {
  // Tag with kind:'site' so the QA path matches production's searchAll() hit shape
  // (searchSites() omits kind). Without it, the kind-strict render/preview branches
  // treat these as non-site and the search-previews-marker journey check fails.
  const results = searchSites(query).map(hit => ({ ...hit, kind: 'site' }));
  const input = document.getElementById('site-search-input');
  if (input) input.value = query;
  renderSearchResults(results, query);
  return results.map(hit => ({
    id: hit.site.id,
    name: hit.site.name,
    modern: hit.site.modern,
    bucket: hit.bucket,
    match: hit.match,
  }));
};
window.VIA.selectSearchResult = function (index) {
  return selectSearchResult(index);
};
window.VIA.firstQuestSite = function (tier) {
  const s = SITES.find(x => x.quest && (!tier || x.quest === tier));
  return s ? { id: s.id, name: s.name, pleiades: s.pleiades, quest: s.quest } : null;
};
window.VIA.closePanel  = function () { closePanel(); };
window.VIA.setEra      = function (e) { setEra(e); };
window.VIA.setDetail   = function (n) { setDetailLevel(n); };       // 0 curated · 1 +quests · 2 all
window.VIA.toggleTier  = function (t) { toggleTier(t); };           // legend tier filter
window.VIA.openLegend  = function () { openLegendInfo(); };
window.VIA.getState    = function () {
  const panel = document.getElementById('info-panel');
  // Markers currently mounted across the cluster groups (clustering-agnostic:
  // markercluster.getLayers() returns members whether or not they're clustered).
  let visibleSiteCount = 0;
  if (typeof siteClusters !== 'undefined') {
    for (const k of TIER_KINDS) if (siteClusters[k]) visibleSiteCount += siteClusters[k].getLayers().length;
  }
  return {
    build: BUILD,
    era: currentEra,
    zoom: map.getZoom(),
    panelOpen: !!(panel && panel.classList.contains('open')),
    panelKind: currentPanelKind,
    panelSite: currentPanelSite ? currentPanelSite.id : null,
    panelName: (document.getElementById('panel-name') || {}).textContent || null,
    questBannerVisible: document.getElementById('panel-quest-banner').classList.contains('visible'),
    detailLevel,
    hiddenTiers: (typeof hiddenTiers !== 'undefined') ? Array.from(hiddenTiers) : [],
    searchOpen: document.getElementById('site-search-results').classList.contains('open'),
    searchQuery: (document.getElementById('site-search-input') || {}).value || '',
    searchResultCount: currentSearchResults.length,
    searchPreviewSite: previewMarker && previewMarker._site ? previewMarker._site.id : null,
    roadHighlight: highlightedRoad ? highlightedRoad.name : null,
    roadHighlightLayers: roadHighlightGroup.getLayers().length,
    // The road mini-banner is a curated-road Leaflet tooltip; detect it in the DOM
    // so the gate can assert it clears on card close (option 2, 3c).
    roadTooltipOpen: !!document.querySelector('.leaflet-tooltip.road-tip'),
    visibleSiteCount,
    siteCount: SITES.length,
  };
};

// QA: replicate a curated-road TAP (opens the road mini-banner tooltip + the
// segment panel), so the banner-clears-on-close behavior is deterministically
// gateable headlessly — the real tap path is touch-only (COARSE_POINTER).
// Pass fromTap=false to simulate the DESKTOP hover/click case (banner opened
// without a tap) — that banner must SURVIVE closePanel (no mid-gesture teardown).
window.VIA.tapRoad = function (name, fromTap) {
  let hit = null;
  roadsGroup.eachLayer(l => {
    if (!hit && l._curatedRoad && l._curatedRoad.name === name && l.openTooltip) hit = l;
  });
  if (!hit) return false;
  roadsGroup.eachLayer(l => { if (l.closeTooltip) l.closeTooltip(); });
  const r = hit._curatedRoad;
  const mid = r.coords[Math.floor(r.coords.length / 2)];
  hit.openTooltip([mid[1], mid[0]]);
  roadBannerFromTap = (fromTap !== false);  // default true; false = desktop sim
  showSegmentPanel({ name: r.name, main: 1, desc: r.desc }, r.coords.map(c => [c[1], c[0]]));
  return true;
};
