// ═══════════════════════════════════════════════════════════
//  VIA — build-linked-data.mjs   (foreground sites)
//
//  Incorporates the Pleiades "Linked Data Sidebar"
//  (https://pleiades.stoa.org/help/linked-data-sidebar): the aggregation
//  of INBOUND links to each Pleiades place from ~21 external scholarly
//  datasets (EDH inscriptions, ToposText texts, Nomisma coins, MANTO myth,
//  Wikidata, Vici.org, Trismegistos, …).
//
//  The live place pages sit behind an anti-bot wall, so we read the same
//  data from the published bulk collection in the pleiades.datasets repo:
//    https://raw.githubusercontent.com/isawnyu/pleiades.datasets/main/data/sidebar/<d>/<d>/<d>/<id>.json
//  (sharded by the first three digits of the Pleiades id). No API key, no
//  rate limit, no bot wall. Cached under .cache/pleiades-sidebar/.
//
//  Each sidebar file is an array of Features:
//    { "@id": <external resource URI>,
//      "properties": { "title", "summary", "reciprocal": bool },
//      "links": [ { "type": "closeMatch", "identifier": <uri> }, … ] }
//  The SOURCE dataset is the host of "@id"; the clickable link is "@id".
//
//  Output: js/sites-linked-data.js
//    window.SITES_LINKED_DATA = {
//      "<pleiades>": {
//        total: <int>,                       // total inbound features
//        sources: [ { key, label, recip, n, items:[{ t:title, u:url, r:recip }] } ]
//      }, …
//    }
//  Grouped by source, scholarly sources first, capped per source.
//
//  Usage:
//    node scripts/build-linked-data.mjs            # all foreground pleiades ids (960)
//    node scripts/build-linked-data.mjs --sample 8 # spike a handful
//    node scripts/build-linked-data.mjs --refresh  # bust the sidebar cache
//
//  SCOPE: foreground = curated + SITES_PLEIADES + SITES_VICI (the real markers /
//  full panels), deduped. The ~25k coverage long tail is excluded (thin panel,
//  no card). Emitted alongside the other build outputs.
// ═══════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'pleiades-sidebar');
const OUT_PATH  = path.join(ROOT, 'js', 'sites-linked-data.js');

const REFRESH    = process.argv.includes('--refresh');
const SAMPLE_IDX = process.argv.indexOf('--sample');
const SAMPLE     = SAMPLE_IDX >= 0 ? Number(process.argv[SAMPLE_IDX + 1] || 8) : 0;

const RATE_MS = 250;   // polite gap on cache miss (GitHub raw, no hard limit)
const UA      = 'VIA-AncientWorldExplorer/0.1 (https://github.com/danielkorr/ancient-world-explorer; +linked-data-sidebar spike)';
const MAX_PER_SOURCE = 12;   // cap items kept per source (Roma alone has 768 features)
const RAW_BASE = 'https://raw.githubusercontent.com/isawnyu/pleiades.datasets/main/data/sidebar';

