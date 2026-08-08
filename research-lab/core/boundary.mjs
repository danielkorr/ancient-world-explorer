import path from 'node:path';
import { STATE_ROOT } from '../config.mjs';

function inside(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

export function assertResearchWritePath(target, stateRoot = STATE_ROOT) {
  const resolved = path.resolve(target);
  if (!inside(stateRoot, resolved)) {
    throw new Error(`Research boundary violation: write refused outside ${path.resolve(stateRoot)}`);
  }
  return resolved;
}

export function researchPath(...parts) {
  return assertResearchWritePath(path.join(STATE_ROOT, ...parts));
}
