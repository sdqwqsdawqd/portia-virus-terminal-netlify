---
phase: 15-baseline
plan: 12
subsystem: visual-regression
tags: [playwright, exact-bytes, firefox-authority, visual-regression]
requires:
  - phase: 15-11
    provides: local UI contract and complete owner verdict ledger
provides:
  - exact tracked projection of 33 approved snapshot bytes
  - executable visual comparisons on declared desktop, DPR and phone projects
  - fail-closed exclusion of 18 rejected and 33 blocked states
affects: [15-13, 15-15, phase-18]
tech-stack:
  added: []
  patterns: [approved-only-snapshot-store, project-specific-pixel-authority, semantic-readiness-before-capture]
key-files:
  created: []
  modified: [scripts/phase15-visual-manifest.mjs, tests/e2e/fixtures/visual-policy.ts, tests/e2e/visual/desktop.spec.ts, tests/e2e/visual/apps.spec.ts, tests/e2e/visual/editor.spec.ts, tests/e2e/visual/motion.spec.ts, tests/e2e/visual/promotion.spec.ts, tests/e2e/visual/__screenshots__/]
key-decisions:
  - "Only APPROVED exact bytes remain in the tracked snapshot store; rejected and blocked rows are absent."
  - "Firefox is the owner-selected pixel authority for restored, maximized and minimized Search window states."
  - "The duplicate WebKit clean destination is excluded while its identical phone-webkit device row remains approved."
requirements-completed: []
requirements-addressed: [STAB-BASE-03, STAB-BASE-04, STAB-BASE-06]
duration: 45min
completed: 2026-10-31
---

# Phase 15 Plan 12: Executable Approved Visual Authority Summary

**The tracked snapshot directory now contains exactly the 33 owner-approved bytes, and every retained visual authority is exercised without promoting rejected motion or transitional loading frames.**

## Accomplishments

- Promoted 33 approved snapshots byte-for-byte and removed 18 rejected destinations.
- Kept all 33 typed BLOCKED rows outside snapshot authority.
- Replaced two transient Firefox Search loading captures with owner-selected settled-content frames.
- Selected Firefox as the only Search-window pixel authority while retaining Chromium, DPR and phone shell/device coverage.
- Added semantic readiness for windows, editor denial/login and Promotion lookup.
- Exercised approved web-rest and Vivian idle/activity/offended/recovery states; rejected shortcut/spider/web-wave states are not compared as passing baselines.

## Task Commits

1. **Task 1: Promote exact approved bytes** — `a96392f`
2. **Task 2: Execute approved visual authority and bind Firefox Search states** — `2f3c54b`

## Verification

- Approval ledger: 51 captured rows covered; 33 blocked rows excluded.
- Promotion: 33 exact approved bytes verified; 18 rejected rows absent.
- Playwright visual suite: 21 passed, 54 explicitly skipped, 0 failed.
- Manifest unit tests: 16/16 passed.

## Per-project Results

| Project | Passed | Explicitly skipped | Failed | Authority role |
|---|---:|---:|---:|---|
| chromium-desktop | 14 | 1 | 0 | public apps, editor, Promotion, motion and desktop shell |
| chromium-dpr125 | 2 | 13 | 0 | shell and DPR 1.25 device frame |
| firefox-desktop | 1 | 14 | 0 | Search-window restored/maximized/minimized pixel authority |
| webkit-phone | 2 | 13 | 0 | phone shell and canonical WebKit device frame |
| chromium-phone | 2 | 13 | 0 | phone shell and canonical Chromium device frame |

## Rejected/Blocked Accounting

- 18 REJECTED rows remain immutable evidence and cannot be promoted.
- 33 BLOCKED rows remain assigned to their named recovery phases.
- Phase 18 owns replacement motion candidates and phone/window recovery.

## Next Plan Readiness

Ready for 15-13 to seal metadata and path verification above the approved snapshot set.

---
*Phase: 15-baseline*
*Completed: 2026-10-31*
