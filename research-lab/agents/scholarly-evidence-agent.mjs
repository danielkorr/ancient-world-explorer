import { claim, evidence, CLAIM_STATUS, EVIDENCE_STATUS } from '../core/schema.mjs';

export function runScholarlyEvidenceAgent({ subject, pleiadesPlace = null }) {
  const references = (pleiadesPlace?.references || [])
    .filter((ref) => ref.url && !/wikidata\.org|wikipedia\.org|vici\.org/i.test(ref.url))
    .slice(0, 12);

  const evidenceItems = references.map((ref) => evidence({
    subjectId: subject.id,
    sourceType: 'pleiades_reference',
    sourceUrl: ref.url,
    title: String(ref.title || 'Pleiades linked reference').slice(0, 500),
    assertion: 'Pleiades links this resource to the place; the Research Lab has not independently fetched or validated its scholarly claim.',
    status: EVIDENCE_STATUS.UNRESOLVED,
    payload: { reference_type: ref.type },
  }));

  return {
    claims: [claim({
      subject,
      field: 'modern_scholarship',
      existingValue: null,
      status: CLAIM_STATUS.OBSERVED,
      agent: 'scholarly-evidence-agent',
      evidence: evidenceItems.map((item) => item.id),
      note: references.length
        ? 'Candidate scholarship/reference links discovered through Pleiades; each still requires independent review.'
        : 'No structured candidate scholarship was discovered from the currently linked authority record.',
    })],
    evidence: evidenceItems,
    conflicts: [],
  };
}