// Source classification by "@id" host.
//
// EVIDENCE-ONLY POLICY: the card surfaces only sources that bring data VIA does
// NOT already give the user — primary-source evidence about the place
// (inscriptions, ancient texts, coins, myth, excavation reports). Everything else
// is deliberately excluded:
//   - Vici.org → already has its own panel button (was a literal duplicate)
//   - Itiner-e → already a first-class map layer (the roads)
//   - Wikidata / DBpedia / GeoNames / Getty / VIAF / Trismegistos / WHG → identity
//     hubs ("same place, other catalogue id"), one Pleiades click away, no new info
// Labels lead with the CONTENT type (what you get), source name second.
// Array order = display order. `ev:true` marks a source the card will render.
const SOURCES = [
  { re: /edh\.ub\.uni-heidelberg|edh-www|\/edh\//i,        key: 'edh',          label: 'Inscriptions · EDH',                 ev: true },
  { re: /topostext\.org/i,                                  key: 'topostext',    label: 'Ancient texts · ToposText',          ev: true },
  { re: /nomisma\.org/i,                                    key: 'nomisma',      label: 'Coins · Nomisma',                    ev: true },
  { re: /manto/i,                                           key: 'manto',        label: 'Myth & genealogy · MANTO',           ev: true },
  { re: /chronique|efa\.gr|chgk|cfl|\bago\b|archaeology.*greece/i, key: 'ago',   label: 'Excavation reports · Greece (AGO)',  ev: true },
  { re: /classical-?temples|templ/i,                        key: 'temples',      label: 'Temples · Classical Temples',        ev: true },
  { re: /p-?lod|pompeii.*lod/i,                             key: 'plod',         label: 'Pompeii archaeology · P-LOD',        ev: true },
  { re: /paths|coptic/i,                                    key: 'paths',        label: 'Coptic texts · PAThs',               ev: true },
  // --- classified but NOT shown (identity hubs / already-in-VIA) ---
  { re: /itiner-?e/i,                                       key: 'itinere',      label: 'Itiner-e' },
  { re: /vici\.org/i,                                       key: 'vici',         label: 'Vici.org' },
  { re: /whgazetteer|whg|worldhistory/i,                    key: 'whg',          label: 'World Historical Gazetteer' },
  { re: /trismegistos/i,                                    key: 'trismegistos', label: 'Trismegistos' },
  { re: /wikidata\.org/i,                                   key: 'wikidata',     label: 'Wikidata' },
  { re: /dbpedia\.org|wikipedia/i,                          key: 'dbpedia',      label: 'DBpedia / Wikipedia' },
  { re: /geonames/i,                                        key: 'geonames',     label: 'GeoNames' },
  { re: /getty\.edu/i,                                      key: 'getty',        label: 'Getty TGN' },
  { re: /viaf\.org/i,                                       key: 'viaf',         label: 'VIAF' },
];
const SOURCE_ORDER = Object.fromEntries(SOURCES.map((s, i) => [s.key, i]));
const EVIDENCE_KEYS = new Set(SOURCES.filter((s) => s.ev).map((s) => s.key));

async function exists(p) { try { await stat(p); return true; } catch { return false; } }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Foreground = every place that renders as a real marker + opens the full panel:
// curated (data.js) + SITES_PLEIADES + SITES_VICI, deduped by pleiades id. NOT the
// ~25k coverage long tail (background canvas dots open a thin panel, no card). The
// regex is format-agnostic: matches both `pleiades:"123"` (data.js) and the
// JSON-style `"pleiades":"123"` (generated files).
async function loadForegroundPleiadesIds() {
  const ids = new Set();
  for (const file of ['js/data.js', 'js/sites-pleiades.js', 'js/sites-vici.js']) {
    const text = await readFile(path.join(ROOT, file), 'utf8');
    for (const m of text.matchAll(/pleiades"?\s*:\s*"?(\d+)/g)) ids.add(m[1]);
  }
  return [...ids];
}

function shardUrl(id) {
  const d = id.slice(0, 3).split('').join('/');
  return `${RAW_BASE}/${d}/${id}.json`;
}

async function fetchSidebar(id) {
  const cached = path.join(CACHE_DIR, `${id}.json`);
  if (!REFRESH && await exists(cached)) {
    return JSON.parse(await readFile(cached, 'utf8'));
  }
  const res = await fetch(shardUrl(id), { headers: { 'User-Agent': UA } });
  if (res.status === 404) { await writeFile(cached, '[]'); return []; }  // no sidebar for this place
  if (!res.ok) throw new Error(`sidebar HTTP ${res.status}`);
  const json = await res.json();
  await writeFile(cached, JSON.stringify(json));
  return json;
}

function classify(uri) {
  for (const s of SOURCES) if (s.re.test(uri)) return s;
  let host = 'other';
  try { host = new URL(uri).host.replace(/^www\./, ''); } catch {}
  return { key: 'other:' + host, label: host };
}

// Roll a sidebar feature array into grouped EVIDENCE sources for one place.
// Non-evidence features (identity hubs, already-in-VIA datasets) are dropped here,
// so a place with only those produces no card at all — which is correct: the card
// exists only when there's primary-source data the user can't already reach.
function rollup(features) {
  if (!Array.isArray(features) || !features.length) return null;
  const groups = new Map();
  for (const f of features) {
    const uri = f && f['@id'];
    if (typeof uri !== 'string') continue;
    const src = classify(uri);
    if (!EVIDENCE_KEYS.has(src.key)) continue;   // evidence-only
    const p = f.properties || {};
    if (!groups.has(src.key)) groups.set(src.key, { key: src.key, label: src.label, recip: false, n: 0, items: [] });
    const g = groups.get(src.key);
    g.n += 1;
    if (p.reciprocal) g.recip = true;
    if (g.items.length < MAX_PER_SOURCE) {
      g.items.push({ t: p.title || uri, u: uri, r: !!p.reciprocal });
    }
  }
  if (!groups.size) return null;
  const sources = [...groups.values()].sort((a, b) => {
    const oa = SOURCE_ORDER[a.key] ?? 999, ob = SOURCE_ORDER[b.key] ?? 999;
    if (oa !== ob) return oa - ob;
    return b.n - a.n;
  });
  const total = sources.reduce((sum, s) => sum + s.n, 0);
  return { total, sources };
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  let ids = await loadForegroundPleiadesIds();
  if (SAMPLE) ids = ids.slice(0, SAMPLE);
  console.log(`Linked-data sidebar: ${ids.length} foreground Pleiades ids`);

  const out = {};
  let withData = 0, totalFeatures = 0;
  const sourceTally = new Map();

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    let hit = await exists(path.join(CACHE_DIR, `${id}.json`));
    let features;
    try { features = await fetchSidebar(id); }
    catch (e) { console.warn(`  ! ${id}: ${e.message}`); continue; }
    const rolled = rollup(features);
    if (rolled) {
      out[id] = rolled;
      withData += 1;
      totalFeatures += rolled.total;
      for (const s of rolled.sources) sourceTally.set(s.label, (sourceTally.get(s.label) || 0) + 1);
    }
    process.stdout.write(`\r  ${i + 1}/${ids.length}  ${id}${rolled ? ` (${rolled.total})` : ' (—)'}        `);
    if (!hit && i < ids.length - 1) await sleep(RATE_MS);
  }
  console.log();

  const banner =
    `// AUTO-GENERATED by scripts/build-linked-data.mjs — DO NOT EDIT.\n` +
    `// Pleiades Linked Data Sidebar (inbound cross-references), CC-BY Pleiades contributors.\n` +
    `// Source: pleiades.datasets /data/sidebar/. SPIKE: curated sites only.\n`;
  await writeFile(OUT_PATH, `${banner}window.SITES_LINKED_DATA = ${JSON.stringify(out)};\n`);

  console.log(`\nWrote ${OUT_PATH}`);
  console.log(`  ${withData}/${ids.length} foreground places have sidebar data`);
  console.log(`  ${totalFeatures} total inbound features`);
  console.log(`  source coverage (places per source):`);
  [...sourceTally.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([label, n]) => console.log(`    ${String(n).padStart(3)}  ${label}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
