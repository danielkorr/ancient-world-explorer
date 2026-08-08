import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { PILOT_STOP_IDS, REPO_ROOT } from '../config.mjs';

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function readAlexanderStops() {
  const sourcePath = path.join(REPO_ROOT, 'js', 'alexander.js');
  const source = await readFile(sourcePath, 'utf8');
  const context = vm.createContext(Object.create(null));
  const script = new vm.Script(
    `${source}\n;globalThis.__AWE_RESEARCH_STOPS__ = ALEXANDER_STOPS;`,
    { filename: 'js/alexander.js', timeout: 1000 },
  );
  script.runInContext(context, { timeout: 1000 });
  return {
    source: 'js/alexander.js',
    sha256: sha256(source),
    stops: clone(context.__AWE_RESEARCH_STOPS__),
  };
}

export async function readAlexanderPhotos() {
  const sourcePath = path.join(REPO_ROOT, 'js', 'alexander-photos.js');
  const source = await readFile(sourcePath, 'utf8');
  const context = vm.createContext({ window: {} });
  const script = new vm.Script(source, { filename: 'js/alexander-photos.js' });
  script.runInContext(context, { timeout: 1000 });
  return {
    source: 'js/alexander-photos.js',
    sha256: sha256(source),
    photos: clone(context.window.ALEXANDER_PHOTOS || {}),
  };
}

export async function readPilotSnapshot(ids = PILOT_STOP_IDS) {
  return readAlexanderSnapshot(ids);
}

export async function readAlexanderSnapshot(ids = null) {
  const [campaign, photoData] = await Promise.all([
    readAlexanderStops(),
    readAlexanderPhotos(),
  ]);
  const byId = new Map(campaign.stops.map((stop) => [stop.id, stop]));
  const selectedIds = ids === null ? campaign.stops.map((stop) => stop.id) : [...ids];
  const missing = selectedIds.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`Alexander stop(s) missing from core data: ${missing.join(', ')}`);

  const stops = selectedIds.map((id) => {
    const stop = clone(byId.get(id));
    const photoKey = String(stop.pleiades || stop.id);
    stop.existing_photo = photoData.photos[photoKey] || photoData.photos[stop.id] || null;
    return stop;
  });

  return Object.freeze({
    snapshot_version: 1,
    created_at: new Date().toISOString(),
    core_sources: [
      { path: campaign.source, sha256: campaign.sha256 },
      { path: photoData.source, sha256: photoData.sha256 },
    ],
    scope: ids === null ? 'all-alexander-stops' : 'selected-alexander-stops',
    stop_ids: selectedIds,
    stops,
  });
}
