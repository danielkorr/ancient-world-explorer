// ═══════════════════════════════════════════════════════════
//  VIA — build-elevation-worklist.mjs
//
//  Builds the "scholarly elevation worklist": VIA photo-quest sites (no
//  portrait photo in the scholarly record, i.e. no Wikidata P18) for which
//  vici.org ALREADY HAS a credited photo. Those are concrete, sourced
//  candidates to elevate into Wikidata/Commons/Pleiades — the scholar-facing
//  pitch (imagery exists in the wild, just not in the authoritative record).
//
//  Source: René Voorburg's published vici.org dump (CC BY-SA 3.0 images /
//  CC0 metadata), .cache/vici-dump/vici.sql.gz (Oct-2023 snapshot). This is a
//  ONE-TIME OFFLINE parse, not a runtime/scraping step. The endpoint scraping
//  path is a dead end (geojson.php 403s) — the dump is the blessed export.
//
//  Join: pmetadata.pmeta_pleiades → points (pnt) → pnt_img_lnk → images →
//  img_data (creator/attribution/license) → licenses. Cross-referenced
//  against js/pleiades-photos.json (Wikidata-P18 = VIA's photo source of truth).
//
//  Output:
//    docs/vici-elevation-worklist.json  — structured, machine-readable
//    docs/vici-elevation-worklist.md    — human-readable artifact for scholars
//
//  Usage:
//    node --max-old-space-size=4096 scripts/build-elevation-worklist.mjs
// ═══════════════════════════════════════════════════════════

import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const DUMP      = path.join(ROOT, '.cache', 'vici-dump', 'vici.sql.gz');
const PL_CACHE  = path.join(ROOT, '.cache', 'pleiades-json');
const PHOTOS    = path.join(ROOT, 'js', 'pleiades-photos.json');
const OUT_JSON  = path.join(ROOT, 'docs', 'vici-elevation-worklist.json');
const OUT_MD    = path.join(ROOT, 'docs', 'vici-elevation-worklist.md');
const OUT_SITES = path.join(ROOT, 'js', 'sites-vici.js');

// --emit-sites also generates js/sites-vici.js (the Phase 1 elevation layer):
// every vici-photo Pleiades place NOT already in VIA, enriched from Pleiades JSON
// (name/type/desc) + Wikidata P18 (tier). See docs/v1-spec-elevation-layer.md.
const EMIT_SITES = process.argv.includes('--emit-sites');

const UA = 'VIA-AncientWorldExplorer/0.1 (https://github.com/danielkorr/ancient-world-explorer; +elevation-layer)';
const RATE_MS = 1100, WD_BATCH = 50;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fexists = async p => { try { await stat(p); return true; } catch { return false; } };

// Pleiades placeType slug → VIA type enum (mirrors build-sites.mjs TYPE_MAP).
const TYPE_MAP = {
  'settlement':'city','settlement-modern':'city','urban':'city','town':'city','city-gate':'city',
  'port':'port','harbor':'port','river-mouth':'port','estuary':'port',
  'fort':'fortress','fortress':'fortress','castellum':'fortress','tower-defensive':'fortress',
  'wall-city':'fortress','wall-fortification':'fortress','limes':'fortress',
  'province':'capital','province-roman':'capital',
};
const mapType = (placeTypes = []) => { for (const t of placeTypes) if (TYPE_MAP[t]) return TYPE_MAP[t]; return 'city'; };

