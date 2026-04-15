import { test } from '@playwright/test';

// TC-E2E-PERF-001: FPS median ≥ 45 during scripted gameplay.
// Gated on Cocos web-mobile build — no rendering happens in the fallback
// shell, so FPS measurements would be measuring the shell's idle loop
// (~60 FPS). Tracked as follow-up.

test.describe('perf FPS (gated on Cocos build)', () => {
  test.skip('TC-E2E-PERF-001: median FPS ≥ 45 over 5s gameplay', () => {});
});
