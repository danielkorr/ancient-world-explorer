import { createHash, randomUUID } from 'node:crypto';

export const CLAIM_STATUS = Object.freeze({
  OBSERVED: 'observed',
  PROPOSED: 'proposed',
  DISPUTED: 'disputed',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
});

export const EVIDENCE_STATUS = Object.freeze({
  VERIFIED: 'verified',
  UNRESOLVED: 'unresolved',
  CONFLICTING: 'conflicting',
  QUARANTINED: 'quarantined',
});

function stableId(prefix, value) {
  return `${prefix}-${createHash('sha256').update(String(value)).digest('hex').slice(0, 16)}`;
}

export function subjectFromStop(stop) {
  return {
    id: `alexander:${stop.id}`,
    kind: 'alexander_stop',
    core_id: stop.id,
    name: stop.name,
    pleiades: stop.pleiades ? String(stop.pleiades) : null,
  };
}

export function claim({ subject, field, existingValue, proposedValue = existingValue, status = CLAIM_STATUS.OBSERVED, agent, evidence = [], conflicts = [], note = '' }) {
  const key = `${subject.id}|${field}|${JSON.stringify(existingValue)}|${JSON.stringify(proposedValue)}`;
  return {
    id: stableId('claim', key),
    subject_id: subject.id,
    field,
    existing_value: existingValue ?? null,
    proposed_value: proposedValue ?? null,
    status,
    agent,
    evidence_ids: [...new Set(evidence)],
    conflict_ids: [...new Set(conflicts)],
    note,
  };
}

export function evidence({ subjectId, sourceType, sourceUrl = null, citation = null, title = '', assertion = '', status = EVIDENCE_STATUS.UNRESOLVED, retrievedAt = new Date().toISOString(), payload = null, security = null }) {
  const key = `${subjectId}|${sourceType}|${sourceUrl || citation || title}|${assertion}`;
  return {
    id: stableId('evidence', key),
    subject_id: subjectId,
    source_type: sourceType,
    source_url: sourceUrl,
    citation,
    title,
    assertion,
    status,
    retrieved_at: retrievedAt,
    payload,
    security,
  };
}

export function conflict({ subjectId, field, description, severity = 'medium', evidenceIds = [] }) {
  const key = `${subjectId}|${field}|${description}`;
  return {
    id: stableId('conflict', key),
    subject_id: subjectId,
    field,
    description,
    severity,
    evidence_ids: [...new Set(evidenceIds)],
  };
}

export function auditEvent(type, detail = {}) {
  return { id: randomUUID(), at: new Date().toISOString(), type, detail };
}

export function assertReportShape(report) {
  if (!report || report.schema_version !== 1) throw new Error('Invalid research report schema_version');
  if (!Array.isArray(report.subjects) || !Array.isArray(report.claims) || !Array.isArray(report.evidence)) {
    throw new Error('Invalid research report collections');
  }
  return report;
}
