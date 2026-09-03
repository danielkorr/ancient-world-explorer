import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { PeriodOConnector, buildPeriodOIndex } from './connectors/periodo.mjs';
import { researchPath } from './core/boundary.mjs';

const offline = process.env.AWE_RESEARCH_OFFLINE === '1';
const result = await new PeriodOConnector({ offline }).getDataset();
const index = buildPeriodOIndex(result.data);
const dir = researchPath('periodo');
await mkdir(dir, { recursive: true });
const datasetText = JSON.stringify(result.data, null, 2) + '\n';
const manifest = {
  schema_version: 1,
  source_url: result.finalUrl,
  requested_url: 'https://n2t.net/ark:/99152/p0d.json',
  retrieved_at: new Date().toISOString(),
  sha256: createHash('sha256').update(datasetText).digest('hex'),
  record_count: index.record_count,
  security: result.security,
};
await writeFile(researchPath('periodo', 'dataset.json'), datasetText, 'utf8');
await writeFile(researchPath('periodo', 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
await writeFile(researchPath('periodo', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`PeriodO cache: ${index.record_count} definitions`);
console.log(`Source: ${result.finalUrl}`);
console.log(`Dataset: ${researchPath('periodo', 'dataset.json')}`);
