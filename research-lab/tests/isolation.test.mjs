import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from '../config.mjs';

const policy = JSON.parse(await readFile(new URL('../policy/core-baseline.json', import.meta.url), 'utf8'));

test('experimental branch has not altered protected core files', async () => {
  for (const [relative, expected] of Object.entries(policy.sha256)) {
    const content = await readFile(path.join(REPO_ROOT, relative));
    const actual = createHash('sha256').update(content).digest('hex');
    assert.equal(actual, expected, `${relative} differs from protected baseline ${policy.baseline_commit}`);
  }
});
