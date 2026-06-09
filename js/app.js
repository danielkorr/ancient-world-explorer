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
  photo:    { color:'#e07a3a', icon:'📷', label:'Photo Quest',    text:'No portrait photo exists in the scholarly record. Be the first.' },
  location: { color:'#c94040', icon:'📍', label:'Location Quest', text:'Coordinates are unverified in Pleiades. Field confirmation needed.' },
  text:     { color:'#9b6fcf', icon:'📜', label:'Text Quest',     text:'Known only from ancient texts. Physical site not yet confirmed.' },
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

// Sepia-toned modern basemap used as a fallback when DARE tiles fail.
// CSS class `ancient-fallback` applies the sepia filter (see style.css).
const ancientFallbackLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  {
    maxZoom: 18,
    className: 'ancient-fallback',
    attribution: 'Ancient tiles offline — © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
  }
);

const modernLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  { maxZoom:19, attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>' }
);

const map = L.map('map', {
  center: [38.5, 17.0],
  zoom: 5,
  zoomControl: false,
  layers: [ancientLayer],
});

let currentEra = 'ancient';

// ── DARE FALLBACK ────────────────────────────────────────
// dh.gu.se is a single-origin university server with no CDN. If a handful
// of tiles fail within a short window, swap to the sepia fallback so the
// ancient view still renders something map-shaped.

let dareErrors = 0;
let dareFallbackActive = false;
const DARE_ERROR_THRESHOLD = 4;

ancientLayer.on('tileerror', () => {
  if (dareFallbackActive) return;
  dareErrors++;
  if (dareErrors >= DARE_ERROR_THRESHOLD) activateDareFallback();
});

ancientLayer.on('tileload', () => {
  // Successful loads decay the error count so a transient blip doesn't trip us.
  if (dareErrors > 0) dareErrors--;
});

function activateDareFallback() {
  dareFallbackActive = true;
  if (currentEra === 'ancient') {
    map.removeLayer(ancientLayer);
    map.addLayer(ancientFallbackLayer);
    roadsGroup.bringToFront();
    sitesGroup.bringToFront();
  }
  const banner = document.getElementById('dare-fallback-banner');
  if (banner) banner.classList.add('visible');
}

// ── ROADS ────────────────────────────────────────────────

const roadsGroup = L.layerGroup().addTo(map);

ROADS.forEach(road => {
  const latlngs = road.coords.map(c => [c[1], c[0]]);
  L.polyline(latlngs, { color:'#c9a45a', weight:1.8, opacity:0.58 })
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
    banner.style.background     = `${quest.color}12`;
    banner.style.borderColor    = `${quest.color}33`;
    document.getElementById('quest-banner-icon').textContent  = quest.icon;
    document.getElementById('quest-banner-title').textContent = quest.label;
    document.getElementById('quest-banner-text').textContent  = quest.text;
    document.getElementById('quest-banner-title').style.color = quest.color;
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
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

  const ancient = dareFallbackActive ? ancientFallbackLayer : ancientLayer;
  if (era === 'ancient') {
    map.removeLayer(modernLayer);
    map.addLayer(ancient);
  } else {
    map.removeLayer(ancient);
    map.addLayer(modernLayer);
  }
  roadsGroup.bringToFront();
  sitesGroup.bringToFront();
}

// ── LAYER TOGGLES ────────────────────────────────────────

const layerState = { roads:true, sites:true };

function toggleLayer(which) {
  layerState[which] = !layerState[which];
  const group = which === 'roads' ? roadsGroup : sitesGroup;
  const btn   = document.getElementById('btn-' + which);
  if (layerState[which]) { map.addLayer(group);    btn.classList.add('active');    }
  else                   { map.removeLayer(group); btn.classList.remove('active'); }
}

// ── KEYBOARD ─────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeAuthModal(); closePanel(); }
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

function openAuthModal() {
  // On mobile the bottom-sheet panel + the modal would otherwise stack
  // visibly. Close the panel first so the modal owns the viewport.
  if (window.innerWidth <= 640 && document.getElementById('info-panel').classList.contains('open')) {
    closePanel();
  }
  const modal = document.getElementById('auth-modal');
  const user  = VIA.auth.currentUser();
  if (user) {
    modal.classList.add('signed-in');
    document.getElementById('auth-user-name').textContent = user.name;
    const n = VIA.auth.getUserCheckins().length;
    document.getElementById('auth-checkin-count').textContent = `${n} ${n === 1 ? 'site' : 'sites'} visited`;
  } else {
    modal.classList.remove('signed-in');
    setTimeout(() => document.getElementById('auth-name-input').focus(), 60);
  }
  modal.classList.add('open');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
}

function submitSignIn() {
  const name = document.getElementById('auth-name-input').value;
  try { VIA.auth.signIn(name); } catch { return; }
  closeAuthModal();
}

function signOutAndClose() {
  VIA.auth.signOut();
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

VIA.auth.onChange(() => {
  refreshProfilePill();
  refreshCheckinRow();
  refreshAllMarkers();
});

refreshProfilePill();