// Column order per target table (from the dump's CREATE TABLE DDL).
const COLS = {
  licenses:    ['license_id','license_short','license_url','license_uploadable','license_abbr'],
  points:      ['pnt_id','pnt_name','pnt_kind','pnt_visible','pnt_lat','pnt_lng','pnt_dflt_short','pnt_promote','pnt_hide','pnt_img'],
  pmetadata:   ['pmeta_id','pmeta_pnt_id','pmeta_kind_specifier','pmeta_loc_accuracy','pmeta_creator','pmeta_editor','pmeta_create_date','pmeta_edit_date','pmeta_locked','pmeta_extids','pmeta_pleiades','pmeta_livius','pmeta_romaq','pmeta_dare','pmeta_mithraeum','pmeta_startyr','pmeta_endyr','pmeta_startyr_str','pmeta_endyr_str'],
  pnt_img_lnk: ['pil_pnt','pil_img','pil_dflt'],
  images:      ['img_id','img_path','img_hide'],
  img_data:    ['imgd_imgid','imgd_uploader','imgd_ownwork','imgd_license','imgd_source','imgd_creator','imgd_attribution','imgd_date','imgd_width','imgd_height','imgd_lat','imgd_lng','imgd_title','imgd_description','imgd_tags','imgd_metadata','imgd_lang','imgd_md5sum'],
};
const TARGETS = new Set(Object.keys(COLS));

// ── collected data ────────────────────────────────────────
const licenses = new Map();          // license_id → {abbr, short, url}
const points   = new Map();          // pnt_id → {name, visible, hide, img, lat, lng}
const pmeta    = [];                 // {pnt, pleiades, dare}  (pleiades non-null only)
const links    = new Map();          // pnt_id → [{img, dflt}]
const images   = new Map();          // img_id → {path, hide}
const imgdata  = new Map();          // img_id → {creator, attribution, license, ownwork, source, title, w, h}

// ── MySQL INSERT tuple parser (incremental, chunk-safe) ────
function unescape(s) {
  return s.replace(/\\(.)/g, (_, c) =>
    c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' :
    c === '0' ? '\0' : c === 'b' ? '\b' : c === 'Z' ? '\x1a' : c);
}

let buf = '';
let mode = 'scan';   // 'scan' | 'values'
let table = null, cols = null, keep = false;

const INSERT_RE = /INSERT INTO `(\w+)`\s*(\([^)]*\))?\s*VALUES\s*/i;

function rowToObj(vals, colNames) {
  const o = {};
  for (let k = 0; k < colNames.length; k++) o[colNames[k]] = vals[k];
  return o;
}

function store(obj) {
  switch (table) {
    case 'licenses':
      licenses.set(+obj.license_id, { abbr: obj.license_abbr || obj.license_short, short: obj.license_short, url: obj.license_url });
      break;
    case 'points':
      points.set(+obj.pnt_id, {
        name: obj.pnt_name, visible: +obj.pnt_visible, hide: +obj.pnt_hide,
        img: obj.pnt_img == null ? null : +obj.pnt_img,
        lat: obj.pnt_lat == null ? null : +obj.pnt_lat, lng: obj.pnt_lng == null ? null : +obj.pnt_lng,
      });
      break;
    case 'pmetadata':
      if (obj.pmeta_pleiades != null && +obj.pmeta_pleiades > 0)   // 0 = "no Pleiades link"
        pmeta.push({ pnt: +obj.pmeta_pnt_id, pleiades: String(+obj.pmeta_pleiades), dare: obj.pmeta_dare });
      break;
    case 'pnt_img_lnk': {
      const p = +obj.pil_pnt;
      if (!links.has(p)) links.set(p, []);
      links.get(p).push({ img: +obj.pil_img, dflt: +obj.pil_dflt });
      break;
    }
    case 'images':
      images.set(+obj.img_id, { path: obj.img_path, hide: +obj.img_hide });
      break;
    case 'img_data':
      imgdata.set(+obj.imgd_imgid, {
        creator: obj.imgd_creator, attribution: obj.imgd_attribution,
        license: obj.imgd_license == null ? null : +obj.imgd_license,
        ownwork: obj.imgd_ownwork == null ? null : +obj.imgd_ownwork,
        source: obj.imgd_source, title: obj.imgd_title,
        w: obj.imgd_width == null ? null : +obj.imgd_width,
        h: obj.imgd_height == null ? null : +obj.imgd_height,
      });
      break;
  }
}

function normScalar(raw) { const t = raw.trim(); return t === 'NULL' ? null : t; }

