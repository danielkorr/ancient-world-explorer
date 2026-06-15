// ═══════════════════════════════════════════════════════════
//  VIA — build-roads.mjs
//
//  Pulls the Itiner-e GeoJSON dump from Zenodo, simplifies every road
//  geometry with Douglas-Peucker, rounds coordinates to 4 decimals
//  (~11 m), and writes js/roads-itinere.js exposing the global
//  ROADS_ITINERE for the runtime to render as the subtle baseline
//  beneath the 14 hand-curated named roads.
//
//  Run:     node scripts/build-roads.mjs
//  Re-run:  same — cached dump in .cache/itinere/ is reused unless --refresh.
//  Flags:
//    --refresh        re-download the 78 MB GeoJSON
//    --tol=<deg>      Douglas-Peucker tolerance in degrees (default 0.005 ≈ 500 m)
//    --max=<n>        cap to N segments (for smoke tests)
//
//  Source: De Soto et al. (2025), Itiner-e v1.3, https://doi.org/10.5281/zenodo.17122148
//  License: CC BY 4.0. Attribution lives in index.html + the map credits.
// ═══════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const CACHE     = path.join(ROOT, '.cache', 'itinere');
const GEOJSON   = path.join(CACHE, 'itinere_roads.geojson');
const OUT_PATH  = path.join(ROOT, 'js', 'roads-itinere.js');

const SOURCE_URL = 'https://zenodo.org/records/17122148/files/itinere_roads.geojson';

const REFRESH = process.argv.includes('--refresh');
const TOL     = Number((process.argv.find(a => a.startsWith('--tol=')) || '').split('=')[1]) || 0.005;
const MAX     = Number((process.argv.find(a => a.startsWith('--max=')) || '').split('=')[1]) || Infinity;

// Itiner-e's real field names (shapefile-truncated to 10 chars). We normalize
// the handful that carry scholarly signal into a compact per-road meta object;
// everything else is dropped. Footprint matters at ~14.8k rows, so meta objects
// are deduped into a shared ROADS_ITINERE_META table and each segment carries a
// small integer index `m` into it (MultiLineString splitting otherwise dupes the
// same road's metadata across every sibling segment).
//
//   Segment_s  → cert : 'c' Certain / 'j' Conjectured / 'h' Hypothetical  (100% filled)
//   Name       → name : road name
//   Type       → main : 1 for "Main Road" (omitted for Secondary, the common case)
//   Citation   → cite : contributor/editor
//   Bibliograp → bib  : bibliography reference
//   Itinerary  → itin : ancient-itinerary membership (41% filled)
const CERT_MAP = { Certain: 'c', Conjectured: 'j', Hypothetical: 'h' };

function normMeta(props) {
  if (!props) return {};
  const out = {};
  const cert = CERT_MAP[props.Segment_s];
  if (cert) out.cert = cert;
  if (props.Name) out.name = String(props.Name);
  if (props.Type === 'Main Road') out.main = 1;
  if (props.Citation) out.cite = String(props.Citation);
  if (props.Bibliograp) out.bib = String(props.Bibliograp);
  if (props.Itinerary) out.itin = String(props.Itinerary);
  return out;
}

