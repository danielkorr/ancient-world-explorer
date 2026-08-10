import { safeFetchJson } from './http.mjs';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function publicOpenContextUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'opencontext.org') return null;
    url.protocol = 'https:';
    return url.toString();
  } catch { return null; }
}

function publicCitationUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['n2t.net', 'doi.org'].includes(url.hostname) ? url.toString() : null;
  } catch { return null; }
}

function recordDataUrl(readerUrl) {
  if (!readerUrl) return null;
  const url = new URL(readerUrl);
  if (!/\.(json|jsonld)$/.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/$/, '')}.json`;
  return url.toString();
}

function plainSnippet(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);
}

export function normalizeOpenContextRecord(record, responseSecurity = null) {
  const latitude = finiteNumber(record.latitude ?? record['geo:lat']);
  const longitude = finiteNumber(record.longitude ?? record['geo:long']);
  const readerUrl = publicOpenContextUrl(record.href)
    || publicOpenContextUrl(record.uri || record.id || record['@id']);
  return {
    source_url: readerUrl,
    reader_url: readerUrl,
    data_url: recordDataUrl(readerUrl),
    citation_url: publicCitationUrl(record['citation uri']),
    label: String(record.label || record['rdfs:label'] || 'Open Context record').slice(0, 500),
    category: String(record['item category'] || record.category || '').slice(0, 200),
    project: String(record['project label'] || '').slice(0, 300),
    project_url: publicOpenContextUrl(record['project href']),
    context: String(record['context label'] || '').slice(0, 500),
    context_url: publicOpenContextUrl(record['context href']),
    snippet: plainSnippet(record.snippet),
    early_year: finiteNumber(record['early bce/ce']),
    late_year: finiteNumber(record['late bce/ce']),
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

  searchPageUrl(query, rows = 8) {
    const apiUrl = new URL(this.searchUrl(query, rows));
    apiUrl.pathname = '/query/';
    return apiUrl.toString();
  }

  async search(query, { rows = 8 } = {}) {
    const url = this.searchUrl(query, rows);
    const result = await safeFetchJson(url, { offline: this.offline, timeoutMs: 20000 });
    const records = Array.isArray(result.data?.['oc-api:has-results']) ? result.data['oc-api:has-results'] : [];
    return {
      query: String(query).trim(),
      source_url: this.searchPageUrl(query, rows),
      reader_url: this.searchPageUrl(query, rows),
      data_url: url,
      total_results: Number(result.data?.totalResults) || records.length,
      records: records.slice(0, Math.max(1, Math.min(20, Number(rows) || 8))).map((record) => normalizeOpenContextRecord(record, result.security)),
      security: result.security,
    };
  }
}
