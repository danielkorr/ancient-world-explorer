// ═══════════════════════════════════════════════════════════
//  VIA — build-orbis.mjs
//
//  Pulls the ORBIS network (Stanford, via the sfsheath/gorbit mirror),
//  runs Dijkstra from Rome over the `days` edge cost (summer civilian,
//  fastest path), and emits js/orbis-days.js with:
//
//    ORBIS_BY_PLEIADES   pleiades_id → { days, mode }    direct match
//    ORBIS_NODES         [{ id, lat, lng, days, mode }]  for nearest-node
//                                                        fallback at runtime
//
//  Run: node scripts/build-orbis.mjs
//  Re-fetch the dump: node scripts/build-orbis.mjs --refresh
// ═══════════════════════════════════════════════════════════

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT  = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, '.cache', 'orbis');
const OUT   = path.join(ROOT, 'js', 'orbis-days.js');

const REFRESH = process.argv.includes('--refresh');
const ROME_NODE_ID = 50327;

const FILES = {
  nodes: { url: 'https://raw.githubusercontent.com/sfsheath/gorbit/master/gorbit-nodes.csv', dest: 'nodes.csv' },
  edges: { url: 'https://raw.githubusercontent.com/sfsheath/gorbit/master/gorbit-edges.csv', dest: 'edges.csv' },
  sites: { url: 'https://raw.githubusercontent.com/sfsheath/gorbit/master/gorbit-sites.csv', dest: 'sites.csv' },
};

