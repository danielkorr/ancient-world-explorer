import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const LAB_ROOT = here;
export const REPO_ROOT = path.resolve(here, '..');
export const STATE_ROOT = path.join(LAB_ROOT, '.state');

export const PILOT_STOP_IDS = Object.freeze([
  'aegae',
  'granicus',
  'issus',
  'gaza',
  'gaugamela',
  'persian-gate',
]);

export const SOURCE_HOSTS = Object.freeze(new Set([
  'pleiades.stoa.org',
  'www.wikidata.org',
  'commons.wikimedia.org',
  'scaife.perseus.org',
]));

export const USER_AGENT =
  'VIA-AncientWorldExplorer-ResearchLab/0.1 (+https://github.com/danielkorr/ancient-world-explorer)';

export const EXTERNAL_AGENT_ENABLE_VALUE = 'RESEARCH_QUARANTINE_ONLY';
