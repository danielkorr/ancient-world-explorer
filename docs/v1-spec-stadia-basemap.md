# Task: Stamen (Stadia) ancient-mode floor + attribution

**File:** `docs/v1-spec-stadia-basemap.md`
**Project:** VIA — Ancient World Explorer (static SPA, Leaflet, GitHub Pages)
**Status:** Ready for implementation

---

## 1. Why

VIA's ancient-mode floor was CARTO `light_all` with a sepia CSS tint — a hack to
fake an old-map feel out of a modern basemap. Stadia hosts the Stamen styles (Terrain,
Watercolor), which read as a genuine antique map. This task brings Stamen into **ancient
mode** and wires its attribution.

**Fallback-floor revision (decision in force).** Stamen does **not** replace the sepia
CARTO floor — it is **layered on top of it**. The sepia-tinted CARTO `light_all` base is
restored as the **keyless** floor that always renders; the Stamen layer (Stadia-hosted,
domain-auth'd) sits above it. When Stamen fails — auth miss, outage, or an un-whitelisted
LAN IP during device testing — its tiles render transparent in Leaflet and the sepia CARTO
base shows through, so **ancient mode never renders white**. No `tileerror` JS handler is
needed; the stacking does it. Modern mode, the DARE atlas overlay, the Esri satellite
layer, the marker model, Pleiades keying, quests, and auth are all unchanged.

## 2. The existing basemap architecture (read first)

VIA does **not** have a single basemap. `js/app.js` runs a four-layer system tied to the
era toggle and a zoom-based reveal:

1. `ancientLayer` — **DARE** Roman atlas tiles; overlay that fades in z7–z11. *Not CARTO.* **Keep.**
2. `ancientFallbackLayer` — **CARTO `light_all`, sepia-tinted**; the **keyless** permanent
   floor under DARE in ancient mode. **Keep it** — it becomes the always-renders base that
   shows through when Stamen fails.
3. `ancientStamenLayer` — **Stamen (Stadia-hosted)**; **new** layer stacked *on top of*
   `ancientFallbackLayer` in ancient mode for the antique look. Domain-auth'd.
4. `modernLayer` — **CARTO Voyager**; the basemap in modern mode. **Keep.**
5. `satelliteLayer` — **Esri World Imagery**; fades in at deep zoom. *Not CARTO.* **Keep.**

Ancient-mode stacking order, bottom → top: `ancientFallbackLayer` (sepia CARTO base) →
`ancientStamenLayer` (Stamen) → Toner labels (watercolor only) → `ancientLayer` (DARE).

## 3. Scope

**In scope**
- Keep `ancientFallbackLayer` (sepia CARTO `light_all`) as the **keyless base floor**, and
  add a **new** `ancientStamenLayer` (Stamen, Stadia-hosted) stacked on top of it in
  ancient mode.
- Keep the sepia CSS filter on the CARTO base (it shows through when Stamen fails, so the
  tint still matters) — retargeted from the old `.ancient-fallback` class to
  `.ancient-sepia-floor`, set on the CARTO base in `basemap.js`.
- Add both layers' attribution to Leaflet's native control (CARTO+OSM for the base;
  Stadia+Stamen+OSM, +OpenMapTiles for terrain, on the Stamen layer).

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

**Explicitly dropped from an earlier draft:** the criterion "no carto references remain,"
**and** the earlier plan to *remove* the sepia CARTO ancient floor. Both were based on a
wrong model. CARTO Voyager intentionally survives in modern mode, **and** the sepia CARTO
`light_all` floor intentionally survives in ancient mode as the keyless base under Stamen.
Stamen layers on top; nothing CARTO is removed.

## 4. Project constraints (hold to these)

- **Static SPA, GitHub Pages, no backend.** Build-time/static only.
- **No ES modules.** VIA loads every script as a plain global `<script>` tag (no
  `type="module"`). The new file must define a **global function**, not `export` anything,
  and load via `<script src="js/basemap.js?v=82"></script>`. An `export` would throw and
  the map would not boot.
- **No API key in the repo.** Auth is domain-based. `danielkorr.github.io` is whitelisted
  in the Stadia dashboard; `localhost` / `127.0.0.1` are keyless. Leave any
  `STADIA_API_KEY` absent/empty. (Phone-over-wifi via a LAN IP needs the developer to
  whitelist that LAN address in the dashboard — not a code change.)
- **No new runtime dependencies.** Stadia is just a tile URL; Leaflet is already vendored.
  Do not add npm packages, a bundler, or a framework.
- **Bump the cache token.** Local assets carry a `?v=N` token in `index.html`. The initial
  Stamen migration shipped **`v81`**; this fallback-floor revision edits JS/CSS again, so
  bump every asset's token to **`v82`** in `index.html`. Bumping the page URL alone does NOT
  work — each sub-resource must be bumped.
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

The Stamen style backing the **top** ancient layer is chosen by a single constant. Default
to **Terrain** (most legible under marker density). **Watercolor** is the documented
alternative. Watercolor differs: it is `.jpg`, its tiles thin past zoom 16 (the Esri
satellite already fades in at deep zoom and covers that range), it has **no labels of its
own** (pair it with Stamen Toner labels), and its attribution **omits OpenMapTiles**. The
sepia CARTO base below is unaffected by this choice — it is always the same keyless
`light_all` floor regardless of the Stamen style on top.

### 5.2 New file: `js/basemap.js` (global script, NOT a module)

`basemap.js` exposes `window.VIA_createAncientFloor()`, which returns **three** layers —
`{ carto, stamen, labels }` — built but NOT added to the map (app.js owns membership):

- `carto` — keyless CARTO `light_all` base with `className: 'ancient-sepia-floor'` (CSS
  applies the sepia filter) and a CARTO+OSM attribution. Always renders; shows through
  wherever `stamen` fails.
- `stamen` — the Stadia/Stamen tile layer (`ACTIVE_BASEMAP` = `'terrain'` default |
  `'watercolor'`), stacked on top of `carto`.
- `labels` — Stamen Toner labels overlay for watercolor only (null for terrain).

```js
// js/basemap.js — ANCIENT-mode floor for VIA: sepia CARTO base + Stamen on top.
// Plain global script — NO ES module, NO export. Load via:
//   <script src="js/basemap.js?v=82"></script>
// Domain auth only: NO API key. localhost is keyless; production is authorized via
// danielkorr.github.io. The CARTO base is keyless and always renders, so a Stamen
// auth miss (incl. an un-whitelisted LAN IP) degrades to sepia CARTO, not white.

const ACTIVE_BASEMAP = 'terrain'; // 'terrain' (default) | 'watercolor'  (Stamen layer only)

window.VIA_createAncientFloor = function () {
  const cfg = BASEMAPS[ACTIVE_BASEMAP];

  const carto = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    { maxZoom: 19, className: 'ancient-sepia-floor',
      attribution: [ATTR_OSM, ATTR_CARTO].join(' ') }
  );
  const stamen = L.tileLayer(cfg.url, cfg.options);
  const labels = cfg.labels ? L.tileLayer(cfg.labels, { maxZoom: 18, attribution: '' }) : null;
  return { carto, stamen, labels };
};
```

(`BASEMAPS` holds the same terrain/watercolor URL + attribution table as before; terrain
credits Stadia+Stamen+OpenMapTiles+OSM, watercolor omits OpenMapTiles and adds Toner
labels.)

### 5.3 Wire it into `js/app.js`

- `const _ancientFloor = VIA_createAncientFloor();` then
  `const ancientFallbackLayer = _ancientFloor.carto;` (keyless sepia base, original name/
  role restored), `const ancientStamenLayer = _ancientFloor.stamen;` (new, on top),
  `const ancientFallbackLabels = _ancientFloor.labels;`.
- Init `layers:` and the `setEra` ancient branch add them bottom→top: `ancientFallbackLayer`,
  `ancientStamenLayer`, `ancientFallbackLabels?`, `ancientLayer`. The modern branch removes
  `ancientStamenLayer` alongside the others. `updateBasemaps` holds carto + stamen (+ labels)
  at opacity 1.
- **Keep** the sepia CSS filter, retargeted to `.ancient-sepia-floor` in `css/style.css`
  (`filter: sepia(0.5) saturate(0.85)`), since the CARTO base shows through on Stamen
  failure.
- Add `<script src="js/basemap.js?v=82"></script>` in `index.html` **before** `app.js`, so
  `VIA_createAncientFloor` is defined when `app.js` runs.

### 5.4 Attribution

- Keep Leaflet's built-in attribution control enabled and let it aggregate the
  attributions of whatever layers are currently active. Do **not** hand-roll a tile-credits
  widget.
- **Preserve** the existing attribution strings on `ancientLayer` (DARE), `modernLayer`
  (CARTO Voyager), and `satelliteLayer` (Esri). The CARTO credit legitimately remains in
  modern mode.
- The Stamen layer carries its own attribution (set in `basemap.js`): Stadia + Stamen +
  OSM, plus OpenMapTiles for Terrain only.
- The sepia CARTO base carries CARTO + OSM. Because that base is **always active in ancient
  mode** (it's the keyless floor), its CARTO credit now legitimately appears in ancient mode
  too — alongside Stadia/Stamen/OMT and DARE. That is correct (CARTO tiles are loaded) and,
  on mobile, sits behind the existing ⓘ attribution toggle.
- Style `.leaflet-control-attribution` to match VIA's dark/gold theme (dark pill, gold
  links), legible and not clipped on a narrow mobile viewport. Data-source credits that are
  not tile credits — Pleiades (CC BY), Wikidata (CC0) — stay in the existing info/KEY panel.

## 6. Acceptance criteria

- [ ] **Ancient mode** renders the Stamen style on top of the sepia CARTO base on
      `localhost` (keyless) and on deployed `danielkorr.github.io`; the sepia CARTO base is
      **present** (kept) with its filter on `.ancient-sepia-floor`.
- [ ] **Fallback-floor behavior:** when the Stamen layer fails to load (e.g. an
      un-whitelisted LAN IP, or blocking `tiles.stadiamaps.com` in devtools), the sepia
      CARTO base shows through and **ancient mode does not render white**; no JS error.
- [ ] **Modern mode** still shows CARTO Voyager; the era toggle behaves as before.
- [ ] DARE overlay still fades in z7–z11; Esri satellite still fades in at deep zoom.
- [ ] `js/basemap.js` is a plain global script (no `export`); `VIA_createAncientFloor` is
      defined before `app.js` runs; the map boots with no console errors.
- [ ] Attribution control aggregates the correct credits per mode (ancient: Stadia/Stamen/
      OSM +OpenMapTiles for terrain, + CARTO+OSM for the base, + DARE; modern: CARTO
      Voyager; + Esri at deep zoom); styled to theme, legible on mobile.
- [ ] No API key string anywhere in the repo.
- [ ] `?v=` cache token bumped to **`v82`** on every changed asset in `index.html`.
- [ ] If `ACTIVE_BASEMAP = 'watercolor'`: Toner labels overlay loads with the floor, and
      panning past z16 does not flood the console (expected thinning; satellite covers deep
      zoom).
- [ ] Markers (all types) + popups + **Pleiades keying** unchanged.
- [ ] No test runner / package manager added; no `tools/` directory created.
- [ ] **On-device check (the gate):** map loads in real iPhone Safari — ancient floor
      renders (Stamen where authed, sepia CARTO where not), era toggle works, markers/popups
      work, attribution legible and not clipped; desktop check passes.

## 7. Notes

- VIA runs as a nonprofit; Stadia's free tier and domain auth cover this at no cost. If VIA
  is monetized later, revisit Stadia's commercial tier and fold it into the existing CC-BY
  license audit.
- `ACTIVE_BASEMAP` (terrain | watercolor) is the only aesthetic value left open for the
  Stamen top layer — a one-line flip, judged on-device. Watercolor + the existing Esri
  deep-zoom reveal may pair especially well, since satellite takes over right where
  Watercolor thins out.
- The keyless sepia CARTO base is the reason device testing over a LAN IP no longer needs a
  Stadia dashboard whitelist just to see *something*: an un-whitelisted IP shows the sepia
  floor instead of white. Whitelisting the IP is still what makes the Stamen layer appear on
  top.
