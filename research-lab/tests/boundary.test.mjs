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
  assert.deepEqual(await store.readReviews(), [{
    id: 'review-test',
    at: (await store.readReviews())[0].at,
    target_type: 'claim',
    target_id: 'claim-test',
    decision: 'more-research',
    note: 'verify this',
    claim_id: 'claim-test',
  }]);
});

test('archaeology reviews are append-only judgments with a separate decision vocabulary', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'awe-archaeology-review-'));
  const store = new ResearchStore(root);
  const record = await store.appendReview({
    id: 'arch-review-test',
    target_type: 'archaeology_lead',
    target_id: 'archaeology-test',
    decision: 'relevant',
    note: 'Check stratigraphic date independently.',
  });
  assert.equal(record.target_type, 'archaeology_lead');
  assert.equal(record.decision, 'relevant');
  assert.equal(record.claim_id, undefined);
  assert.equal((await store.readReviews()).length, 1);
  await assert.rejects(
    store.appendReview({ id: 'bad-review', target_type: 'archaeology_lead', target_id: 'archaeology-test', decision: 'accept' }),
    /invalid review record/i,
  );
});
