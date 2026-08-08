import { readPilotSnapshot } from './core/core-reader.mjs';
import { ResearchStore } from './core/store.mjs';
import { runResearchPilot } from './agents/orchestrator.mjs';

const offline = process.env.AWE_RESEARCH_OFFLINE === '1';
const snapshot = await readPilotSnapshot();
const store = new ResearchStore();
await store.writeSnapshot(snapshot);

console.log(`Research pilot: ${snapshot.stop_ids.join(', ')}`);
console.log(`Network: ${offline ? 'offline (verification will remain unresolved)' : 'allowlisted scholarly sources'}`);
const report = await runResearchPilot(snapshot, { offline });
const runPath = await store.writeRun(report);

console.log(`Run: ${report.run_id}`);
console.log(`Verification: ${report.verification.passed ? 'PASS' : `FAIL (${report.verification.issue_count})`}`);
for (const subject of report.subjects) {
  const s = subject.scores;
  console.log(`  ${subject.name}: confidence ${s.scholarly_confidence}, completeness ${s.research_completeness}, source ${s.source_quality}${s.disputed ? ' [DISPUTED]' : ''}`);
}
console.log(`Immutable run record: ${runPath}`);
