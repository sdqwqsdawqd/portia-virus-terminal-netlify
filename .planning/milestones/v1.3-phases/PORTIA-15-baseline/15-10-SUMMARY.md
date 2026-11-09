---
phase: 15-baseline
plan: 10
subsystem: testing
tags: [playwright, visual-manifest, blocked-evidence, privacy]
requires:
  - phase: 15-09
    provides: read-only visual candidates and semantic motion coverage
provides:
  - immutable 84-row visual inventory with separate captured and blocked accounting
  - stable blocker reason codes and recovery ownership for Phases 16/18/19/20/22
  - manifest rejection of missing, duplicate, converted or hash-bearing blocked rows
affects: [15-11, 15-12, phase-16, phase-18, phase-19, phase-20, phase-22]
tech-stack:
  added: []
  patterns: [typed-blocker-matrix, stable-project-row-identity, blocked-never-passes]
key-files:
  created: [lib/phase15-visual-manifest.test.ts, .planning/phases/PORTIA-15-baseline/evidence/15-STABLE-ROW-INVENTORY.json]
  modified: [scripts/phase15-visual-manifest.mjs, tests/e2e/visual-candidates/support.ts, .planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-CANDIDATES.md, .planning/phases/PORTIA-15-baseline/evidence/15-FRAME-TEST-MAP.md]
key-decisions:
  - "BLOCKED rows carry no PNG path or hash and can never count as passing visual coverage."
  - "Stable identity is project plus row ID, so phone and desktop contracts cannot silently replace each other."
  - "Unavailable private authority remains metadata-only and is recovered only in its named later phase."
requirements-completed: []
requirements-addressed: [STAB-BASE-02, STAB-BASE-03, STAB-BASE-04, STAB-BASE-06]
duration: 25min
completed: 2026-10-31
---

# Phase 15 Plan 10: Machine-verified BLOCKED Ledger Summary

**The visual ledger now proves exactly what was captured and exactly what remains unavailable, without converting private or unproven states into successful coverage.**

## Accomplishments

- Removed the free-text `UNCLASSIFIED_BLOCKER` fallback from candidate generation.
- Assigned every blocker a stable reason code and recovery phase: isolated auth (16), motion/phone geometry (18), private Promotion data (19), public application fixtures (20), or unsigned Firefox pixel authority (22).
- Captured one complete local set with 84 stable project/row identities: 51 CAPTURED and 33 BLOCKED.
- Added a tracked status inventory and rejected missing rows, duplicates, status conversion, unexpected rows, missing captured evidence, and hash-bearing blocked rows.
- Preserved all 23 owner-approved snapshot bytes exactly and found no credentials or private application values in the generated evidence.

## Task Commits

1. **Task 1: Normalize privileged visual blockers and recovery ownership** — `6389d8a`
2. **Task 2a: Enforce blocked manifest integrity** — `efbc140`
3. **Task 2b: Seal stable visual inventory** — `53897de`

## Verification

- Manifest regression suite: 7 passed.
- Chromium desktop candidate suite: 20 passed.
- DPR 1.25, Chromium phone, WebKit phone and Firefox desktop shell suite: 8 passed.
- Complete manifest: 84 rows verified (51 PNGs, 33 BLOCKED).
- Figma machine identity map: 84 rows verified.
- Approved-byte gate: 23 exact hashes verified.
- Evidence privacy scan: empty.
- TypeScript: passed.

## Blocker Recovery Matrix

| Reason code | Recovery phase | Meaning |
|---|---:|---|
| `ISOLATED_AUTH_REQUIRED` | 16 | editor/owner/reviewer authority needs isolated server proof |
| `MOTION_CAPTURE_BOUNDARY_REQUIRED` | 18 | motion frame boundary still needs stable capture semantics |
| `PHONE_WINDOW_CONTRACT` | 18 | desktop-only window controls do not exist on phone |
| `ISOLATED_PROMOTION_DATA_REQUIRED` | 19 | participant/reviewer state needs isolated private fixtures |
| `PUBLIC_STATE_FIXTURE_REQUIRED` | 20 | loading/empty/degraded/error app fixtures are not yet safe |
| `PIXEL_AUTHORITY_NOT_SIGNED` | 22 | Firefox remains behavior evidence until owner pixel approval |

## Self-Check: PASSED WITH RECORDED BLOCKERS

- No production authentication, request submission, device binding, claim, save or Supabase mutation occurred.
- BLOCKED rows contain no candidate file or hash and cannot enter approval or promotion.
- Phase 15 remains `gaps_found`: this plan records recovery ownership but does not fabricate missing authority.

## Next Phase Readiness

Ready for 15-11 to synchronize the strict CURRENT ledger with Figma and collect a
Qloxz verdict for every available new hash. Private and unstable rows remain blocked.

---
*Phase: 15-baseline*
*Completed: 2026-10-31*
