import { appendFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { EXTERNAL_AGENT_ENABLE_VALUE, STATE_ROOT } from '../config.mjs';
import { assertResearchWritePath } from '../core/boundary.mjs';
import { assessUntrustedText } from '../security/untrusted.mjs';

const ALLOWED_AGENT_HOSTS = new Set(['moltbook.com', 'www.moltbook.com']);

export function externalAgentGatewayEnabled(env = process.env) {
  return env.AWE_ENABLE_EXTERNAL_AGENTS === EXTERNAL_AGENT_ENABLE_VALUE;
}

export async function quarantineExternalAgentPayload({ sourceUrl, agentId = null, content }, { env = process.env, stateRoot = STATE_ROOT } = {}) {
  if (!externalAgentGatewayEnabled(env)) {
    throw new Error('External-agent gateway disabled. Phase 8 requires explicit post-verification enablement.');
  }
  const source = new URL(sourceUrl);
  if (source.protocol !== 'https:' || !ALLOWED_AGENT_HOSTS.has(source.hostname)) {
    throw new Error('External-agent source is not allowlisted');
  }
  const assessed = assessUntrustedText(content);
  const record = {
    id: randomUUID(),
    at: new Date().toISOString(),
    source_url: source.toString(),
    agent_id: agentId ? String(agentId).slice(0, 200) : null,
    content: assessed.text,
    security: assessed,
    trust: 'quarantined-external-agent-data',
    eligible_for_core_write: false,
  };
  const dir = assertResearchWritePath(path.join(stateRoot, 'quarantine'), stateRoot);
  await mkdir(dir, { recursive: true });
  const target = assertResearchWritePath(path.join(dir, 'external-agent.jsonl'), stateRoot);
  await appendFile(target, JSON.stringify(record) + '\n', 'utf8');
  return record;
}
