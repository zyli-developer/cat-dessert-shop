#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_RE = /\b(test|it|describe)\.skip\s*\(/;
const REASON_RE = /SKIP-REASON:/;

const roots = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['server', 'client/tests', 'e2e/specs', 'scripts/tests'];

const violations = [];

function walk(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.spec\.(ts|js|mjs)$|\.e2e-spec\.ts$/.test(name)) checkFile(p);
  }
}

function checkFile(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (SKIP_RE.test(lines[i])) {
      const window = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
      if (!REASON_RE.test(window)) {
        violations.push(`${path}:${i + 1} naked skip (no SKIP-REASON comment within 5 preceding lines)`);
      }
    }
  }
}

for (const r of roots) walk(r);

if (violations.length > 0) {
  console.error('Skip-lint violations:');
  for (const v of violations) console.error('  ' + v);
  console.error(`\n${violations.length} violation(s). Add SKIP-REASON comments or remove the skip.`);
  process.exit(1);
}
console.log('Skip-lint: clean.');
