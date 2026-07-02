// ═══════════════════════════════════════════════════════════
//  VIA — build-roads.mjs
//
//  Pulls Itiner-e's live "Download Latest Export" (newline-delimited GeoJSON —
//  one route segment per line), simplifies every road geometry with
//  Douglas-Peucker, rounds coordinates to 4 decimals (~11 m), and writes:
//
//    js/roads-itinere.js           ROADS_ITINERE + ROADS_ITINERE_META
//                                  (cold-start baseline; each segment now carries
//                                   its Itiner-e `id` so the panel can deep-link
//                                   to https://itiner-e.org/route-segment/<id>)
//    js/roads-itinere-pleiades.js  ROADS_ITINERE_PP + ROADS_ITINERE_PP_PLACES
//                                  (LAZY — the Pleiades places Itiner-e associates
//                                   with each segment; loaded on first road tap)
//
//  Why the export and not the Zenodo v1.3 dump: the frozen Zenodo GeoJSON has no
//  per-segment id and no Pleiades association. The live export carries both, and
//  ships already in WGS84 lng/lat (no Web-Mercator reprojection needed).
//
//  Run:     node scripts/build-roads.mjs
//  Re-run:  same — cached export in .cache/itinere/ is reused unless --refresh.
//  Flags:
//    --refresh        re-download the ~37 MB ndjson export
//    --tol=<deg>      Douglas-Peucker tolerance in degrees (default 0.005 ≈ 500 m)
//    --max=<n>        cap to N segments (for smoke tests)
//
//  Source: Itiner-e — the digital atlas of ancient roads, https://itiner-e.org
//          Brughmans, de Soto, Pažout & Bjerregaard Vahlstrup (2024).
//  License: CC BY 4.0. Attribution lives in app.js (map credits) + index.html.
// ═══════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const CACHE     = path.join(ROOT, '.cache', 'itinere');
const EXPORT    = path.join(CACHE, 'itinere_export.ndjson');
const OUT_PATH  = path.join(ROOT, 'js', 'roads-itinere.js');
const PP_PATH   = path.join(ROOT, 'js', 'roads-itinere-pleiades.js');

// Itiner-e's live "Download Latest Export" — ndjson, one route segment per line.
const SOURCE_URL = 'https://itiner-e.org/route-segments/download';

const REFRESH = process.argv.includes('--refresh');
const TOL     = Number((process.argv.find(a => a.startsWith('--tol=')) || '').split('=')[1]) || 0.005;
const MAX     = Number((process.argv.find(a => a.startsWith('--max=')) || '').split('=')[1]) || Infinity;

// The export ships full JSON field names (unlike the shapefile-truncated Zenodo
// dump). We normalize the handful carrying scholarly signal into a compact per-road
// meta object; the per-segment `id` and `pleiadesPlaces` are handled separately.
// Meta objects are deduped into a shared ROADS_ITINERE_META table (a road's sibling
// segments share the same name/certainty), each segment carrying a small integer
// index `m` into it.
//
//   segmentCertainty  → cert : 'c' Certain / 'j' Conjectured / 'h' Hypothetical
//   name              → name : road name (endpoint pair, e.g. "Silvium-Herdoniae")
//   type              → main : 1 for "Main Road" (omitted for Secondary)
//   author            → cite : contributor/editor
//   bibliography      → bib  : bibliography reference
//   itinerary         → itin : ancient-itinerary membership
const CERT_MAP = { Certain: 'c', Conjectured: 'j', Hypothetical: 'h' };

// Only true roads render on the "Roads" layer. The export also carries River and
// Sea Lane features (Roman transport network, but not roads) — excluded so the
// layer keeps its meaning and certainty styling.
const ROAD_TYPES = new Set(['Main Road', 'Secondary Road']);

function normMeta(props) {
  if (!props) return {};
  const out = {};
  const cert = CERT_MAP[props.segmentCertainty];
  if (cert) out.cert = cert;
  if (props.name) out.name = String(props.name);
  if (props.type === 'Main Road') out.main = 1;
  if (props.author) out.cite = String(props.author);
  if (props.bibliography) out.bib = String(props.bibliography);
  if (props.itinerary) out.itin = String(props.itinerary);
  return out;
}

