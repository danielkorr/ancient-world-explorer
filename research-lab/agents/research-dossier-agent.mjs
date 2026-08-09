function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function interpretiveStatus({ conflicts, verifiedEvidence, unresolvedEvidence }) {
  if (conflicts.some((item) => item.severity === 'high')) return 'contested';
  if (conflicts.length) return 'qualified';
  if (verifiedEvidence > 0 && verifiedEvidence >= unresolvedEvidence) return 'source-supported';
  return 'evidence-developing';
}

function evidenceSummary(item) {
  return {
    evidence_id: item.id,
    title: item.title,
    citation: item.citation,
    status: item.status,
    source_type: item.source_type,
    source_url: item.source_url,
    assertion: item.assertion,
    excerpt: item.payload?.excerpt || null,
    verification_url: item.payload?.verification_url || null,
    verification_scope: item.payload?.verification_scope || null,
    source_link_kind: item.payload?.source_link_kind || null,
    urn: item.payload?.urn || item.payload?.attempted_urn || null,
  };
}

export function buildResearchDossier({ subject, claims, evidence, conflicts, archaeologyLeads }) {
  const citationResolvedEvidence = evidence.filter((item) =>
    item.status === 'verified' && item.payload?.verification_scope === 'citation-resolution'
  );
  const verifiedEvidence = evidence.filter((item) =>
    item.status === 'verified' && item.payload?.verification_scope !== 'citation-resolution'
  );
  const unresolvedEvidence = evidence.filter((item) => item.status === 'unresolved');
  const primarySources = evidence
    .filter((item) => ['scaife_cts', 'classical_citation'].includes(item.source_type))
    .map(evidenceSummary);
  const modernScholarship = evidence
    .filter((item) => item.source_type === 'pleiades_reference')
    .map(evidenceSummary);
  const geographicEvidence = evidence
    .filter((item) => item.payload && Number.isFinite(item.payload.distance_km))
    .map((item) => ({ ...evidenceSummary(item), distance_km: item.payload.distance_km }));

  const status = interpretiveStatus({
    conflicts,
    verifiedEvidence: verifiedEvidence.length,
    unresolvedEvidence: unresolvedEvidence.length,
  });

  const unresolvedQuestions = [];
  for (const item of conflicts) {
    unresolvedQuestions.push(`Resolve ${item.field.replaceAll('_', ' ')}: ${item.description}`);
  }
  for (const item of primarySources.filter((source) => source.status !== 'verified')) {
    unresolvedQuestions.push(`Verify the primary-source passage for ${item.citation || item.title}.`);
  }
  for (const item of evidence.filter((source) => source.source_type === 'wikidata_identity_candidate')) {
    unresolvedQuestions.push(`Determine whether ${item.title} is the correct authority identity for this stop.`);
  }
  for (const lead of archaeologyLeads.filter((item) => item.classification !== 'established_evidence')) {
    unresolvedQuestions.push(`Assess the chronological and contextual relevance of archaeological lead “${lead.title}”.`);
  }

  const questions = unique(unresolvedQuestions).slice(0, 24);
  const highConfidenceLeads = archaeologyLeads.filter((item) => item.confidence >= 60).length;
  const executiveSynthesis = [
    `${subject.name} currently has ${verifiedEvidence.length} substantively verified evidence item${verifiedEvidence.length === 1 ? '' : 's'}, ${citationResolvedEvidence.length} machine-resolved primary citation${citationResolvedEvidence.length === 1 ? '' : 's'}, ${unresolvedEvidence.length} unresolved item${unresolvedEvidence.length === 1 ? '' : 's'}, and ${conflicts.length} recorded conflict${conflicts.length === 1 ? '' : 's'}.`,
    archaeologyLeads.length
      ? `Archaeological discovery surfaced ${archaeologyLeads.length} public-source lead${archaeologyLeads.length === 1 ? '' : 's'}${highConfidenceLeads ? `, including ${highConfidenceLeads} higher-priority lead${highConfidenceLeads === 1 ? '' : 's'}` : ''}; these remain candidates until independently reviewed.`
      : 'No archaeological discovery lead is presently attached to this dossier.',
    `Interpretive status: ${status.replaceAll('-', ' ')}. This status summarizes the research record; it is not a declaration of historical truth.`,
  ].join(' ');

  return {
    id: `dossier:${subject.core_id}`,
    subject_id: subject.id,
    title: `${subject.name} Research Dossier`,
    interpretive_status: status,
    executive_synthesis: executiveSynthesis,
    what_we_know: claims.map((item) => ({
      claim_id: item.id,
      field: item.field,
      status: item.status,
      value: item.existing_value,
      note: item.note,
      evidence_ids: item.evidence_ids,
    })),
    primary_sources: primarySources,
    archaeological_evidence: archaeologyLeads.map((item) => ({
      lead_id: item.id,
      classification: item.classification,
      title: item.title,
      source_url: item.source_url,
      confidence: item.confidence,
      distance_km: item.distance_km,
      date: item.date,
      relevance: item.relevance,
    })),
    modern_scholarship: modernScholarship,
    geographic_evidence: geographicEvidence,
    competing_interpretations: conflicts.map((item) => ({
      conflict_id: item.id,
      field: item.field,
      severity: item.severity,
      description: item.description,
      evidence_ids: item.evidence_ids,
    })),
    unresolved_questions: questions,
    research_priorities: questions.slice(0, 6),
    confidence_assessment: subject.scores,
    provenance: {
      claim_ids: claims.map((item) => item.id),
      evidence_ids: evidence.map((item) => item.id),
      conflict_ids: conflicts.map((item) => item.id),
      archaeology_lead_ids: archaeologyLeads.map((item) => item.id),
    },
  };
}
