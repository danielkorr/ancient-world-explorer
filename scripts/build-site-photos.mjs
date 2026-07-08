// VIA - build-site-photos.mjs
//
// Builds Roman site hero photos separately from Alexander campaign photos.
// Source priority:
//   1. pinned Commons files for known bad/missing P18 choices
//   2. js/pleiades-photos.json cached Pleiades -> Wikidata P18 signal
//   3. Pleiades JSON -> Wikidata P18 for unresolved foreground sites
//
// Output:
//   js/site-photos.js
//     window.SITE_PHOTOS = { <pleiadesId>: { thumb, full, credit, license, source, position? } }
//
// Vici photos stay a runtime fallback in app.js. Alexander keeps using its own
// generated file so crossover sites do not merge display state across tabs.

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'pleiades-json');
const PHOTOS_JSON = path.join(ROOT, 'js', 'pleiades-photos.json');
const SITE_FILES = [
  path.join(ROOT, 'js', 'data.js'),
  path.join(ROOT, 'js', 'sites-pleiades.js'),
];
const OUT_PATH  = path.join(ROOT, 'js', 'site-photos.js');

const REFRESH = process.argv.includes('--refresh');
const RATE_MS = 1100;
const UA = 'VIA-AncientWorldExplorer/0.1 (https://github.com/danielkorr/ancient-world-explorer; +roman site photos)';
const THUMB_W = 900;

const PINNED_FILES = {
  // Roma's P18 is a diagram of legendary early Rome, not a site photograph.
  '423025': 'Colosseum in Rome, Italy - April 2007.jpg',
  // Alexandria's P18 is a modern skyline. Use visible archaeological remains.
  '727070': 'Alexandrie_Théâtre_romain_2.jpg',
};
const PINNED_POSITION = {
  '423025': 'center 52%',
  '727070': 'center 45%',
};

async function exists(p) { try { await stat(p); return true; } catch { return false; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
function isUsableImageName(file) {
  if (!file) return false;
  if (/\.svg$/i.test(file)) return false;
  if (/\b(map|coin|coins|diagram|plan|periplous)\b/i.test(file)) return false;
  return true;
}

async function loadSites() {
  const byPid = new Map();
  for (const file of SITE_FILES) {
    if (!await exists(file)) continue;
    const src = await readFile(file, 'utf8');
    for (const chunk of src.split(/\n\s*\{/).slice(1)) {
      const id = (chunk.match(/["']?id["']?\s*:\s*["']([^"']+)["']/) || [])[1];
      const pid = (chunk.match(/["']?pleiades["']?\s*:\s*["']?(\d+)["']?/) || [])[1];
      const name = (chunk.match(/["']?name["']?\s*:\s*["']([^"']+)["']/) || [])[1];
      if (pid && !byPid.has(pid)) byPid.set(pid, { id: id || `pleiades-${pid}`, pleiades: pid, name: name || `Pleiades ${pid}` });
    }
  }
  return [...byPid.values()];
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
  const out = {};
  for (let i = 0; i < qids.length; i += 50) {
    const batch = qids.slice(i, i + 50);
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', batch.join('|'));
    url.searchParams.set('props', 'claims');
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    const data = await res.json();
    for (const qid of batch) {
      const ent = data.entities && data.entities[qid];
      const claims = (ent && ent.claims && ent.claims.P18) || [];
      out[qid] = claims.length && claims[0].mainsnak && claims[0].mainsnak.datavalue
        ? claims[0].mainsnak.datavalue.value : null;
    }
    await sleep(250);
  }
  return out;
}

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
  const sites = await loadSites();
  console.log(`✓ ${sites.length} Roman/VIA foreground Pleiades ids found`);

  const cachedPhotos = JSON.parse(await readFile(PHOTOS_JSON, 'utf8'));
  const fileByPid = {};
  const needResolve = [];
  for (const s of sites) {
    const rec = cachedPhotos[s.pleiades];
    if (PINNED_FILES[s.pleiades]) fileByPid[s.pleiades] = PINNED_FILES[s.pleiades];
    else if (rec && isUsableImageName(rec.image)) fileByPid[s.pleiades] = rec.image;
    else needResolve.push(s);
  }
  console.log(`  ${Object.keys(fileByPid).length} cached/pinned usable image filenames; resolving ${needResolve.length} more`);

  const qidByPid = {};
  for (let i = 0; i < needResolve.length; i++) {
    const s = needResolve[i];
    const t = Date.now();
    try {
      const rec = await fetchPleiadesJson(s.pleiades);
      qidByPid[s.pleiades] = extractWikidataId(rec);
      if ((i + 1) % 25 === 0 || i === needResolve.length - 1) {
        console.log(`  [${i + 1}/${needResolve.length}] ${s.name}`);
      }
    } catch (e) {
      console.warn(`  [${i + 1}/${needResolve.length}] ${s.name} ERROR ${e.message}`);
      qidByPid[s.pleiades] = null;
    }
    const el = Date.now() - t;
    if (i < needResolve.length - 1 && el < RATE_MS) await sleep(RATE_MS - el);
  }

  const qids = [...new Set(Object.values(qidByPid).filter(Boolean))];
  const p18 = await fetchWikidataP18(qids);
  for (const [pid, qid] of Object.entries(qidByPid)) {
    if (qid && isUsableImageName(p18[qid])) fileByPid[pid] = p18[qid];
  }

  const files = [...new Set(Object.values(fileByPid))];
  console.log(`\n── Commons imageinfo for ${files.length} files ──`);
  const info = await fetchCommonsInfo(files);

  const outObj = {};
  let ok = 0;
  for (const s of sites) {
    const file = fileByPid[s.pleiades];
    const ci = file && info[file];
    if (ci && ci.thumb) {
      outObj[s.pleiades] = { thumb: ci.thumb, full: ci.full, credit: ci.credit, license: ci.license, source: ci.source };
      if (PINNED_POSITION[s.pleiades]) outObj[s.pleiades].position = PINNED_POSITION[s.pleiades];
      ok++;
    }
  }

  const banner =
    '// AUTO-GENERATED by scripts/build-site-photos.mjs - do not hand-edit.\n' +
    '// Roman/VIA site hero photos from Pleiades -> Wikidata P18 -> Wikimedia Commons.\n' +
    '// Alexander campaign stops use js/alexander-photos.js instead.\n';
  await writeFile(OUT_PATH, `${banner}window.SITE_PHOTOS = ${JSON.stringify(outObj, null, 2)};\n`);

  console.log(`\n✓ ${ok} sites with a Commons hero photo, ${sites.length - ok} without`);
  console.log(`✓ wrote ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
