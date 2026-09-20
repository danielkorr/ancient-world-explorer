// ═══════════════════════════════════════════════════════════
//  VIA — build-sites.mjs
//
//  Pulls the Pleiades JSON dump, filters to Roman-period places with
//  usable coordinates and substantive descriptions, maps them to our
//  SITES schema, and writes js/sites-pleiades.js.
//
//  Run: node scripts/build-sites.mjs
//  Re-run: same — cached dump in .cache/ is reused unless --refresh.
// ═══════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const CACHE     = path.join(ROOT, '.cache');
const GZ_PATH   = path.join(CACHE, 'pleiades-places.csv.gz');
const CSV_PATH  = path.join(CACHE, 'pleiades-places.csv');
const OUT_PATH  = path.join(ROOT, 'js', 'sites-pleiades.js');
const OUT_COVERAGE = path.join(ROOT, 'js', 'sites-coverage.js');

const DUMP_URL = 'https://atlantides.org/downloads/pleiades/dumps/pleiades-places-latest.csv.gz';

const REFRESH = process.argv.includes('--refresh');
const MAX_SITES = Number(process.env.MAX_SITES || 400);

// Pleiades placeType slugs → our type enum.
// Anything we can't map cleanly defaults to "city".
const TYPE_MAP = {
  'settlement':            'city',
  'settlement-modern':     'city',
  'urban':                 'city',
  'town':                  'city',
  'city-gate':             'city',
  'port':                  'port',
  'harbor':                'port',
  'river-mouth':           'port',
  'estuary':               'port',
  'fort':                  'fortress',
  'fortress':              'fortress',
  'castellum':             'fortress',
  'tower-defensive':       'fortress',
  'wall-city':             'fortress',
  'wall-fortification':    'fortress',
  'limes':                 'fortress',
  'province':              'capital',
  'province-roman':        'capital',
};

// Roman-era period slugs in Pleiades.
const ROMAN_PERIODS = new Set([
  'roman',
  'roman-republican',
  'roman-republic',
  'roman-early',
  'roman-late',
  'roman-imperial',
  'late-antique',
  'early-byzantine',
]);

// ── DOWNLOAD ──────────────────────────────────────────────

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function ensureDump() {
  await mkdir(CACHE, { recursive: true });
  if (!REFRESH && await exists(CSV_PATH)) {
    console.log(`✓ cached dump at ${path.relative(ROOT, CSV_PATH)}`);
    return;
  }
  if (REFRESH || !await exists(GZ_PATH)) {
    console.log(`↓ fetching ${DUMP_URL} ...`);
    const res = await fetch(DUMP_URL);
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(GZ_PATH));
    console.log(`✓ saved ${path.relative(ROOT, GZ_PATH)}`);
  }
  console.log(`⊙ decompressing ...`);
  await pipeline(createReadStream(GZ_PATH), createGunzip(), createWriteStream(CSV_PATH));
  console.log(`✓ wrote ${path.relative(ROOT, CSV_PATH)}`);
}

// ── CSV STREAM PARSER (RFC 4180, supports quoted fields with embedded
//    commas, quotes "" and newlines). Yields one record at a time. ──

async function* parseCsv(filePath) {
  const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1 << 16 });
  let buf = '';
  let fields = [];
  let field = '';
  let inQuotes = false;
  let header = null;

  function commitField()  { fields.push(field); field = ''; }
  function commitRecord() {
    commitField();
    if (!header) { header = fields; fields = []; return null; }
    const rec = {};
    for (let i = 0; i < header.length; i++) rec[header[i]] = fields[i] ?? '';
    fields = [];
    return rec;
  }

  for await (const chunk of stream) {
    buf += chunk;
    let i = 0;
    while (i < buf.length) {
      const c = buf[i];
      if (inQuotes) {
        if (c === '"') {
          if (buf[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++;
      } else {
        if (c === '"')      { inQuotes = true; i++; }
        else if (c === ',') { commitField(); i++; }
        else if (c === '\r'){ i++; }
        else if (c === '\n'){
          const rec = commitRecord();
          if (rec) yield rec;
          i++;
        }
        else { field += c; i++; }
      }
    }
    buf = '';
  }
  if (field.length || fields.length) {
    const rec = commitRecord();
    if (rec) yield rec;
  }
}

// ── TRANSFORM ─────────────────────────────────────────────

function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60);
}

