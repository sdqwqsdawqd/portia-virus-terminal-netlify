---
phase: 15-baseline
plan: 08
subsystem: testing
tags: [playwright, diagnostics, visual-regression, snapshots]
requires:
  - phase: 15-07
    provides: honest local actor gate and read-only execution boundary
provides:
  - real runner-time diagnostic allowlist expiry
  - typed visual policy covering all 23 approved states
  - immutable approved-snapshot verification after policy tightening
affects: [15-09, 15-12, 15-15]
tech-stack:
  added: []
  patterns: [wall-clock-policy, per-surface-visual-cap]
key-files:
  created: [lib/e2e-diagnostics.test.ts, tests/e2e/fixtures/visual-policy.ts, lib/e2e-visual-policy.test.ts]
  modified: [tests/e2e/fixtures/diagnostics.ts, tests/e2e/visual/desktop.spec.ts, tests/e2e/visual/apps.spec.ts, tests/e2e/visual/editor.spec.ts, tests/e2e/visual/motion.spec.ts, tests/e2e/visual/promotion.spec.ts]
key-decisions:
  - "Node wall-clock time controls diagnostic expiry; the fixed browser clock controls page determinism only."
  - "Approved bytes remain immutable, so existing live-background drift uses measured per-surface caps until a future owner-approved recapture can introduce background masks."
patterns-established:
  - "Every approved state resolves through one typed visual-policy registry."
  - "Static desktop states use a 256-pixel cap; motion uses 1,200 and live-background application/editor states use a 2,300 ceiling, all below the former blanket 2,500."
requirements-completed: []
requirements-addressed: [STAB-BASE-03, STAB-BASE-05, STAB-BASE-06]
duration: 18min
completed: 2026-10-31
---

# Phase 15 Plan 08: Diagnostic Expiry and Visual Policy Summary

**Diagnostic exceptions now expire against the real runner clock, and all 23 approved screenshot states use one typed, bounded policy without changing a single approved PNG byte.**

## Accomplishments

- Removed the fixed 2026 diagnostic timestamp from runtime assertions.
- Added one-millisecond-before, exact-expiry and one-millisecond-after boundary coverage plus exact source/text/project matching.
- Replaced duplicated `maxDiffPixels: 2_500` literals with an exhaustive typed registry.
- Proved that removal of a 16×32 control fails the static desktop policy.
- Re-ran all 14 Chromium authority comparisons and verified all 23 owner-approved hashes unchanged.

## Task Commits

1. **Task 1: Make diagnostic expiry use real runner time** — `a4255c8`
2. **Task 2: Centralize masks and reduce visual tolerance** — `68ed0b6`

## Verification

- Diagnostic boundary unit tests: 3 passed.
- Diagnostic browser probes: 3 passed.
- Visual-policy unit tests: 3 passed.
- Chromium approved visual suite: 14 passed, 0 failed.
- Promotion manifest: 23 exact approved bytes verified; 0 excluded.
- TypeScript: passed.

## Deviations from Plan

### Preserved approved-byte authority

The existing approved PNGs contain the moving background spider without a mask.
Adding a new mask only to current captures would make them differ from the signed
expected bytes; rewriting those bytes is forbidden in this plan. The implementation
therefore preserves the two existing named masks (live employee data and external
document iframe), removes the global 2,500 allowance, and applies measured typed
caps by surface. A future owner-approved candidate/promotion cycle may adopt
background masks symmetrically. This remains recorded as a visual-authority gap,
not silently claimed as perfect pixel isolation.

## Self-Check: PASSED

- No approved PNG is modified.
- No visual spec contains the former literal blanket allowance.
- Product source and schema are untouched.

## Next Phase Readiness

Ready for 15-09 read-only public/device/motion candidate coverage. Phase-level
visual closure remains blocked by unavailable device/privileged states and the
documented background-mask limitation.

---
*Phase: 15-baseline*
*Completed: 2026-10-31*
