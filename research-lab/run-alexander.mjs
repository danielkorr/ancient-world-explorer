import { runResearch } from './agents/orchestrator.mjs';
import { readAlexanderSnapshot } from './core/core-reader.mjs';
import { ResearchStore } from './core/store.mjs';

const offline = process.env.AWE_RESEARCH_OFFLINE === '1';
const snapshot = await readAlexanderSnapshot();
const store = new ResearchStore();
await store.writeSnapshot(snapshot);

console.log(`Alexander research system: ${snapshot.stops.length} stops`);
console.log(`Network: ${offline ? 'offline (verification will remain unresolved)' : 'allowlisted scholarly and archaeological sources'}`);
const report = await runResearch(snapshot, { offline, scope: 'all-38-alexander-stops' });
const runPath = await store.writeRun(report);

console.log(`Run: ${report.run_id}`);
console.log(`Verification: ${report.verification.passed ? 'PASS' : `FAIL (${report.verification.issue_count})`}`);
console.log(`Archaeology leads: ${report.archaeology_leads.length} (candidate evidence: ${report.archaeology_leads.filter((item) => item.classification === 'candidate_evidence').length})`);
for (const subject of report.subjects) {
  const scores = subject.scores;
  console.log(`  ${subject.name}: confidence ${scores.scholarly_confidence}, completeness ${scores.research_completeness}, source ${scores.source_quality}, archaeology ${subject.archaeology_lead_count}${scores.disputed ? ' [DISPUTED]' : ''}`);
}
console.log(`Immutable run record: ${runPath}`);
