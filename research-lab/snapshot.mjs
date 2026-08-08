import { readPilotSnapshot } from './core/core-reader.mjs';
import { ResearchStore } from './core/store.mjs';

const snapshot = await readPilotSnapshot();
const store = new ResearchStore();
const target = await store.writeSnapshot(snapshot);
console.log(`Research snapshot written: ${target}`);
console.log(`Core fingerprint: ${snapshot.core_sources[0].sha256}`);
console.log(`Pilot stops: ${snapshot.stop_ids.join(', ')}`);
