import { readAlexanderSnapshot } from './core/core-reader.mjs';
import { ResearchStore } from './core/store.mjs';

const snapshot = await readAlexanderSnapshot();
const store = new ResearchStore();
const target = await store.writeSnapshot(snapshot);
console.log(`Research snapshot written: ${target}`);
console.log(`Core fingerprint: ${snapshot.core_sources[0].sha256}`);
console.log(`Alexander stops: ${snapshot.stops.length}`);
