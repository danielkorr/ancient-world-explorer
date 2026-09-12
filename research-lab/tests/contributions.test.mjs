import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertContributionShape,
  createContribution,
  createContributionDecision,
  createContributionEvidence,
} from '../core/contributions.mjs';

const base = {
  subjectKind: 'alexander_stop',
  subjectId: 'granicus',
  submissionType: 'new-evidence',
  title: 'Field report points to a second crossing approach',
  proposal: 'Consider the eastern approach as a research lead.',
  rationale: 'The observation is useful but does not establish the crossing location.',
  provenance: 'Firsthand observation recorded during a site visit.',
  contributorId: 'user-123',
  createdAt: '2026-09-12T00:00:00.000Z',
};

test('contribution starts proposed and preserves contributor context', () => {
  const contribution = createContribution({ ...base, contributorContext: { expertise: ['field archaeology'] } });
  assert.equal(contribution.status, 'proposed');
  assert.equal(contribution.subject_id, 'granicus');
  assert.deepEqual(contribution.contributor_context, { expertise: ['field archaeology'] });
  assert.doesNotThrow(() => assertContributionShape(contribution));
});

test('contribution requires rationale and provenance', () => {
  assert.throws(() => createContribution({ ...base, rationale: '' }), /rationale is required/);
  assert.throws(() => createContribution({ ...base, provenance: '' }), /provenance is required/);
});

test('evidence requires a reviewable source or observation note', () => {
  assert.throws(() => createContributionEvidence({
    contributionId: 'contribution-1', evidenceType: 'source', title: 'Empty item',
  }), /source_url, citation, or notes is required/);
  const item = createContributionEvidence({
    contributionId: 'contribution-1', evidenceType: 'field-observation', title: 'Visible bank cut',
    notes: 'Recorded from the public footpath.', latitude: 40.35, longitude: 26.45,
  });
  assert.equal(item.provenance_kind, 'unknown');
  assert.equal(item.latitude, 40.35);
});

test('decisions require rationale and remain separate records', () => {
  const decision = createContributionDecision({
    contributionId: 'contribution-1', reviewerId: 'reviewer-1', decision: 'needs-more-research',
    rationale: 'The lead needs a published survey or independent field confirmation.',
  });
  assert.equal(decision.decision, 'needs-more-research');
  assert.ok(decision.id);
  assert.throws(() => createContributionDecision({
    contributionId: 'contribution-1', reviewerId: 'reviewer-1', decision: 'accept', rationale: '',
  }), /rationale is required/);
});
