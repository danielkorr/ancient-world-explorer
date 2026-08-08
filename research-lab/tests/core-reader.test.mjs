import assert from 'node:assert/strict';
import test from 'node:test';
import { PILOT_STOP_IDS } from '../config.mjs';
import { readPilotSnapshot } from '../core/core-reader.mjs';

test('pilot snapshot reads exactly the approved six core records', async () => {
  const snapshot = await readPilotSnapshot();
  assert.deepEqual(snapshot.stop_ids, PILOT_STOP_IDS);
  assert.equal(snapshot.stops.length, 6);
  assert.deepEqual(snapshot.stops.map((s) => s.id), PILOT_STOP_IDS);
  assert.match(snapshot.core_sources[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.core_sources[0].path, 'js/alexander.js');
});

test('snapshot exposes only cloned data, never a core write handle', async () => {
  const snapshot = await readPilotSnapshot();
  assert.equal('write' in snapshot, false);
  assert.equal('save' in snapshot, false);
  assert.equal(snapshot.stops.find((s) => s.id === 'gaugamela').certainty, 'disputed');
});
