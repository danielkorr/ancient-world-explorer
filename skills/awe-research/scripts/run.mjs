import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const TEST_FILES = readdirSync(path.join(REPO_ROOT, 'research-lab', 'tests'))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => path.join('research-lab', 'tests', name));

const COMMANDS = {
  snapshot: ['research-lab/snapshot-all.mjs'],
  dossier: ['research-lab/run-alexander.mjs'],
  pilot: ['research-lab/run-pilot.mjs'],
  'periodo-pilot': ['research-lab/periodo-pilot.mjs'],
  'export-plato': ['research-lab/export-periodo-plato.mjs'],
  'promote-partial': ['research-lab/promote-periodo.mjs', '--partial'],
  test: ['--test', ...TEST_FILES],
};

const command = process.argv[2];
if (!command || !COMMANDS[command]) {
  console.error(`Unknown Research Lab command: ${command || '(missing)'}`);
  console.error(`Allowed commands: ${Object.keys(COMMANDS).join(', ')}`);
  process.exit(2);
}

const [script, ...args] = COMMANDS[command];
const nodeArgs = [script, ...args];
const child = spawn(process.execPath, nodeArgs, {
  cwd: REPO_ROOT,
  env: process.env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Could not start Research Lab command: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Research Lab command stopped by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
