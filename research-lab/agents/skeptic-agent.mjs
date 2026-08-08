import { claim, conflict, CLAIM_STATUS } from '../core/schema.mjs';

export function runSkepticAgent({ stop, subject, archaeologyLeads = [] }) {
  const conflicts = [];
  const note = String(stop.source_note || '');
  const certainty = String(stop.certainty || '').toLowerCase();

  if (['disputed', 'uncertain'].includes(certainty) || /disput|debated/i.test(note)) {
    conflicts.push(conflict({
      subjectId: subject.id,
      field: 'scholarly_interpretation',
      description: `Core data itself signals scholarly uncertainty: ${note || certainty}.`,
      severity: 'high',
    }));
  } else if (certainty === 'approximate' || /approximate|generalized|transformed/i.test(note)) {
    conflicts.push(conflict({
      subjectId: subject.id,
      field: 'scholarly_interpretation',
      description: `Core data signals an approximate or transformed location: ${note || certainty}.`,
      severity: 'medium',
    }));
  }

  if (!stop.ancient_sources?.length) {
    conflicts.push(conflict({
      subjectId: subject.id,
      field: 'ancient_sources',
      description: 'No ancient-source citation is attached to this stop.',
      severity: 'high',
    }));
  }

  for (const lead of archaeologyLeads.filter((item) => item.classification === 'candidate_evidence')) {
    if (lead.distance_km === null || lead.distance_km > 25 || lead.confidence < 65) {
      conflicts.push(conflict({
        subjectId: subject.id,
        field: 'archaeological_association',
        description: `Discovery candidate “${lead.title}” is not established evidence for Alexander; ${lead.distance_km === null ? 'no comparable public coordinate is available' : `its published point is ${lead.distance_km.toFixed(1)} km from the VIA marker`} and the association requires independent archaeological review.`,
        severity: lead.distance_km !== null && lead.distance_km > 100 ? 'medium' : 'low',
        evidenceIds: lead.evidence_ids,
      }));
    }
  }

  return {
    claims: [claim({
      subject,
      field: 'certainty',
      existingValue: stop.certainty || null,
      status: conflicts.length ? CLAIM_STATUS.DISPUTED : CLAIM_STATUS.OBSERVED,
      agent: 'skeptic-agent',
      conflicts: conflicts.map((c) => c.id),
      note: conflicts.length ? 'Skeptic agent preserved explicit uncertainty rather than collapsing it into a single answer.' : 'No explicit uncertainty signal found in core record.',
    })],
    evidence: [],
    conflicts,
  };
}
