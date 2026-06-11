// ═══════════════════════════════════════════════════════════
//  VIA — Ancient World Explorer  |  app.js
// ═══════════════════════════════════════════════════════════

// ── TYPE CONFIG ──────────────────────────────────────────

const TYPE = {
  capital: { color:'#d4a853', icon:'⚡' },
  city:    { color:'#e07a5f', icon:'⊕' },
  port:    { color:'#5e9fd4', icon:'⚓' },
  fortress:{ color:'#7bc47b', icon:'⚔' },
};

const QUEST = {
  photo: {
    color: '#e07a3a',
    icon:  '📷',
    label: 'Photo Quest · Open',
    text:  'This place has no portrait photo in the scholarly record. Be the traveler who closes the gap.',
    pitch: 'No one has ever submitted a portrait photograph of this place to humanity’s authoritative atlas of the ancient world. You can change that.',
    cta:   'Take this Quest →',
  },
  location: {
    color: '#c94040',
    icon:  '📍',
    label: 'Location Quest · Open',
    text:  'The coordinates for this place are unverified. A field GPS confirmation would lock it into the record.',
    pitch: 'Pleiades flags this site’s position as approximate. A traveler on the ground with a GPS reading would give scholars certainty.',
    cta:   'Take this Quest →',
  },
  text: {
    color: '#9b6fcf',
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
  { maxZoom:11, attribution:'© <a href="https://dare.ht.lu.se/" target="_blank">Digital Atlas of the Roman Empire</a>' }
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
      color: '#a17840',
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
  })
   .bindTooltip(
     `<b style="color:#d4a853">${road.name}</b><br>${road.desc}<br><span style="opacity:.55">Est. ${road.built}</span>`,
     { className:'road-tip', sticky:true }
   )
   .addTo(roadsGroup);
});

// ── SITE MARKERS ─────────────────────────────────────────

function makeIcon(site, hovered) {
  const quest  = site.quest ? QUEST[site.quest] : null;
  const color  = quest ? quest.color : (TYPE[site.type]?.color || '#d4a853');
  const sz     = hovered ? 15 : (quest ? 11 : 9);
  const border = hovered ? 'rgba(255,255,255,0.9)' : (quest ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)');
  const glow   = hovered
    ? `box-shadow:0 0 14px ${color};`
    : quest
      ? `box-shadow:0 0 8px ${color}99;`
      : `box-shadow:0 0 5px ${color}55;`;

  const ring = quest && !hovered
    ? `<div class="quest-ring" style="color:${color};"></div>`
    : '';

  // Visited badge: green ring around any site this user has checked in to.
  const visited = (typeof VIA !== 'undefined' && VIA.auth && VIA.auth.currentUser())
    ? !!VIA.auth.getCheckin(site)
    : false;
  const visitedBadge = visited
    ? `<div style="position:absolute;inset:-4px;border:1.5px solid #7bc47b;border-radius:50%;box-shadow:0 0 6px rgba(123,196,123,0.55);pointer-events:none;"></div>`
    : '';

  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${sz}px;height:${sz}px;">
             <div style="width:${sz}px;height:${sz}px;background:${color};border:2px solid ${border};border-radius:50%;cursor:pointer;${glow};transition:all .15s;"></div>
             ${ring}
             ${visitedBadge}
           </div>`,
    iconSize:   [sz, sz],
    iconAnchor: [sz/2, sz/2],
  });
}

const sitesGroup   = L.layerGroup().addTo(map);
let   activeMarker = null;

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
    if (activeMarker && activeMarker !== this) {
      activeMarker.setIcon(makeIcon(activeMarker._site, false));
      activeMarker.setZIndexOffset(activeMarker._site.quest ? 500 : 0);
    }
    activeMarker = this;
    showPanel(this._site);
  });

  sitesGroup.addLayer(marker);
});

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
  // The "roads" toggle covers both the curated named roads and the
  // Itiner-e baseline — the user thinks of them as one concept.
  const groups = which === 'roads'
    ? [itinereRoadsGroup, roadsGroup]
    : [sitesGroup];
  const btn = document.getElementById('btn-' + which);
  if (layerState[which]) {
    for (const g of groups) if (g) map.addLayer(g);
    btn.classList.add('active');
  } else {
    for (const g of groups) if (g) map.removeLayer(g);
    btn.classList.remove('active');
  }
}

// ── KEYBOARD ─────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeQuestModal(); closeAuthModal(); closePanel(); }
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

// "Quests Only" map filter — re-renders sitesGroup with quest sites only.
let questsOnly = false;
const allMarkers = [];
sitesGroup.eachLayer(m => allMarkers.push(m));

function toggleQuestsOnly() {
  questsOnly = !questsOnly;
  document.getElementById('btn-quests').classList.toggle('active', questsOnly);
  sitesGroup.clearLayers();
  for (const m of allMarkers) {
    if (!questsOnly || m._site.quest) sitesGroup.addLayer(m);
  }
}

function refreshQuestBadge() {
  const n  = SITES.filter(s => !!s.quest).length;
  const el = document.getElementById('quest-count-badge');
  if (el) el.textContent = n > 99 ? '99+' : String(n);
}
refreshQuestBadge();
