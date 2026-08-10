import assert from 'node:assert/strict';
import test from 'node:test';
import { runArchaeologicalDiscoveryAgent } from '../agents/archaeological-discovery-agent.mjs';
import { runPlaceAgent } from '../agents/place-agent.mjs';
import { runVerificationAgent } from '../agents/verification-agent.mjs';
import { scaifeReaderUrl, scaifeVerificationUrl } from '../connectors/scaife.mjs';
import { readAlexanderSnapshot } from '../core/core-reader.mjs';
import { resolveClassicalCitation } from '../core/classical-citation.mjs';
import { subjectFromStop } from '../core/schema.mjs';

test('all current Alexander citations resolve to a verified edition target without guessing a work', async () => {
  const snapshot = await readAlexanderSnapshot();
  const citations = snapshot.stops.flatMap((stop) => stop.ancient_sources || []);
  assert.ok(citations.length >= 38);
  for (const citation of citations) {
    const resolved = resolveClassicalCitation(citation);
    assert.ok(resolved, `missing resolver for ${citation}`);
    assert.match(resolved.cts_urn, /^urn:cts:/);
    assert.equal(scaifeReaderUrl(resolved.cts_urn), `https://scaife.perseus.org/reader/${resolved.cts_urn}`);
  }
  assert.equal(resolveClassicalCitation('Arrian 1.7-9').canonical_passage, '1.7-1.9');
  assert.equal(resolveClassicalCitation('Diodorus 17.70-72').canonical_passage, '17.70-17.72');
  assert.equal(resolveClassicalCitation('Plutarch, Alexander 75-77').canonical_passage, '75-77');
});

test('missing Pleiades identity surfaces Wikidata candidates but never auto-accepts one', async () => {
  const stop = { id: 'test', name: 'Example Ancient Place', lat: 40, lng: 20, certainty: 'secure' };
  const subject = subjectFromStop(stop);
  const wikidata = {
    async searchEntities() {
      return [{ id: 'Q123', label: 'Example Ancient Place', description: 'ancient settlement', source_url: 'https://www.wikidata.org/wiki/Q123', security: { prompt_injection_suspected: false } }];
    },
    async getEntity() {
      return { id: 'Q123', label: 'Example Ancient Place', pleiades: '999', coordinate: { lat: 40.01, lng: 20.01 }, source_url: 'https://www.wikidata.org/wiki/Q123', security: { prompt_injection_suspected: false } };
    },
  };
  const result = await runPlaceAgent({ stop, subject, pleiades: null, wikidata });
  const candidate = result.evidence.find((item) => item.source_type === 'wikidata_identity_candidate');
  assert.ok(candidate);
  assert.equal(candidate.status, 'unresolved');
  assert.equal(candidate.payload.auto_accept, false);
  assert.equal(result.claims[0].existing_value, null);
  assert.equal(result.claims[0].proposed_value, null);
  assert.ok(result.conflicts.length > 0);
});

test('archaeological discovery labels a close public Open Context match as candidate evidence, not established evidence', async () => {
  const stop = { id: 'pella', name: 'Pella', lat: 40.761, lng: 22.519 };
  const subject = subjectFromStop(stop);
  const openContext = {
    searchUrl: () => 'https://opencontext.org/query/.json?q=Pella',
    async search() {
      return {
        query: 'Pella',
        source_url: 'https://opencontext.org/query/.json?q=Pella',
        security: { prompt_injection_suspected: false },
        records: [{
          source_url: 'https://opencontext.org/subjects/example',
          citation_url: null,
          label: 'Pella excavation context',
          category: 'Context',
          project: 'Pella fieldwork',
          context: 'Pella',
          published: '2025-01-01',
          updated: null,
          coordinate: { lat: 40.762, lng: 22.52 },
          security: { prompt_injection_suspected: false },
        }],
      };
    },
  };
  const result = await runArchaeologicalDiscoveryAgent({ stop, subject, openContext });
  assert.equal(result.leads.length, 1);
  assert.equal(result.leads[0].classification, 'candidate_evidence');
  assert.notEqual(result.leads[0].classification, 'established_evidence');
  assert.equal(result.leads[0].sensitivity, 'public-open-data-only');
  assert.equal(result.leads[0].source_url, 'https://opencontext.org/subjects/example');
  assert.equal(result.evidence[0].status, 'unresolved');
  assert.match(result.leads[0].rationale, /not evidence of association/i);
});

test('verification rejects established archaeology that lacks verified supporting evidence', () => {
  const subject = { id: 'alexander:test' };
  const ev = { id: 'ev-1', subject_id: subject.id, status: 'unresolved', source_url: 'https://opencontext.org/subjects/example' };
  const lead = {
    id: 'lead-1',
    subject_id: subject.id,
    classification: 'established_evidence',
    source_url: 'https://opencontext.org/subjects/example',
    confidence: 90,
    evidence_ids: [ev.id],
  };
  const result = runVerificationAgent({ subjects: [subject], claims: [], evidence: [ev], conflicts: [], archaeologyLeads: [lead] });
  assert.equal(result.passed, false);
  assert.ok(result.events.some((event) => event.type === 'unsupported-established-archaeology'));
});

test('verification rejects a machine or catalog route presented as a human Scaife source', () => {
  const subject = { id: 'alexander:pella' };
  const urn = 'urn:cts:greekLit:tlg0007.tlg047.perseus-eng2:3';
  const badEvidence = {
    id: 'ev-scaife-bad-link',
    subject_id: subject.id,
    source_type: 'scaife_cts',
    source_url: scaifeVerificationUrl(urn),
    status: 'verified',
    payload: { verification_scope: 'citation-resolution', verification_url: scaifeVerificationUrl(urn) },
  };
  const rejected = runVerificationAgent({ subjects: [subject], claims: [], evidence: [badEvidence], conflicts: [] });
  assert.equal(rejected.passed, false);
  assert.ok(rejected.events.some((event) => event.type === 'invalid-scaife-reader-link'));

  const validEvidence = { ...badEvidence, source_url: scaifeReaderUrl(urn) };
  const accepted = runVerificationAgent({ subjects: [subject], claims: [], evidence: [validEvidence], conflicts: [] });
  assert.equal(accepted.passed, true);
});

test('verification rejects Open Context JSON-LD as a human archaeology link', () => {
  const subject = { id: 'alexander:pella' };
  const lead = {
    id: 'lead-open-context-machine-link',
    subject_id: subject.id,
    source_type: 'open_context',
    source_url: 'https://opencontext.org/subjects/example.json',
    data_url: 'https://opencontext.org/subjects/example.json',
    classification: 'research_lead',
    confidence: 40,
    evidence_ids: [],
  };
  const result = runVerificationAgent({ subjects: [subject], claims: [], evidence: [], conflicts: [], archaeologyLeads: [lead] });
  assert.equal(result.passed, false);
  assert.ok(result.events.some((event) => event.type === 'invalid-open-context-reader-link'));
});
