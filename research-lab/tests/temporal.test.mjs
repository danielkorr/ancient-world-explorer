import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPeriodOIndex, PeriodOConnector, PERIODO_DATASET_URL } from '../connectors/periodo.mjs';
import { temporalAssertion, TEMPORAL_REVIEW_STATUS, validateTemporalAssertion } from '../core/temporal.mjs';

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
