import { safeFetchJson } from './http.mjs';

export const PERIODO_DATASET_URL = 'https://n2t.net/ark:/99152/p0d.json';

function assertPeriodId(value) {
  if (!/^https?:\/\/n2t\.net\/ark:\/99152\/[A-Za-z0-9._~-]+$/.test(value)) {
    throw new Error('Invalid PeriodO definition URI');
  }
  return value;
}

function yearFromEndpoint(endpoint) {
  const value = endpoint?.in?.year;
  if (value == null || value === '') return null;
  const year = Number(value);
  return Number.isFinite(year) ? Math.trunc(year) : null;
}

export function buildPeriodOIndex(dataset) {
  const authorities = dataset?.authorities;
  if (!authorities || typeof authorities !== 'object') throw new Error('PeriodO dataset has no authorities index');
  const records = [];
  for (const authority of Object.values(authorities)) {
    const source = authority.source || {};
    for (const period of Object.values(authority.periods || {})) {
      const labels = [
        period.label,
        ...(Object.values(period.localizedLabels || {}).flat()),
      ].filter(Boolean).map(String);
      records.push({
        id: period.id,
        uri: `https://n2t.net/ark:/99152/${period.id}`,
        labels: [...new Set(labels)],
        authority_id: authority.id,
        authority_source: source.title || source.partOf?.title || null,
        authority_year: source.yearPublished || source.partOf?.yearPublished || null,
        original_note: period.editorialNote || period.note || null,
        spatial_scope: (period.spatialCoverage || []).map(item => ({
          id: item.id || null,
          label: item.label || null,
        })),
        spatial_description: period.spatialCoverageDescription || null,
        normalized_date_range: {
          earliest: yearFromEndpoint(period.start),
          latest: yearFromEndpoint(period.stop),
        },
      });
    }
  }
  return {
    schema_version: 1,
    source: PERIODO_DATASET_URL,
    indexed_at: new Date().toISOString(),
    record_count: records.length,
    records,
  };
}

export class PeriodOConnector {
  constructor({ offline = false } = {}) {
    this.offline = offline;
  }

  async getDataset() {
    return safeFetchJson(PERIODO_DATASET_URL, { offline: this.offline });
  }

  async getDefinition(uri) {
    const definitionUri = assertPeriodId(uri);
    return safeFetchJson(`${definitionUri}.json`, { offline: this.offline });
  }
}
