import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewSyntheses } from '../core/review-synthesis.mjs';

function fixture() {
  return {
    subjects: [{ id: 'place:pella', name: 'Pella' }],
    claims: [
      { id: 'claim:one', subject_id: 'place:pella', field: 'ancient_sources', existing_value: [], proposed_value: ['Plutarch'] },
      { id: 'claim:two', subject_id: 'place:pella', field: 'description', existing_value: 'Old', proposed_value: 'New' },
    ],
    evidence: [
      { id: 'evidence:one', subject_id: 'place:pella', source_type: 'scaife_cts', citation: 'Plutarch, Alexander 3' },
      { id: 'evidence:two', subject_id: 'place:pella', source_type: 'pleiades_reference', title: 'A modern article' },
      { id: 'evidence:three', subject_id: 'place:pella', source_type: 'wikidata', title: 'Pella authority record' },
    ],
    archaeology_leads: [
      { id: 'lead:one', subject_id: 'place:pella', title: 'Pella survey record' },
    ],
  };
}

test('review synthesis uses the latest decision and reports coverage by record family', () => {
  const report = fixture();
  const reviews = [
    { target_type: 'evidence', target_id: 'evidence:one', decision: 'more-research', note: 'Initial uncertainty', at: '2026-08-01T00:00:00Z' },
    { target_type: 'evidence', target_id: 'evidence:one', decision: 'direct-support', note: 'Passage checked', at: '2026-08-02T00:00:00Z' },
    { target_type: 'evidence', target_id: 'evidence:two', decision: 'outdated-superseded', note: 'Use newer edition', at: '2026-08-03T00:00:00Z' },
    { target_type: 'archaeology_lead', target_id: 'lead:one', decision: 'chronologically-incompatible', note: 'Roman phase only', at: '2026-08-04T00:00:00Z' },
    { target_type: 'claim', target_id: 'claim:one', decision: 'accept', note: 'Supported by passage', at: '2026-08-05T00:00:00Z' },
  ];

  const synthesis = buildReviewSyntheses(report, reviews)[0];
  assert.deepEqual(synthesis.coverage.overall, { total: 6, reviewed: 4, unreviewed: 2, completion_percent: 67 });
  assert.deepEqual(synthesis.coverage.claims, { total: 2, reviewed: 1, unreviewed: 1, completion_percent: 50 });
  assert.deepEqual(synthesis.coverage.sources, { total: 3, reviewed: 2, unreviewed: 1, completion_percent: 67 });
  assert.deepEqual(synthesis.coverage.archaeology, { total: 1, reviewed: 1, unreviewed: 0, completion_percent: 100 });
  assert.deepEqual(synthesis.assessments.direct.map((item) => item.target_id), ['claim:one', 'evidence:one']);
  assert.deepEqual(synthesis.assessments.excluded.map((item) => item.target_id), ['evidence:two', 'lead:one']);
  assert.equal(synthesis.assessments.pending.length, 0);
  assert.deepEqual(synthesis.assessments.unreviewed.map((item) => item.target_id), ['claim:two', 'evidence:three']);
  assert.equal(synthesis.reviewer_notes.some((item) => item.note === 'Initial uncertainty'), false);
  assert.equal(synthesis.reviewer_notes.length, 4);
  assert.deepEqual(synthesis.outstanding_work.map((item) => item.reason), ['unreviewed', 'unreviewed']);
  assert.deepEqual(synthesis.safety, {
    machine_confidence_unchanged: true,
    core_write_path: false,
    promotion_to_core: 'not-implemented',
  });
});

test('review synthesis keeps pending work visible and does not mutate its inputs', () => {
  const report = fixture();
  const reviews = [{ target_type: 'evidence', target_id: 'evidence:one', decision: 'unable-to-access', note: 'Paywall' }];
  const originalReport = structuredClone(report);
  const originalReviews = structuredClone(reviews);

  const synthesis = buildReviewSyntheses(report, reviews)[0];

  assert.equal(synthesis.assessments.pending[0].assessment, 'pending');
  assert.equal(synthesis.outstanding_work[0].reason, 'pending-review-resolution');
  assert.equal(synthesis.coverage.sources.reviewed, 1);
  assert.deepEqual(report, originalReport);
  assert.deepEqual(reviews, originalReviews);
});

test('an empty record family is complete without inventing review work', () => {
  const report = { subjects: [{ id: 'empty', name: 'Empty' }], claims: [], evidence: [], archaeology_leads: [] };
  const synthesis = buildReviewSyntheses(report)[0];
  assert.deepEqual(synthesis.coverage.overall, { total: 0, reviewed: 0, unreviewed: 0, completion_percent: 100 });
  assert.deepEqual(synthesis.outstanding_work, []);
});
