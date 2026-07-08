// ═══════════════════════════════════════════════════════════
//  VIA — build-alexander-photos.mjs
//
//  Gives each Alexander campaign stop a hero photo from the SCHOLARLY
//  record: Pleiades → Wikidata P18 → Wikimedia Commons, with correct
//  attribution baked in (Commons images carry per-file licenses).
//
//    1. Read the stops' Pleiades ids from js/alexander.js.
//    2. Resolve each id's Commons image FILENAME:
//         - reuse js/pleiades-photos.json when it already has one, else
//         - fetch Pleiades JSON (cached), pull the Wikidata Q-id from
//           references[], batch-query Wikidata for P18.
//    3. For every filename, one Commons `imageinfo` pass for a right-sized
//       thumbnail URL + license (LicenseShortName) + author (Artist).
//    4. Emit js/alexander-photos.js:
//         window.ALEXANDER_PHOTOS = {
//           <pleiadesId>: { thumb, full, credit, license, source }
//         }
//
//  Reuses the same .cache/pleiades-json cache + UA + rate limit as
//  detect-pleiades-photos.mjs. Does NOT touch pleiades-photos.json.
//
//  Usage:
//    node scripts/build-alexander-photos.mjs
//    node scripts/build-alexander-photos.mjs --refresh   # re-fetch Pleiades JSON
// ═══════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'pleiades-json');
const PHOTOS_JSON = path.join(ROOT, 'js', 'pleiades-photos.json');
const ALEX_JS   = path.join(ROOT, 'js', 'alexander.js');
const OUT_PATH  = path.join(ROOT, 'js', 'alexander-photos.js');

const REFRESH = process.argv.includes('--refresh');
const RATE_MS = 1100;
const UA = 'VIA-AncientWorldExplorer/0.1 (https://github.com/danielkorr/ancient-world-explorer; +alexander photos)';
const THUMB_W = 900;   // hero strip is ~360-460px; 900 covers 2x displays
const PINNED_FILES = {
  // P18 is occasionally a modern skyline or a crop that fails in the narrow hero.
  // Keep those corrections here so js/alexander-photos.js remains generated.
  '727070': 'Alexandrie_Théâtre_romain_2.jpg',
  '961886': 'Green Mosque, Balkh.jpg',
  '922693': 'Cyrus_tomb.jpg',
  '922695': 'پانوراما روز تخت جمشید.jpg',
  'sogdian-rock': 'Vista de les muntanyes al sud de Mazori Sharif (Panjakent, Sughd, Tajikistan).jpg',
  '59987': 'Indus River Delta.jpg',
  'gedrosian-route': 'Baluchistan Canyons.jpg',
  'opis': '160731-D-PB383-021 Tigris River flows through Baghdad, July 2016.JPG',
};
const PINNED_POSITION = {
  '727070': 'center 45%',
  '961886': 'center 48%',
  '922693': 'center 42%',
  '922695': 'center 55%',
  'sogdian-rock': 'center 52%',
  '59987': 'center 50%',
  'gedrosian-route': 'center 48%',
  'opis': 'center 52%',
};
const PINNED_CAPTION = {
  '961886': 'Pictured: later ruins at Balkh/Bactra',
  'sogdian-rock': 'Pictured: Sughd mountain landscape; exact site disputed',
  '59987': 'Pictured: Indus delta; Patala location approximate',
  'gedrosian-route': 'Pictured: Makran/Balochistan landscape; route generalized',
  'opis': 'Pictured: Tigris near Baghdad; Opis location uncertain',
};