// Parse complete tuples from buf[i..]. Returns the index consumed up to; a
// partial trailing tuple is left in buf for the next chunk. Sets mode='scan'
// when it reaches the statement-terminating ';'.
function parseValues(i) {
  const n = buf.length;
  while (i < n) {
    while (i < n && (buf[i] === ',' || buf[i] === ' ' || buf[i] === '\n' || buf[i] === '\r' || buf[i] === '\t')) i++;
    if (i >= n) return i;
    if (buf[i] === ';') { mode = 'scan'; return i + 1; }
    if (buf[i] !== '(') { mode = 'scan'; return i; }   // resync
    const start = i; i++;
    const vals = [];
    let field = '', isStr = false, inStr = false, done = false;
    while (i < n) {
      const ch = buf[i];
      if (inStr) {
        if (ch === '\\') { if (i + 1 >= n) return start; field += ch + buf[i + 1]; i += 2; continue; }
        if (ch === "'") { inStr = false; i++; continue; }
        field += ch; i++; continue;
      }
      if (ch === "'") { inStr = true; isStr = true; i++; continue; }
      if (ch === ',') { vals.push(isStr ? unescape(field) : normScalar(field)); field = ''; isStr = false; i++; continue; }
      if (ch === ')') { vals.push(isStr ? unescape(field) : normScalar(field)); i++; done = true; break; }
      field += ch; i++;
    }
    if (!done) return start;   // incomplete tuple — wait for more data
    if (keep) store(rowToObj(vals, cols));
  }
  return i;
}

