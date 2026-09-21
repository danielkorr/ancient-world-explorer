// Read-only integrity audit for the foreground Roman catalogue and Alexander layer.
// This checks joins and display boundaries. It does not decide whether a historical
// description or photograph is semantically correct; those still need human review.

import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(file, 'utf8');

function loadRomanSites() {
  const context = { window: {} };
  const source = [
    'js/sites-pleiades.js',
    'js/sites-vici.js',
    'js/data.js',
  ].map(read).join('\n') + '\nthis.__sites = SITES;';
  vm.runInNewContext(source, context);
  return context.__sites;
}

function loadAlexanderStops() {
  const context = { window: {} };
  const source = read('js/alexander.js') + '\nthis.__stops = ALEXANDER_STOPS;';
  vm.runInNewContext(source, context);
  return context.__stops;
}

function loadPhotoMap(file, globalName) {
  const context = { window: {} };
  vm.runInNewContext(read(file) + `\nthis.__photos = window.${globalName};`, context);
  return context.__photos || {};
}

function duplicateValues(items, key) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    const value = item[key];
    if (value == null) continue;
    if (seen.has(value)) duplicates.add(String(value));
    seen.add(value);
  }
  return [...duplicates];
}

const sites = loadRomanSites();
const stops = loadAlexanderStops();
const romanPhotos = loadPhotoMap('js/site-photos.js', 'SITE_PHOTOS');
const alexanderPhotos = loadPhotoMap('js/alexander-photos.js', 'ALEXANDER_PHOTOS');

const siteIds = new Set(sites.map(site => String(site.pleiades)).filter(Boolean));
const stopIds = new Set(stops.map(stop => stop.id));
const stopPleiades = new Set(stops.map(stop => String(stop.pleiades)).filter(Boolean));
const failures = [];

const duplicateSitePleiades = duplicateValues(sites, 'pleiades');
if (duplicateSitePleiades.length) failures.push(`duplicate Roman Pleiades ids: ${duplicateSitePleiades.join(', ')}`);

for (const site of sites) {
  if (!Number.isFinite(site.lat) || !Number.isFinite(site.lng)) {
    failures.push(`Roman site has invalid coordinates: ${site.name || site.id}`);
  }
}

for (const key of Object.keys(romanPhotos)) {
  if (!siteIds.has(String(key))) failures.push(`Roman photo has no runtime site: ${key}`);
}

for (const stop of stops) {
  if (!stop.id || !stop.name) failures.push('Alexander stop missing id or name');
  if (!Array.isArray(stop.links) || stop.links.length === 0) {
    failures.push(`Alexander stop has no source link: ${stop.id}`);
  }
  if (stop.certainty !== 'secure' && !stop.source_note) {
    failures.push(`Alexander non-secure stop missing source note: ${stop.id}`);
  }
  if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) {
    failures.push(`Alexander stop has invalid coordinates: ${stop.id}`);
  }
}

for (const key of Object.keys(alexanderPhotos)) {
  if (!stopPleiades.has(String(key)) && !stopIds.has(key)) {
    failures.push(`Alexander photo has no stop: ${key}`);
  }
}

// This was the reported contamination path. The two namespaces must stay separate.
if (Object.prototype.hasOwnProperty.call(romanPhotos, 'sogdian-rock')) {
  failures.push('Alexander sogdian-rock photo leaked into Roman photo map');
}

const questCounts = sites.reduce((out, site) => {
  const tier = site.quest || 'documented';
  out[tier] = (out[tier] || 0) + 1;
  return out;
}, {});

console.log(JSON.stringify({
  romanForegroundSites: sites.length,
  romanQuestCounts: questCounts,
  romanPhotoEntries: Object.keys(romanPhotos).length,
  alexanderStops: stops.length,
  alexanderStopsWithPleiades: stops.filter(stop => stop.pleiades).length,
  alexanderPhotoEntries: Object.keys(alexanderPhotos).length,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
