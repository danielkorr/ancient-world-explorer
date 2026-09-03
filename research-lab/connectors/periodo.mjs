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

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenOverlap(a, b) {
  const left = new Set(normalize(a).split(' ').filter(Boolean));
  const right = new Set(normalize(b).split(' ').filter(Boolean));
  if (!left.size || !right.size) return 0;
  return [...left].filter(token => right.has(token)).length / left.size;
}

function rangeOverlap(a, b) {
  if (!a || !b || a.earliest == null || a.latest == null || b.earliest == null || b.latest == null) return 0;
  const start = Math.max(a.earliest, b.earliest);
  const end = Math.min(a.latest, b.latest);
  if (end < start) return 0;
  const union = Math.max(a.latest, b.latest) - Math.min(a.earliest, b.earliest);
  return union ? (end - start) / union : 1;
}

export function rankPeriodODefinitions(index, { expression, spatialHints = [], dateRange = null, limit = 8 } = {}) {
  if (!expression) throw new Error('PeriodO matching requires an expression');
  const hints = (Array.isArray(spatialHints) ? spatialHints : [spatialHints]).map(normalize).filter(Boolean);
  return (index?.records || []).map(record => {
    const labelScore = Math.max(...record.labels.map(label => {
      const candidate = normalize(label);
      const wanted = normalize(expression);
      if (candidate === wanted) return 1;
      if (candidate.includes(wanted) || wanted.includes(candidate)) return 0.8;
      return tokenOverlap(wanted, candidate) * 0.6;
    }), 0);
    const scopeText = [record.spatial_description, ...record.spatial_scope.map(item => item.label)].filter(Boolean).join(' ');
    const scopeScore = hints.length ? Math.max(...hints.map(hint => tokenOverlap(hint, scopeText))) : 0;
    const dateScore = rangeOverlap(dateRange, record.normalized_date_range);
    const score = Math.round((labelScore * 0.65 + scopeScore * 0.2 + dateScore * 0.15) * 100);
    const rationale = [
      labelScore >= 0.8 ? 'label match' : labelScore > 0 ? 'partial label match' : null,
      scopeScore > 0 ? 'spatial scope match' : null,
      dateScore > 0 ? 'date-range overlap' : null,
    ].filter(Boolean);
    return { record, score, rationale };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id))
    .slice(0, Math.max(1, limit));
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
