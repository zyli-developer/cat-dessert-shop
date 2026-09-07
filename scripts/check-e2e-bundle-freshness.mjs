#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CLIENT = join(ROOT, 'client');
const OUTDIR = join(ROOT, 'e2e/dist/web-mobile');

function hashAssets() {
  const h = createHash('sha256');
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        h.update(relative(CLIENT, p).replaceAll('\\', '/'));
        h.update(readFileSync(p));
      }
    }
  };
  walk(join(CLIENT, 'assets'));
  walk(join(CLIENT, 'settings'));
  return h.digest('hex');
}

const current = hashAssets();
const hashFile = join(OUTDIR, '__asset-hash');
if (!existsSync(hashFile)) {
  console.error('E2E bundle missing. Run: npm run build:e2e-bundle');
  process.exit(2);
}
const committed = readFileSync(hashFile, 'utf8').trim();
if (current !== committed) {
  console.error(`E2E bundle stale:
  committed: ${committed}
  current:   ${current}
Run: npm run build:e2e-bundle && git add e2e/dist/web-mobile && commit.`);
  process.exit(1);
}
console.log('E2E bundle is fresh.');
