import { createHash, randomUUID } from 'node:crypto';

export const SUBMISSION_TYPES = Object.freeze([
  'claim-correction',
  'new-evidence',
  'field-observation',
  'interpretation',
  'objection',
  'research-lead',
]);

export const CONTRIBUTION_STATUSES = Object.freeze([
  'proposed',
  'triaged',
  'under-review',
  'accepted',
  'disputed',
  'needs-more-research',
  'withdrawn',
  'archived',
]);

export const EVIDENCE_TYPES = Object.freeze([
  'source',
  'archaeological-record',
  'photograph',
  'map',
  'field-observation',
  'inscription',
  'other',
]);

export const DECISIONS = Object.freeze([
  'triage',
  'accept',
  'dispute',
  'needs-more-research',
  'withdraw',
  'archive',
]);

const SUBJECT_KINDS = new Set(['site', 'road', 'alexander_stop', 'dossier']);
const PROVENANCE_KINDS = new Set(['firsthand', 'quoted', 'derivative', 'inferred', 'unknown']);

function requiredText(value, field, max = 10000) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${field} is required`);
  if (text.length > max) throw new Error(`${field} exceeds ${max} characters`);
  return text;
}

function oneOf(value, values, field) {
  if (!values.includes(value)) throw new Error(`${field} is invalid`);
  return value;
}

function stableId(prefix, value) {
  return `${prefix}-${createHash('sha256').update(String(value)).digest('hex').slice(0, 16)}`;
}

export function createContribution({
  subjectKind,
  subjectId,
  submissionType,
  title,
  proposal,
  rationale,
  provenance,
  contributorId,
  contributorContext = {},
  createdAt = new Date().toISOString(),
}) {
  oneOf(subjectKind, [...SUBJECT_KINDS], 'subject_kind');
  requiredText(subjectId, 'subject_id', 160);
  oneOf(submissionType, SUBMISSION_TYPES, 'submission_type');
  requiredText(title, 'title', 180);
  requiredText(proposal, 'proposal');
  requiredText(rationale, 'rationale');
  requiredText(provenance, 'provenance');
  requiredText(contributorId, 'contributor_id', 160);
  if (!contributorContext || typeof contributorContext !== 'object' || Array.isArray(contributorContext)) {
    throw new Error('contributor_context must be an object');
  }
  const key = [subjectKind, subjectId, submissionType, title, contributorId, createdAt].join('|');
  return {
    id: stableId('contribution', key),
    subject_kind: String(subjectKind),
    subject_id: String(subjectId).trim(),
    submission_type: submissionType,
    title: String(title).trim(),
    proposal: String(proposal).trim(),
    rationale: String(rationale).trim(),
    provenance: String(provenance).trim(),
    contributor_id: String(contributorId).trim(),
    contributor_context: structuredClone(contributorContext),
    status: 'proposed',
    created_at: createdAt,
  };
}

export function createContributionEvidence({
  contributionId,
  evidenceType,
  title,
  sourceUrl = null,
  citation = null,
  provenanceKind = 'unknown',
  observedAt = null,
  latitude = null,
  longitude = null,
  locationPrecision = null,
  notes = null,
  metadata = {},
  createdAt = new Date().toISOString(),
}) {
  requiredText(contributionId, 'contribution_id', 160);
  oneOf(evidenceType, EVIDENCE_TYPES, 'evidence_type');
  requiredText(title, 'title', 240);
  oneOf(provenanceKind, [...PROVENANCE_KINDS], 'provenance_kind');
  if (!sourceUrl && !citation && !notes) throw new Error('source_url, citation, or notes is required');
  if (latitude != null && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) {
    throw new Error('latitude is invalid');
  }
  if (longitude != null && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) {
    throw new Error('longitude is invalid');
  }
  const key = [contributionId, evidenceType, title, sourceUrl, citation, createdAt].join('|');
  return {
    id: stableId('contribution-evidence', key),
    contribution_id: String(contributionId).trim(),
    evidence_type: evidenceType,
    title: String(title).trim(),
    source_url: sourceUrl,
    citation,
    provenance_kind: provenanceKind,
    observed_at: observedAt,
    latitude: latitude == null ? null : Number(latitude),
    longitude: longitude == null ? null : Number(longitude),
    location_precision: locationPrecision,
    notes,
    metadata: structuredClone(metadata),
    created_at: createdAt,
  };
}

export function createContributionDecision({
  contributionId,
  reviewerId,
  decision,
  rationale,
  reviewerContext = {},
  createdAt = new Date().toISOString(),
}) {
  requiredText(contributionId, 'contribution_id', 160);
  requiredText(reviewerId, 'reviewer_id', 160);
  oneOf(decision, DECISIONS, 'decision');
  requiredText(rationale, 'rationale');
  if (!reviewerContext || typeof reviewerContext !== 'object' || Array.isArray(reviewerContext)) {
    throw new Error('reviewer_context must be an object');
  }
  return {
    id: randomUUID(),
    contribution_id: String(contributionId).trim(),
    reviewer_id: String(reviewerId).trim(),
    decision,
    rationale: String(rationale).trim(),
    reviewer_context: structuredClone(reviewerContext),
    created_at: createdAt,
  };
}

export function assertContributionShape(contribution) {
  if (!contribution || !SUBMISSION_TYPES.includes(contribution.submission_type)) throw new Error('Invalid submission type');
  if (!CONTRIBUTION_STATUSES.includes(contribution.status)) throw new Error('Invalid contribution status');
  for (const field of ['subject_id', 'title', 'proposal', 'rationale', 'provenance', 'contributor_id']) {
    requiredText(contribution[field], field);
  }
  return contribution;
}
