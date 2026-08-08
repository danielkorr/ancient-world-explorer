import assert from 'node:assert/strict';
import test from 'node:test';
import { runResearch, runResearchPilot } from '../agents/orchestrator.mjs';
import { readAlexanderSnapshot, readPilotSnapshot } from '../core/core-reader.mjs';

test('offline pilot completes all six subjects without inventing verification', async () => {
  const snapshot = await readPilotSnapshot();
  const report = await runResearchPilot(snapshot, { offline: true });
  assert.equal(report.subjects.length, 6);
  assert.equal(report.safety.core_write_path, false);
  assert.equal(report.safety.external_agents_enabled, false);
  assert.equal(report.safety.promotion_to_core, 'not-implemented');
  assert.equal(report.verification.passed, true);
  assert.equal(report.dossiers.length, 6);
  assert.equal(new Set(report.dossiers.map((item) => item.subject_id)).size, 6);

  const gazaPleiades = report.evidence.find((e) => e.subject_id === 'alexander:gaza' && e.source_type === 'pleiades');
  assert.equal(gazaPleiades.status, 'unresolved');
  assert.match(gazaPleiades.assertion, /network disabled/i);

  const unsupportedProposals = report.claims.filter((c) => c.status === 'proposed' && c.evidence_ids.length === 0);
  assert.deepEqual(unsupportedProposals, []);
});

test('skeptic agent preserves Gaugamela as disputed', async () => {
  const report = await runResearchPilot(await readPilotSnapshot(), { offline: true });
  const subject = report.subjects.find((s) => s.id === 'alexander:gaugamela');
  assert.equal(subject.scores.disputed, true);
  assert.ok(subject.conflict_count > 0);
  const dossier = report.dossiers.find((item) => item.subject_id === subject.id);
  assert.equal(dossier.interpretive_status, 'contested');
  assert.ok(dossier.competing_interpretations.length > 0);
  assert.ok(dossier.unresolved_questions.length > 0);
});

test('offline all-38 run covers every Alexander stop without promoting discovery output', async () => {
  const report = await runResearch(await readAlexanderSnapshot(), { offline: true, scope: 'all-38-alexander-stops' });
  assert.equal(report.schema_version, 3);
  assert.equal(report.scope, 'all-38-alexander-stops');
  assert.equal(report.subjects.length, 38);
  assert.equal(new Set(report.subjects.map((subject) => subject.core_id)).size, 38);
  assert.equal(report.safety.core_write_path, false);
  assert.equal(report.safety.promotion_to_core, 'not-implemented');
  assert.equal(report.verification.passed, true);
  assert.deepEqual(report.archaeology_leads, []);
  assert.equal(report.dossiers.length, 38);
  assert.equal(new Set(report.dossiers.map((dossier) => dossier.subject_id)).size, 38);
  assert.ok(report.dossiers.every((dossier) => dossier.provenance && dossier.confidence_assessment));

  const classical = report.evidence.filter((item) => item.source_type === 'scaife_cts');
  assert.ok(classical.length >= 38);
  assert.ok(classical.every((item) => item.status === 'unresolved' && item.payload?.attempted_urn?.startsWith('urn:cts:')));
});
