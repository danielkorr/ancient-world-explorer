import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { STATE_ROOT } from '../config.mjs';
import { assertResearchWritePath } from './boundary.mjs';
import { assertReportShape } from './schema.mjs';

export class ResearchStore {
  constructor(root = STATE_ROOT) {
    this.root = path.resolve(root);
  }

  path(...parts) {
    return assertResearchWritePath(path.join(this.root, ...parts), this.root);
  }

  async init() {
    await mkdir(this.path('runs'), { recursive: true });
  }

  async writeSnapshot(snapshot) {
    await this.init();
    const target = this.path('snapshot.json');
    await writeFile(target, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    return target;
  }

  async writeRun(report) {
    assertReportShape(report);
    await this.init();
    const runPath = this.path('runs', `${report.run_id}.json`);
    await writeFile(runPath, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    await writeFile(this.path('latest.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    return runPath;
  }

  async readLatest() {
    return JSON.parse(await readFile(this.path('latest.json'), 'utf8'));
  }

  async appendReview(review) {
    await this.init();
    const record = {
      id: review.id,
      at: review.at || new Date().toISOString(),
      claim_id: review.claim_id,
      decision: review.decision,
      note: String(review.note || '').slice(0, 2000),
    };
    if (!record.id || !record.claim_id || !['accept', 'reject', 'more-research'].includes(record.decision)) {
      throw new Error('Invalid review record');
    }
    await appendFile(this.path('reviews.jsonl'), JSON.stringify(record) + '\n', 'utf8');
    return record;
  }
}
