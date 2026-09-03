import { createHash } from 'node:crypto';

export const TEMPORAL_REVIEW_STATUS = Object.freeze({
  PENDING: 'pending',
  HUMAN_REVIEWED: 'human-reviewed',
  DISPUTED: 'disputed',
});

function stableId(value) {
  return `temporal-${createHash('sha256').update(String(value)).digest('hex').slice(0, 16)}`;
}

function nullableString(value) {
  return value == null || value === '' ? null : String(value);
}

function nullableYear(value) {
  if (value == null || value === '') return null;
  const year = Number(value);
  return Number.isFinite(year) ? Math.trunc(year) : null;
}

export function temporalAssertion({
  subjectId,
  claimId = null,
  sourceTemporalExpression,
  periodoDefinitionUri = null,
  periodoLabel = null,
  authority = null,
  spatialScope = [],
  earliestYear = null,
  latestYear = null,
  researcherInterpretation = '',
  assignmentConfidence = 'unassigned',
  reviewStatus = TEMPORAL_REVIEW_STATUS.PENDING,
  alternatives = [],
}) {
  if (!subjectId) throw new Error('Temporal assertion requires subjectId');
  if (!sourceTemporalExpression) throw new Error('Temporal assertion requires sourceTemporalExpression');
  const normalizedScope = [...new Set((Array.isArray(spatialScope) ? spatialScope : [spatialScope])
    .map(nullableString).filter(Boolean))];
  const normalizedAlternatives = [...new Set((Array.isArray(alternatives) ? alternatives : [alternatives])
    .map(nullableString).filter(Boolean))];
  const key = [subjectId, claimId, sourceTemporalExpression, periodoDefinitionUri, normalizedAlternatives.join('|')].join('|');
  return {
    id: stableId(key),
    subject_id: String(subjectId),
    claim_id: nullableString(claimId),
    source_temporal_expression: String(sourceTemporalExpression),
    periodo_definition_uri: nullableString(periodoDefinitionUri),
    periodo_label: nullableString(periodoLabel),
    authority: nullableString(authority),
    spatial_scope: normalizedScope,
    normalized_date_range: {
      earliest: nullableYear(earliestYear),
      latest: nullableYear(latestYear),
    },
    researcher_interpretation: String(researcherInterpretation || ''),
    assignment_confidence: String(assignmentConfidence || 'unassigned'),
    review_status: String(reviewStatus || TEMPORAL_REVIEW_STATUS.PENDING),
    alternative_definition_uris: normalizedAlternatives,
  };
}

export function validateTemporalAssertion(assertion) {
  if (!assertion || typeof assertion !== 'object') throw new Error('Invalid temporal assertion');
  if (!assertion.subject_id || !assertion.source_temporal_expression) {
    throw new Error('Temporal assertion is missing subject or original wording');
  }
  if (!assertion.normalized_date_range || typeof assertion.normalized_date_range !== 'object') {
    throw new Error('Temporal assertion is missing normalized_date_range');
  }
  if (!Array.isArray(assertion.spatial_scope) || !Array.isArray(assertion.alternative_definition_uris)) {
    throw new Error('Temporal assertion scope and alternatives must be arrays');
  }
  return assertion;
}