// ── DOWNLOAD ──────────────────────────────────────────────

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function ensureDump() {
  await mkdir(CACHE, { recursive: true });
  if (!REFRESH && await exists(GEOJSON)) {
    const { size } = await stat(GEOJSON);
    console.log(`✓ cached dump at ${path.relative(ROOT, GEOJSON)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
    return;
  }
  console.log(`↓ fetching ${SOURCE_URL} ...`);
  console.log(`  (this is ~78 MB — first run takes a minute)`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(GEOJSON));
  const { size } = await stat(GEOJSON);
  console.log(`✓ saved ${path.relative(ROOT, GEOJSON)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

// ── GEOMETRY ──────────────────────────────────────────────

// Itiner-e ships in EPSG:3857 (Web Mercator metres), not WGS84. Reproject
// each vertex back to lng/lat before simplifying so our degree-tolerance
// DP and 4-decimal rounding make sense.
const EARTH_R = 6378137;
const RAD2DEG = 180 / Math.PI;
function mercatorToLngLat(c) {
  const lng = c[0] / EARTH_R * RAD2DEG;
  const lat = (2 * Math.atan(Math.exp(c[1] / EARTH_R)) - Math.PI / 2) * RAD2DEG;
  return [lng, lat];
}

// Perpendicular distance from point p to the line through a-b, in degree space.
// Good enough at the scale of individual roads; we round to 4 decimals after.
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

// Round a coord pair to 4 decimals (~11 m precision). String-formatted to
// avoid 0.30000000000000004-style float gunk in the output JS.
function roundCoord(c) {
  return [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4];
}

// ── PROCESS ──────────────────────────────────────────────

function processFeature(feat, stats, internMeta) {
  const g = feat.geometry;
  if (!g) return [];
  const m = internMeta(feat.properties); // shared index, or -1 when no meta
  const lines = g.type === 'LineString'      ? [g.coordinates]
              : g.type === 'MultiLineString' ? g.coordinates
              : null;
  if (!lines) { stats.skippedNonLine++; return []; }

  const out = [];
  for (const line of lines) {
    if (!Array.isArray(line) || line.length < 2) continue;
    stats.rawVerts += line.length;
    const lngLat = line.map(mercatorToLngLat);
    const simplified = dpSimplify(lngLat, TOL).map(roundCoord);
    if (simplified.length < 2) continue;
    stats.outVerts += simplified.length;
    out.push(m >= 0 ? { coords: simplified, m } : { coords: simplified });
  }
  return out;
}

async function build() {
  await ensureDump();
  console.log(`⊙ parsing GeoJSON ...`);
  const raw = await readFile(GEOJSON, 'utf8');
  const fc = JSON.parse(raw);
  if (!fc || !Array.isArray(fc.features)) {
    throw new Error('expected FeatureCollection with .features array');
  }
  console.log(`✓ ${fc.features.length} features in source`);

  // Deduped metadata table: identical normalized meta objects collapse to one
  // entry, and each segment references it by integer index `m`.
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

  const stats = { rawVerts: 0, outVerts: 0, skippedNonLine: 0 };
  const segments = [];
  for (const feat of fc.features) {
    if (segments.length >= MAX) break;
    for (const seg of processFeature(feat, stats, internMeta)) {
      segments.push(seg);
      if (segments.length >= MAX) break;
    }
  }

  console.log(`⊙ simplified: ${stats.rawVerts.toLocaleString()} → ${stats.outVerts.toLocaleString()} vertices (${(100 * stats.outVerts / stats.rawVerts).toFixed(1)}%)`);
  if (stats.skippedNonLine) console.log(`  skipped ${stats.skippedNonLine} non-line features`);
  console.log(`✓ ${segments.length.toLocaleString()} segments retained`);
  console.log(`✓ ${metaList.length.toLocaleString()} unique road-metadata records`);

  // Sample one segment so the reader can sanity-check the schema.
  if (segments.length) {
    console.log(`  sample[0]: ${JSON.stringify(segments[0]).slice(0, 160)}${JSON.stringify(segments[0]).length > 160 ? '...' : ''}`);
  }

  const banner =
`// ═══════════════════════════════════════════════════════════
//  AUTO-GENERATED by scripts/build-roads.mjs — do not hand-edit.
//
//  Source:  Itiner-e v1.3 — De Soto et al. (2025), https://doi.org/10.5281/zenodo.17122148
//  License: CC BY 4.0
//  Cite:    Brughmans, T., de Soto, P., Pažout, A. and Bjerregaard Vahlstrup, P.
//           (2024) Itiner-e: the digital atlas of ancient roads. https://itiner-e.org
//
//  Geometry simplified with Douglas-Peucker (tol=${TOL}° ≈ ${Math.round(TOL * 111000)} m)
//  and rounded to 4 decimals (~11 m precision). Run build-roads.mjs to regenerate.
//
//  Each segment:  { coords: [[lng, lat], ...], m?: <index into ROADS_ITINERE_META> }
//  Each meta:     { cert?: 'c'|'j'|'h', name?, main?: 1, cite?, bib?, itin? }
//                 cert = Certain / Conjectured / Hypothetical (Itiner-e Segment_s).
// ═══════════════════════════════════════════════════════════
`;

  // Compact one-segment-per-line output — much better diff readability than
  // a single mega-JSON, and gzips just as well. Meta table first so the runtime
  // can resolve a segment's `m` index immediately.
  const metaLines = metaList.map(m => '  ' + JSON.stringify(m) + ',');
  const metaBody  = `const ROADS_ITINERE_META = [\n${metaLines.join('\n')}\n];\n\n`;
  const lines = segments.map(s => '  ' + JSON.stringify(s) + ',');
  const body  = metaBody + `const ROADS_ITINERE = [\n${lines.join('\n')}\n];\n`;

  await writeFile(OUT_PATH, banner + body, 'utf8');
  const { size } = await stat(OUT_PATH);
  console.log(`✓ wrote ${path.relative(ROOT, OUT_PATH)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
}

build().catch(e => { console.error(e); process.exit(1); });
