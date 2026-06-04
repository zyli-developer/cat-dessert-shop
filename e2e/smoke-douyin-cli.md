# Douyin Mini-Game Pre-Submission Smoke Checklist

> Manual — run in the Douyin developer tool + a real device before every submission.
> Automated Playwright specs cover most of this against a fallback shell, but the real `tt` runtime + store compliance can only be verified here.

## Prerequisites

- [ ] Latest Douyin developer tool (open platform → Mini Game tab)
- [ ] Production AppID and ad unit IDs (not the test ones)
- [ ] Real devices: 1 iOS + 1 Android, ideally 1 low-end (≤ 2 GB RAM)
- [ ] Built the mini-game bundle via Cocos Creator → bytedance-mini-game
- [ ] Server deployed and reachable from devices

---

## Section A: Package & Cold Start (TC-PLAT-PKG)

- [ ] **TC-PLAT-PKG-001** Main package ≤ 4 MB (Douyin hard limit)
- [ ] **TC-PLAT-PKG-002** Total bundle (with subpackages) ≤ 20 MB
- [ ] **TC-PLAT-PKG-003** Cold start < 8 seconds first-visible-frame on low-end
- [ ] **TC-PLAT-PKG-004** Warm start < 3 seconds (after OS cached)

---

## Section B: Real `tt` SDK Calls (TC-PLAT-SDK)

Automated tests use a mock `window.tt`. These verify the real runtime:

- [ ] **TC-PLAT-SDK-001** `tt.login()` returns a real code that our `/api/auth/login` can exchange via the Douyin `code2session` service (FU-T1-04 must be done — the stub exchanger will reject real codes)
- [ ] **TC-PLAT-SDK-002** `tt.getStorageSync` / `setStorageSync` round-trip persists across app restart
- [ ] **TC-PLAT-SDK-003** `tt.getLaunchOptionsSync()` returns expected `scene` + `query` when launched via share card
- [ ] **TC-PLAT-SDK-004** `tt.shareAppMessage` — success path triggers platform share sheet; cancel path does not crash

---

## Section C: Rewarded Video (TC-PLAT-AD)

Production ad unit IDs must be in config — test IDs will not pay out.

- [ ] **TC-PLAT-AD-001** Watch full ad → `isEnded: true` → game grants reward
- [ ] **TC-PLAT-AD-002** Close ad mid-play → `isEnded: false` → no reward
- [ ] **TC-PLAT-AD-003** No network → `onError` fires → UI shows "ad unavailable, try later"
- [ ] **TC-PLAT-AD-004** Ad frequency acceptable to Douyin (no forced pre-roll; player-initiated)
- [ ] **TC-PLAT-AD-005** Ad unit ID is production, not `test-ad-unit-xxx`

---

## Section D: Device Compatibility (TC-PLAT-COMPAT)

- [ ] **TC-PLAT-COMPAT-001** iOS device: login → play → share works end-to-end
- [ ] **TC-PLAT-COMPAT-002** Android device: same end-to-end
- [ ] **TC-PLAT-COMPAT-003** Low-end device sustains ≥ 30 FPS during active merge round
- [ ] **TC-PLAT-COMPAT-004** Notch / safe area respected on iOS (no UI clipped)
- [ ] **TC-PLAT-COMPAT-005** Orientation locked per spec (portrait) — rotating device does not break layout

---

## Section E: Network Resilience (TC-PLAT-NET)

- [ ] **TC-PLAT-NET-001** 3G throttling: game still playable; upload retry visible
- [ ] **TC-PLAT-NET-002** Airplane mode mid-round: local state preserved, upload queued (requires FU-T2-02)
- [ ] **TC-PLAT-NET-003** App → background → foreground: game state intact, audio resumes

---

## Section F: Compliance & Review (TC-PLAT-REVIEW)

- [ ] **TC-PLAT-REVIEW-001** Privacy policy link accessible from settings + first-launch modal
- [ ] **TC-PLAT-REVIEW-002** Terms of service present and accurate
- [ ] **TC-PLAT-REVIEW-003** No copyrighted content / impermissible imagery (cats, desserts, fonts checked)
- [ ] **TC-PLAT-REVIEW-004** Minor-protection banner if age verification is required by region
- [ ] **TC-PLAT-REVIEW-005** Ad display frequency complies with Douyin guidelines (no ad every N seconds; all player-initiated)

---

## Sign-off

| Role | Name | Date | Build SHA |
|------|------|------|-----------|
| Dev | | | |
| QA | | | |
| Compliance | | | |

Submission URL: `__________`

---

## Related automation

See `e2e/specs/*.spec.ts` for the Playwright coverage. The items above are the residual manual gap that no fake `tt` mock can exercise.
