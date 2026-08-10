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

export const ARCHAEOLOGY_CLASSIFICATION = Object.freeze({
  ESTABLISHED: 'established_evidence',
  CANDIDATE: 'candidate_evidence',
  DISPUTED: 'disputed_interpretation',
  LEAD: 'research_lead',
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

export function archaeologyLead({ subjectId, classification = ARCHAEOLOGY_CLASSIFICATION.LEAD, sourceType, sourceUrl, dataUrl = null, citationUrl = null, title, location = null, date = null, snippet = '', project = '', context = '', chronology = null, relevance, confidence = 0, distanceKm = null, evidenceIds = [], rationale = '', sensitivity = 'public-source-only' }) {
  const score = Math.max(0, Math.min(100, Math.round(Number(confidence) || 0)));
  const key = `${subjectId}|${sourceType}|${sourceUrl || title}|${classification}`;
  return {
    id: stableId('archaeology', key),
    subject_id: subjectId,
    classification,
    source_type: sourceType,
    source_url: sourceUrl,
    data_url: dataUrl,
    citation_url: citationUrl,
    title,
    location,
    date,
    snippet,
    project,
    context,
    chronology,
    relevance,
    confidence: score,
    distance_km: Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(3)) : null,
    evidence_ids: [...new Set(evidenceIds)],
    rationale,
    sensitivity,
  };
}

export function auditEvent(type, detail = {}) {
  return { id: randomUUID(), at: new Date().toISOString(), type, detail };
}

export function assertReportShape(report) {
  if (!report || ![1, 2, 3].includes(report.schema_version)) throw new Error('Invalid research report schema_version');
  if (!Array.isArray(report.subjects) || !Array.isArray(report.claims) || !Array.isArray(report.evidence)) {
    throw new Error('Invalid research report collections');
  }
  if (report.schema_version >= 2 && !Array.isArray(report.archaeology_leads)) {
    throw new Error('Invalid archaeology lead collection');
  }
  if (report.schema_version >= 3 && !Array.isArray(report.dossiers)) {
    throw new Error('Invalid research dossier collection');
  }
  return report;
}
