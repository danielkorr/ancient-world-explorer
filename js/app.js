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

// Sepia-toned modern basemap that sits permanently underneath DARE in
// ancient mode. Where DARE has coverage (Roman world), its tiles render
// on top. Where DARE 404s (panning outside the empire, or a temporary
// server hiccup), the sepia fallback shows through naturally — no mode
// swap, no banner, no permanent confusion. CSS class `ancient-fallback`
// applies the sepia filter (see style.css).
const ancientFallbackLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  {
    maxZoom: 18,
    className: 'ancient-fallback',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
  }
);

const modernLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  { maxZoom:19, attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>' }
);

// Boot with the fallback below + DARE on top. Leaflet stacks tile layers
// in the order they're added, so fallback-first keeps DARE visually on top.
const map = L.map('map', {
  center: [38.5, 17.0],
  zoom: 5,
  zoomControl: false,
  layers: [ancientFallbackLayer, ancientLayer],

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

let currentEra = 'ancient';

// L.LayerGroup has no bringToFront. Re-add each group in stacking order
// (bottom to top) to put them above any tile layer just inserted under
// them. Itiner-e baseline first, named roads next, sites on top.
function raiseOverlays() {
  if (typeof itinereRoadsGroup !== 'undefined' && map.hasLayer(itinereRoadsGroup)) {
    map.removeLayer(itinereRoadsGroup); map.addLayer(itinereRoadsGroup);
  }
  if (map.hasLayer(roadsGroup)) { map.removeLayer(roadsGroup); map.addLayer(roadsGroup); }
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

if (typeof ROADS_ITINERE !== 'undefined') {
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
function findNearestItinere(latlng, cp) {
  if (!map.hasLayer(itinereRoadsGroup)) return null;
  const THRESH = 14;
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
const ROAD_CASING_WEIGHT = 6;
const ROAD_FILL_COLOR    = '#ffd66b';     // bright saffron — high luminance vs casing
const ROAD_FILL_WEIGHT   = 3;

ROADS.forEach(road => {
  const latlngs = road.coords.map(c => [c[1], c[0]]);
  // Casing first, then fill on top — same coords, different stroke weight.
  L.polyline(latlngs, {
    color: ROAD_CASING_COLOR,
    weight: ROAD_CASING_WEIGHT,
    opacity: 0.85,
    lineCap: 'round',
    lineJoin: 'round',
    interactive: false,
  }).addTo(roadsGroup);
  L.polyline(latlngs, {
    color: ROAD_FILL_COLOR,
    weight: ROAD_FILL_WEIGHT,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
    interactive: false,          // purely the visible stroke; the hit-line below handles taps
  }).addTo(roadsGroup);
  // Invisible fat hit-line. A 3px road is nearly impossible to land a finger on,
  // and the name tooltip used to be hover-only (no hover exists on touch — that's
  // why road names vanished on mobile). This wide transparent stroke makes the road
  // tappable, and `click` opens the name on a phone while hover still works on desktop.
  const hit = L.polyline(latlngs, {
    color: '#000', weight: 22, opacity: 0, lineCap: 'round', lineJoin: 'round',
  })
   .bindTooltip(
     `<b style="color:#d4a853">${road.name}</b><br>${road.desc}<br><span style="opacity:.55">Est. ${road.built}</span>`,
     { className:'road-tip', sticky:true }
   )
   .on('click', function (e) { this.openTooltip(e.latlng); });
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
// 18px of padding around a 9px dot = a 45px tap target (50px on the 14px quests),
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
  const sz     = hovered ? 18 : (quest ? 14 : 9);
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
               <div style="${dotStyle}"></div>
               ${ring}
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
    spiderfyOnMaxZoom: true,          // fan out the last few coincident sites
    showCoverageOnHover: false,       // no hover on touch; avoids stray polygons
    zoomToBoundsOnClick: true,        // desktop: tap a cluster -> zoom to members
    chunkedLoading: true,             // don't stall the main thread on the dense set
    spiderfyDistanceMultiplier: 1.6,  // wider fan for fat-finger taps
    iconCreateFunction: cluster => L.divIcon({
      html: `<div class="via-cluster via-cluster--${kind}">${cluster.getChildCount()}</div>`,
      className: 'via-cluster-wrap',
      iconSize: L.point(44, 44),      // 44px floor = mobile touch target
    }),
  };
}
const siteClusters = {};
TIER_KINDS.forEach(k => { siteClusters[k] = L.markerClusterGroup(clusterOpts(k)); map.addLayer(siteClusters[k]); });

// Master marker lists. allMarkers = every marker (icon-refresh, touch lookup);
// markersByTier = the source-of-truth per category so filters are pure
// add/remove into the clusters, never a rebuild-from-scratch.
const markersByTier = { documented: [], photo: [], location: [], text: [] };
const allMarkers    = [];

let   activeMarker = null;

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
    if (activeMarker) {
      activeMarker.setIcon(makeIcon(activeMarker._site, false));
      activeMarker.setZIndexOffset(activeMarker._site.quest ? 500 : 0);
    }
    activeMarker = this;
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

// iOS Safari does NOT synthesize a `click` from a tap on a Leaflet divIcon — the
// ?debug=1 overlay confirmed `touchstart on [DIV]` with no click ever firing, so
// marker.on('click') (which Leaflet drives off the synthesized click) never runs.
// Handle the tap ourselves: a delegated touchend on the marker pane, matched back
// to its marker, opens the panel directly. Touch-only (COARSE_POINTER) so desktop
// click is untouched; preventDefault suppresses any late synthesized click so we
// never double-fire.
if (COARSE_POINTER) {
  const markerPane = map.getPane('markerPane');
  let _tStart = null;
  markerPane.addEventListener('touchstart', e => {
    const t = e.changedTouches && e.changedTouches[0];
    _tStart = t ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  markerPane.addEventListener('touchend', e => {
    const t = e.changedTouches && e.changedTouches[0];
    // Ignore drags — only a near-stationary touch counts as a tap.
    if (_tStart && t && (Math.abs(t.clientX - _tStart.x) > 12 || Math.abs(t.clientY - _tStart.y) > 12)) return;
    const iconEl = e.target.closest && e.target.closest('.leaflet-marker-icon');
    if (!iconEl) return;
    // A cluster bubble: drill in toward it. markercluster's zoomToBoundsOnClick
    // relies on a click iOS never synthesizes, so we zoom ourselves — repeated
    // taps split the cluster and eventually spiderfy the last coincident sites.
    if (iconEl.querySelector && iconEl.querySelector('.via-cluster')) {
      e.preventDefault();
      let ll; try { ll = map.mouseEventToLatLng(t); } catch (_) {}
      if (ll) map.setView(ll, Math.min(map.getZoom() + 2, map.getMaxZoom()), { animate: true });
      return;
    }
    // An individual marker (rendered un-clustered): open its panel. Markers live
    // in cluster groups now, so match against the master list, not a single group.
    let hit = null;
    for (const m of allMarkers) { if (m._icon === iconEl) { hit = m; break; } }
    if (!hit) return;
    e.preventDefault();   // suppress any late synthesized click → no double-open
    if (activeMarker && activeMarker !== hit) {
      activeMarker.setIcon(makeIcon(activeMarker._site, false));
      activeMarker.setZIndexOffset(activeMarker._site.quest ? 500 : 0);
    }
    activeMarker = hit;
    showPanel(hit._site);
  }, { passive: false });
}

// Roads hit the same iOS wall (SVG paths, ~1 tap in 10). Delegate touchend on the
// overlay pane, match the tapped <path> to its road layer, open the name tooltip.
if (COARSE_POINTER) {
  const overlayPane = map.getPane('overlayPane');
  let _rStart = null;
  overlayPane.addEventListener('touchstart', e => {
    const t = e.changedTouches && e.changedTouches[0];
    _rStart = t ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  overlayPane.addEventListener('touchend', e => {
    const t = e.changedTouches && e.changedTouches[0];
    if (_rStart && t && (Math.abs(t.clientX - _rStart.x) > 12 || Math.abs(t.clientY - _rStart.y) > 12)) return;
    const pathEl = e.target.closest && e.target.closest('path');
    if (!pathEl) return;
    let road = null;
    roadsGroup.eachLayer(l => { if (l._path === pathEl && l.getTooltip && l.getTooltip()) road = l; });
    if (!road) return;
    e.preventDefault();
    roadsGroup.eachLayer(l => { if (l.closeTooltip) l.closeTooltip(); });  // one at a time
    let ll; try { ll = map.mouseEventToLatLng(t); } catch (_) {}
    road.openTooltip(ll);
    // Parity with desktop: a road tap must ALSO open the segment sidebar. On
    // desktop the map-level 'click' drives showSegmentPanel, but the
    // preventDefault above suppresses the synthesized click on iOS — so the
    // panel never opened on mobile (curated-road taps only). Resolve the
    // nearest Itiner-e segment ourselves and open it here.
    if (ll) {
      const seg = findNearestItinere(ll, map.latLngToContainerPoint(ll));
      if (seg) {
        showSegmentPanel(seg.meta, seg.ll);
      } else if (road._curatedRoad) {
        // No Itiner-e segment under the tap — open a panel from the curated
        // road's own rich copy so the named roads (Via Appia etc.) always work.
        const r = road._curatedRoad;
        // [lat,lng] arrays — the shape nearestSitesToSegment/kmPointToPolyline
        // index by [0]/[1] (NOT Leaflet LatLng objects from getLatLngs()).
        const rll = r.coords.map(c => [c[1], c[0]]);
        showSegmentPanel({ name: r.name, main: 1, desc: r.desc }, rll);
      }
    }
  }, { passive: false });
}

// ── INFO PANEL ───────────────────────────────────────────

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
  document.getElementById('panel-modern-name').textContent = site.modern;
  document.getElementById('panel-period').innerHTML        = `<span style="font-size:13px">⏳</span>&nbsp;${site.period}`;
  document.getElementById('panel-desc').textContent        = site.desc;

  // ORBIS card — live values from the Stanford ORBIS network.
  // Direct Pleiades match wins; else nearest ORBIS node within 75km;
  // else fall back to the curated hardcoded estimate on the site.
  const orbisCard = document.getElementById('orbis-card');
  const orbis = orbisLookup(site);
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
      <div><div class="p-btn-main">Pleiades Gazetteer</div><div class="p-btn-sub">Academic record · sources · cross-references</div></div>
      <span class="p-btn-ext" aria-hidden="true">↗</span>
    </a>${viciBtn}
  `;

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
  // Glide back to the view you came from, undoing the offset pan that opening
  // the panel applied. Without this you're left stranded wherever the last
  // marker tap dragged the map.
  if (panelReturnView) {
    map.flyTo(panelReturnView.center, panelReturnView.zoom, { duration: 0.4 });
    panelReturnView = null;
  }
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

  // Single external action: the Itiner-e atlas (opens a new tab — no per-segment
  // state to restore, unlike the same-tab site links).
  document.getElementById('panel-actions').innerHTML = `
    <a href="https://itiner-e.org" target="_blank" rel="noopener" class="p-btn p-btn-gold">
      <span class="p-btn-icon">🗺️</span>
      <div><div class="p-btn-main">Itiner-e Atlas</div><div class="p-btn-sub">Scholarly Roman road dataset · CC BY 4.0</div></div>
      <span class="p-btn-ext" aria-hidden="true">↗</span>
    </a>`;

  const panel = document.getElementById('info-panel');
  panel.classList.add('segment-panel');
  if (!panel.classList.contains('open')) {
    panelReturnView = { center: map.getCenter(), zoom: map.getZoom() };
  }
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
  const seg = findNearestItinere(e.latlng, e.containerPoint);
  if (seg) { showSegmentPanel(seg.meta, seg.ll); return; }
  if (document.getElementById('info-panel').classList.contains('open')) closePanel();
});

// ── ERA TOGGLE ───────────────────────────────────────────

function setEra(era) {
  if (era === currentEra) return;
  currentEra = era;
  document.getElementById('btn-ancient').classList.toggle('active', era === 'ancient');
  document.getElementById('btn-modern').classList.toggle('active',  era === 'modern');

  if (era === 'ancient') {
    if (map.hasLayer(modernLayer)) map.removeLayer(modernLayer);
    if (!map.hasLayer(ancientFallbackLayer)) map.addLayer(ancientFallbackLayer);
    if (!map.hasLayer(ancientLayer))         map.addLayer(ancientLayer);
  } else {
    if (map.hasLayer(ancientLayer))         map.removeLayer(ancientLayer);
    if (map.hasLayer(ancientFallbackLayer)) map.removeLayer(ancientFallbackLayer);
    if (!map.hasLayer(modernLayer))         map.addLayer(modernLayer);
  }
  updateBasemaps();  // re-apply zoom-staged opacity + satellite reveal for the new era
  raiseOverlays();
}

// ── LAYER TOGGLES ────────────────────────────────────────

const layerState = { roads:true, sites:true };

function toggleLayer(which) {
  dismissMobileGuide(true);
  layerState[which] = !layerState[which];
  const btn = document.getElementById('btn-' + which);
  btn.classList.toggle('active', layerState[which]);
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
    // Sites & Cities is the MASTER layer switch, conceptually above the quest
    // filter. Operating it clears any active tier filter so the toggle always
    // means the full sites layer. Without this, a leftover Quests/legend filter
    // makes "Sites & Cities" show only quest cities every time, and the result
    // depended on whatever state the Quests button was left in (user-reported,
    // on both mobile and desktop).
    activeTiers.clear();
    syncFilterUI();   // un-light the Quests button + legend rows to match
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

async function shareQuest() {
  if (!currentPanelSite) return;
  const q    = QUEST[currentPanelSite.quest] || QUEST.photo;
  const site = currentPanelSite;
  const url  = `https://pleiades.stoa.org/places/${site.pleiades}`;
  const text = `${q.label.replace(' · Open','')}: ${site.name} (${site.modern || 'ancient world'}). ${q.text} ${url} #VIAquest`;

  if (navigator.share) {
    try { await navigator.share({ title: `${site.name} — VIA quest`, text, url }); return; }
    catch { /* fall through to clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('quest-share-btn');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied — paste into a tweet';
    setTimeout(() => { btn.textContent = orig; }, 2400);
  } catch {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
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
  const text = `${certLabel} Roman road: ${name}. Help verify this stretch of the ancient road network. https://itiner-e.org #VIAquest`;

  if (navigator.share) {
    try { await navigator.share({ title: `${name} — VIA road quest`, text, url: 'https://itiner-e.org' }); return; }
    catch { /* fall through to clipboard */ }
  }
  const btn = document.getElementById('quest-banner-cta');
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied — paste into a tweet';
      setTimeout(() => { btn.textContent = orig; }, 2400);
    }
  } catch {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  }
}

// Marker visibility is governed by two things: zoom-staged disclosure when no
// filter is active, and an explicit tier filter when the user taps legend rows.
// A single Set of active tiers drives the legend, so the filter state stays
// consistent even as the map detail slider changes the visible zoom stage.
// (allMarkers + markersByTier are populated in the marker build loop above.)

const QUEST_TIERS  = ['photo', 'location', 'text'];
const activeTiers  = new Set();              // empty = no filter (zoom disclosure)
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
//   0 Curated      — the ~95 hand-written cities (clean landing, the default).
//   1 Quest detail — curated + every quest (the actionable game layer).
//   2 Full detail  — the entire Pleiades set.
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
  const filtering = activeTiers.size > 0;
  TIER_KINDS.forEach(tier => {
    // An explicit tier filter shows EVERY site of that tier (intent to see all);
    // other tiers are dropped. With no filter, the detail level governs which
    // sites populate the clusters. Bulk addLayers keeps chunkedLoading happy.
    if (filtering && !activeTiers.has(tier)) return;
    const subset = filtering
      ? markersByTier[tier]
      : markersByTier[tier].filter(m => siteVisibleAtLevel(m._site, detailLevel));
    if (subset.length) siteClusters[tier].addLayers(subset);
  });
}

// Reflect the active tier set onto the legend rows (and dim the rest).
function syncFilterUI() {
  const legend = document.getElementById('quest-legend');
  if (legend) {
    legend.classList.toggle('filtering', activeTiers.size > 0);
    legend.querySelectorAll('.legend-row[data-tier]').forEach(row => {
      row.classList.toggle('active', activeTiers.has(row.dataset.tier));
    });
  }
}

const DETAIL_LABELS = ['Curated', 'Quest detail', 'Full detail'];

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
  slider.setAttribute('aria-valuetext', `${stats.label}, ${stats.questCount.toLocaleString()} quests visible`);
  readout.textContent = `${stats.label} · ${stats.questCount.toLocaleString()} quests`;
}

// The slider sets WHAT is shown (curated / +quests / all), not the zoom.
// Clustering handles density, so this is a pure content filter into the groups.
function setDetailLevel(level) {
  detailLevel = Math.max(0, Math.min(DETAIL_LABELS.length - 1, level));
  if (detailLevel > 0) ensureSitesLayerOn();   // revealing more turns sites on
  refreshVisibleMarkers();
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

// Tap a legend tier to toggle it in/out of the filter. Empty tiers are inert.
function toggleTier(tier) {
  if (!tierCounts[tier]) return;
  const adding = !activeTiers.has(tier);
  if (adding) activeTiers.add(tier);
  else        activeTiers.delete(tier);
  if (activeTiers.size > 0) ensureSitesLayerOn();
  if (adding) showLegendToast(tier);   // explain the tier the moment it's picked
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
  // Stay open when tapping inside the legend (filtering) or the FAB itself.
  if (lg.contains(e.target) || (e.target.closest && e.target.closest('#legend-fab'))) return;
  lg.classList.remove('mobile-open');
  const fab = document.getElementById('legend-fab');
  if (fab) fab.setAttribute('aria-expanded', 'false');
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

map.on('zoomend', () => {
  updateBasemaps();
  // Marker visibility is governed by the DETAIL slider, not zoom, and
  // markercluster re-clusters by itself — so there's nothing to recompute
  // here beyond the zoom-staged basemap opacity + satellite reveal.
});

// Prime at boot (zoom 5, ancient era): sepia landing + curated sites only.
updateBasemaps();
decorateLegend();
decorateRoadsLegend();
syncFilterUI();
syncRoadsFilterUI();
refreshVisibleMarkers();
bindDetailSlider();
syncDetailUI();

// Keyboard activation for the legend filter rows (they're role="button"). Site
// tier rows carry data-tier; roads certainty rows carry data-cert.
const _legendEl = document.getElementById('quest-legend');
if (_legendEl) {
  _legendEl.addEventListener('keydown', e => {
    const ds = e.target && e.target.dataset ? e.target.dataset : null;
    if (!ds || (e.key !== 'Enter' && e.key !== ' ')) return;
    if (ds.tier)      { e.preventDefault(); toggleTier(ds.tier); }
    else if (ds.cert) { e.preventDefault(); toggleCert(ds.cert); }
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
