import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertResearchWritePath } from '../core/boundary.mjs';
import { ResearchStore } from '../core/store.mjs';

test('research boundary rejects paths outside its state root', () => {
  const root = path.join(os.tmpdir(), 'awe-boundary');
  assert.equal(assertResearchWritePath(path.join(root, 'runs', 'one.json'), root), path.join(root, 'runs', 'one.json'));
  assert.throws(() => assertResearchWritePath(path.join(root, '..', 'js', 'alexander.js'), root), /boundary violation/i);
});

test('store writes reviews only under an injected research root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'awe-research-store-'));
  const store = new ResearchStore(root);
  await store.appendReview({ id: 'review-test', claim_id: 'claim-test', decision: 'more-research', note: 'verify this' });
  const text = await readFile(path.join(root, 'reviews.jsonl'), 'utf8');
  assert.match(text, /"decision":"more-research"/);
});
