// ═══════════════════════════════════════════════════════════
//  VIA — build-coverage-photos.mjs
//
//  Bulk-resolves a "does a decent photo exist" signal for the coverage-tier
//  long tail (js/sites-coverage.js, ~25k thin Pleiades stubs) via Wikidata's
//  Pleiades cross-reference property (P1584) and its image property (P18).
//  Unlike detect-pleiades-photos.mjs (which needs an exact scholarly answer
//  for the foreground quest system), this is a "good enough, looks related"
//  signal for a cosmetic panel photo — see the coverage-photo-layer decision:
//  precision isn't required, just plausibility. A light P31 ("instance of")
//  blacklist excludes categories that clearly wouldn't read as a place photo
//  (rivers, seas, ethnic groups, provinces, etc.).
//
//  Output: js/coverage-photos.json, pleiades id -> { url, credit, license }
//  url is a Wikimedia Commons Special:FilePath URL (same commonsSized()
//  resizing convention as site.photo on curated sites, js/app.js).
//
//  Usage:
//    node scripts/build-coverage-photos.mjs
//    node scripts/build-coverage-photos.mjs --sample 500
// ═══════════════════════════════════════════════════════════

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COVERAGE_PATH = path.join(ROOT, 'js', 'sites-coverage.js');
const OUT_PATH = path.join(ROOT, 'js', 'coverage-photos.json');

const UA = 'VIA-AncientWorldExplorer/0.1 (https://github.com/danielkorr/ancient-world-explorer; +coverage-photo signal)';
const SPARQL_BATCH = 1200;
const COMMONS_BATCH = 50;

const SAMPLE_IDX = process.argv.indexOf('--sample');
const SAMPLE = SAMPLE_IDX >= 0 ? Number(process.argv[SAMPLE_IDX + 1] || 500) : 0;

