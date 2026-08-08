import { auditEvent } from '../core/schema.mjs';

export function runVerificationAgent({ subjects, claims, evidence, conflicts, archaeologyLeads = [], dossiers = [] }) {
  const events = [];
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const conflictIds = new Set(conflicts.map((item) => item.id));
  const subjectIds = new Set(subjects.map((item) => item.id));
  const claimIds = new Set(claims.map((item) => item.id));
  const archaeologyIds = new Set(archaeologyLeads.map((item) => item.id));

  for (const item of claims) {
    if (!subjectIds.has(item.subject_id)) events.push(auditEvent('invalid-claim-subject', { claim_id: item.id }));
    for (const id of item.evidence_ids) if (!evidenceIds.has(id)) events.push(auditEvent('missing-evidence-reference', { claim_id: item.id, evidence_id: id }));
    for (const id of item.conflict_ids) if (!conflictIds.has(id)) events.push(auditEvent('missing-conflict-reference', { claim_id: item.id, conflict_id: id }));
    if (item.status === 'proposed' && item.evidence_ids.length === 0) {
      events.push(auditEvent('unsupported-proposal', { claim_id: item.id, field: item.field }));
    }
  }

  for (const item of evidence) {
    if (item.source_url) {
      let protocol = null;
      try { protocol = new URL(item.source_url).protocol; } catch {}
      if (protocol !== 'https:') events.push(auditEvent('unsafe-source-url', { evidence_id: item.id, url: item.source_url }));
    }
  }


  for (const lead of archaeologyLeads) {
    if (!subjectIds.has(lead.subject_id)) events.push(auditEvent('invalid-archaeology-subject', { lead_id: lead.id }));
    if (!lead.source_url || !/^https:\/\//.test(lead.source_url)) events.push(auditEvent('unsafe-archaeology-source', { lead_id: lead.id }));
    if (lead.confidence < 0 || lead.confidence > 100) events.push(auditEvent('invalid-archaeology-confidence', { lead_id: lead.id }));
    for (const id of lead.evidence_ids) if (!evidenceIds.has(id)) events.push(auditEvent('missing-archaeology-evidence', { lead_id: lead.id, evidence_id: id }));
    if (lead.classification === 'established_evidence') {
      const supporting = lead.evidence_ids.map((id) => evidence.find((item) => item.id === id));
      if (lead.confidence < 80 || supporting.some((item) => item?.status !== 'verified')) {
        events.push(auditEvent('unsupported-established-archaeology', { lead_id: lead.id }));
      }
    }
  }

  const dossierSubjects = new Set();
  for (const dossier of dossiers) {
    if (!subjectIds.has(dossier.subject_id)) events.push(auditEvent('invalid-dossier-subject', { dossier_id: dossier.id }));
    if (dossierSubjects.has(dossier.subject_id)) events.push(auditEvent('duplicate-subject-dossier', { subject_id: dossier.subject_id }));
    dossierSubjects.add(dossier.subject_id);
    for (const id of dossier.provenance?.claim_ids || []) if (!claimIds.has(id)) events.push(auditEvent('missing-dossier-claim', { dossier_id: dossier.id, claim_id: id }));
    for (const id of dossier.provenance?.evidence_ids || []) if (!evidenceIds.has(id)) events.push(auditEvent('missing-dossier-evidence', { dossier_id: dossier.id, evidence_id: id }));
    for (const id of dossier.provenance?.conflict_ids || []) if (!conflictIds.has(id)) events.push(auditEvent('missing-dossier-conflict', { dossier_id: dossier.id, conflict_id: id }));
    for (const id of dossier.provenance?.archaeology_lead_ids || []) if (!archaeologyIds.has(id)) events.push(auditEvent('missing-dossier-archaeology', { dossier_id: dossier.id, lead_id: id }));
  }
  if (dossiers.length) {
    for (const subject of subjects) if (!dossierSubjects.has(subject.id)) events.push(auditEvent('missing-subject-dossier', { subject_id: subject.id }));
  }

  return {
    passed: events.length === 0,
    issue_count: events.length,
    events,
  };
}
