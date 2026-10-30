---
phase: 15-baseline
plan: 05
subsystem: visual-baseline-closure
tags: [owner-approval, visual-regression, clean-checkout, traceability, playwright]

requires:
  - phase: 15-baseline
    provides: candidate-only screenshots, deterministic browser contracts and editable Figma mapping from plans 15-01 through 15-04
provides:
  - named owner approval bound to 23 exact candidate hashes and one Figma revision
  - exact-byte promoted screenshot baselines with hash verification
  - clean-checkout unit, type, build, lint, browser, visual, a11y and diagnostic results
  - complete STAB-BASE-01 through STAB-BASE-06 traceability with honest blockers
affects: [16-supabase-staging, 18-desktop-motion, 19-promotion-proof, 21-security, 22-owner-uat]

tech-stack:
  added: []
  patterns: [owner-signed byte authority, candidate-only discovery, clean-checkout evidence, explicit blocked closure]

key-files:
  created:
    - tests/e2e/visual/__screenshots__/
    - .planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-APPROVAL.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-TRACEABILITY.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-BASELINE-RESULTS.md
  modified:
    - playwright.config.ts
    - scripts/phase15-visual-manifest.mjs
    - .planning/phases/PORTIA-15-baseline/evidence/15-FIGMA-CONTRACT.md

key-decisions:
  - "The owner's approval applies to exactly 23 CURRENT candidate hashes and does not convert the 35 BLOCKED rows or PROPOSED material into baseline authority."
  - "Visual candidate generation is opt-in and excluded from the default regression discovery."
  - "A passing automated checkout does not close Phase 15 while actor, device, visual and security gates remain blocked."

patterns-established:
  - "Every committed visual baseline is byte-identical to one owner-approved candidate."
  - "Every skipped browser lane is classified as expected, owner-bound or BLOCKED; no silent skip is counted as a pass."

requirements-completed: []
requirements-partial: [STAB-BASE-03, STAB-BASE-04, STAB-BASE-06]

duration: 4h51m
completed: 2026-10-30
---

# Phase 15 Plan 05: Approval, Promotion and Clean Evidence Summary

**Qloxz signed all 23 available CURRENT candidates, those exact bytes now form the Chromium desktop baseline, and the final clean-checkout automation passes; Phase 15 remains blocked by the 35 unavailable states and external gates.**

## Performance

- **Duration:** 4h51m across owner review and execution
- **Completed:** 2026-10-30T21:03:18+05:00
- **Tasks:** 3
- **Task commits:** 4

## Accomplishments

- Recorded signer `Qloxz`, signature time, candidate set, source commit and exact Figma MCP revision with 23 APPROVED and no PENDING/REJECTED captured candidate.
- Promoted 23 PNG files without recapture or transformation and verified destination SHA-256 equality against the signed ledger.
- Added 14 Chromium desktop comparison tests containing 23 screenshot assertions.
- Excluded candidate-generation specs from default Playwright discovery while preserving explicit candidate runs.
- Passed a fresh detached checkout under Node 22.13.1: 594 unit tests passed, typecheck/build passed, lint had 0 errors, and Playwright reported 66 passed / 79 explicit skips / 0 unexpected / 0 flaky.
- Added complete requirement traceability and a secret/artifact scan with no concrete credential or auth-state matches.

## Task Commits

1. **Task 1: Sign visual/Figma authority** — `03c3fb7`
2. **Task 2: Promote approved bytes and add comparisons** — `8fd346e`
3. **Task 3a: Isolate candidate capture from regression discovery** — `8493636`
4. **Task 3b: Seal clean-checkout results and traceability** — `49fcb1e`

## Clean-Checkout Result

| Gate | Result |
|---|---|
| `npm ci` | PASS |
| `npm test` | 594 passed, 1 explicit skip, 0 failed |
| TypeScript | PASS |
| Next production build | PASS |
| ESLint | 0 errors, 18 current warnings |
| Full Playwright, retries 0 | 66 passed, 79 explicit skips, 0 unexpected, 0 flaky |
| Approved visual authority | 23/23 hashes verified; 14 Chromium tests passed |
| Axe | 0 critical/serious; two moderate inventory rows retained |
| Secret/artifact scan | PASS |

The first detached run at `8fd346e` failed because it lacked runtime public
configuration and default discovery included candidate generation. That failure
was retained in the evidence narrative. After the orchestration fix, a new clean
checkout at `8493636` passed the required regression command.

## Explicit Blockers

- **STAB-BASE-02:** participant, editor, reviewer and owner browser decisions still require isolated Supabase staging and disposable identities.
- **STAB-BASE-03:** 35 visual rows remain blocked, including privileged states, representative device evidence and spider/web/Vivian semantic states.
- **STAB-BASE-04:** the exact CURRENT revision is signed, but blocked phone/device and semantic states prevent full contract closure.
- **STAB-BASE-06:** physical owner UAT and managed security evidence remain open.

## Deviations from Plan

### Auto-fixed Blocking Issue

1. **[Rule 3 - Blocking] Candidate generation was part of default Playwright discovery**
   - Added conditional `testIgnore` so the full regression command excludes `visual-candidates`, while an explicit candidate path still discovers all 95 candidate tests.
   - Verified default discovery contains 145 tests and explicit candidate discovery contains 95 tests.

### Honest Partial Completion

The plan's requested artifacts and automated clean-checkout evidence are complete,
but its phase-level success criteria explicitly prohibit closure while mandatory
rows are BLOCKED. Requirements `STAB-BASE-03`, `STAB-BASE-04` and
`STAB-BASE-06` therefore remain partial rather than being marked complete.

## Next Phase Readiness

Phase 16 may provision isolated Supabase staging and unblock real actor lanes.
Phase 15 itself must remain open until verification/security disposition decides
whether blocked visual/device evidence stays here or is formally reassigned.

---
*Phase: 15-baseline*
*Plan: 05 complete; phase closure blocked*
*Completed: 2026-10-30*

