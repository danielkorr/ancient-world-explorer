import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assertPilotReadyForPartialPublicChronology, assertPilotReadyForPublicChronology } from './core/promotion.mjs';
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
const partial = process.argv.includes('--partial');
const result = partial
  ? assertPilotReadyForPartialPublicChronology(pilot, reviews)
  : { assertions: assertPilotReadyForPublicChronology(pilot, reviews), unresolved_assignments: [] };
const output = {
  schema_version: 1,
  status: partial ? 'partial-reviewed-ready-for-public-design-review' : 'reviewed-ready-for-public-design-review',
  created_at: new Date().toISOString(),
  assertions: result.assertions,
  unresolved_assignments: result.unresolved_assignments,
  note: partial ? 'Only explicitly confirmed assignments are included. Unresolved pilot assignments remain excluded.' : 'Every pilot assignment has a confirmed human selection.',
};
await mkdir(researchPath('periodo'), { recursive: true });
const filename = partial ? 'public-chronology-partial-ready.json' : 'public-chronology-ready.json';
await writeFile(researchPath('periodo', filename), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Public chronology ${partial ? 'partial gate' : 'gate'}: ${result.assertions.length} reviewed assertions ready for design review`);
if (result.unresolved_assignments.length) console.log(`Open assignments: ${result.unresolved_assignments.map((item) => item.subject_id).join(', ')}`);
