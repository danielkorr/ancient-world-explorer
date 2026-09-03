import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assertPilotReadyForPublicChronology } from './core/promotion.mjs';
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
const assertions = assertPilotReadyForPublicChronology(pilot, reviews);
const output = { schema_version: 1, status: 'reviewed-ready-for-public-design-review', created_at: new Date().toISOString(), assertions };
await mkdir(researchPath('periodo'), { recursive: true });
await writeFile(researchPath('periodo', 'public-chronology-ready.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Public chronology gate: ${assertions.length} reviewed assertions ready for design review`);
