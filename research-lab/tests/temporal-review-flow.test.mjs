import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPilotReadyForPublicChronology, reviewedTemporalAssertions } from '../core/promotion.mjs';

const pilot = {
  assignments: [{
    annotation_id: 'a1',
    subject_id: 'alexander:pella',
    source_temporal_expression: 'Hellenistic period',
    candidates: [{
      uri: 'https://n2t.net/ark:/99152/p06v8w4bh8d',
      labels: ['Hellenistic Period'],
      authority_source: 'Test authority',
      spatial_scope: [{ label: 'Macedonia' }],
      normalized_date_range: { earliest: -323, latest: -30 },
    }],
  }],
};

test('an exploratory selection without rationale cannot be promoted', () => {
  const exploratory = [{
    target_type: 'temporal_assertion',
    target_id: 'a1',
    decision: 'select-definition',
    selected_definition_uri: 'https://n2t.net/ark:/99152/p06v8w4bh8d',
    note: '',
  }];
  assert.equal(reviewedTemporalAssertions(pilot, exploratory).length, 0);
  assert.throws(() => assertPilotReadyForPublicChronology(pilot, exploratory), /public chronology blocked/i);
});

test('a confirmed selection with rationale remains eligible for promotion', () => {
  const confirmed = [{
    target_type: 'temporal_assertion',
    target_id: 'a1',
    decision: 'select-definition',
    selected_definition_uri: 'https://n2t.net/ark:/99152/p06v8w4bh8d',
    note: 'The Macedonia-scoped definition is the best current fit; the source wording remains Hellenistic period.',
  }];
  assert.equal(assertPilotReadyForPublicChronology(pilot, confirmed).length, 1);
});