function feed(chunk) {
  buf += chunk;
  for (;;) {
    if (mode === 'scan') {
      const m = INSERT_RE.exec(buf);
      if (!m) { if (buf.length > 8192) buf = buf.slice(-8192); break; }
      table = m[1];
      keep = TARGETS.has(table);
      cols = keep ? (m[2] ? m[2].slice(1, -1).split(',').map(s => s.trim().replace(/`/g, '')) : COLS[table]) : null;
      buf = buf.slice(m.index + m[0].length);
      mode = 'values';
      continue;
    }
    // values mode
    const ni = parseValues(0);
    buf = buf.slice(ni);
    if (mode === 'values') break;   // ran out mid-statement — wait for next chunk
    // mode flipped to 'scan' → loop to find the next INSERT
  }
}

async function parseDump() {
  await new Promise((resolve, reject) => {
    const gz = createReadStream(DUMP).pipe(createGunzip());
    gz.setEncoding('utf8');
    gz.on('data', feed);
    gz.on('end', resolve);
    gz.on('error', reject);
  });
}

// ── VIA sites (for names) via vm ──────────────────────────
async function loadVIASites() {
  const pl = await readFile(path.join(ROOT, 'js', 'sites-pleiades.js'), 'utf8');
  const dt = await readFile(path.join(ROOT, 'js', 'data.js'), 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(`${pl}\n${dt}\n;this.__SITES = (typeof SITES!=='undefined')?SITES:[];`, ctx);
  const byPid = new Map();
  for (const s of ctx.__SITES || []) if (s.pleiades) byPid.set(String(s.pleiades), s);
  return byPid;
}

// The imageserver takes the stored img_path directly after a required transform
// segment (the bare path 404s; there is NO 'uploads/' to hardcode — it's already
// part of the path when present). Strip any leading slash to avoid a double slash.
function viciImageUrl(p, transform) {
  return `https://images.vici.org/${transform}/${String(p).replace(/^\/+/, '')}`;
}

// ── Pleiades + Wikidata enrichment (mirrors detect-pleiades-photos.mjs) ──
async function fetchPleiadesJson(id) {
  const cached = path.join(PL_CACHE, `${id}.json`);
  if (await fexists(cached)) return JSON.parse(await readFile(cached, 'utf8'));
  const res = await fetch(`https://pleiades.stoa.org/places/${id}/json`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Pleiades HTTP ${res.status}`);
  const json = await res.json();
  await writeFile(cached, JSON.stringify(json));
  return json;
}
function extractWikidataId(rec) {
  const RE = /wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i;
  for (const r of (rec.references || []))
    for (const f of ['accessURI', 'identifier', 'bibliographicURI', 'alternateURI']) {
      const v = r[f]; if (typeof v === 'string') { const m = v.match(RE); if (m) return m[1]; }
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
    const claims = ent && !ent.missing && ent.claims && ent.claims.P18;
    out[qid] = (claims && claims.length) ? (claims[0].mainsnak?.datavalue?.value ?? true) : null;
  }
  return out;
}
function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

// Build js/sites-vici.js from the net-new vici-photo Pleiades places.
// `candidates` are the elevation sites ALREADY in VIA (deduped out of SITES_VICI);
// they get an overlay (VICI_ELEVATION, by pleiades id) that data.js applies onto
// the existing records so they show the same vici hero + "help elevate" treatment.
async function emitSites(viciPhotoByPleiades, viaSites, photos, candidates = []) {
  await mkdir(PL_CACHE, { recursive: true });
  const newIds = [...viciPhotoByPleiades.keys()].filter(pid => !viaSites.has(pid));
  console.log(`\n── --emit-sites: ${newIds.length} net-new vici-photo Pleiades places ──`);

  // PASS A: Pleiades JSON per id (name/type/desc + Wikidata Q-id).
  const meta = new Map();   // pid → {title, type, lat, lng, desc, qid}
  const qidByPid = {};
  let i = 0, fetched = 0;
  for (const pid of newIds) {
    i++; const t0 = Date.now();
    try {
      const onDisk = await fexists(path.join(PL_CACHE, `${pid}.json`));
      const rec = await fetchPleiadesJson(pid);
      if (!onDisk) fetched++;
      const rp = Array.isArray(rec.reprPoint) ? rec.reprPoint : null;
      meta.set(pid, {
        title: rec.title || viciPhotoByPleiades.get(pid).viciName || `Pleiades ${pid}`,
        type: mapType(rec.placeTypes || []),
        lat: rp ? Number(rp[1].toFixed(4)) : null,
        lng: rp ? Number(rp[0].toFixed(4)) : null,
        desc: (rec.description || '').trim().replace(/\s+/g, ' '),
        qid: extractWikidataId(rec),
      });
      qidByPid[pid] = meta.get(pid).qid;
      if (i <= 5 || i % 50 === 0) console.log(`  [${i}/${newIds.length}] ${pid} → ${rec.title || '(no title)'}`);
      if (!onDisk && i < newIds.length) { const e = Date.now() - t0; if (e < RATE_MS) await sleep(RATE_MS - e); }
    } catch (e) {
      console.warn(`  [${i}/${newIds.length}] ${pid} ERROR ${e.message}`);
    }
  }
  console.log(`✓ Pleiades enriched (${fetched} fetched, rest cached)`);

  // PASS B: Wikidata P18 for the gathered Q-ids.
  const qids = [...new Set(Object.values(qidByPid).filter(Boolean))];
  const p18 = {};
  for (let j = 0; j < qids.length; j += WD_BATCH) {
    Object.assign(p18, await fetchWikidataP18(qids.slice(j, j + WD_BATCH)));
    await sleep(400);
  }
  console.log(`✓ Wikidata P18 across ${qids.length} Q-ids`);

  // Build records + extend pleiades-photos.json with the new P18 signal.
  const records = [];
  for (const pid of newIds) {
    const m = meta.get(pid); if (!m || m.lat == null) continue;
    const v = viciPhotoByPleiades.get(pid);
    const qid = m.qid;
    const hasP18 = qid ? (p18[qid] != null) : false;
    photos[pid] = qid
      ? { has_photo: hasP18, wikidata: qid, image: hasP18 ? p18[qid] : null, reason: hasP18 ? 'has-p18' : 'no-p18' }
      : { has_photo: false, wikidata: null, image: null, reason: 'no-wikidata' };
    const rec = {
      id: `vici-${v.viciId}`,
      name: m.title, modern: '', type: m.type,
      lat: m.lat, lng: m.lng, period: 'Roman period',
      pleiades: pid, rome_days: 0,
      desc: m.desc || `${m.title} — an ancient place recorded in the Pleiades gazetteer and documented on vici.org.`,
    };
    if (!hasP18) { rec.quest = 'photo'; rec.elevation = true; }
    rec.vici = { url: v.viciUrl, name: v.viciName, image: v.top.image, creator: v.top.creator || null, license: v.top.license || null };
    records.push(rec);
  }
  records.sort((a, b) => a.name.localeCompare(b.name));

  const elev = records.filter(r => r.elevation).length;
  const body =
    `// ═══════════════════════════════════════════════════════════\n` +
    `//  VIA — sites-vici.js — AUTO-GENERATED, do not hand-edit.\n` +
    `//  The vici.org elevation layer (Phase 1). Pleiades places vici has a\n` +
    `//  photo of, not already in VIA. quest:"photo"+elevation:true = no Wikidata\n` +
    `//  P18 (an elevation candidate); otherwise documented coverage. vici image\n` +
    `//  data is CC BY-SA 3.0 / metadata CC0. Regenerate:\n` +
    `//    node --max-old-space-size=4096 scripts/build-elevation-worklist.mjs --emit-sites\n` +
    `//  See docs/v1-spec-elevation-layer.md.\n` +
    `// ═══════════════════════════════════════════════════════════\n\n` +
    `const SITES_VICI = [\n${records.map(r => '  ' + JSON.stringify(r)).join(',\n')}\n];\n`;

  // Overlay for elevation candidates already in VIA (deduped out of SITES_VICI).
  // data.js applies these onto the matching site by pleiades id.
  const overlay = {};
  for (const c of candidates) {
    const im = c.images[0];
    overlay[c.pleiades] = { url: c.vici_url, name: c.vici_name, image: im.image, creator: im.creator || null, license: im.license || null };
  }
  const overlayBody =
    `\n// Elevation overlay: vici data for candidates already present in VIA's\n` +
    `// curated/Pleiades sets (so they get the same hero + "help elevate" panel).\n` +
    `// data.js merges this onto the matching site by pleiades id.\n` +
    `const VICI_ELEVATION = ${JSON.stringify(overlay, null, 2)};\n`;
  await writeFile(OUT_SITES, body + overlayBody);
  await writeFile(PHOTOS, JSON.stringify(photos, null, 2));
  console.log(`✓ wrote ${path.relative(ROOT, OUT_SITES)} — ${records.length} sites (${elev} elevation candidates, ${records.length - elev} documented)`);
  console.log(`✓ updated ${path.relative(ROOT, PHOTOS)} with ${newIds.length} new P18 results`);
}

// ── MAIN ──────────────────────────────────────────────────
async function main() {
  console.log('── parsing vici dump (streaming) ──');
  const t0 = Date.now();
  await parseDump();
  console.log(`✓ parsed in ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log(`  licenses=${licenses.size} points=${points.size} pmeta(pleiades)=${pmeta.length} links=${links.size} images=${images.size} img_data=${imgdata.size}`);

  const photos = JSON.parse(await readFile(PHOTOS, 'utf8'));   // pid → {has_photo, wikidata}
  const viaSites = await loadVIASites();
  console.log(`✓ VIA sites: ${viaSites.size} with pleiades id`);

  // index pmeta by pleiades id
  const pntsByPleiades = new Map();
  for (const r of pmeta) {
    if (!pntsByPleiades.has(r.pleiades)) pntsByPleiades.set(r.pleiades, []);
    pntsByPleiades.get(r.pleiades).push(r.pnt);
  }

  // collect, per VIA pleiades id, the visible vici images
  function imagesForPnt(pntId) {
    const out = [];
    const seen = new Set();
    const lnk = links.get(pntId) || [];
    const pt = points.get(pntId);
    const ids = lnk.map(l => l.img);
    if (pt && pt.img != null) ids.unshift(pt.img);          // default image first
    for (const imgId of ids) {
      if (seen.has(imgId)) continue; seen.add(imgId);
      const im = images.get(imgId);
      if (!im || im.hide) continue;                          // skip hidden
      const d = imgdata.get(imgId) || {};
      const lic = d.license != null ? licenses.get(d.license) : null;
      out.push({
        img_id: imgId,
        path: im.path,
        thumb: viciImageUrl(im.path, 'crop/w320xh320'),
        image: viciImageUrl(im.path, 'cover/w1600xh1600'),
        creator: d.creator || null,
        attribution: d.attribution || null,
        own_work: d.ownwork === 1,
        source: d.source || null,
        title: d.title || null,
        license: lic ? lic.abbr : (d.license != null ? `license#${d.license}` : null),
        license_url: lic ? lic.url : null,
        width: d.w, height: d.h,
      });
    }
    return out;
  }

  const matched = [];   // every VIA site with ≥1 vici image
  for (const [pid, pnts] of pntsByPleiades) {
    if (!viaSites.has(pid)) continue;                        // only VIA's catalogue
    const imgs = [];
    let viciName = null, viciId = null;
    for (const pntId of pnts) {
      const pt = points.get(pntId);
      if (!pt || pt.hide || !pt.visible) continue;           // visible points only
      const got = imagesForPnt(pntId);
      if (got.length) { imgs.push(...got); if (!viciId) { viciId = pntId; viciName = pt.name; } }
    }
    if (!imgs.length) continue;
    const via = viaSites.get(pid);
    const ph = photos[pid] || {};
    matched.push({
      pleiades: pid,
      via_name: via.name,
      via_type: via.type || null,
      via_quest: via.quest || 'documented',
      wikidata_p18: ph.has_photo === true,                   // true = already in scholarly record
      wikidata: ph.wikidata || null,
      vici_id: String(viciId),
      vici_url: `https://vici.org/vici/${viciId}/`,
      vici_name: viciName,
      image_count: imgs.length,
      images: imgs,
    });
  }

  // GLOBAL UNIVERSE (not restricted to VIA's catalogue): how many distinct
  // Pleiades places does vici have a photo for at all? This sizes the
  // catalogue-expansion opportunity beyond VIA's current 473 sites.
  let pleiadesWithVici = 0;
  const viciPhotoByPleiades = new Map();   // pid → {viciId, viciUrl, viciName, top}
  for (const [pid, pnts] of pntsByPleiades) {
    pleiadesWithVici++;
    for (const pntId of pnts) {
      const pt = points.get(pntId);
      if (!pt || pt.hide || !pt.visible) continue;
      const imgs = imagesForPnt(pntId);
      if (imgs.length) {
        viciPhotoByPleiades.set(pid, {
          viciId: String(pntId), viciUrl: `https://vici.org/vici/${pntId}/`,
          viciName: pt.name, top: imgs[0],
        });
        break;
      }
    }
  }
  const pleiadesWithViciPhoto = viciPhotoByPleiades.size;
  console.log(`\n── GLOBAL (all vici, not just VIA) ──`);
  console.log(`  distinct Pleiades places vici knows:        ${pleiadesWithVici}`);
  console.log(`  distinct Pleiades places vici has a PHOTO:  ${pleiadesWithViciPhoto}`);

  // elevation candidates = VIA photo-quest (no P18) AND vici has a photo
  const candidates = matched.filter(m => {
    const ph = photos[m.pleiades] || {};
    return ph.has_photo === false;        // no scholarly portrait photo
  }).sort((a, b) => b.image_count - a.image_count);

  // license breakdown across candidate images
  const licCount = {};
  for (const c of candidates) for (const im of c.images) {
    const k = im.license || '(none recorded)';
    licCount[k] = (licCount[k] || 0) + 1;
  }

  const result = {
    generated: new Date().toISOString(),
    source: 'vici.org SQL dump (renevoorburg/vici.org, db/vici.sql.gz, Oct-2023 snapshot)',
    license_note: 'vici image data CC BY-SA 3.0 (attribution + ShareAlike); place metadata CC0. Attribution/creator carried per image where recorded.',
    definition: 'Elevation candidate = a VIA photo-quest site (no Wikidata P18 image) that has at least one non-hidden, credited photo on vici.org.',
    counts: {
      global_pleiades_in_vici: pleiadesWithVici,
      global_pleiades_with_vici_photo: pleiadesWithViciPhoto,
      via_sites_with_pleiades: viaSites.size,
      via_sites_matched_to_vici_with_image: matched.length,
      elevation_candidates: candidates.length,
      candidate_images: candidates.reduce((n, c) => n + c.image_count, 0),
      license_breakdown: licCount,
    },
    candidates,
    matched_with_p18_already: matched.filter(m => (photos[m.pleiades]||{}).has_photo === true).map(m => ({ pleiades: m.pleiades, via_name: m.via_name, vici_url: m.vici_url, image_count: m.image_count })),
  };

  await writeFile(OUT_JSON, JSON.stringify(result, null, 2));
  console.log(`\n✓ wrote ${path.relative(ROOT, OUT_JSON)}`);

  // ── human-readable markdown ──
  const lines = [];
  lines.push(`# VIA — vici.org Elevation Worklist`);
  lines.push('');
  lines.push(`> Sites where good imagery already exists on [vici.org](https://vici.org) but is **missing from the scholarly record** (no Wikidata P18). These are concrete, sourced candidates to elevate into Wikidata / Wikimedia Commons / Pleiades — the scholar-facing payoff of VIA's photo quests.`);
  lines.push('');
  lines.push(`- **Source:** ${result.source}`);
  lines.push(`- **Generated:** ${result.generated}`);
  lines.push(`- **License:** ${result.license_note}`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| VIA sites (with Pleiades id) | ${result.counts.via_sites_with_pleiades} |`);
  lines.push(`| Matched to a vici place that has ≥1 photo | ${result.counts.via_sites_matched_to_vici_with_image} |`);
  lines.push(`| **Elevation candidates** (photo-quest + vici photo) | **${result.counts.elevation_candidates}** |`);
  lines.push(`| Candidate images available | ${result.counts.candidate_images} |`);
  lines.push('');
  lines.push(`### License breakdown (candidate images)`);
  lines.push('');
  for (const [k, v] of Object.entries(licCount).sort((a,b)=>b[1]-a[1])) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push(`## Candidates`);
  lines.push('');
  for (const c of candidates) {
    lines.push(`### ${c.via_name}  ·  Pleiades [${c.pleiades}](https://pleiades.stoa.org/places/${c.pleiades})`);
    lines.push(`- vici: [${c.vici_name}](${c.vici_url}) · ${c.image_count} photo(s) · quest tier: ${c.via_quest}`);
    const credits = [...new Set(c.images.map(im => im.creator).filter(Boolean))];
    if (credits.length) lines.push(`- credits: ${credits.join('; ')}`);
    const lics = [...new Set(c.images.map(im => im.license).filter(Boolean))];
    if (lics.length) lines.push(`- licenses: ${lics.join(', ')}`);
    lines.push(`- top image: ${c.images[0].image}`);
    lines.push('');
  }
  await writeFile(OUT_MD, lines.join('\n'));
  console.log(`✓ wrote ${path.relative(ROOT, OUT_MD)}`);

  console.log(`\n── RESULT ──`);
  console.log(`  matched VIA sites w/ vici photo: ${matched.length}`);
  console.log(`  ELEVATION CANDIDATES (no P18 + vici photo): ${candidates.length}`);
  console.log(`  candidate images: ${result.counts.candidate_images}`);
  console.log(`  licenses:`, licCount);
  console.log(`\n  top 8 candidates:`);
  for (const c of candidates.slice(0, 8)) console.log(`    ${c.pleiades.padEnd(11)} ${(c.via_name||'').slice(0,32).padEnd(33)} ${c.image_count} img  ${c.images[0].license || '?'}`);

  if (EMIT_SITES) await emitSites(viciPhotoByPleiades, viaSites, photos, candidates);
}

main().catch(e => { console.error(e); process.exit(1); });