// P31 ("instance of") values that clearly wouldn't read as a place photo —
// rivers/seas, human groups, and administrative abstractions. Deliberately
// short: the brief here is "looks related," not "is exactly this monument."
const P31_BLACKLIST = new Set([
  'Q4022',      // river
  'Q355304',    // watercourse
  'Q47521',     // stream
  'Q165',       // sea
  'Q15324',     // body of water
  'Q23397',     // lake
  'Q8502',      // mountain
  'Q46831',     // mountain range
  'Q82794',     // human settlement (region-level dupes sometimes tagged this loosely) — see note below, actually keep
  'Q1620908',   // historical region
  'Q41710',     // ethnic group
  'Q4204501',   // historical ethnic group
  'Q2472587',   // people (ethnic/social group)
  'Q211503',    // tribe
  'Q1152444',   // Germanic tribe
  'Q34770',     // language
  'Q25295',     // language family
  'Q210980',    // archaeological culture
  'Q173527',    // Roman province
  'Q3024240',   // historical country
]);
// Q82794 ("geographic region") is ambiguous — Pleiades regions sometimes get
// this generically. Left in deliberately; a region-level photo is still
// "related," just less site-specific, and the bar here is low.
P31_BLACKLIST.delete('Q82794');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function loadCoverageIds() {
  const src = await readFile(COVERAGE_PATH, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const sites = sandbox.window.SITES_COVERAGE || [];
  return [...new Set(sites.map(s => s.pleiades).filter(Boolean))];
}

async function sparqlBatch(ids) {
  const values = ids.map(id => `"${id}"`).join(' ');
  const query = `SELECT ?pleiades ?item ?image ?type WHERE {
    VALUES ?pleiades { ${values} }
    ?item wdt:P1584 ?pleiades .
    OPTIONAL { ?item wdt:P18 ?image }
    OPTIONAL { ?item wdt:P31 ?typeItem . BIND(STRAFTER(STR(?typeItem), "entity/") AS ?type) }
  }`;
  const res = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Accept': 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'format=json&query=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const data = await res.json();
  // Group by pleiades id: collect image (first seen) + all P31 types.
  const byPleiades = new Map();
  for (const b of data.results.bindings) {
    const pid = b.pleiades.value;
    if (!byPleiades.has(pid)) byPleiades.set(pid, { image: null, types: new Set() });
    const rec = byPleiades.get(pid);
    if (b.image && !rec.image) rec.image = b.image.value;
    if (b.type) rec.types.add(b.type.value);
  }
  return byPleiades;
}

async function commonsImageInfoBatch(titles) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&titles=' +
    encodeURIComponent(titles.join('|')) + '&format=json&formatversion=2';
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons HTTP ${res.status}`);
  const data = await res.json();
  const out = {};
  for (const p of data.query.pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const em = ii.extmetadata || {};
    out[p.title] = {
      credit: em.Artist ? em.Artist.value.replace(/<[^>]+>/g, '').trim().slice(0, 120) : null,
      license: em.LicenseShortName ? em.LicenseShortName.value : null,
    };
  }
  return out;
}

async function main() {
  let ids = await loadCoverageIds();
  console.log(`✓ ${ids.length} unique coverage-tier Pleiades ids`);
  if (SAMPLE > 0) { ids = ids.slice(0, SAMPLE); console.log(`⚡ sample mode: first ${ids.length}`); }

  console.log(`\n── Pass 1: Wikidata P1584 → P18/P31 (batches of ${SPARQL_BATCH}) ──`);
  const resolved = new Map(); // pleiades -> { image, types }
  for (let i = 0; i < ids.length; i += SPARQL_BATCH) {
    const batch = ids.slice(i, i + SPARQL_BATCH);
    try {
      const results = await sparqlBatch(batch);
      for (const [pid, rec] of results) resolved.set(pid, rec);
      console.log(`  [${Math.min(i + SPARQL_BATCH, ids.length)}/${ids.length}] batch done, running hits: ${resolved.size}`);
    } catch (e) {
      console.warn(`  batch ${i} ERROR ${e.message}`);
    }
    await sleep(300);
  }

  console.log(`\n── Filtering (P31 blacklist) ──`);
  let noImage = 0, blacklisted = 0, kept = 0;
  const imageByPleiades = new Map(); // pleiades -> filename (decoded, no path prefix)
  for (const [pid, rec] of resolved) {
    if (!rec.image) { noImage++; continue; }
    const isBad = [...rec.types].some(t => P31_BLACKLIST.has(t));
    if (isBad) { blacklisted++; continue; }
    const m = rec.image.match(/Special:FilePath\/(.+)$/);
    const filename = m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
    if (!filename) continue;
    imageByPleiades.set(pid, filename);
    kept++;
  }
  console.log(`  no image: ${noImage}  blacklisted category: ${blacklisted}  kept: ${kept}`);

  console.log(`\n── Pass 2: Commons imageinfo (credit/license, batches of ${COMMONS_BATCH}) ──`);
  const filenames = [...imageByPleiades.values()];
  const infoByFilename = {};
  for (let i = 0; i < filenames.length; i += COMMONS_BATCH) {
    const batch = filenames.slice(i, i + COMMONS_BATCH);
    const titles = batch.map(f => `File:${f}`);
    try {
      const info = await commonsImageInfoBatch(titles);
      for (const [title, meta] of Object.entries(info)) {
        infoByFilename[title.replace(/^File:/, '')] = meta;
      }
      if ((i / COMMONS_BATCH) % 10 === 0) console.log(`  [${Math.min(i + COMMONS_BATCH, filenames.length)}/${filenames.length}]`);
    } catch (e) {
      console.warn(`  imageinfo batch ${i} ERROR ${e.message}`);
    }
    await sleep(200);
  }

  console.log(`\n── Assembling output ──`);
  const out = {};
  for (const [pid, filename] of imageByPleiades) {
    const meta = infoByFilename[filename] || {};
    out[pid] = {
      url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`,
      credit: meta.credit || null,
      license: meta.license || null,
    };
  }
  await writeFile(OUT_PATH, JSON.stringify(out));
  console.log(`✓ wrote ${path.relative(ROOT, OUT_PATH)} (${Object.keys(out).length} entries)`);
}

main().catch(e => { console.error(e); process.exit(1); });
