import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildPlatoExport } from './export/plato.mjs';
import { researchPath } from './core/boundary.mjs';

async function readJsonl(file) {
  try {
    const text = await readFile(file, 'utf8');
    return text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

const pilot = JSON.parse(await readFile(researchPath('periodo', 'pella-aegae-review.json'), 'utf8'));
const reviews = await readJsonl(researchPath('reviews.jsonl'));
const latest = new Map();
for (const review of reviews) {
  if (review.target_type === 'temporal_assertion') latest.set(review.target_id, review);
}

const places = pilot.assignments.flatMap((assignment) => {
  const review = latest.get(assignment.annotation_id);
  if (!review || review.decision !== 'select-definition' || !String(review.note || '').trim()) return [];
  const candidate = assignment.candidates.find((item) => item.uri === review.selected_definition_uri);
  if (!candidate) return [];
  return [{
    pleiades: assignment.pleiades,
    name: assignment.subject_id,
    temporal_assertion: {
      source_temporal_expression: assignment.source_temporal_expression,
      periodo_definition_uri: candidate.uri,
      periodo_label: candidate.labels[0] || assignment.source_temporal_expression,
      authority: candidate.authority_source,
      spatial_scope: candidate.spatial_scope,
      normalized_date_range: candidate.normalized_date_range,
      review_status: 'human-reviewed',
    },
  }];
});

const output = buildPlatoExport({ places, datasetTitle: 'VIA Research Lab · reviewed PeriodO pilot' });
const target = researchPath('exports', 'periodo-pilot.plato.json');
await mkdir(researchPath('exports'), { recursive: true });
await writeFile(target, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`PLATO export: ${places.length} reviewed temporal attestations`);
console.log(`Export artifact: ${target}`);
