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
});

let currentEra = 'ancient';

// L.LayerGroup has no bringToFront. Re-add each group in stacking order
// (bottom to top) to put them above any tile layer just inserted under
// them. Itiner-e baseline first, named roads next, sites on top.
function raiseOverlays() {
  if (typeof itinereRoadsGroup !== 'undefined' && map.hasLayer(itinereRoadsGroup)) {
    map.removeLayer(itinereRoadsGroup); map.addLayer(itinereRoadsGroup);
  }
  if (map.hasLayer(roadsGroup)) { map.removeLayer(roadsGroup); map.addLayer(roadsGroup); }
  if (map.hasLayer(sitesGroup)) { map.removeLayer(sitesGroup); map.addLayer(sitesGroup); }
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

if (typeof ROADS_ITINERE !== 'undefined') {
  for (const seg of ROADS_ITINERE) {
    // coords are [lng, lat] from the build script; Leaflet wants [lat, lng].
    const latlngs = seg.coords.map(c => [c[1], c[0]]);
    L.polyline(latlngs, {
      renderer: itinereRenderer,
      color: '#8a6a3a',
      weight: 1,
      opacity: 0.42,
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(itinereRoadsGroup);
  }
  // CC BY 4.0 attribution — required by the dataset license.
  map.attributionControl.addAttribution(
    'Roads: <a href="https://itiner-e.org" target="_blank" rel="noopener">Itiner-e</a> (CC BY 4.0)'
  );
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
  L.polyline(latlngs, {
    color: '#000', weight: 22, opacity: 0, lineCap: 'round', lineJoin: 'round',
  })
   .bindTooltip(
     `<b style="color:#d4a853">${road.name}</b><br>${road.desc}<br><span style="opacity:.55">Est. ${road.built}</span>`,
     { className:'road-tip', sticky:true }
   )
   .on('click', function (e) { this.openTooltip(e.latlng); })
   .addTo(roadsGroup);
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

const sitesGroup   = L.layerGroup().addTo(map);
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
    dbg('✓ MARKER click: ' + this._site.name);
    L.DomEvent.stopPropagation(e);
    if (activeMarker && activeMarker !== this) {
      activeMarker.setIcon(makeIcon(activeMarker._site, false));
      activeMarker.setZIndexOffset(activeMarker._site.quest ? 500 : 0);
    }
    activeMarker = this;
    showPanel(this._site);
  });

  sitesGroup.addLayer(marker);
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
    let hit = null;
    sitesGroup.eachLayer(m => { if (m._icon === iconEl) hit = m; });
    if (!hit) return;
    e.preventDefault();   // suppress any late synthesized click → no double-open
    dbg('✓ TAP→panel: ' + hit._site.name);
    if (activeMarker && activeMarker !== hit) {
      activeMarker.setIcon(makeIcon(activeMarker._site, false));
      activeMarker.setZIndexOffset(activeMarker._site.quest ? 500 : 0);
    }
    activeMarker = hit;
    showPanel(hit._site);
  }, { passive: false });
}

// ── INFO PANEL ───────────────────────────────────────────

function showPanel(site) {
  const tc    = TYPE[site.type] || TYPE.city;
  const quest = site.quest ? QUEST[site.quest] : null;
  const color = quest ? quest.color : tc.color;

  // Hero
  document.getElementById('panel-hero').style.background =
    `radial-gradient(ellipse at center, ${color}18 0%, #110a00 70%)`;
  document.getElementById('hero-icon').textContent = tc.icon;
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
  const satUrl = `https://www.google.com/maps/@${site.lat},${site.lng},500m/data=!3m1!1e3`;
  const plUrl  = `https://pleiades.stoa.org/places/${site.pleiades}`;

  document.getElementById('panel-actions').innerHTML = `
    <a href="${gmUrl}" target="_blank" class="p-btn p-btn-maps">
      <span class="p-btn-icon">🗺️</span>
      <div><div class="p-btn-main">Google Maps</div><div class="p-btn-sub">See ${site.name} in the modern world</div></div>
    </a>
    <a href="${satUrl}" target="_blank" class="p-btn p-btn-sat">
      <span class="p-btn-icon">🛰️</span>
      <div><div class="p-btn-main">Satellite View</div><div class="p-btn-sub">Modern aerial — spot the ruins</div></div>
    </a>
    <a href="${plUrl}" target="_blank" class="p-btn p-btn-gold">
      <span class="p-btn-icon">📜</span>
      <div><div class="p-btn-main">Pleiades Gazetteer</div><div class="p-btn-sub">Academic record · sources · cross-references</div></div>
    </a>
  `;

  document.getElementById('info-panel').classList.add('open');
  dbg('showPanel ' + site.name + ' open=' + document.getElementById('info-panel').classList.contains('open'));
  currentPanelSite = site;
  refreshCheckinRow();
  // Offset map pan: right on desktop, up on mobile
  const isMobile = window.innerWidth <= 640;
  map.panTo(
    isMobile ? [site.lat + 0.8, site.lng] : [site.lat, site.lng - 2],
    { animate:true, duration:0.4 }
  );
}

