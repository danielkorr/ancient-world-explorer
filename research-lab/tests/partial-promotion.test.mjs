import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPilotReadyForPartialPublicChronology } from '../core/promotion.mjs';

const pilot = {
  assignments: [
    {
      annotation_id: 'pella', subject_id: 'alexander:pella', source_temporal_expression: 'Hellenistic period',
      candidates: [{ uri: 'https://n2t.net/ark:/99152/pella', labels: ['Hellenistic Period'], authority_source: 'Test authority', spatial_scope: [{ label: 'Macedonia' }], normalized_date_range: { earliest: -323, latest: -30 } }],
    },
    {
      annotation_id: 'aegae', subject_id: 'alexander:aegae', source_temporal_expression: 'Early Hellenistic period',
      candidates: [{ uri: 'https://n2t.net/ark:/99152/aegae', labels: ['Hellenistic Period'], authority_source: 'Test authority', spatial_scope: [{ label: 'Macedonia' }], normalized_date_range: { earliest: -323, latest: -30 } }],
    },
  ],
};

test('partial promotion advances confirmed places and keeps open assignments visible', () => {
  const result = assertPilotReadyForPartialPublicChronology(pilot, [{
    target_type: 'temporal_assertion', target_id: 'pella', decision: 'select-definition',
    selected_definition_uri: 'https://n2t.net/ark:/99152/pella', note: 'Macedonia-scoped definition selected for the reviewed pilot place.',
  }]);
  assert.equal(result.assertions.length, 1);
  assert.deepEqual(result.unresolved_assignments, [{ annotation_id: 'aegae', subject_id: 'alexander:aegae', source_temporal_expression: 'Early Hellenistic period' }]);
});

test('partial promotion still blocks when nothing has been confirmed', () => {
  assert.throws(() => assertPilotReadyForPartialPublicChronology(pilot, []), /no pilot assignment has a confirmed human selection/i);
});
