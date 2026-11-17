---
phase: 15-baseline
plan: 07
subsystem: testing
tags: [playwright, actors, authorization, supabase, security]
requires:
  - phase: 15-06
    provides: fail-closed isolated-target guard and browser preflight
provides:
  - immutable server-session proof contract for privileged actor readiness
  - executable visitor denial and explicit four-role blocked inventory
  - Phase 16 recovery contract without production mutation
affects: [15-08, 15-10, phase-16, phase-19]
tech-stack:
  added: []
  patterns: [server-proof-before-role-ready, blocked-is-not-passed]
key-files:
  created: [.planning/phases/PORTIA-15-baseline/evidence/15-ROLE-GATE.md]
  modified: [tests/e2e/fixtures/actors.ts, tests/e2e/fixtures/data/roster.json, tests/e2e/specs/roles.spec.ts, lib/e2e-actors.test.ts]
key-decisions:
  - "Environment strings cannot establish authenticated actor authority."
  - "Privileged role proof remains BLOCKED until Phase 16 isolated staging supplies server evidence and cleanup receipts."
patterns-established:
  - "Privileged READY requires both an isolated target and a matching immutable server-derived proof."
  - "Browser reports retain one skipped row per blocked role plus a passing blocker-inventory assertion."
requirements-completed: []
requirements-addressed: [STAB-BASE-02, STAB-BASE-06]
duration: 12min
completed: 2026-10-31
---

# Phase 15 Plan 07: Read-only Actor Gate Summary

**Privileged actor lanes now fail closed unless both isolated-target identity and matching server-session proof exist; the local browser report records four honest blockers instead of fabricated role passes.**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added stable `TARGET_NOT_ISOLATED` and `AUTHENTICATED_SESSION_UNPROVEN` blocker codes.
- Required immutable, role-matched `server-probe` evidence before any privileged fixture can become READY.
- Executed the real visitor denial and a four-role blocker inventory in Chromium desktop.
- Published a credential-free Phase 16 handoff with target attestation, authorization and cleanup requirements.

## Task Commits

1. **Task 1: Make actor readiness and blocked lanes unambiguous** — `aa8b600`
2. **Task 2: Execute the read-only role lane and publish the deferred matrix** — `4c33cfa`

## Verification

- Actor and target-guard unit matrix: 15 passed, 0 failed.
- TypeScript: passed.
- Chromium desktop role lane on Node 22.13.1: 2 passed, 4 explicitly skipped as BLOCKED, 0 failed.
- Service-client/admin/production-credential import scan: no matches.
- Production mutations and remote actor provisioning: not attempted.

## Decisions Made

- A syntactically safe target cannot prove an authenticated session.
- The owner identity is pre-existing and must never be deleted or modified by fixtures.
- CR-01 and `STAB-BASE-02` remain open; this plan closes only the local fail-closed evidence contribution.

## Deviations from Plan

None. The browser verification used the pinned Node 22.13.1 runtime and a process-local non-secret public-key placeholder required by the preflight; the application retained its existing local public configuration.

## Self-Check: PASSED

- Both task commits exist.
- Role evidence contains no target identifier, credential, account identity, cookie or authorization header.
- Product source and database schema were not changed.

## Next Phase Readiness

- Ready for 15-08 local diagnostic expiry and centralized visual-policy work.
- Authenticated participant/editor/reviewer/owner proof remains deferred to Phase 16 isolated staging.

---
*Phase: 15-baseline*
*Completed: 2026-10-31*
