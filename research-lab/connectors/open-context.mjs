import { safeFetchJson } from './http.mjs';

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function publicOpenContextUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'opencontext.org' ? url.toString() : null;
  } catch { return null; }
}

function normalizeRecord(record, responseSecurity) {
  const latitude = finiteNumber(record.latitude ?? record['geo:lat']);
  const longitude = finiteNumber(record.longitude ?? record['geo:long']);
  return {
    source_url: publicOpenContextUrl(record.uri || record.id || record['@id']),
    citation_url: publicOpenContextUrl(record['citation uri']),
    label: String(record.label || record['rdfs:label'] || 'Open Context record').slice(0, 500),
    category: String(record['item category'] || record.category || '').slice(0, 200),
    project: String(record['project label'] || '').slice(0, 300),
    context: String(record['context label'] || '').slice(0, 500),
    published: record.published || null,
    updated: record.updated || null,
    coordinate: latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null,
    security: responseSecurity,
  };
}

export class OpenContextConnector {
  constructor({ offline = false } = {}) { this.offline = offline; }

  searchUrl(query, rows = 8) {
    const term = String(query || '').trim();
    if (!term || term.length > 160) throw new Error('An Open Context search term of 1-160 characters is required');
    const count = Math.max(1, Math.min(20, Number(rows) || 8));
    const url = new URL('https://opencontext.org/query/.json');
    url.searchParams.set('q', term);
    url.searchParams.set('rows', String(count));
    url.searchParams.set('response', 'metadata,uri-meta');
    return url.toString();
  }

  async search(query, { rows = 8 } = {}) {
    const url = this.searchUrl(query, rows);
    const result = await safeFetchJson(url, { offline: this.offline, timeoutMs: 20000 });
    const records = Array.isArray(result.data?.['oc-api:has-results']) ? result.data['oc-api:has-results'] : [];
    return {
      query: String(query).trim(),
      source_url: url,
      total_results: Number(result.data?.totalResults) || records.length,
      records: records.slice(0, Math.max(1, Math.min(20, Number(rows) || 8))).map((record) => normalizeRecord(record, result.security)),
      security: result.security,
    };
  }
}
