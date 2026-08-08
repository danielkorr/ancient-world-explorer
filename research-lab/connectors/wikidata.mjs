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
}
