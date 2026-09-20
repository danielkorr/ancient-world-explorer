// ── QUEST FINDER (design options B + C) ────────────────────────────────────
// The problem this solves: tapping a quest tier (or Alexander phase) reports a
// count — "Location Quest · 10" — but zoom-staged disclosure + clustering means
// only a couple of markers are actually on screen at empire zoom, so you can't
// see WHERE the category's sites concentrate or reach all of them.
//
// Two reinforcing answers, both live here:
//   B · Count-beacons — labelled centroid bubbles ("Italy · 6") on an always-on,
//        non-clustered layer, so density reads at any zoom. Tap → fit that region.
//   C · Finder panel — a grouped index of EVERY site in the category (region for
//        Roman tiers, phase for Alexander), tap-to-fly-and-open. The list is the
//        checklist; in Alexander mode it doubles as the itinerary.
//
// Additive by design: one new file + CSS + a script tag. It reads app.js globals
// (SITES, map, focusSite, ALEXANDER_STOPS, …) which share the classic-script
// global lexical scope, and overrides the legend taps via CAPTURE-phase listeners
// so app.js itself is left untouched (keeps merges with Codex clean). Gated on
// ?finder=1 until it earns a permanent home.
(function () {
  'use strict';

  const ENABLED = new URLSearchParams(location.search).has('finder');
  if (!ENABLED) return;

  // ── Region model (Roman) ────────────────────────────────────────────────
  // Nearest-anchor bucketing: every site lands in exactly one region (no gaps,
  // no overlap bugs from hand-drawn boxes). Squared-degree distance is fine at
  // this scale for coarse regional grouping.
  const ROMAN_REGIONS = [
    { key: 'britannia', label: 'Britannia & the North', lat: 52, lng: -1 },
    { key: 'iberia',    label: 'Iberia',                lat: 40, lng: -4 },
    { key: 'gaul',      label: 'Gaul & the Rhine',      lat: 47, lng: 4 },
    { key: 'italy',     label: 'Italy & the Alps',      lat: 42, lng: 13 },
    { key: 'africa',    label: 'North Africa',          lat: 34, lng: 6 },
    { key: 'greece',    label: 'Greece & the Balkans',  lat: 40, lng: 23 },
    { key: 'anatolia',  label: 'Asia Minor',            lat: 39, lng: 33 },
    { key: 'levant',    label: 'Levant & the East',     lat: 34, lng: 38 },
    { key: 'egypt',     label: 'Egypt & the Nile',      lat: 27, lng: 31 },
  ];
  const REGION_ORDER = ROMAN_REGIONS.map(r => r.key);

  function regionOf(lat, lng) {
    let best = ROMAN_REGIONS[0], bestD = Infinity;
    for (const r of ROMAN_REGIONS) {
      const dLat = lat - r.lat, dLng = lng - r.lng;
      const d = dLat * dLat + dLng * dLng;
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  // ── State ────────────────────────────────────────────────────────────────
  let beaconGroup = null;      // Leaflet LayerGroup for count-beacons (B)
  let activeCategory = null;   // { kind:'tier'|'phase', key }
  let groups = [];             // [{ key, label, color, items:[{...}], centroid:[lat,lng] }]

  function ensureBeaconGroup() {
    if (!beaconGroup && typeof map !== 'undefined') {
      beaconGroup = L.layerGroup().addTo(map);
    }
    return beaconGroup;
  }

  // ── Build the category's grouped model ─────────────────────────────────────
  function buildTierModel(tierKey) {
    const tier = s => (s.quest || 'documented');
    const members = (typeof SITES !== 'undefined' ? SITES : []).filter(s => tier(s) === tierKey);
    const byRegion = new Map();
    for (const s of members) {
      const r = regionOf(s.lat, s.lng);
      if (!byRegion.has(r.key)) byRegion.set(r.key, { key: r.key, label: r.label, items: [] });
      byRegion.get(r.key).items.push({
        id: s.id, name: s.name, modern: s.modern, lat: s.lat, lng: s.lng, site: s,
      });
    }
    const info = (typeof TIER_INFO !== 'undefined' && TIER_INFO[tierKey]) || {};
    return {
      label: info.label || tierKey,
      color: info.color || '#b89a6a',
      total: members.length,
      groups: REGION_ORDER
        .filter(k => byRegion.has(k))
        .map(k => finalizeGroup(byRegion.get(k))),
    };
  }

  function buildPhaseModel() {
    // Alexander: list the WHOLE campaign grouped by phase (the itinerary), then
    // auto-scroll to the tapped phase. Stops are already in narrative order.
    const stops = (typeof ALEXANDER_STOPS !== 'undefined') ? ALEXANDER_STOPS : [];
    const order = (typeof ALEX_PHASE_ORDER !== 'undefined')
      ? ALEX_PHASE_ORDER
      : ['macedon', 'anatolia', 'levantEgypt', 'persianCore', 'eastIndia', 'returnDeath'];
    const byPhase = new Map();
    stops.forEach((st, i) => {
      if (!byPhase.has(st.phase)) byPhase.set(st.phase, []);
      byPhase.get(st.phase).push({
        id: st.id, name: st.name, modern: st.modern || st.year_label || '',
        lat: st.lat, lng: st.lng, stop: st, index: i,
      });
    });
    const phases = (typeof ALEXANDER_PHASES !== 'undefined') ? ALEXANDER_PHASES : {};
    return {
      label: "Alexander's Campaign",
      color: '#8f7cc3',
      total: stops.length,
      groups: order.filter(k => byPhase.has(k)).map(k => finalizeGroup({
        key: k,
        label: (phases[k] && phases[k].label) || k,
        color: (phases[k] && phases[k].color) || '#8f7cc3',
        items: byPhase.get(k),
      })),
    };
  }

  function finalizeGroup(g) {
    let sLat = 0, sLng = 0;
    for (const it of g.items) { sLat += it.lat; sLng += it.lng; }
    g.centroid = [sLat / g.items.length, sLng / g.items.length];
    return g;
  }

  // ── B · Count-beacons ──────────────────────────────────────────────────────
  function renderBeacons() {
    const grp = ensureBeaconGroup();
    if (!grp) return;
    grp.clearLayers();
    groups.forEach((g, gi) => {
      const color = activeColor(g);
      const icon = L.divIcon({
        className: 'finder-beacon',
        html: `<button type="button" class="finder-beacon-btn" data-gi="${gi}" style="--fc:${color}">`
            + `<span class="fb-count">${g.items.length}</span>`
            + `<span class="fb-label">${escapeText(g.label)}</span></button>`,
        iconSize: null,
      });
      L.marker(g.centroid, { icon, interactive: true, zIndexOffset: 1600, keyboard: false })
        .addTo(grp)
        .on('click', () => focusGroup(gi));
    });
  }

  function activeColor(g) {
    return g.color || (activeCategory && activeCategory.color) || '#b89a6a';
  }

  // ── C · Finder panel ────────────────────────────────────────────────────────
  function panelEl() { return document.getElementById('finder-panel'); }

  function ensurePanel() {
    let el = panelEl();
    if (el) return el;
    el = document.createElement('aside');
    el.id = 'finder-panel';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<header id="finder-head">'
      + '<div id="finder-title"></div>'
      + '<button type="button" id="finder-close" aria-label="Close finder">&times;</button>'
      + '</header>'
      + '<p id="finder-sub"></p>'
      + '<div id="finder-body"></div>';
    document.body.appendChild(el);
    el.querySelector('#finder-close').addEventListener('click', closeFinder);
    return el;
  }

  function checkedIn(item) {
    try {
      const auth = window.VIA && window.VIA.auth;
      const target = item.site || item.stop;
      if (auth && target && typeof auth.getCheckin === 'function') return !!auth.getCheckin(target);
    } catch (e) { /* auth not ready — treat as not visited */ }
    return false;
  }

  function renderPanel(model, scrollToKey) {
    const el = ensurePanel();
    document.getElementById('finder-title').innerHTML =
      `<span class="finder-swatch" style="--fc:${model.color}"></span>${escapeText(model.label)}`;
    document.getElementById('finder-sub').innerHTML =
      `${model.total} ${model.total === 1 ? 'place' : 'places'} · tap any <b>place</b> to fly to it on the map, or a <b>region heading</b> to zoom to that area`;
    const body = document.getElementById('finder-body');
    body.innerHTML = model.groups.map((g, gi) => {
      const rows = g.items.map((it, ii) =>
        `<li class="finder-row" data-gi="${gi}" data-ii="${ii}" role="button" tabindex="0">`
        + `<span class="finder-row-name">${escapeText(it.name)}</span>`
        + (it.modern ? `<span class="finder-row-modern">${escapeText(it.modern)}</span>` : '')
        + (checkedIn(it) ? '<span class="finder-row-visited" title="You have checked in here">✓</span>' : '')
        + '</li>'
      ).join('');
      return `<section class="finder-group" data-key="${g.key}">`
        + `<h3 class="finder-group-head" data-gi="${gi}" role="button" tabindex="0">`
        + `<span class="finder-group-label">${escapeText(g.label)}</span>`
        + `<span class="finder-group-count" style="--fc:${activeColor(g)}">${g.items.length}</span></h3>`
        + `<ul class="finder-list">${rows}</ul></section>`;
    }).join('');

    // Row / group delegation (click + keyboard).
    body.onclick = (e) => {
      const row = e.target.closest('.finder-row');
      if (row) { pickItem(+row.dataset.gi, +row.dataset.ii); return; }
      const head = e.target.closest('.finder-group-head');
      if (head) focusGroup(+head.dataset.gi);
    };
    body.onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('.finder-row');
      const head = e.target.closest('.finder-group-head');
      if (row || head) { e.preventDefault(); }
      if (row) pickItem(+row.dataset.gi, +row.dataset.ii);
      else if (head) focusGroup(+head.dataset.gi);
    };

    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    // Defer scroll past layout: the panel just flipped display:none→flex (mobile),
    // so its scroll geometry isn't settled this frame — scrollIntoView would no-op.
    if (scrollToKey) {
      requestAnimationFrame(() => {
        const sec = body.querySelector(`.finder-group[data-key="${scrollToKey}"]`);
        if (sec) {
          // Scroll only the panel container (not the page) so the section sits at
          // its top edge — subtract the two rects instead of scrollIntoView.
          body.scrollTop += sec.getBoundingClientRect().top - body.getBoundingClientRect().top;
        }
      });
    } else {
      body.scrollTop = 0;
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  function pickItem(gi, ii) {
    const g = groups[gi]; if (!g) return;
    const it = g.items[ii]; if (!it) return;
    if (it.site && typeof focusSite === 'function') {
      focusSite(it.site, { pulse: true, pulseOnClose: true });
    } else if (it.stop && typeof journeyGoTo === 'function') {
      if (typeof appMode !== 'undefined' && appMode !== 'alexander' && typeof setMode === 'function') {
        setMode('alexander', { preserveView: true });
      }
      journeyGoTo(it.index);
    }
    // Drilled into a single place: the region beacons (zIndexOffset 1600) would sit
    // on top of the site's pulse and hide it. Clear them so the locator reads clean;
    // tapping a region heading (focusGroup) brings the bubbles back.
    if (beaconGroup) beaconGroup.clearLayers();
    // On phones the finder covers the map; close it so the fly + pulse are visible.
    if (window.innerWidth <= 640) closeFinder();
  }

  function focusGroup(gi) {
    const g = groups[gi]; if (!g || typeof map === 'undefined') return;
    // Region view: (re)show the beacons — pickItem clears them on a place drill-down.
    renderBeacons();
    const pts = g.items.map(it => [it.lat, it.lng]);
    if (pts.length === 1) {
      map.flyTo(pts[0], Math.max(map.getZoom(), 8), { duration: 0.6 });
    } else {
      map.flyToBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 9, duration: 0.6 });
    }
    // Bring the tapped region's section to the top of the list (container only).
    const body = document.getElementById('finder-body');
    if (body) {
      const sec = body.querySelector(`.finder-group[data-key="${g.key}"]`);
      if (sec) {
        const top = body.scrollTop + sec.getBoundingClientRect().top - body.getBoundingClientRect().top;
        body.scrollTo({ top, behavior: 'smooth' });
      }
    }
  }

  function openFinder(category) {
    activeCategory = category;
    const model = category.kind === 'phase' ? buildPhaseModel() : buildTierModel(category.key);
    if (!model.total) { closeFinder(); return; }
    model.color = category.color || model.color;
    groups = model.groups;
    renderBeacons();
    renderPanel(model, category.scrollTo);
  }

  function closeFinder() {
    const el = panelEl();
    if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
    if (beaconGroup) beaconGroup.clearLayers();
    activeCategory = null;
    groups = [];
  }

  function escapeText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Legend interception (capture-phase, so app.js inline onclick never fires) ─
  function interceptLegend() {
    const handler = (e) => {
      const tierRow = e.target.closest('.legend-row[data-tier]');
      if (tierRow) {
        const tier = tierRow.dataset.tier;
        const counts = (typeof tierCounts !== 'undefined') ? tierCounts : {};
        if (!counts[tier]) return;              // empty tier stays inert
        e.preventDefault(); e.stopPropagation();
        const info = (typeof TIER_INFO !== 'undefined' && TIER_INFO[tier]) || {};
        openFinder({ kind: 'tier', key: tier, color: info.color });
        return;
      }
      const phaseRow = e.target.closest('.phase-row[data-phase]');
      if (phaseRow) {
        e.preventDefault(); e.stopPropagation();
        const phases = (typeof ALEXANDER_PHASES !== 'undefined') ? ALEXANDER_PHASES : {};
        const key = phaseRow.dataset.phase;
        openFinder({ kind: 'phase', key, scrollTo: key, color: phases[key] && phases[key].color });
      }
    };
    const keyHandler = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('.legend-row[data-tier], .phase-row[data-phase]')) handler(e);
    };
    ['quest-legend', 'campaign-legend'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', handler, true);
      el.addEventListener('keydown', keyHandler, true);
    });
  }

  function init() {
    interceptLegend();
    // Re-render the visited ticks live when auth/check-in state changes.
    try {
      if (window.VIA && window.VIA.auth && typeof window.VIA.auth.onChange === 'function') {
        window.VIA.auth.onChange(() => {
          if (activeCategory) openFinder({ ...activeCategory, scrollTo: undefined });
        });
      }
    } catch (e) { /* auth optional */ }
    // Test/QA surface.
    window.VIA = window.VIA || {};
    window.VIA.openFinder = openFinder;
    window.VIA.closeFinder = closeFinder;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
