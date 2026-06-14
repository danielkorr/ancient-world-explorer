// ═══════════════════════════════════════════════════════════
//  VIA — build-enrichment.mjs   (Site schema v2 enrichment spike)
//
//  Fills the v2 ENRICHMENT fields for CURATED sites without ever
//  touching the hand-written prose in data.js. Output is a SIDECAR
//  keyed by the site slug `id`; the runtime merges it onto the
//  curated record at load. data.js stays sacred.
//
//  Pipeline (mirrors detect-pleiades-photos.mjs patterns + cache):
//    Pass 1  Pleiades JSON  → Wikidata Q-id        (cached, 1/sec)
//    Pass 2  Wikidata claims → image + cross-refs + heritage  (batch 50)
//    Pass 3  Commons imageinfo → media url + LICENSE + credit  (batch 20)
//
//  The LICENSE is read from Wikimedia Commons extmetadata, normalized
//  to an SPDX-ish id, and gated to `commercial_ok` (D-06). Unknown or
//  non-commercial → commercial_ok:false. No license is ever guessed.
//
//  Output: js/sites-enrichment.json   { [slug]: { ...enrichment } }
//
//  Usage:
//    node scripts/build-enrichment.mjs --sample 5     # spike a handful
//    node scripts/build-enrichment.mjs                # all curated sites
//    node scripts/build-enrichment.mjs --refresh      # bust Pleiades cache
// ═══════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'pleiades-json');
const DATA_PATH = path.join(ROOT, 'js', 'data.js');
const OUT_PATH  = path.join(ROOT, 'js', 'sites-enrichment.json');

const REFRESH    = process.argv.includes('--refresh');
const SAMPLE_IDX = process.argv.indexOf('--sample');
const SAMPLE     = SAMPLE_IDX >= 0 ? Number(process.argv[SAMPLE_IDX + 1] || 5) : 0;

const RATE_MS   = 1100;
const UA        = 'VIA-AncientWorldExplorer/0.1 (https://github.com/danielkorr/ancient-world-explorer; +schema-v2 enrichment)';
const WD_BATCH  = 50;
const COMMONS_BATCH = 20;

// Wikidata property ids we resolve (honest subset — dare/vici have no clean WD property).
const P = {
  image:        'P18',
  topostext:    'P9092',
  trismegistos: 'P1958',
  commons_cat:  'P373',
  unesco:       'P757',   // World Heritage Site ID
};

