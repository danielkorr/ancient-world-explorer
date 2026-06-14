// ═══════════════════════════════════════════════════════════
//  VIA — build-vici-links.mjs
//
//  Resolves each Pleiades place to its vici.org entry, if one exists.
//  vici.org (René Voorburg's crowdsourced archaeological atlas) cross-
//  references Pleiades: the link lives in the SAME Pleiades JSON we already
//  cache for photo detection, as a references[] entry whose accessURI is
//  https://vici.org/vici/<id>/ (shortTitle "vici.org"). So the
//  pleiades_id → vici_id join needs no new source — just a regex over the
//  cached records.
//
//  Two uses (see docs/v1-spec-photo-quest.md):
//    1. Runtime reference link on the info panel (scholar audience).
//    2. Quest-accuracy cross-check + editorial-seed source — a site we
//       flagged "no photo" via Wikidata P18 may already have one on vici.
//
//  ⚠ LICENSE: vici content is CC BY-SA 3.0 (ShareAlike) + CC0 metadata —
//  NOT CC-BY-4.0. Reference links are fine; if vici photos are ever used as
//  editorial seeds, record license as "CC-BY-SA-3.0" and keep attribution.
//
//  Photo presence (--photos): ⚠ UNRELIABLE, OFF BY DEFAULT. vici has no JSON
//  API (/json + /api 404), and the place page is a ~5 KB SHELL that renders
//  its gallery client-side via /js/common.js — the raw server HTML contains
//  neither the "No images available yet" sentinel NOR any image URLs, so the
//  scrape can't tell empty from populated (it reports ~all linked sites as
//  "has photo", which is false). The documented GeoJSON endpoint
//  (geojson.php?bbox=...) 403s without the right headers. Until a reliable
//  vici data source is confirmed, leave has_photo null and use the existing
//  Wikidata-P18 signal (detect-pleiades-photos.mjs) for "has a photo".
//  The --photos flag and its scraper are kept for when that source is found;
//  do not trust their output today.
//
//  Output: js/vici-links.js defining window.VICI_LINKS, a runtime global
//  (mirrors the other generated js/*.js files), mapping
//    pleiades_id → { vici, url, has_photo: boolean | null }
//
//  Usage:
//    node scripts/build-vici-links.mjs                 # id mapping only
//    node scripts/build-vici-links.mjs --photos        # + scrape photo flag
//    node scripts/build-vici-links.mjs --photos --refresh   # re-fetch all
//    node scripts/build-vici-links.mjs --sample 10
// ═══════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const PL_CACHE   = path.join(ROOT, '.cache', 'pleiades-json');
const VICI_CACHE = path.join(ROOT, '.cache', 'vici-html');
const OUT_PATH   = path.join(ROOT, 'js', 'vici-links.js');

const REFRESH    = process.argv.includes('--refresh');
const PHOTOS     = process.argv.includes('--photos');
const SAMPLE_IDX = process.argv.indexOf('--sample');
const SAMPLE     = SAMPLE_IDX >= 0 ? Number(process.argv[SAMPLE_IDX + 1] || 10) : 0;

const RATE_MS = 1100;
const UA      = 'VIA-AncientWorldExplorer/0.1 (https://github.com/danielkorr/ancient-world-explorer; +vici-link resolution)';
const VICI_RE = /vici\.org\/vici\/(\d+)/i;
const EMPTY_SENTINEL = 'No images available yet';

// ── HELPERS ───────────────────────────────────────────────

