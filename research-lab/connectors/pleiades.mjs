import { safeFetchJson } from './http.mjs';

function point(record) {
  if (Array.isArray(record.reprPoint) && record.reprPoint.length >= 2) {
    return { lng: Number(record.reprPoint[0]), lat: Number(record.reprPoint[1]), basis: 'reprPoint' };
  }
  const features = Array.isArray(record.features) ? record.features : [];
  for (const feature of features) {
    const coords = feature?.geometry?.coordinates;
    if (feature?.geometry?.type === 'Point' && Array.isArray(coords) && coords.length >= 2) {
      return { lng: Number(coords[0]), lat: Number(coords[1]), basis: 'feature-point' };
    }
  }
  return null;
}

function wikidataId(record) {
  const re = /wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i;
  for (const ref of record.references || []) {
    for (const key of ['accessURI', 'identifier', 'bibliographicURI', 'alternateURI']) {
      const match = typeof ref?.[key] === 'string' && ref[key].match(re);
      if (match) return match[1].toUpperCase();
    }
  }
  return null;
}

function references(record) {
  return (record.references || []).map((ref) => ({
    title: ref.shortTitle || ref.title || ref.citationDetail || ref.identifier || 'Pleiades reference',
    url: ['accessURI', 'bibliographicURI', 'alternateURI'].map((key) => ref?.[key]).find((value) => typeof value === 'string' && /^https:\/\//i.test(value)) || null,
    type: ref.type || null,
  })).filter((ref) => ref.url || ref.title).slice(0, 30);
}

export class PleiadesConnector {
  constructor({ offline = false } = {}) { this.offline = offline; }

  async getPlace(id) {
    const pid = String(id || '');
    if (!/^\d+$/.test(pid)) throw new Error(`Invalid Pleiades id: ${pid}`);
    const result = await safeFetchJson(`https://pleiades.stoa.org/places/${pid}/json`, { offline: this.offline });
    const record = result.data;
    return {
      id: pid,
      title: record.title || record.name || '',
      description: record.description || '',
      representative_point: point(record),
      names: (record.names || []).map((n) => n?.attested || n?.romanized || n?.name).filter(Boolean).slice(0, 30),
      references: references(record),
      wikidata: wikidataId(record),
      source_url: `https://pleiades.stoa.org/places/${pid}`,
      fetched_url: result.finalUrl,
      security: result.security,
    };
  }
}