// ── HELPERS ───────────────────────────────────────────────
async function exists(p) { try { await stat(p); return true; } catch { return false; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function stripHtml(s) { return typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : null; }

// Parse curated rows for { id, pleiades } pairs. Records are flat `{...}` objects
// with no nested braces in the prose, so a brace-free object match is safe.
async function loadCuratedSites() {
  const text = await readFile(DATA_PATH, 'utf8');
  const out = [];
  for (const block of text.matchAll(/\{[^{}]*\}/g)) {
    const rec = block[0];
    const id  = rec.match(/\bid\s*:\s*"([^"]+)"/);
    const pid = rec.match(/\bpleiades\s*:\s*"(\d+)"/);
    if (id && pid) out.push({ id: id[1], pleiades: pid[1] });
  }
  return out;
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

// Pull the first value of a Wikidata claim (formatversion 2).
function claimValue(ent, prop) {
  const claims = (ent.claims && ent.claims[prop]) || [];
  if (!claims.length) return null;
  const snak = claims[0].mainsnak;
  return snak && snak.datavalue ? snak.datavalue.value : null;
}

async function fetchWikidataClaims(qids) {
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
    out[qid] = {
      image:        claimValue(ent, P.image),
      topostext:    claimValue(ent, P.topostext),
      trismegistos: claimValue(ent, P.trismegistos),
      commons_cat:  claimValue(ent, P.commons_cat),
      unesco:       claimValue(ent, P.unesco),
    };
  }
  return out;
}

// Normalize a Commons license to an SPDX-ish id + the commercial_ok gate (D-06).
// Conservative by design: only recognized free/commercial licenses pass; NC and
// anything unrecognized → commercial_ok:false.
function normalizeLicense(machineCode, shortName) {
  const code = (machineCode || '').toLowerCase().trim();
  const sn   = (shortName   || '').toLowerCase().trim();
  const s    = code || sn;
  if (!s) return { license: 'unknown', commercial_ok: false };

  if (s.includes('nc'))                       return { license: spdx(code, sn), commercial_ok: false }; // non-commercial
  if (/cc0/.test(s))                          return { license: 'CC0-1.0', commercial_ok: true };
  if (s.includes('public domain') || s === 'pd' || /^pd[-/]/.test(s))
                                              return { license: 'PD', commercial_ok: true };
  const m = code.match(/cc-by(-sa)?-(\d(?:\.\d)?)/);
  if (m)                                      return { license: `CC-BY${m[1] ? '-SA' : ''}-${m[2]}`, commercial_ok: true };
  if (s.includes('by-sa') || s.includes('by sa')) return { license: 'CC-BY-SA', commercial_ok: true };
  if (s.includes('cc-by') || s.includes('cc by')) return { license: 'CC-BY', commercial_ok: true };
  if (s.includes('fal'))                      return { license: 'FAL-1.3', commercial_ok: true };
  if (s.includes('gfdl'))                     return { license: 'GFDL', commercial_ok: true };
  return { license: machineCode || shortName || 'unknown', commercial_ok: false };
}
function spdx(code, sn) { return (code || sn || 'unknown').toUpperCase(); }

// Commons imageinfo for a batch of File: titles → { filename: media-entry }.
async function fetchCommonsMedia(filenames) {
  if (!filenames.length) return {};
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '480');
  url.searchParams.set('titles', filenames.map(f => `File:${f}`).join('|'));
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons HTTP ${res.status}`);
  const data = await res.json();
  const out = {};
  for (const page of (data.query && data.query.pages) || []) {
    const ii = page.imageinfo && page.imageinfo[0];
    const name = page.title.replace(/^File:/, '');
    if (!ii) { out[name] = null; continue; }
    const em = ii.extmetadata || {};
    const get = k => (em[k] && em[k].value) != null ? em[k].value : null;
    const { license, commercial_ok } = normalizeLicense(get('License'), get('LicenseShortName'));
    out[name] = {
      url:           ii.url,
      thumb:         ii.thumburl || null,
      credit:        stripHtml(get('Artist')) || stripHtml(get('Credit')) || null,
      source:        'wikimedia_commons',
      license,
      commercial_ok,
    };
  }
  return out;
}

// ── MAIN ──────────────────────────────────────────────────
async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  let sites = await loadCuratedSites();
  console.log(`✓ ${sites.length} curated sites with a Pleiades id`);
  if (SAMPLE > 0) { sites = sites.slice(0, SAMPLE); console.log(`⚡ sample mode: first ${sites.length}`); }

  // Flag duplicate pleiades ids across curated rows (the neapolis/cumae case).
  const byPid = {};
  for (const s of sites) (byPid[s.pleiades] ||= []).push(s.id);
  for (const [pid, ids] of Object.entries(byPid))
    if (ids.length > 1) console.warn(`  ⚠ pleiades ${pid} shared by: ${ids.join(', ')}`);

  // PASS 1: Pleiades JSON → Wikidata Q-id.
  console.log(`\n── Pass 1: Pleiades JSON (rate 1/sec) ──`);
  const qidBySlug = {};
  let i = 0;
  for (const s of sites) {
    i++; const t = Date.now();
    try {
      const rec = await fetchPleiadesJson(s.pleiades);
      qidBySlug[s.id] = extractWikidataId(rec);
      console.log(`  [${i}/${sites.length}] ${s.id} (${s.pleiades}) → ${qidBySlug[s.id] || '(no Wikidata)'}`);
    } catch (e) {
      console.warn(`  [${i}/${sites.length}] ${s.id} ERROR ${e.message}`);
      qidBySlug[s.id] = null;
    }
    const el = Date.now() - t;
    if (i < sites.length && el < RATE_MS) await sleep(RATE_MS - el);
  }

  // PASS 2: Wikidata claims.
  const qids = [...new Set(Object.values(qidBySlug).filter(Boolean))];
  console.log(`\n── Pass 2: Wikidata claims for ${qids.length} Q-ids (batch ${WD_BATCH}) ──`);
  const claimsByQid = {};
  for (let j = 0; j < qids.length; j += WD_BATCH) {
    const batch = qids.slice(j, j + WD_BATCH);
    try { Object.assign(claimsByQid, await fetchWikidataClaims(batch)); }
    catch (e) { console.warn(`  batch ERROR ${e.message}`); }
    await sleep(400);
  }

  // PASS 3: Commons license for each unique image filename.
  const filenames = [...new Set(qids.map(q => claimsByQid[q] && claimsByQid[q].image).filter(Boolean))];
  console.log(`\n── Pass 3: Commons imageinfo + license for ${filenames.length} images (batch ${COMMONS_BATCH}) ──`);
  const mediaByFile = {};
  for (let j = 0; j < filenames.length; j += COMMONS_BATCH) {
    const batch = filenames.slice(j, j + COMMONS_BATCH);
    try { Object.assign(mediaByFile, await fetchCommonsMedia(batch)); }
    catch (e) { console.warn(`  batch ERROR ${e.message}`); }
    await sleep(400);
  }

  // ASSEMBLE the sidecar, keyed by slug.
  const now = new Date().toISOString();
  const sidecar = {};
  for (const s of sites) {
    const qid = qidBySlug[s.id];
    const c   = qid ? claimsByQid[qid] : null;
    const ingested_from = ['curated'];
    if (qid) ingested_from.push('wikidata');

    const xref = {
      wikidata:     qid || null,
      dare:         null,                          // no clean Wikidata property
      vici:         null,                          // no clean Wikidata property
      topostext:    (c && c.topostext)    || null,
      trismegistos: (c && c.trismegistos) || null,
    };

    const media = [];
    if (c && c.image && mediaByFile[c.image]) { media.push(mediaByFile[c.image]); ingested_from.push('wikimedia_commons'); }

    const heritage = {};
    if (c && c.unesco) { heritage.unesco = true; heritage.unesco_ref = String(c.unesco); }

    sidecar[s.id] = {
      xref,
      media,
      texts: [],                                   // ToposText text pull deferred past the spike
      ...(Object.keys(heritage).length ? { heritage } : {}),
      provenance: {
        ingested_from: [...new Set(ingested_from)],
        ingested_at:   now,
        unmatched:     !qid,
      },
    };
  }

  await writeFile(OUT_PATH, JSON.stringify(sidecar, null, 2));
  console.log(`\n✓ wrote ${path.relative(ROOT, OUT_PATH)} (${Object.keys(sidecar).length} sites)`);

  // Spike report: license tally + a preview of the first records.
  const tally = { commercial: 0, blocked: 0, no_media: 0 };
  for (const s of Object.values(sidecar)) {
    if (!s.media.length) tally.no_media++;
    else if (s.media[0].commercial_ok) tally.commercial++;
    else tally.blocked++;
  }
  console.log(
    `\n✓ media license tally:\n` +
    `   commercial_ok images: ${tally.commercial}\n` +
    `   blocked (NC/unknown): ${tally.blocked}\n` +
    `   no image found:       ${tally.no_media}`
  );

  console.log(`\n--- PREVIEW (first ${Math.min(5, sites.length)}) ---`);
  for (const s of sites.slice(0, 5)) {
    const e = sidecar[s.id];
    const m = e.media[0];
    console.log(`\n  ${s.id}  (wikidata ${e.xref.wikidata || '—'})`);
    console.log(`    xref: topostext=${e.xref.topostext || '—'} trismegistos=${e.xref.trismegistos || '—'}`);
    console.log(`    heritage: ${e.heritage ? `UNESCO #${e.heritage.unesco_ref}` : '—'}`);
    if (m) console.log(`    media: ${m.license} commercial_ok=${m.commercial_ok}\n           ${m.credit || '(no credit)'}\n           ${m.url}`);
    else   console.log(`    media: (none)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