async function exists(p) { try { await stat(p); return true; } catch { return false; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function loadSitePleiadesIds() {
  const ids = new Set();
  for (const file of ['js/sites-pleiades.js', 'js/data.js']) {
    const text = await readFile(path.join(ROOT, file), 'utf8');
    for (const m of text.matchAll(/pleiades\s*:\s*"(\d+)"/g)) ids.add(m[1]);
  }
  return [...ids];
}

// Read a cached Pleiades record; fetch + cache on miss (same path/shape as
// detect-pleiades-photos.mjs, so a prior photo-detect run primes this for free).
async function fetchPleiadesJson(id) {
  const cached = path.join(PL_CACHE, `${id}.json`);
  if (!REFRESH && await exists(cached)) {
    return { json: JSON.parse(await readFile(cached, 'utf8')), fromCache: true };
  }
  const res = await fetch(`https://pleiades.stoa.org/places/${id}/json`, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Pleiades HTTP ${res.status}`);
  const json = await res.json();
  await writeFile(cached, JSON.stringify(json));
  return { json, fromCache: false };
}

// Pull the vici id out of a Pleiades record's references[].accessURI.
function extractViciId(record) {
  for (const r of (record.references || [])) {
    for (const field of ['accessURI', 'identifier', 'bibliographicURI', 'alternateURI']) {
      const v = r[field];
      if (typeof v === 'string') {
        const m = v.match(VICI_RE);
        if (m) return m[1];
      }
    }
  }
  return null;
}

// Scrape a vici place page for the empty-state sentinel. Returns true if the
// place has at least one of its own images, false if explicitly empty.
async function fetchViciHasPhoto(viciId) {
  const cached = path.join(VICI_CACHE, `${viciId}.html`);
  let html;
  if (!REFRESH && await exists(cached)) {
    html = await readFile(cached, 'utf8');
  } else {
    const res = await fetch(`https://vici.org/vici/${viciId}/`, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`vici HTTP ${res.status}`);
    html = await res.text();
    await writeFile(cached, html);
  }
  return !html.includes(EMPTY_SENTINEL);
}

// ── MAIN ──────────────────────────────────────────────────

async function main() {
  await mkdir(PL_CACHE, { recursive: true });
  await mkdir(VICI_CACHE, { recursive: true });

  let ids = await loadSitePleiadesIds();
  console.log(`✓ ${ids.length} unique Pleiades ids`);
  if (SAMPLE > 0) {
    ids = ids.slice(0, SAMPLE);
    console.log(`⚡ sample mode: first ${ids.length}`);
  }

  // PASS 1: Pleiades JSON → vici id (mostly from cache after a photo-detect run).
  console.log(`\n── Pass 1: Pleiades JSON → vici id ──`);
  const viciByPid = {};
  let i = 0, fetched = 0;
  for (const pid of ids) {
    i++;
    const t = Date.now();
    try {
      const { json, fromCache } = await fetchPleiadesJson(pid);
      viciByPid[pid] = extractViciId(json);
      if (!fromCache) fetched++;
      if (i <= 10 || i % 50 === 0) {
        console.log(`  [${i}/${ids.length}] ${pid} → ${viciByPid[pid] ? 'vici/' + viciByPid[pid] : '(none)'}`);
      }
      // Only rate-limit when we actually hit the network.
      if (!fromCache && i < ids.length) {
        const elapsed = Date.now() - t;
        if (elapsed < RATE_MS) await sleep(RATE_MS - elapsed);
      }
    } catch (e) {
      console.warn(`  [${i}/${ids.length}] ${pid} ERROR ${e.message}`);
      viciByPid[pid] = null;
    }
  }
  const linked = Object.entries(viciByPid).filter(([, v]) => v);
  console.log(`✓ ${linked.length}/${ids.length} sites have a vici.org link  (${fetched} Pleiades fetches, rest cached)`);

  // PASS 2 (optional): scrape vici for photo presence.
  const photoByPid = {};
  if (PHOTOS) {
    console.log(`\n── Pass 2: vici photo presence (rate: 1/sec) ──`);
    let j = 0, withPhoto = 0;
    for (const [pid, viciId] of linked) {
      j++;
      const t = Date.now();
      try {
        const has = await fetchViciHasPhoto(viciId);
        photoByPid[pid] = has;
        if (has) withPhoto++;
        if (j <= 10 || j % 50 === 0) {
          console.log(`  [${j}/${linked.length}] vici/${viciId} → ${has ? '📷 has photo' : '○ empty'}`);
        }
      } catch (e) {
        console.warn(`  [${j}/${linked.length}] vici/${viciId} ERROR ${e.message}`);
        photoByPid[pid] = null;
      }
      const elapsed = Date.now() - t;
      if (j < linked.length && elapsed < RATE_MS) await sleep(RATE_MS - elapsed);
    }
    console.log(`✓ ${withPhoto}/${linked.length} vici-linked sites have at least one photo on vici`);
  }

  // BUILD OUTPUT (sorted by pleiades id for stable diffs)
  const out = {};
  for (const [pid, viciId] of linked.sort((a, b) => Number(a[0]) - Number(b[0]))) {
    out[pid] = {
      vici: viciId,
      url: `https://vici.org/vici/${viciId}/`,
      has_photo: PHOTOS ? (photoByPid[pid] ?? null) : null,
    };
  }

  const body =
    `// AUTO-GENERATED by scripts/build-vici-links.mjs — do not hand-edit.\n` +
    `// Pleiades id → vici.org reference. Source content is CC BY-SA 3.0 (+CC0\n` +
    `// metadata) — NOT CC-BY-4.0; record license accordingly if ever reused.\n` +
    `// has_photo: true|false only when built with --photos, else null.\n` +
    `window.VICI_LINKS = ${JSON.stringify(out, null, 2)};\n`;
  await writeFile(OUT_PATH, body);
  console.log(`\n✓ wrote ${path.relative(ROOT, OUT_PATH)} (${Object.keys(out).length} entries)`);

  if (SAMPLE > 0) {
    console.log(`\n--- SAMPLE PREVIEW ---`);
    for (const [pid, r] of Object.entries(out)) {
      const tag = r.has_photo === true ? '📷' : r.has_photo === false ? '○' : ' ';
      console.log(`  ${pid.padEnd(11)} ${tag}  vici/${r.vici}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