function closePanel() {
  document.getElementById('info-panel').classList.remove('open');
  if (activeMarker) {
    activeMarker.setIcon(makeIcon(activeMarker._site, false));
    activeMarker.setZIndexOffset(activeMarker._site.quest ? 500 : 0);
    activeMarker = null;
  }
  currentPanelSite = null;
}

// Close on map click
map.on('click', () => {
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
    updateAncientLayer();  // re-apply zoom-staged opacity for current zoom
  } else {
    if (map.hasLayer(ancientLayer))         map.removeLayer(ancientLayer);
    if (map.hasLayer(ancientFallbackLayer)) map.removeLayer(ancientFallbackLayer);
    if (!map.hasLayer(modernLayer))         map.addLayer(modernLayer);
  }
  raiseOverlays();
}

// ── LAYER TOGGLES ────────────────────────────────────────

const layerState = { roads:true, sites:true };

function toggleLayer(which) {
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
    // repaint on mobile Safari (the "Quests Only shows nothing from an empty map"
    // bug). Never removing the group sidesteps it: refreshVisibleMarkers shows
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
  sitesGroup.eachLayer(m => m.setIcon(makeIcon(m._site, m === activeMarker)));
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

// Marker visibility is governed by two things: zoom-staged disclosure when no
// filter is active, and an explicit tier filter when the user taps legend rows
// or "Quests Only". A single Set of active tiers drives BOTH the legend and the
// Quests Only button, so the two controls can never disagree — tapping the
// three quest tiers and tapping "Quests Only" land on the same state.
const allMarkers = [];
sitesGroup.eachLayer(m => allMarkers.push(m));

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
// count against. Total matches the 289 shown on the Quests Only badge.
const questSites     = SITES.filter(s => !!s.quest);
const TOTAL_QUESTS   = questSites.length;
const QUEST_PLEIADES = new Set(questSites.map(s => s.pleiades).filter(Boolean));

// Quest tiers that actually have sites — "Quests Only" selects exactly these
// (so the empty Text tier doesn't get spuriously toggled on).
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

// Zoom-staged reveal. The landing (z<=5) shows only the ~95 curated sites +
// nothing else — clean, legible, an empire of great cities rather than 473
// dots of orange measles. z6 adds the quests (the actionable game layer).
// z>=7, where DARE itself becomes readable, reveals the full Pleiades set.
function siteVisibleAtZoom(site, z) {
  if (z >= 7) return true;
  if (z >= 6) return CURATED_SET.has(site) || !!site.quest;
  return CURATED_SET.has(site);
}

function refreshVisibleMarkers() {
  sitesGroup.clearLayers();
  if (!layerState.sites) return;   // sites hidden: the group stays on the map but empty
  const z = map.getZoom();
  const filtering = activeTiers.size > 0;
  for (const m of allMarkers) {
    // An explicit tier filter shows every matching site regardless of zoom —
    // tapping a tier is an intent to see all of them. With no filter, fall
    // back to the zoom-staged reveal.
    if (filtering) {
      if (activeTiers.has(siteTier(m._site))) sitesGroup.addLayer(m);
    } else if (siteVisibleAtZoom(m._site, z)) {
      sitesGroup.addLayer(m);
    }
  }
}

// Reflect the active tier set onto both controls: highlight selected legend
// rows (and dim the rest), and light up Quests Only only when the selection is
// exactly the three quest tiers.
function syncFilterUI() {
  const legend = document.getElementById('quest-legend');
  if (legend) {
    legend.classList.toggle('filtering', activeTiers.size > 0);
    legend.querySelectorAll('.legend-row[data-tier]').forEach(row => {
      row.classList.toggle('active', activeTiers.has(row.dataset.tier));
    });
  }
  const qBtn = document.getElementById('btn-quests');
  if (qBtn) {
    const questsExactly = activeTiers.size === presentQuestTiers.length &&
                          presentQuestTiers.every(t => activeTiers.has(t));
    qBtn.classList.toggle('active', questsExactly);
  }
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

function showQuestsToast() {
  const el = document.getElementById('legend-toast');
  if (!el) return;
  const n = presentQuestTiers.reduce((s, t) => s + tierCounts[t], 0);
  document.getElementById('legend-toast-title').textContent = `All quests · ${n}`;
  document.getElementById('legend-toast-body').textContent  =
    'Places missing a photo or a verified location in the scholarly record. Tap any marker to help.';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 4800);
}

// Build + open the "?" explainer. Lists only tiers that have sites, with the
// matching shape swatch so the colorblind shape key is reinforced here too.
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

// "Quests Only" is a shortcut for "select all three quest tiers". Tapping it
// again from that exact state clears back to the full zoom-staged map. Open to
// everyone — previewing quests is the hook; the sign-in wall is at check-in.
function toggleQuestsOnly() {
  const questsExactly = activeTiers.size === presentQuestTiers.length &&
                        presentQuestTiers.every(t => activeTiers.has(t));
  activeTiers.clear();
  if (!questsExactly) {
    presentQuestTiers.forEach(t => activeTiers.add(t));
    ensureSitesLayerOn();
    showQuestsToast();
  }
  syncFilterUI();
  refreshVisibleMarkers();
}

// DARE only becomes legible around z7; at the z5 landing its shrunk atlas
// plate is pure label noise, while the sepia terrain fallback underneath is
// clean and beautiful. Fade DARE in as you zoom so the ancient world resolves
// the deeper you go — turning zoom into a reveal.
function ancientOpacityForZoom(z) {
  if (z <= 5) return 0;
  if (z >= 7) return 1;
  return 0.5;
}

function updateAncientLayer() {
  if (currentEra !== 'ancient') return;
  ancientLayer.setOpacity(ancientOpacityForZoom(map.getZoom()));
}

map.on('zoomend', () => {
  updateAncientLayer();
  // Zoom only changes the visible set under the disclosure rule; an explicit
  // tier filter already shows all matches, so there's nothing to recompute.
  if (activeTiers.size === 0) refreshVisibleMarkers();
});

// Prime at boot (zoom 5, ancient era): sepia landing + curated sites only.
updateAncientLayer();
decorateLegend();
syncFilterUI();
refreshVisibleMarkers();

// Keyboard activation for the legend filter rows (they're role="button").
const _legendEl = document.getElementById('quest-legend');
if (_legendEl) {
  _legendEl.addEventListener('keydown', e => {
    const tier = e.target && e.target.dataset ? e.target.dataset.tier : null;
    if (tier && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggleTier(tier);
    }
  });
}

function refreshQuestBadge() {
  const n  = SITES.filter(s => !!s.quest).length;
  const el = document.getElementById('quest-count-badge');
  if (el) el.textContent = String(n);  // real count (289) beats a flat "99+"
}
refreshQuestBadge();

// ════════════════════════════════════════════════════════════
//  TEMP TOUCH DIAGNOSTIC — opt-in with ?debug=1 in the URL.
//  Paints a live event log so we can see, on a real phone, exactly
//  where a tap dies. REMOVE once the mobile tap bug is resolved.
// ════════════════════════════════════════════════════════════
var DEBUG_TOUCH = false;
try { DEBUG_TOUCH = new URLSearchParams(location.search).has('debug'); } catch (_) {}
var _dbgEl = null;
function dbg(msg) {
  if (!DEBUG_TOUCH) return;
  try {
    if (!_dbgEl) {
      _dbgEl = document.createElement('div');
      _dbgEl.style.cssText = 'position:fixed;top:54px;left:6px;right:6px;z-index:99999;'
        + 'background:rgba(0,0,0,.85);color:#8f8;font:11px/1.35 monospace;padding:7px 9px;'
        + 'border-radius:6px;max-height:44vh;overflow:auto;pointer-events:none;white-space:pre-wrap;';
      document.body.appendChild(_dbgEl);
    }
    _dbgEl.textContent = msg + '\n' + _dbgEl.textContent;
    if (_dbgEl.textContent.length > 1400) _dbgEl.textContent = _dbgEl.textContent.slice(0, 1400);
  } catch (_) {}
}
if (DEBUG_TOUCH) {
  dbg('READY coarse=' + COARSE_POINTER + ' hitpad=' + HIT_PAD
      + ' maxTouch=' + (navigator.maxTouchPoints || 0)
      + ' ontouchstart=' + ('ontouchstart' in window));
  map.on('movestart', function () { dbg('• map PAN/move'); });
  map.on('click',     function () { dbg('• map CLICK (empty space, missed marker)'); });
  document.addEventListener('touchstart', function (e) {
    var t = e.target;
    var cls = (t && t.getAttribute && t.getAttribute('class')) || (t && t.tagName) || '?';
    dbg('touchstart on [' + cls + ']');
  }, { passive: true, capture: true });
}
