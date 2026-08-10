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

  async readReviews() {
    try {
      const text = await readFile(this.path('reviews.jsonl'), 'utf8');
      return text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
  }

  async appendReview(review) {
    await this.init();
    const targetType = review.target_type || 'claim';
    const targetId = review.target_id || review.claim_id;
    const allowed = targetType === 'claim'
      ? ['accept', 'reject', 'more-research']
      : targetType === 'archaeology_lead'
        ? ['relevant', 'not-relevant', 'directly-relevant', 'contextually-relevant', 'name-only-match', 'geographically-unrelated', 'chronologically-incompatible', 'insufficient-information', 'more-research']
        : targetType === 'evidence'
          ? ['direct-support', 'contextual-support', 'partial-support', 'directly-relevant', 'useful-background', 'bibliographic-lead', 'outdated-superseded', 'correct-identity', 'possible-identity', 'incorrect-identity', 'relevant', 'not-relevant', 'unable-to-access', 'more-research']
          : [];
    const record = {
      id: review.id,
      at: review.at || new Date().toISOString(),
      target_type: targetType,
      target_id: targetId,
      decision: review.decision,
      note: String(review.note || '').slice(0, 2000),
    };
    if (targetType === 'claim') record.claim_id = targetId;
    if (!record.id || !record.target_id || !allowed.includes(record.decision)) {
      throw new Error('Invalid review record');
    }
    await appendFile(this.path('reviews.jsonl'), JSON.stringify(record) + '\n', 'utf8');
    return record;
  }
}
