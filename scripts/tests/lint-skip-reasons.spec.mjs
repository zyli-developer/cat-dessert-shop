import { describe, it, expect } from '@jest/globals';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function runLint(content) {
  const dir = mkdtempSync(join(tmpdir(), 'lint-skip-'));
  writeFileSync(join(dir, 'fake.spec.ts'), content);
  try {
    execSync(`node ${process.cwd()}/../lint-skip-reasons.mjs ${dir}`, { stdio: 'pipe' });
    return { exit: 0 };
  } catch (e) {
    return { exit: e.status, stderr: String(e.stderr) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('lint-skip-reasons', () => {
  it('passes when no skips present', () => {
    const r = runLint(`test('x', () => {});`);
    expect(r.exit).toBe(0);
  });

  it('passes when skip has SKIP-REASON comment above', () => {
    const r = runLint(`
// SKIP-REASON: FU-T2-01 pending
test.skip('y', () => {});
`);
    expect(r.exit).toBe(0);
  });

  // SKIP-REASON: fixture literal — the `test.skip(...)` text below is input
  // to the lint rule under test, not an actual skipped case in this suite.
  it('fails on naked test.skip', () => {
    const r = runLint(`test.skip('z', () => {});`);
    expect(r.exit).toBe(1);
    expect(r.stderr).toMatch(/naked skip/i);
  });

  // SKIP-REASON: fixture literal — same rationale as above.
  it('fails on describe.skip without reason', () => {
    const r = runLint(`describe.skip('w', () => {});`);
    expect(r.exit).toBe(1);
  });
});