// ── DOWNLOAD ──────────────────────────────────────────────

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function ensureExport() {
  await mkdir(CACHE, { recursive: true });
  if (!REFRESH && await exists(EXPORT)) {
    const { size } = await stat(EXPORT);
    console.log(`✓ cached export at ${path.relative(ROOT, EXPORT)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
    return;
  }
  console.log(`↓ fetching ${SOURCE_URL} ...`);
  console.log(`  (Itiner-e "Download Latest Export", ~37 MB — first run takes a minute)`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(EXPORT));
  const { size } = await stat(EXPORT);
  console.log(`✓ saved ${path.relative(ROOT, EXPORT)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

// ── GEOMETRY ──────────────────────────────────────────────
// The export is already WGS84 lng/lat, so (unlike the Zenodo Web-Mercator dump)
// no reprojection is needed — we simplify + round directly.

// Perpendicular distance from point p to the line through a-b, in degree space.
function perpDist(p, a, b) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) {
    const ex = px - ax, ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const num = Math.abs(dy * px - dx * py + bx * ay - by * ax);
  const den = Math.sqrt(dx * dx + dy * dy);
  return num / den;
}

// Iterative Douglas-Peucker (recursion blows the stack at ~10k vertices).
function dpSimplify(points, tol) {
  const n = points.length;
  if (n <= 2) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let maxD = 0, idx = -1;
    const a = points[lo], b = points[hi];
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDist(points[i], a, b);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx !== -1) {
      keep[idx] = 1;
      stack.push([lo, idx], [idx, hi]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

// Round a coord pair to N decimals (default 4 ≈ 11 m). Drops any z ordinate.
function roundCoord(c, dp = 1e4) {
  return [Math.round(c[0] * dp) / dp, Math.round(c[1] * dp) / dp];
}

// ── BUILD ─────────────────────────────────────────────────

async function build() {
  await ensureExport();
  console.log(`⊙ parsing export (ndjson) ...`);

  // Deduped road-metadata table.
  const metaList = [];
  const metaIndex = new Map();
  function internMeta(props) {
    const meta = normMeta(props);
    const key = JSON.stringify(meta);
    if (key === '{}') return -1;
    let idx = metaIndex.get(key);
    if (idx === undefined) { idx = metaList.length; metaList.push(meta); metaIndex.set(key, idx); }
    return idx;
  }

  // Deduped Pleiades place table (many roads reference the same place). Each place
  // is [pleiadesId, name, type, lng, lat]; segments reference places by integer
  // index. ppBySeg maps our segment id → [placeIdx, ...].
  const placeList = [];
  const placeIndex = new Map();
  function internPlace(p) {
    if (!p || p.id == null) return -1;
    let idx = placeIndex.get(p.id);
    if (idx !== undefined) return idx;
    const nm  = (p.properties && p.properties.name) || '';
    const ty  = (p.properties && p.properties.type) || '';
    const g   = p.geometry && p.geometry.coordinates;
    const lng = g ? Math.round(g[0] * 1e5) / 1e5 : null;
    const lat = g ? Math.round(g[1] * 1e5) / 1e5 : null;
    idx = placeList.length;
    placeList.push([p.id, nm, ty, lng, lat]);
    placeIndex.set(p.id, idx);
    return idx;
  }

  const stats = { total: 0, skippedType: 0, skippedGeom: 0, rawVerts: 0, outVerts: 0, ppLinks: 0 };
  const segments = [];
  const ppBySeg  = {};

  const rl = createInterface({ input: createReadStream(EXPORT), crlfDelay: Infinity });
  for await (const line of rl) {
    if (segments.length >= MAX) break;
    const t = line.trim();
    if (!t) continue;
    let feat;
    try { feat = JSON.parse(t); } catch { continue; }
    stats.total++;

    const props = feat.properties || {};
    if (!ROAD_TYPES.has(props.type)) { stats.skippedType++; continue; }

    const g = feat.geometry;
    if (!g || g.type !== 'LineString' || !Array.isArray(g.coordinates) || g.coordinates.length < 2) {
      stats.skippedGeom++; continue;
    }

    stats.rawVerts += g.coordinates.length;
    const simplified = dpSimplify(g.coordinates, TOL).map(c => roundCoord(c));
    if (simplified.length < 2) { stats.skippedGeom++; continue; }
    stats.outVerts += simplified.length;

    const id = feat.id;
    const m  = internMeta(props);
    const seg = { coords: simplified };
    if (m >= 0) seg.m = m;
    if (id != null) seg.id = id;
    segments.push(seg);

    // Pleiades association (only for segments we keep + actually have an id).
    if (id != null && Array.isArray(feat.pleiadesPlaces) && feat.pleiadesPlaces.length) {
      const idxs = [];
      for (const p of feat.pleiadesPlaces) {
        const pi = internPlace(p);
        if (pi >= 0) idxs.push(pi);
      }
      if (idxs.length) { ppBySeg[id] = idxs; stats.ppLinks += idxs.length; }
    }
  }

  console.log(`✓ ${stats.total.toLocaleString()} features scanned`);
  console.log(`  skipped ${stats.skippedType.toLocaleString()} non-road (River/Sea Lane), ${stats.skippedGeom} bad geometry`);
  console.log(`⊙ simplified: ${stats.rawVerts.toLocaleString()} → ${stats.outVerts.toLocaleString()} vertices (${(100 * stats.outVerts / stats.rawVerts).toFixed(1)}%)`);
  console.log(`✓ ${segments.length.toLocaleString()} road segments retained`);
  console.log(`✓ ${metaList.length.toLocaleString()} unique road-metadata records`);
  console.log(`✓ ${Object.keys(ppBySeg).length.toLocaleString()} segments with Pleiades links (${stats.ppLinks.toLocaleString()} links, ${placeList.length.toLocaleString()} unique places)`);

  if (segments.length) {
    const s0 = JSON.stringify(segments[0]);
    console.log(`  sample[0]: ${s0.slice(0, 160)}${s0.length > 160 ? '...' : ''}`);
  }

  const stamp = new Date().toISOString().slice(0, 10);

  // ── roads-itinere.js ─────────────────────────────────────
  const banner =
`// ═══════════════════════════════════════════════════════════
//  AUTO-GENERATED by scripts/build-roads.mjs — do not hand-edit.
//
//  Source:  Itiner-e "Download Latest Export" (${SOURCE_URL})
//           snapshot ${stamp} — the live successor to Zenodo v1.3.
//  License: CC BY 4.0
//  Cite:    Brughmans, T., de Soto, P., Pažout, A. and Bjerregaard Vahlstrup, P.
//           (2024) Itiner-e: the digital atlas of ancient roads. https://itiner-e.org
//
//  Geometry simplified with Douglas-Peucker (tol=${TOL}° ≈ ${Math.round(TOL * 111000)} m)
//  and rounded to 4 decimals (~11 m precision). WGS84 lng/lat as shipped.
//
//  Each segment:  { coords: [[lng, lat], ...], m?: <index into ROADS_ITINERE_META>,
//                   id?: <Itiner-e route-segment id — deep-links to
//                         https://itiner-e.org/route-segment/<id> > }
//  Each meta:     { cert?: 'c'|'j'|'h', name?, main?: 1, cite?, bib?, itin? }
//                 cert = Certain / Conjectured / Hypothetical (segmentCertainty).
//
//  The Pleiades places Itiner-e links to each segment live in the LAZY sibling
//  file js/roads-itinere-pleiades.js (keyed by segment id).
// ═══════════════════════════════════════════════════════════
`;

  const metaLines = metaList.map(m => '  ' + JSON.stringify(m) + ',');
  const metaBody  = `const ROADS_ITINERE_META = [\n${metaLines.join('\n')}\n];\n\n`;
  const segLines  = segments.map(s => '  ' + JSON.stringify(s) + ',');
  const body      = metaBody + `const ROADS_ITINERE = [\n${segLines.join('\n')}\n];\n`;
  await writeFile(OUT_PATH, banner + body, 'utf8');
  const { size } = await stat(OUT_PATH);
  console.log(`✓ wrote ${path.relative(ROOT, OUT_PATH)} (${(size / 1024 / 1024).toFixed(2)} MB)`);

  // ── roads-itinere-pleiades.js (lazy) ─────────────────────
  const ppBanner =
`// ═══════════════════════════════════════════════════════════
//  AUTO-GENERATED by scripts/build-roads.mjs — do not hand-edit.
//
//  LAZY-LOADED companion to roads-itinere.js (loaded on first road tap, NOT at
//  cold start). The Pleiades places Itiner-e associates with each route segment.
//
//  Source:  Itiner-e "Download Latest Export", snapshot ${stamp} — CC BY 4.0.
//           Pleiades ids resolve at https://pleiades.stoa.org/places/<id>.
//
//  ROADS_ITINERE_PP_PLACES : shared place table — each entry
//                            [pleiadesId, name, type, lng, lat].
//  ROADS_ITINERE_PP        : { <segment id>: [placeIdx, ...] } into that table.
// ═══════════════════════════════════════════════════════════
`;
  const placeLines = placeList.map(p => '  ' + JSON.stringify(p) + ',');
  const ppEntries  = Object.keys(ppBySeg).map(id => `${id}:[${ppBySeg[id].join(',')}]`);
  const ppBody =
`window.ROADS_ITINERE_PP_PLACES = [\n${placeLines.join('\n')}\n];\n\n` +
`window.ROADS_ITINERE_PP = {${ppEntries.join(',')}};\n`;
  await writeFile(PP_PATH, ppBanner + ppBody, 'utf8');
  const pp = await stat(PP_PATH);
  console.log(`✓ wrote ${path.relative(ROOT, PP_PATH)} (${(pp.size / 1024 / 1024).toFixed(2)} MB)`);
}

build().catch(e => { console.error(e); process.exit(1); });
