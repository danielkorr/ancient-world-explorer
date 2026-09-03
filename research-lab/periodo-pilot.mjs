import { readFile, writeFile } from 'node:fs/promises';
import { rankPeriodODefinitions } from './connectors/periodo.mjs';
import { researchPath } from './core/boundary.mjs';

const index = JSON.parse(await readFile(researchPath('periodo', 'index.json'), 'utf8'));
const fixture = JSON.parse(await readFile(new URL('./pilots/periodo-pella-aegae.json', import.meta.url), 'utf8'));
const review = {
  schema_version: 1,
  pilot: fixture.pilot,
  created_at: new Date().toISOString(),
  source_index: { source: index.source, indexed_at: index.indexed_at, record_count: index.record_count },
  assignments: fixture.annotations.map(annotation => ({
    annotation_id: annotation.annotation_id,
    subject_id: annotation.subject_id,
    pleiades: annotation.pleiades,
    source_temporal_expression: annotation.source_temporal_expression,
    approximate_date_range: annotation.approximate_date_range,
    source_note: annotation.source_note,
    status: 'unassigned',
    selected_definition_uri: null,
    candidates: rankPeriodODefinitions(index, {
      expression: annotation.source_temporal_expression,
      spatialHints: annotation.place_labels,
      dateRange: annotation.approximate_date_range,
      limit: 8,
    }).map(({ record, score, rationale }) => ({
      uri: record.uri,
      labels: record.labels,
      authority_id: record.authority_id,
      authority_source: record.authority_source,
      spatial_scope: record.spatial_scope,
      normalized_date_range: record.normalized_date_range,
      score,
      rationale,
    })),
  })),
};
await writeFile(researchPath('periodo', 'pella-aegae-review.json'), JSON.stringify(review, null, 2) + '\n', 'utf8');
console.log(`PeriodO pilot: ${review.assignments.length} unassigned expressions`);
for (const assignment of review.assignments) console.log(`  ${assignment.subject_id}: ${assignment.candidates.length} candidates`);
console.log(`Review artifact: ${researchPath('periodo', 'pella-aegae-review.json')}`);
