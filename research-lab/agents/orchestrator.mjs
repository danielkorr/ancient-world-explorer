import { randomUUID } from 'node:crypto';
import { CommonsConnector } from '../connectors/commons.mjs';
import { PleiadesConnector } from '../connectors/pleiades.mjs';
import { ScaifeConnector } from '../connectors/scaife.mjs';
import { WikidataConnector } from '../connectors/wikidata.mjs';
import { scoreSubject } from '../core/confidence.mjs';
import { auditEvent, subjectFromStop } from '../core/schema.mjs';
import { runClassicalSourcesAgent } from './classical-sources-agent.mjs';
import { runGeospatialAgent } from './geospatial-agent.mjs';
import { runMediaAgent } from './media-agent.mjs';
import { runPlaceAgent } from './place-agent.mjs';
import { runScholarlyEvidenceAgent } from './scholarly-evidence-agent.mjs';
import { runSkepticAgent } from './skeptic-agent.mjs';
import { runVerificationAgent } from './verification-agent.mjs';

function uniqueById(items) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export async function runResearchPilot(snapshot, { offline = false, ctsMap = {} } = {}) {
  const pleiades = new PleiadesConnector({ offline });
  const wikidata = new WikidataConnector({ offline });
  const commons = new CommonsConnector({ offline });
  const scaife = new ScaifeConnector({ offline });
  const subjects = [];
  const claims = [];
  const evidence = [];
  const conflicts = [];
  const audit = [auditEvent('pilot-started', { stop_ids: snapshot.stop_ids, offline })];

  for (const stop of snapshot.stops) {
    const subject = subjectFromStop(stop);
    subjects.push(subject);

    const place = await runPlaceAgent({ stop, subject, pleiades, wikidata });
    const geo = runGeospatialAgent({ stop, subject, ...place.context });
    const classical = await runClassicalSourcesAgent({ stop, subject, scaife, ctsMap });
    const scholarship = runScholarlyEvidenceAgent({ subject, pleiadesPlace: place.context.pleiadesPlace });
    const media = await runMediaAgent({ stop, subject, commons, wikidataEntity: place.context.wikidataEntity });
    const skeptic = runSkepticAgent({ stop, subject });

    for (const result of [place, geo, classical, scholarship, media, skeptic]) {
      claims.push(...result.claims);
      evidence.push(...result.evidence);
      conflicts.push(...result.conflicts);
    }
    audit.push(auditEvent('subject-researched', { subject_id: subject.id }));
  }

  const cleanClaims = uniqueById(claims);
  const cleanEvidence = uniqueById(evidence);
  const cleanConflicts = uniqueById(conflicts);
  for (const subject of subjects) {
    const subjectClaims = cleanClaims.filter((item) => item.subject_id === subject.id);
    const subjectEvidence = cleanEvidence.filter((item) => item.subject_id === subject.id);
    const subjectConflicts = cleanConflicts.filter((item) => item.subject_id === subject.id);
    subject.scores = scoreSubject({ claims: subjectClaims, evidence: subjectEvidence, conflicts: subjectConflicts });
    subject.claim_count = subjectClaims.length;
    subject.evidence_count = subjectEvidence.length;
    subject.conflict_count = subjectConflicts.length;
  }

  const verification = runVerificationAgent({ subjects, claims: cleanClaims, evidence: cleanEvidence, conflicts: cleanConflicts });
  audit.push(...verification.events, auditEvent('pilot-finished', { verification_passed: verification.passed }));

  return {
    schema_version: 1,
    run_id: `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
    created_at: new Date().toISOString(),
    branch_policy: 'experiment/ai-research-system',
    core_snapshot: snapshot.core_sources,
    safety: {
      core_write_path: false,
      external_agents_enabled: false,
      network_mode: offline ? 'offline' : 'allowlisted-sources-only',
      promotion_to_core: 'not-implemented',
    },
    verification,
    subjects,
    claims: cleanClaims,
    evidence: cleanEvidence,
    conflicts: cleanConflicts,
    audit,
  };
}
