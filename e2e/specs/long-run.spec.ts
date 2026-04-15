import { test } from '@playwright/test';

// TC-E2E-LONG-001: heap stability across 5 rounds.
// Gated on Cocos web-mobile build; without the real game loop, heap-size
// deltas across "rounds" would be meaningless (the shell has no state
// buildup). Tracked as follow-up when COCOS_CREATOR_PATH is wired.

test.describe('long-run heap stability (gated on Cocos build)', () => {
  test.skip('TC-E2E-LONG-001: heap growth < 20MB across 5 rounds', () => {});
});