async function exists(p) { try { await stat(p); return true; } catch { return false; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

// Parse { id, pleiades?, name } out of each ALEXANDER_STOPS object.
async function loadStops() {
  const src = await readFile(ALEX_JS, 'utf8');
  const block = src.slice(src.indexOf('const ALEXANDER_STOPS'), src.indexOf('const ALEXANDER_ROUTES'));
  const stops = [];
  // split on object boundaries "  {"
  for (const chunk of block.split(/\n  \{/).slice(1)) {
    const id = (chunk.match(/id:\s*'([^']+)'/) || [])[1];
    const pl = (chunk.match(/pleiades:\s*(\d+)/) || [])[1];
    const nm = (chunk.match(/name:\s*'([^']*)'/) || [])[1];
    if (id) stops.push({ id, pleiades: pl || null, key: pl || id, name: nm || id });
  }
  return stops;
}

async function fetchPleiadesJson(id) {
  const cached = path.join(CACHE_DIR, `${id}.json`);
  if (!REFRESH && await exists(cached)) return JSON.parse(await readFile(cached, 'utf8'));
  const res = await fetch(`https://pleiades.stoa.org/places/${id}/json`, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Pleiades HTTP ${res.status}`);
  const json = await res.json();
  await writeFile(cached, JSON.stringify(json));
  return json;
}

function extractWikidataId(record) {
  const WD_RE = /wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i;
  for (const r of (record.references || [])) {
    for (const field of ['accessURI', 'identifier', 'bibliographicURI', 'alternateURI']) {
      const v = r[field];
      if (typeof v === 'string') { const m = v.match(WD_RE); if (m) return m[1]; }
    }
  }
  return null;
}

async function fetchWikidataP18(qids) {
  if (!qids.length) return {};
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', qids.join('|'));
  url.searchParams.set('props', 'claims');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const data = await res.json();
  const out = {};
  for (const qid of qids) {
    const ent = data.entities && data.entities[qid];
    const claims = (ent && ent.claims && ent.claims.P18) || [];
    out[qid] = claims.length && claims[0].mainsnak && claims[0].mainsnak.datavalue
      ? claims[0].mainsnak.datavalue.value : null;
  }
  return out;
}

// Commons imageinfo: thumbnail URL + license + author, per file.
async function fetchCommonsInfo(files) {
  const out = {};
  for (let i = 0; i < files.length; i += 20) {
    const batch = files.slice(i, i + 20);
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', batch.map(f => `File:${f}`).join('|'));
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|extmetadata');
    url.searchParams.set('iiurlwidth', String(THUMB_W));
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Commons HTTP ${res.status}`);
    const data = await res.json();
    for (const page of (data.query && data.query.pages) || []) {
      const title = page.title.replace(/^File:/, '');
      const ii = page.imageinfo && page.imageinfo[0];
      if (!ii) { out[title] = null; continue; }
      const meta = ii.extmetadata || {};
      const artist = stripHtml(meta.Artist && meta.Artist.value);
      const entry = {
        thumb:   ii.thumburl || ii.url,
        full:    ii.url,
        credit:  (!artist || /^(not stated|unknown)$/i.test(artist)) ? 'Wikimedia Commons' : artist,
        license: stripHtml(meta.LicenseShortName && meta.LicenseShortName.value) || '',
        source:  ii.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}`,
      };
      out[title] = entry;
      out[title.replace(/\s+/g, '_')] = entry;
    }
    await sleep(400);
  }
  return out;
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const stops = await loadStops();
  console.log(`✓ ${stops.length} Alexander stops found`);

  const cachedPhotos = JSON.parse(await readFile(PHOTOS_JSON, 'utf8'));

  // Resolve a Commons filename for each stop.
  const fileByKey = {};
  const needResolve = [];
  for (const s of stops) {
    const rec = s.pleiades ? cachedPhotos[s.pleiades] : null;
    if (PINNED_FILES[s.key]) fileByKey[s.key] = PINNED_FILES[s.key];
    else if (rec && rec.image) fileByKey[s.key] = rec.image;
    else if (s.pleiades) needResolve.push(s);
  }
  console.log(`  ${Object.keys(fileByKey).length} already have a cached/pinned filename; resolving ${needResolve.length} more`);

  // Pass 1: Pleiades JSON → Wikidata Q-id for the unresolved ids.
  const qidByPid = {};
  for (let i = 0; i < needResolve.length; i++) {
    const s = needResolve[i];
    const t = Date.now();
    try {
      const rec = await fetchPleiadesJson(s.pleiades);
      qidByPid[s.pleiades] = extractWikidataId(rec);
      console.log(`  [${i + 1}/${needResolve.length}] ${s.name} (${s.pleiades}) → ${qidByPid[s.pleiades] || '(no Wikidata)'}`);
    } catch (e) {
      console.warn(`  [${i + 1}/${needResolve.length}] ${s.name} ERROR ${e.message}`);
      qidByPid[s.pleiades] = null;
    }
    const el = Date.now() - t;
    if (i < needResolve.length - 1 && el < RATE_MS) await sleep(RATE_MS - el);
  }

  // Pass 2: Wikidata P18 for those Q-ids.
  const qids = [...new Set(Object.values(qidByPid).filter(Boolean))];
  const p18 = await fetchWikidataP18(qids);
  for (const [pid, qid] of Object.entries(qidByPid)) {
    if (qid && p18[qid]) fileByKey[pid] = p18[qid];
  }

  // Pass 3: Commons imageinfo (thumb + license + author) for every filename.
  const files = [...new Set(Object.values(fileByKey))];
  console.log(`\n── Commons imageinfo for ${files.length} files ──`);
  const info = await fetchCommonsInfo(files);

  // Assemble output keyed by pleiades id.
  const outObj = {};
  let ok = 0, noImg = 0;
  for (const s of stops) {
    const file = fileByKey[s.key];
    const ci = file && info[file];
    if (ci && ci.thumb) {
      outObj[s.key] = { thumb: ci.thumb, full: ci.full, credit: ci.credit, license: ci.license, source: ci.source };
      if (PINNED_POSITION[s.key]) outObj[s.key].position = PINNED_POSITION[s.key];
      if (PINNED_CAPTION[s.key]) outObj[s.key].caption = PINNED_CAPTION[s.key];
      ok++;
    } else {
      noImg++;
      console.log(`  ○ no image: ${s.name} (${s.key})`);
    }
  }

  const banner =
    '// AUTO-GENERATED by scripts/build-alexander-photos.mjs — do not hand-edit.\n' +
    '// Hero photos for Alexander campaign stops, from Wikidata P18 → Wikimedia\n' +
    '// Commons. Each carries a right-sized thumbnail + attribution (Commons\n' +
    '// images are individually licensed — the panel shows credit + license).\n';
  await writeFile(OUT_PATH, `${banner}window.ALEXANDER_PHOTOS = ${JSON.stringify(outObj, null, 2)};\n`);

  console.log(`\n✓ ${ok} stops with a hero photo, ${noImg} without`);
  console.log(`✓ wrote ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
