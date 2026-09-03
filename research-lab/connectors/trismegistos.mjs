import { safeFetchJson } from './http.mjs';

export const TM_GEORESPONDER_URL = 'https://www.trismegistos.org/dataservices/georesponder/georesponder.php';

export function trismegistosPlaceUrl(id) {
  const value = String(id || '');
  if (!/^\d+$/.test(value)) throw new Error(`Invalid Trismegistos Geo id: ${value}`);
  return `https://www.trismegistos.org/place/${value}`;
}

export function normalizeTrismegistosPlace(record, security = null) {
  const properties = record?.properties || {};
  const coordinates = record?.geometry?.type === 'Point' ? record.geometry.coordinates : null;
  return {
    id: String(record?.TM_Geo_ID || record?.tm_geo_id || '').replace(/\D/g, '') || null,
    title: record?.title || properties.name || '',
    representative_point: Array.isArray(coordinates) && coordinates.length >= 2
      ? { lng: Number(coordinates[0]), lat: Number(coordinates[1]), basis: 'trismegistos-georesponder' }
      : null,
    province: properties.provincia || null,
    country: properties.country || null,
    source_url: typeof record?.uri === 'string' ? record.uri : null,
    security,
  };
}

export class TrismegistosConnector {
  constructor({ offline = false } = {}) { this.offline = offline; }

  async getPlace(id) {
    const sourceUrl = trismegistosPlaceUrl(id);
    const url = new URL(TM_GEORESPONDER_URL);
    url.searchParams.set('id', String(id));
    const result = await safeFetchJson(url.toString(), { offline: this.offline });
    return { ...normalizeTrismegistosPlace(result.data, result.security), source_url: sourceUrl, fetched_url: result.finalUrl };
  }
}
