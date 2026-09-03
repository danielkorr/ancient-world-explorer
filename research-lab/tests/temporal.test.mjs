import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPeriodOIndex, PeriodOConnector, PERIODO_DATASET_URL, rankPeriodODefinitions } from '../connectors/periodo.mjs';
import { temporalAssertion, TEMPORAL_REVIEW_STATUS, validateTemporalAssertion } from '../core/temporal.mjs';
import { assertPilotReadyForPublicChronology, reviewedTemporalAssertions } from '../core/promotion.mjs';
import { evidence } from '../core/schema.mjs';

test('PeriodO connector uses the canonical structured dataset and stays offline-safe', async () => {
  assert.equal(PERIODO_DATASET_URL, 'https://n2t.net/ark:/99152/p0d.json');
  const connector = new PeriodOConnector({ offline: true });
  await assert.rejects(connector.getDataset(), /network disabled/i);
  await assert.rejects(connector.getDefinition('https://example.com/not-periodo'), /Invalid PeriodO definition URI/);
});

test('temporal assertions preserve original wording and source-specific alternatives', () => {
  const assertion = temporalAssertion({
    subjectId: 'alexander:pella',
    claimId: 'claim-pella-period',
    sourceTemporalExpression: 'early Hellenistic period',
    periodoDefinitionUri: 'https://n2t.net/ark:/99152/p0d123',
    periodoLabel: 'Early Hellenistic',
    authority: 'Example scholarly authority',
    spatialScope: ['Macedonia', 'Macedonia'],
    earliestYear: -323.9,
    latestYear: '-281',
    researcherInterpretation: 'Selected for the Macedonian context; approximate only.',
    alternatives: ['https://n2t.net/ark:/99152/p0d456', 'https://n2t.net/ark:/99152/p0d456'],
  });
  validateTemporalAssertion(assertion);
  assert.equal(assertion.source_temporal_expression, 'early Hellenistic period');
  assert.deepEqual(assertion.normalized_date_range, { earliest: -323, latest: -281 });
  assert.deepEqual(assertion.spatial_scope, ['Macedonia']);
  assert.deepEqual(assertion.alternative_definition_uris, ['https://n2t.net/ark:/99152/p0d456']);
  assert.equal(assertion.review_status, TEMPORAL_REVIEW_STATUS.PENDING);
});

test('PeriodO index keeps authority, spatial scope, and approximate dates together', () => {
  const index = buildPeriodOIndex({
    authorities: {
      p0test: {
        id: 'p0test',
        source: { title: 'Test chronology', yearPublished: 2026 },
        periods: {
          p0testperiod: {
            id: 'p0testperiod',
            label: 'Early Example',
            localizedLabels: { en: ['Early Example'] },
            start: { in: { year: '-0322' } },
            stop: { in: { year: '-0301' } },
            spatialCoverage: [{ id: 'https://www.wikidata.org/entity/Q1', label: 'Exampleland' }],
          },
        },
      },
    },
  });
  assert.equal(index.record_count, 1);
  assert.deepEqual(index.records[0].normalized_date_range, { earliest: -322, latest: -301 });
  assert.equal(index.records[0].authority_source, 'Test chronology');
  assert.equal(index.records[0].spatial_scope[0].label, 'Exampleland');
});

test('evidence records can point to temporal assertions without replacing source wording', () => {
  const record = evidence({
    subjectId: 'alexander:pella',
    sourceType: 'scholarship',
    assertion: 'The site belongs to the early Hellenistic period.',
    temporalAssertions: ['temporal-one', 'temporal-one'],
  });
  assert.deepEqual(record.temporal_assertion_ids, ['temporal-one']);
  assert.equal(record.assertion, 'The site belongs to the early Hellenistic period.');
});

test('PeriodO ranking returns candidates without silently assigning one', () => {
  const index = buildPeriodOIndex({
    authorities: {
      p0test: {
        id: 'p0test',
        source: { title: 'Macedonian chronology' },
        periods: {
          p0testperiod: {
            id: 'p0testperiod',
            label: 'Hellenistic Period',
            start: { in: { year: '-0323' } },
            stop: { in: { year: '-0030' } },
            spatialCoverage: [{ label: 'Macedonia' }],
          },
        },
      },
    },
  });
  const candidates = rankPeriodODefinitions(index, {
    expression: 'Hellenistic period',
    spatialHints: ['Macedonia'],
    dateRange: { earliest: -323, latest: -30 },
  });
  assert.equal(candidates[0].record.uri, 'https://n2t.net/ark:/99152/p0testperiod');
  assert.ok(candidates[0].score >= 90);
  assert.equal(Object.hasOwn(candidates[0], 'selected_definition_uri'), false);
});

test('public chronology promotion requires every pilot assignment to be human-selected', () => {
  const pilot = { assignments: [{ annotation_id: 'a1', subject_id: 'alexander:pella', source_temporal_expression: 'Hellenistic period', candidates: [{ uri: 'https://n2t.net/ark:/99152/p06v8w4bh8d', labels: ['Hellenistic'], authority_source: 'Test authority', spatial_scope: [{ label: 'Macedonia' }], normalized_date_range: { earliest: -350, latest: 30 } }] }] };
  assert.throws(() => assertPilotReadyForPublicChronology(pilot, []), /public chronology blocked/i);
  const assertions = assertPilotReadyForPublicChronology(pilot, [{ target_type: 'temporal_assertion', target_id: 'a1', decision: 'select-definition', selected_definition_uri: 'https://n2t.net/ark:/99152/p06v8w4bh8d', note: 'Human selection' }]);
  assert.equal(assertions[0].review_status, 'human-reviewed');
  assert.equal(reviewedTemporalAssertions(pilot, []).length, 0);
});