function mapType(placeTypes = []) {
  for (const t of placeTypes) if (TYPE_MAP[t]) return TYPE_MAP[t];
  return 'city';
}

// Non-point Pleiades feature types split into two tiers, because the two quest
// kinds have DIFFERENT eligibility:
//
//   ABSTRACT — features with no single photographable physical referent: an
//     administrative/geographic area (province, region), a body of open water
//     (sea, lake), or a human group (people, tribe). "Photograph the province
//     of Venetia" / "GPS the Ausonian Sea" are both nonsense. These are NEVER a
//     quest of any kind — documented reference places only.
//
//   LINEAR_OR_AREAL — features with real physical remains but no single GPS
//     point: rivers, aqueducts, canals, mountains, islands. You CAN photograph a
//     river or an aqueduct (so they stay photo-eligible), but you can't "verify
//     their coordinates" with one GPS reading, so they're never a Location Quest.
//
// Location Quest ⇒ point-like (excluded by EITHER set). Photo Quest ⇒ not
// ABSTRACT. Gates trip only when EVERY declared feature type is non-point, so a
// settlement on a river (['settlement','river']) stays a normal point site.
const ABSTRACT_FEATURES = new Set([
  'region', 'province', 'province-2', 'province-roman', 'district', 'territory',
  'sea', 'water-open', 'water-inland', 'lake', 'lagoon', 'gulf', 'bay', 'marsh',
  'people', 'tribe', 'ethnic-group', 'desert', 'plain',
  'label',   // cartographic annotation ("place the label here"), not a real feature — transparent to both gates
]);
const LINEAR_OR_AREAL_FEATURES = new Set([
  ...ABSTRACT_FEATURES,
  'river', 'stream', 'canal', 'aqueduct', 'spring', 'well', 'waterfall',
  'mountain', 'mountain-range', 'ridge', 'valley', 'plateau', 'forest',
  'island', 'archipelago', 'peninsula', 'cape', 'promontory',
]);

const every = (fts, set) => fts.length > 0 && fts.every(t => set.has(t));
function isAbstractFeature(featureTypes = []) { return every(featureTypes, ABSTRACT_FEATURES); }
function isNonPointFeature(featureTypes = []) { return every(featureTypes, LINEAR_OR_AREAL_FEATURES); }

function isRomanEra(timePeriods = []) {
  return timePeriods.some(p => ROMAN_PERIODS.has(p));
}

function pickPeriodLabel(timePeriods = []) {
  // Render an approximate period range from the slugs we see.
  if (timePeriods.includes('roman-republican')) return 'Roman Republic – Imperial';
  if (timePeriods.includes('roman-imperial'))   return 'Roman Imperial';
  if (timePeriods.includes('late-antique'))     return 'Late Antiquity';
  if (timePeriods.includes('roman'))            return 'Roman period';
  return 'Roman period';
}

// CSV columns we care about (Pleiades places dump):
//   id, title, description, featureTypes, timePeriods, timePeriodsKeys,
//   reprLat, reprLong, locationPrecision, minDate, maxDate, path
function transformRow(p) {
  const lat = Number(p.reprLat);
  const lng = Number(p.reprLong);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!p.title || !p.description) return null;
  if (p.description.length < 80) return null;

  const periods = (p.timePeriodsKeys || p.timePeriods || '').split(/[,;\s]+/).filter(Boolean);
  if (!isRomanEra(periods)) return null;

  const precision = (p.locationPrecision || '').toLowerCase() || 'unknown';
  if (precision === 'unknown') return null;

  const featureTypes = (p.featureTypes || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const type = mapType(featureTypes);

  const site = {
    id:       slugify(p.title) || String(p.id),
    name:     p.title,
    modern:   '', // CSV dump has no modern-name reflex; left blank for now.
    type,
    lat:      Number(lat.toFixed(4)),
    lng:      Number(lng.toFixed(4)),
    period:   pickPeriodLabel(periods),
    pleiades: String(p.id),
    rome_days: 0,
    desc:     p.description.trim().replace(/\s+/g, ' '),
  };
  // Abstract features (province, sea, region, people…) are documented reference
  // places, never any quest — flag survives to the photo overlay, stripped
  // before emit. Location Quest = rough coordinates AND a point to actually find
  // (excludes rivers/mountains/aqueducts too — real, but not a single GPS point).
  site._abstract = isAbstractFeature(featureTypes);
  if (precision === 'rough' && !isNonPointFeature(featureTypes)) site.quest = 'location';
  site._descLen = site.desc.length;
  return site;
}

