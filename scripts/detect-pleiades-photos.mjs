// ═══════════════════════════════════════════════════════════
//  VIA — detect-pleiades-photos.mjs
//
//  Decides whether each Pleiades place has a portrait photo "in the
//  scholarly record". Pleiades JSON itself doesn't expose photo
//  presence, so we triangulate via Wikidata:
//
//    1. For each site, fetch Pleiades JSON, extract any Wikidata Q-id
//       from the references[].accessURI list.
//    2. Batch-query Wikidata (50 entities per request) for the P18
//       "image" property on each Q-id.
//    3. Classification:
//         no Wikidata link            → photo quest (no scholarly record)
//         Wikidata link, no P18        → photo quest (Wikidata has no image)
//         Wikidata link with P18       → has photo, no quest
//
//  Output: js/pleiades-photos.json mapping pleiades_id → {
//    has_photo: boolean | null,
//    wikidata: "Q..." | null,
//    image:    "filename or url" | null,
//    reason:   "no-wikidata" | "no-p18" | "has-p18" | "error"
//  }
//
//  Usage:
//    node scripts/detect-pleiades-photos.mjs --sample 10
//    node scripts/detect-pleiades-photos.mjs
//    node scripts/detect-pleiades-photos.mjs --refresh   # re-fetch all
// ═══════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'pleiades-json');
const OUT_PATH  = path.join(ROOT, 'js', 'pleiades-photos.json');

const REFRESH    = process.argv.includes('--refresh');
const SAMPLE_IDX = process.argv.indexOf('--sample');
const SAMPLE     = SAMPLE_IDX >= 0 ? Number(process.argv[SAMPLE_IDX + 1] || 10) : 0;

const RATE_MS = 1100;
const UA      = 'VIA-AncientWorldExplorer/0.1 (https://github.com/danielkorr/ancient-world-explorer; +photo-quest detection)';
const WD_BATCH = 50;

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

async function fetchPleiadesJson(id) {
  const cached = path.join(CACHE_DIR, `${id}.json`);
  if (!REFRESH && await exists(cached)) {
    return JSON.parse(await readFile(cached, 'utf8'));
  }
  const res = await fetch(`https://pleiades.stoa.org/places/${id}/json`, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Pleiades HTTP ${res.status}`);
  const json = await res.json();
  await writeFile(cached, JSON.stringify(json));
  return json;
}

// Extract a Wikidata Q-id (e.g. "Q5680") from a Pleiades record's references.
function extractWikidataId(record) {
  const WD_RE = /wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i;
  for (const r of (record.references || [])) {
    for (const field of ['accessURI', 'identifier', 'bibliographicURI', 'alternateURI']) {
      const v = r[field];
      if (typeof v === 'string') {
        const m = v.match(WD_RE);
        if (m) return m[1];
      }
    }
  }
  return null;
}

// Batch-query Wikidata for the P18 property across N entities.
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
    if (!ent || ent.missing) { out[qid] = null; continue; }
    const claims = (ent.claims && ent.claims.P18) || [];
    if (claims.length) {
      const mainsnak = claims[0].mainsnak;
      out[qid] = mainsnak && mainsnak.datavalue ? mainsnak.datavalue.value : true;
    } else {
      out[qid] = null;
    }
  }
  return out;
}

// ── MAIN ──────────────────────────────────────────────────

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  let ids = await loadSitePleiadesIds();
  console.log(`✓ ${ids.length} unique Pleiades ids`);
  if (SAMPLE > 0) {
    ids = ids.slice(0, SAMPLE);
    console.log(`⚡ sample mode: first ${ids.length}`);
  }

  // PASS 1: gather Pleiades records + extract Wikidata Q-ids.
  console.log(`\n── Pass 1: Pleiades JSON (rate: 1/sec) ──`);
  const pleiadesByPid = {};
  const qidByPid      = {};
  let i = 0;
  for (const pid of ids) {
    i++;
    const t = Date.now();
    try {
      const rec = await fetchPleiadesJson(pid);
      pleiadesByPid[pid] = rec;
      const qid = extractWikidataId(rec);
      qidByPid[pid] = qid;
      if (i <= 10 || i % 50 === 0) {
        console.log(`  [${i}/${ids.length}] ${pid} → ${qid || '(no Wikidata)'}`);
      }
    } catch (e) {
      console.warn(`  [${i}/${ids.length}] ${pid} ERROR ${e.message}`);
      pleiadesByPid[pid] = null;
      qidByPid[pid]      = null;
    }
    const elapsed = Date.now() - t;
    if (i < ids.length && elapsed < RATE_MS) await sleep(RATE_MS - elapsed);
  }
  const qids = [...new Set(Object.values(qidByPid).filter(Boolean))];
  console.log(`✓ ${qids.length} unique Wikidata Q-ids gathered across ${ids.length} sites`);

  // PASS 2: batch-query Wikidata for P18.
  console.log(`\n── Pass 2: Wikidata P18 (batch of ${WD_BATCH}) ──`);
  const p18ByQid = {};
  for (let j = 0; j < qids.length; j += WD_BATCH) {
    const batch = qids.slice(j, j + WD_BATCH);
    try {
      const out = await fetchWikidataP18(batch);
      Object.assign(p18ByQid, out);
      console.log(`  [${Math.min(j + WD_BATCH, qids.length)}/${qids.length}] batch done`);
    } catch (e) {
      console.warn(`  batch ERROR ${e.message}`);
      for (const q of batch) p18ByQid[q] = null;
    }
    await sleep(400);  // polite gap between Wikidata batches
  }

  // CLASSIFY
  const results = {};
  let noWikidata = 0, noP18 = 0, hasP18 = 0, errors = 0;
  for (const pid of ids) {
    if (pleiadesByPid[pid] === null) {
      results[pid] = { has_photo: null, wikidata: null, image: null, reason: 'error' };
      errors++; continue;
    }
    const qid   = qidByPid[pid];
    if (!qid) {
      results[pid] = { has_photo: false, wikidata: null, image: null, reason: 'no-wikidata' };
      noWikidata++; continue;
    }
    const image = p18ByQid[qid];
    if (image == null) {
      results[pid] = { has_photo: false, wikidata: qid, image: null, reason: 'no-p18' };
      noP18++;
    } else {
      results[pid] = { has_photo: true, wikidata: qid, image, reason: 'has-p18' };
      hasP18++;
    }
  }

  console.log(
    `\n✓ classification:\n` +
    `   has photo (P18 set):       ${hasP18}\n` +
    `   no Wikidata link:          ${noWikidata}    ← strongest photo-quest signal\n` +
    `   Wikidata but no P18 image: ${noP18}         ← also a photo quest\n` +
    `   errors:                    ${errors}`
  );

  await writeFile(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(`✓ wrote ${path.relative(ROOT, OUT_PATH)}`);

  if (SAMPLE > 0) {
    console.log(`\n--- SAMPLE PREVIEW ---`);
    for (const [pid, r] of Object.entries(results)) {
      const tag = r.has_photo === true ? '✓ PHOTO' : r.has_photo === false ? '○ quest' : '✗ error';
      console.log(`  ${pid.padEnd(11)} ${tag}  ${r.reason}  ${r.wikidata || ''}  ${r.image || ''}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
