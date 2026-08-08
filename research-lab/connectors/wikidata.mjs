import { safeFetchJson } from './http.mjs';

function firstClaim(entity, property) {
  return entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value ?? null;
}

export class WikidataConnector {
  constructor({ offline = false } = {}) { this.offline = offline; }

  async getEntity(qid) {
    const id = String(qid || '').toUpperCase();
    if (!/^Q\d+$/.test(id)) throw new Error(`Invalid Wikidata id: ${id}`);
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', id);
    url.searchParams.set('props', 'claims|labels');
    url.searchParams.set('languages', 'en');
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    const result = await safeFetchJson(url.toString(), { offline: this.offline });
    const entity = result.data?.entities?.[id];
    if (!entity || entity.missing) throw new Error(`Wikidata entity not found: ${id}`);
    const coordinate = firstClaim(entity, 'P625');
    const pleiades = firstClaim(entity, 'P1584');
    return {
      id,
      label: entity.labels?.en?.value || '',
      image: firstClaim(entity, 'P18'),
      pleiades: typeof pleiades === 'string' ? pleiades : null,
      coordinate: coordinate && Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude)
        ? { lat: coordinate.latitude, lng: coordinate.longitude }
        : null,
      source_url: `https://www.wikidata.org/wiki/${id}`,
      fetched_url: result.finalUrl,
      security: result.security,
    };
  }

  async searchEntities(query, limit = 5) {
    const search = String(query || '').trim();
    if (!search || search.length > 160) throw new Error('A Wikidata search term of 1-160 characters is required');
    const count = Math.max(1, Math.min(10, Number(limit) || 5));
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('search', search);
    url.searchParams.set('language', 'en');
    url.searchParams.set('uselang', 'en');
    url.searchParams.set('type', 'item');
    url.searchParams.set('limit', String(count));
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    const result = await safeFetchJson(url.toString(), { offline: this.offline });
    return (result.data?.search || []).slice(0, count).map((item) => ({
      id: String(item.id || '').toUpperCase(),
      label: item.label || '',
      description: item.description || '',
      source_url: item.concepturi || (item.id ? `https://www.wikidata.org/wiki/${item.id}` : null),
      security: result.security,
    })).filter((item) => /^Q\d+$/.test(item.id));
  }
}
