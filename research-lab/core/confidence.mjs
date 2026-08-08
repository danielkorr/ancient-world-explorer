function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

export function scoreSubject({ claims, evidence, conflicts }) {
  const verifiedEvidence = evidence.filter((e) => e.status === 'verified').length;
  const unresolvedEvidence = evidence.filter((e) => e.status === 'unresolved').length;
  const sourceKinds = new Set(evidence.filter((e) => e.status === 'verified').map((e) => e.source_type)).size;
  const disputedClaims = claims.filter((c) => c.status === 'disputed').length;
  const proposedClaims = claims.filter((c) => c.status === 'proposed').length;

  const sourceQuality = clamp(45 + verifiedEvidence * 8 + sourceKinds * 7 - unresolvedEvidence * 4);
  const researchCompleteness = clamp(30 + Math.min(evidence.length, 8) * 8 + Math.min(claims.length, 8) * 3);
  const scholarlyConfidence = clamp(
    55 + verifiedEvidence * 6 + sourceKinds * 5 - conflicts.length * 12 - disputedClaims * 8 - proposedClaims * 2,
  );

  return {
    scholarly_confidence: scholarlyConfidence,
    research_completeness: researchCompleteness,
    source_quality: sourceQuality,
    disputed: conflicts.length > 0 || disputedClaims > 0,
  };
}
