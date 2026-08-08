import { claim, evidence, CLAIM_STATUS, EVIDENCE_STATUS } from '../core/schema.mjs';
import { resolveClassicalCitation } from '../core/classical-citation.mjs';

export async function runClassicalSourcesAgent({ stop, subject, scaife, ctsMap = {} }) {
  const evidenceItems = [];
  for (const citation of stop.ancient_sources || []) {
    const parsed = resolveClassicalCitation(citation);
    const mappedUrn = ctsMap[citation] || parsed?.cts_urn || null;
    if (!mappedUrn) {
      evidenceItems.push(evidence({
        subjectId: subject.id,
        sourceType: 'classical_citation',
        citation,
        title: citation,
        assertion: 'Citation present in VIA core data; no verified edition mapping is available for machine passage resolution.',
        status: EVIDENCE_STATUS.UNRESOLVED,
        payload: parsed,
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
        payload: { urn: mappedUrn, citation_resolution: parsed, mapping_source: ctsMap[citation] ? 'explicit-map' : 'verified-edition-registry' },
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
        payload: { attempted_urn: mappedUrn, citation_resolution: parsed },
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
      note: 'Known works are mapped only through verified edition URNs; a failed passage lookup remains unresolved and no CTS identifier is fabricated.',
    })],
    evidence: evidenceItems,
    conflicts: [],
  };
}
