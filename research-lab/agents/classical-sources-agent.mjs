import { claim, evidence, CLAIM_STATUS, EVIDENCE_STATUS } from '../core/schema.mjs';

export async function runClassicalSourcesAgent({ stop, subject, scaife, ctsMap = {} }) {
  const evidenceItems = [];
  for (const citation of stop.ancient_sources || []) {
    const mappedUrn = ctsMap[citation] || null;
    if (!mappedUrn) {
      evidenceItems.push(evidence({
        subjectId: subject.id,
        sourceType: 'classical_citation',
        citation,
        title: citation,
        assertion: 'Citation present in VIA core data; machine passage mapping has not been independently resolved.',
        status: EVIDENCE_STATUS.UNRESOLVED,
      }));
      continue;
    }
    try {
      const passage = await scaife.getPassage(mappedUrn);
      evidenceItems.push(evidence({
        subjectId: subject.id,
        sourceType: 'scaife_cts',
        sourceUrl: passage.source_url,
        citation,
        title: citation,
        assertion: `CTS passage resolved as ${mappedUrn}`,
        status: passage.security.prompt_injection_suspected ? EVIDENCE_STATUS.QUARANTINED : EVIDENCE_STATUS.VERIFIED,
        payload: { urn: mappedUrn },
        security: passage.security,
      }));
    } catch (error) {
      evidenceItems.push(evidence({
        subjectId: subject.id,
        sourceType: 'scaife_cts',
        citation,
        title: citation,
        assertion: `CTS resolution failed: ${error.message}`,
        status: EVIDENCE_STATUS.UNRESOLVED,
      }));
    }
  }

  return {
    claims: [claim({
      subject,
      field: 'ancient_sources',
      existingValue: stop.ancient_sources || [],
      status: evidenceItems.length && evidenceItems.every((e) => e.status === EVIDENCE_STATUS.VERIFIED)
        ? CLAIM_STATUS.VERIFIED : CLAIM_STATUS.OBSERVED,
      agent: 'classical-sources-agent',
      evidence: evidenceItems.map((e) => e.id),
      note: 'Unresolved citations remain unresolved; the agent never fabricates CTS identifiers.',
    })],
    evidence: evidenceItems,
    conflicts: [],
  };
}
