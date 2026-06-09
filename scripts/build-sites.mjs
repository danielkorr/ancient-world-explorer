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
  if (precision === 'rough') site.quest = 'location';
  site._descLen = site.desc.length;
  return site;
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
  let scanned = 0, kept = [];
  for await (const row of parseCsv(CSV_PATH)) {
    scanned++;
    const site = transformRow(row);
    if (site) kept.push(site);
  }
  console.log(`✓ scanned ${scanned} places, ${kept.length} passed filter`);

  kept.sort((a, b) => b._descLen - a._descLen);
  let sites = kept.slice(0, MAX_SITES).map(({ _descLen, ...rest }) => rest);
  console.log(`✓ ${sites.length} sites after cap (MAX_SITES=${MAX_SITES})`);

  // Apply photo-quest overlay. Existing "location" quests win over "photo"
  // (a missing GPS is a stronger problem than a missing portrait photo).
  const photos = await loadPhotoOverlay();
  let photoTagged = 0;
  for (const s of sites) {
    if (s.quest) continue;
    const p = photos[s.pleiades];
    if (p && p.has_photo === false) { s.quest = 'photo'; photoTagged++; }
  }
  console.log(`✓ photo-quest overlay applied: ${photoTagged} sites tagged`);

  const byType = sites.reduce((m, s) => (m[s.type] = (m[s.type] || 0) + 1, m), {});
  console.log(`  by type:`, byType);
  const questCounts = sites.reduce((m, s) => {
    if (s.quest) m[s.quest] = (m[s.quest] || 0) + 1;
    return m;
  }, {});
  console.log(`  quests:`, questCounts);

  await writeFile(OUT_PATH, emit(sites));
  console.log(`✓ wrote ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
