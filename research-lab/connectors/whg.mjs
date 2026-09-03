import { safeFetchJson } from './http.mjs';

export const WHG_BASE_URL = 'https://whgazetteer.org';

function tokenQuery(url, token) {
  if (token) url.searchParams.set('token', token);
  return url;
}

function assertEntityId(value) {
  const id = String(value || '');
  if (!/^(place|period|dataset|collection|area):[A-Za-z0-9:_-]+$/.test(id)) throw new Error(`Invalid WHG entity id: ${id}`);
  return id;
}

export function normalizeWhgPlace(feature, security = null) {
  const properties = feature?.properties || {};
  return {
    id: feature?.['@id'] || properties.source_id || null,
    title: properties.title || '',
    names: (feature?.names || []).map((item) => item?.toponym).filter(Boolean),
    geometry: feature?.geometry || null,
    when: feature?.when || null,
    links: feature?.links || [],
    dataset: properties.dataset || null,
    source_url: feature?.['@id'] || null,
    security,
  };
}

export class WhgConnector {
  constructor({ offline = false, token = null } = {}) { this.offline = offline; this.token = token; }

  async getEntity(entityId) {
    const id = assertEntityId(entityId);
    const url = tokenQuery(new URL(`${WHG_BASE_URL}/entity/${encodeURIComponent(id)}/api`), this.token);
    const result = await safeFetchJson(url.toString(), { offline: this.offline });
    return { ...normalizeWhgPlace(result.data, result.security), fetched_url: result.finalUrl };
  }

  async reconcile(queries) {
    if (!Array.isArray(queries) || !queries.length || queries.length > 50) throw new Error('WHG reconciliation requires 1 to 50 queries');
    const url = tokenQuery(new URL(`${WHG_BASE_URL}/reconcile`), this.token);
    const payload = { queries: Object.fromEntries(queries.map((query, index) => [String(query.id || `query-${index + 1}`), {
      query: String(query.query || '').trim(),
      limit: Math.min(20, Math.max(1, Number(query.limit || 5))),
      ...(query.namespaces ? { namespaces: query.namespaces } : {}),
      ...(query.countries ? { countries: query.countries } : {}),
    }])) };
    if (Object.values(payload.queries).some((query) => !query.query)) throw new Error('WHG reconciliation queries require non-empty names');
    const result = await safeFetchJson(url.toString(), {
      method: 'POST', body: JSON.stringify(payload), offline: this.offline,
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
    });
    return { data: result.data, fetched_url: result.finalUrl, security: result.security };
  }
}

export const WHGConnector = WhgConnector;