// ── DOWNLOAD ──────────────────────────────────────────────

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function ensureFile(url, destPath) {
  if (!REFRESH && await exists(destPath)) return;
  console.log(`↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
}

async function ensureDump() {
  await mkdir(CACHE, { recursive: true });
  for (const f of Object.values(FILES)) {
    await ensureFile(f.url, path.join(CACHE, f.dest));
  }
}

// ── CSV STREAM PARSER (RFC 4180) ──────────────────────────

async function* parseCsv(filePath) {
  const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1 << 16 });
  let buf = '', fields = [], field = '', inQuotes = false, header = null;
  const commitField  = () => { fields.push(field); field = ''; };
  const commitRecord = () => {
    commitField();
    if (!header) { header = fields; fields = []; return null; }
    const rec = {};
    for (let i = 0; i < header.length; i++) rec[header[i]] = fields[i] ?? '';
    fields = [];
    return rec;
  };
  for await (const chunk of stream) {
    buf += chunk;
    let i = 0;
    while (i < buf.length) {
      const c = buf[i];
      if (inQuotes) {
        if (c === '"') {
          if (buf[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++;
        } else { field += c; i++; }
      } else {
        if      (c === '"')  { inQuotes = true; i++; }
        else if (c === ',')  { commitField(); i++; }
        else if (c === '\r') { i++; }
        else if (c === '\n') { const r = commitRecord(); if (r) yield r; i++; }
        else                 { field += c; i++; }
      }
    }
    buf = '';
  }
  if (field.length || fields.length) { const r = commitRecord(); if (r) yield r; }
}

async function readAll(filename) {
  const out = [];
  for await (const row of parseCsv(path.join(CACHE, filename))) out.push(row);
  return out;
}

// ── DIJKSTRA ──────────────────────────────────────────────
// Tiny binary heap so we don't allocate a full priority queue lib.

class MinHeap {
  constructor() { this.a = []; }
  push(item) {
    this.a.push(item);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p][0] <= this.a[i][0]) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop() {
    if (!this.a.length) return undefined;
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      const n = this.a.length;
      for (;;) {
        const l = i * 2 + 1, r = i * 2 + 2;
        let s = i;
        if (l < n && this.a[l][0] < this.a[s][0]) s = l;
        if (r < n && this.a[r][0] < this.a[s][0]) s = r;
        if (s === i) break;
        [this.a[s], this.a[i]] = [this.a[i], this.a[s]];
        i = s;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

function dijkstra(adj, source) {
  const days = new Map();
  const prevType = new Map(); // dominant final-leg type (for "by road"/"by sea" hint)
  const heap = new MinHeap();
  heap.push([0, source, null]);
  while (heap.size) {
    const [d, u, lastType] = heap.pop();
    if (days.has(u)) continue;
    days.set(u, d);
    if (lastType) prevType.set(u, lastType);
    const edges = adj.get(u) || [];
    for (const { to, cost, type } of edges) {
      if (!days.has(to)) heap.push([d + cost, to, type]);
    }
  }
  return { days, prevType };
}

// Classify an edge type as a coarse travel mode.
function mode(edgeType) {
  if (['road'].includes(edgeType))                                    return 'road';
  if (['coastal','overseas','slowcoast','slowover'].includes(edgeType))return 'sea';
  if (['upstream','downstream','fastup','fastdown'].includes(edgeType))return 'river';
  if (['ferry'].includes(edgeType))                                   return 'ferry';
  return 'mixed';
}

// ── MAIN ──────────────────────────────────────────────────

async function main() {
  await ensureDump();
  const [nodes, edges, sites] = await Promise.all([
    readAll('nodes.csv'),
    readAll('edges.csv'),
    readAll('sites.csv'),
  ]);
  console.log(`✓ nodes: ${nodes.length}, edges: ${edges.length}, sites: ${sites.length}`);

  // Build undirected adjacency keyed by numeric node id.
  const adj = new Map();
  const addEdge = (a, b, cost, type) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ to: b, cost, type });
  };
  for (const e of edges) {
    const s = Number(e.source), t = Number(e.target);
    const c = Number(e.days);
    if (!Number.isFinite(s) || !Number.isFinite(t) || !Number.isFinite(c)) continue;
    addEdge(s, t, c, e.type);
    addEdge(t, s, c, e.type);
  }

  const { days, prevType } = dijkstra(adj, ROME_NODE_ID);
  console.log(`✓ Dijkstra from Rome reached ${days.size}/${nodes.length} nodes`);

  // Pleiades → days map (from sites.csv, which carries the Pleiades id per ORBIS node).
  const byPleiades = {};
  for (const s of sites) {
    const nid = Number(s.id);
    const pid = String(s.pleiades || '').trim();
    if (!pid || !days.has(nid)) continue;
    byPleiades[pid] = {
      days: Number(days.get(nid).toFixed(1)),
      mode: mode(prevType.get(nid)),
    };
  }
  console.log(`✓ ${Object.keys(byPleiades).length} Pleiades→days mappings`);

  // Node table for runtime nearest-neighbor fallback. Keep it lean —
  // only nodes reached from Rome and with valid coords.
  const nodeRows = [];
  for (const n of nodes) {
    const id = Number(n.id);
    const lat = Number(n.y), lng = Number(n.x);
    if (!days.has(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    nodeRows.push({
      id,
      lat: Number(lat.toFixed(3)),
      lng: Number(lng.toFixed(3)),
      days: Number(days.get(id).toFixed(1)),
      mode: mode(prevType.get(id)),
    });
  }

  await writeFile(OUT, emit(byPleiades, nodeRows));
  console.log(`✓ wrote ${path.relative(ROOT, OUT)} (${nodeRows.length} nodes)`);
}

function emit(byPleiades, nodes) {
  const pleiadesPairs = Object.entries(byPleiades)
    .map(([pid, v]) => `  ${JSON.stringify(pid)}: { days:${v.days}, mode:${JSON.stringify(v.mode)} },`);
  const nodeLines = nodes.map(n =>
    `  { id:${n.id}, lat:${n.lat}, lng:${n.lng}, days:${n.days}, mode:${JSON.stringify(n.mode)} },`);
  return [
    '// ═══════════════════════════════════════════════════════════',
    '//  VIA — Ancient World Explorer',
    '//  orbis-days.js — auto-generated from the ORBIS network',
    '//',
    '//  DO NOT EDIT BY HAND. Regenerate with:',
    '//    node scripts/build-orbis.mjs',
    '//',
    '//  Source: https://github.com/sfsheath/gorbit (mirror of Stanford ORBIS)',
    `//  Generated: ${new Date().toISOString()}`,
    `//  Pleiades→days entries: ${pleiadesPairs.length}`,
    `//  Nodes (for nearest-node fallback): ${nodes.length}`,
    '// ═══════════════════════════════════════════════════════════',
    '',
    'const ORBIS_BY_PLEIADES = {',
    ...pleiadesPairs,
    '};',
    '',
    'const ORBIS_NODES = [',
    ...nodeLines,
    '];',
    '',
  ].join('\n');
}

main().catch(e => { console.error(e); process.exit(1); });
