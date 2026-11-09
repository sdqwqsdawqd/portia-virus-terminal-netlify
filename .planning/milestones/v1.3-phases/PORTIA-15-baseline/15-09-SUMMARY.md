---
phase: 15-baseline
plan: 09
subsystem: testing
tags: [playwright, visual-candidates, motion, devices, phone]
requires:
  - phase: 15-08
    provides: typed visual policy and immutable approved-byte gate
provides:
  - semantic front-leg, web-wave, Vivian and shortcut motion assertions
  - actual DPR 1.25, WebKit phone and Chromium phone candidate metadata
  - 80-row candidate/blocker ledger for Plans 15-10 and 15-11
affects: [15-10, 15-11, 15-12, phase-18]
tech-stack:
  added: []
  patterns: [semantic-before-capture, actual-project-device-evidence, no-own-api-fulfillment]
key-files:
  created: [tests/e2e/fixtures/candidate-faults.ts]
  modified: [tests/e2e/fixtures/determinism.ts, tests/e2e/pages/desktop.page.ts, tests/e2e/visual-candidates/motion.spec.ts, tests/e2e/visual-candidates/desktop.spec.ts, tests/e2e/visual-candidates/support.ts, .planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-CANDIDATES.md, .planning/phases/PORTIA-15-baseline/evidence/15-FRAME-TEST-MAP.md]
key-decisions:
  - "SVG pair 4 (L4/R4), not pair 1, is the anatomical front pair beside the fangs."
  - "Motion PNGs with non-repeatable hashes remain candidate evidence and cannot receive owner approval."
  - "Phone full-screen windows record desktop maximize/minimize controls as not applicable instead of timing out."
patterns-established:
  - "Test-only crypto randomness is seeded alongside Math.random for deterministic route selection."
  - "Candidate faults may delay or abort an exact own-API request but can never fulfill or fabricate one."
requirements-completed: []
requirements-addressed: [STAB-BASE-03, STAB-BASE-04, STAB-BASE-06]
duration: 30min
completed: 2026-10-31
---

# Phase 15 Plan 09: Read-only Device and Motion Candidates Summary

**Public candidates now originate from their real DPR/phone projects, while semantic motion assertions prove the requested front-leg and interaction states without pretending unstable active-motion hashes are approvable.**

## Accomplishments

- Seeded the browser crypto source used by the wallpaper spider in the E2E-only deterministic fixture.
- Asserted front-leg `L4/R4` hunting motion with rear `L1/R1` neutral, real footfall wave emission, seeded route movement, Vivian activity/offended/recovery and complete shortcut cycles.
- Captured 16 DPR 1.25, 14 Chromium-phone and 14 WebKit-phone safe candidates on their declared projects.
- Generated a new 80-row ledger: 58 CAPTURED and 22 BLOCKED, with the Figma map retaining every machine identity for later synchronization.
- Added a candidate-only exact-request delay/abort primitive that never fulfills a PORTIA API response.

## Task Commits

1. **Task 1: Capture completed spider, web, Vivian and shortcut states** — `db5dbad`
2. **Task 2: Capture public application and declared device projects** — `6d4880b`

## Verification

- Motion semantic suite: 3 passed.
- Public/device first run: 37 passed; two phone desktop-window tests exposed an invalid desktop-only maximize assumption.
- Corrected device desktop suite: 6 passed.
- TypeScript: passed.
- Candidate manifest: 80 rows verified.
- Figma machine identity map: 80 rows verified.

## Deviations and Open Evidence

### Active-motion hashes are not reproducible yet

Two identical motion runs reached the same semantic states but changed all 14
active-motion PNG hashes because rAF/CSS continued during screenshot encoding.
Pausing a partial frame is explicitly forbidden. The rows therefore remain
unapproved candidates and are called out in the ledger for Phase 18 capture-boundary
work. Semantic assertions themselves are stable and passing.

### Fault fixture is defined but safe-state capture remains blocked

The candidate-only fault primitive enforces abort/continue-only behavior and records
the exact request. Existing applications do not yet expose an approved deterministic
loading/fatal state without causing the global diagnostic gate to fail, so those rows
remain BLOCKED instead of being fabricated.

## Self-Check: PASSED WITH RECORDED BLOCKERS

- No product component, approved PNG or database schema changed.
- No form submission, device binding, authentication, claim or Supabase mutation occurred.
- Motion reproducibility and candidate fault-state evidence are explicitly open.

## Next Phase Readiness

Ready for 15-10 to machine-verify all privileged and reproducibility blockers with
stable recovery ownership. No new candidate is approved by this plan.

---
*Phase: 15-baseline*
*Completed: 2026-10-31*