// Coverage transform: the documented long tail (Phase A, v2-spec-coverage-layer).
// Same Roman-era + coords + known-precision gate as the foreground, but with NO
// 80-char description requirement — these are the thin records the foreground
// filter drops (e.g. Euphranta/Macomades, pleiades 363959, desc 57 chars). No
// quest (documented reference, not a contribution target in Phase A); the desc is
// honest-thin (may be empty) and capped to bound payload.
function transformCoverage(p) {
  const lat = Number(p.reprLat);
  const lng = Number(p.reprLong);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;   // Pleiades "null island" = missing coords
  const title = (p.title || '').trim();      // some titles carry leading/trailing space
  if (!title) return null;
  const periods = (p.timePeriodsKeys || p.timePeriods || '').split(/[,;\s]+/).filter(Boolean);
  if (!isRomanEra(periods)) return null;
  const precision = (p.locationPrecision || '').toLowerCase() || 'unknown';
  if (precision === 'unknown') return null;

  const featureTypes = (p.featureTypes || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const type = mapType(featureTypes);

  // Honest-thin: no desc (coverage panels link out to Pleiades for the full
  // record), no slug id (synthesized at runtime as cov-<pleiades>). Both are pure
  // payload — dropping them keeps the lazy bundle lean (1.27 MB → well under) for
  // a layer whose whole job is "findable + locatable", not rich content.
  return {
    name:     title,
    type,
    lat:      Number(lat.toFixed(4)),
    lng:      Number(lng.toFixed(4)),
    period:   pickPeriodLabel(periods),
    pleiades: String(p.id),
  };
}

// ── EMIT ──────────────────────────────────────────────────

function emit(sites) {
  const lines = sites.map(s => {
    const fields = [
      `id:${JSON.stringify(s.id)}`,
      `name:${JSON.stringify(s.name)}`,
      `modern:${JSON.stringify(s.modern)}`,
      `type:${JSON.stringify(s.type)}`,
      `lat:${s.lat}`,
      `lng:${s.lng}`,
      `period:${JSON.stringify(s.period)}`,
      `pleiades:${JSON.stringify(s.pleiades)}`,
      `rome_days:${s.rome_days}`,
      s.quest ? `quest:${JSON.stringify(s.quest)}` : null,
      `desc:${JSON.stringify(s.desc)}`,
    ].filter(Boolean).join(', ');
    return `  { ${fields} },`;
  });

  return [
    '// ═══════════════════════════════════════════════════════════',
    '//  VIA — Ancient World Explorer',
    '//  sites-pleiades.js — auto-generated from Pleiades JSON dump',
    '//',
    '//  DO NOT EDIT BY HAND. Regenerate with:',
    '//    node scripts/build-sites.mjs',
    '//',
    `//  Source: ${DUMP_URL}`,
    `//  Generated: ${new Date().toISOString()}`,
    `//  Count: ${sites.length}`,
    '// ═══════════════════════════════════════════════════════════',
    '',
    'const SITES_PLEIADES = [',
    ...lines,
    '];',
    '',
  ].join('\n');
}

function emitCoverage(sites) {
  const lines = sites.map(s => {
    const fields = [
      `name:${JSON.stringify(s.name)}`,
      `type:${JSON.stringify(s.type)}`,
      `lat:${s.lat}`,
      `lng:${s.lng}`,
      `period:${JSON.stringify(s.period)}`,
      `pleiades:${JSON.stringify(s.pleiades)}`,
    ].join(', ');
    return `  { ${fields} },`;
  });

  return [
    '// ═══════════════════════════════════════════════════════════',
    '//  VIA — Ancient World Explorer',
    '//  sites-coverage.js — auto-generated documented-coverage long tail',
    '//  (v2-spec-coverage-layer Phase A). LAZY-LOADED, search-only — NOT in',
    '//  index.html cold start, NOT merged into the global SITES.',
    '//',
    '//  DO NOT EDIT BY HAND. Regenerate with:',
    '//    node scripts/build-sites.mjs',
    '//',
    `//  Source: ${DUMP_URL}`,
    `//  Generated: ${new Date().toISOString()}`,
    `//  Count: ${sites.length}`,
    '// ═══════════════════════════════════════════════════════════',
    '',
    'window.SITES_COVERAGE = [',
    ...lines,
    '];',
    '',
  ].join('\n');
}

// ── MAIN ──────────────────────────────────────────────────

// Photo-quest overlay: js/pleiades-photos.json (produced by
// scripts/detect-pleiades-photos.mjs). For each Pleiades id, if
// has_photo === false we promote the site to quest:"photo" (unless a
// stronger quest tier like "location" is already set).
async function loadPhotoOverlay() {
  const p = path.join(ROOT, 'js', 'pleiades-photos.json');
  try { return JSON.parse(await readFile(p, 'utf8')); }
  catch { return {}; }
}

async function main() {
  await ensureDump();
  console.log(`⊙ streaming CSV ...`);
  let scanned = 0, kept = [], cov = [];
  for await (const row of parseCsv(CSV_PATH)) {
    scanned++;
    const site = transformRow(row);
    if (site) kept.push(site);
    const c = transformCoverage(row);   // relaxed long tail, same stream
    if (c) cov.push(c);
  }
  console.log(`✓ scanned ${scanned} places, ${kept.length} foreground-eligible, ${cov.length} coverage-eligible`);

  kept.sort((a, b) => b._descLen - a._descLen);
  let sites = kept.slice(0, MAX_SITES).map(({ _descLen, ...rest }) => rest);
  console.log(`✓ ${sites.length} sites after cap (MAX_SITES=${MAX_SITES})`);

  // Apply photo-quest overlay. Existing "location" quests win over "photo"
  // (a missing GPS is a stronger problem than a missing portrait photo).
  const photos = await loadPhotoOverlay();
  let photoTagged = 0;
  for (const s of sites) {
    if (s.quest || s._abstract) continue;   // abstract features are never a quest
    const p = photos[s.pleiades];
    if (p && p.has_photo === false) { s.quest = 'photo'; photoTagged++; }
  }
  console.log(`✓ photo-quest overlay applied: ${photoTagged} sites tagged`);

  // Strip the transient abstract marker now that both quest gates have read it.
  sites = sites.map(({ _abstract, ...rest }) => rest);

  const byType = sites.reduce((m, s) => (m[s.type] = (m[s.type] || 0) + 1, m), {});
  console.log(`  by type:`, byType);
  const questCounts = sites.reduce((m, s) => {
    if (s.quest) m[s.quest] = (m[s.quest] || 0) + 1;
    return m;
  }, {});
  console.log(`  quests:`, questCounts);

  await writeFile(OUT_PATH, emit(sites));
  console.log(`✓ wrote ${path.relative(ROOT, OUT_PATH)}`);

  // Coverage long tail: the relaxed pool minus whatever shipped to the foreground
  // (by pleiades id). Curated + vici dedup happens at runtime against the global
  // SITES set, so the build only needs to subtract the foreground here. Sorted by
  // name for a stable, reviewable diff.
  const foregroundIds = new Set(sites.map(s => s.pleiades));
  const coverage = cov
    .filter(c => !foregroundIds.has(c.pleiades))
    .sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(OUT_COVERAGE, emitCoverage(coverage));
  console.log(`✓ wrote ${path.relative(ROOT, OUT_COVERAGE)} (${coverage.length} coverage sites)`);
  const hasEuphranta = coverage.some(c => c.pleiades === '363959');
  console.log(`  Euphranta/Macomades (363959) in coverage: ${hasEuphranta ? 'YES' : 'NO'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
