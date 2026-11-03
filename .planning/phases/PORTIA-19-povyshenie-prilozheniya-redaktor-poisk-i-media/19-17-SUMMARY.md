---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 17
subsystem: promotion-staging
tags: [staging, acceptance, guard, supabase, tdd]
requires:
  - phase: PORTIA-19
    provides: Guarded Phase 16 staging wrapper and Phase 19 acceptance seed
provides:
  - Guarded acceptance-serve with server and client binding probes before revealing URLs
  - Canonical DB URL validation without query, fragment or alternate database path
  - Acceptance manifest v2 with DB clock, pre-seed snapshot and separate PC and phone participants
affects: [PORTIA-19 owner UAT, STAB-PROM-13, STAB-PROM-15]
actuals:
  tokens: 11146
  tasks: 2
  commits: 8
plan_head_before: 33fcf7622728e0ef7eacae9f9a2e010c6c33d37b
plan_head_after: 362eb6a9e62a06762d62c441146d7eefd0674859
tech-stack:
  added: []
  patterns: [Fail-closed local server binding, DB-clock snapshot before seed, explicit-ID cleanup]
key-files:
  created: [.planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-17-red-task1.json, .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-17-red-task2.json]
  modified: [scripts/phase16-staging.mjs, scripts/phase19-acceptance.mjs, lib/phase16-staging.test.ts, lib/phase19-acceptance.test.ts]
key-decisions:
  - Keep STAB-PROM-13 and STAB-PROM-15 Pending until isolated staging execution and owner PC/phone acceptance prove them.
  - Reject an incomplete pre-seed snapshot before creating a run rather than risking deletion of unseen rows.
requirements-completed: []
requirements-pending: [STAB-PROM-13, STAB-PROM-15]
coverage:
  - id: WR-01
    description: DB URL query, fragment and foreign path cannot bypass the staging target guard.
    requirement: STAB-PROM-15
    verification:
      - kind: unit
        ref: lib/phase16-staging.test.ts#resolveStagingTarget fails closed before any spawn or fetch
        status: pass
    human_judgment: false
  - id: T-19-35
    description: Acceptance server announces a URL only after staging status and client bundle probes.
    requirement: STAB-PROM-15
    verification:
      - kind: unit
        ref: lib/phase19-acceptance.test.ts#acceptance-serve staging binding
        status: pass
    human_judgment: true
    rationale: Real isolated staging and owner devices have not been exercised in this plan.
  - id: WR-02
    description: Seed v2 snapshots preexisting rows and shift, residual and teardown exclude them.
    requirement: STAB-PROM-13
    verification:
      - kind: unit
        ref: lib/phase19-acceptance.test.ts#preexisting bucket in the window is neither shifted nor deleted
        status: pass
    human_judgment: true
    rationale: Real Postgres and cleanup execution remain part of the subsequent staging acceptance.
duration: 15min
completed: 2026-11-03
status: complete
---

# Phase 19 Plan 17: Staging-bound acceptance server and safe run cleanup

The acceptance wrapper now starts its own staging-configured Next.js server and reveals a URL only after proving both API and client-bundle binding. Seed v2 protects rows that existed before the run.

## Performance

- **Duration:** approximately 15 min
- **Tasks:** 2
- **Code/test files changed:** 4
- **Own commits:** 5. The measured ledger range is 8 commits because three concurrent Phase 20 documentation commits landed on the shared branch.

## Accomplishments

- `acceptance-serve <runId> [--https]` runs through `resolveStagingTarget`, compares the manifest refHash, refuses occupied port 3000, supplies staging URL and publishable values to `next dev`, clears the admin key and DB URL, persists a per-run device secret outside the repository, and checks the probe nickname, absent nickname and owner-login scripts before emitting one `STAGING-BOUND` JSON line. Failures kill the child.
- `parseDbUrl` rejects query, fragment and foreign database path; the DB URL used by the CLI is rebuilt from parsed components. Empty query and fragment delimiters are rejected too.
- Seed v2 uses the isolated project's Date response, records all preexisting bucket keys and bank IDs, and creates separate `pc-*` and `ph-*` participant sets plus `probe`. Shift, residual and teardown exclude snapshot rows and delete by computed keys or IDs. v1 manifests retain legacy window behavior and report `legacyWindow: true`.

## Task Commits

1. Task 1 RED: `892c0eb` — failing DB URL and acceptance server tests.
2. Task 1 GREEN: `3f88320` — guarded server and binding probe.
3. Task 2 RED: `a5769ff` — failing v2 snapshot, roster and cleanup tests.
4. Task 1 safety correction: `5e105bb` — reject even empty query and fragment delimiters.
5. Task 2 GREEN: `362eb6a` — DB time, v2 snapshot, scoped shift and teardown.

## TDD Evidence

- Task 1: `19-17-red-task1.json`, `RED_EVIDENCE_OK`; the named ref-mismatch test returned usage exit 2 because the command did not exist. GREEN: 69 targeted tests passed at task close.
- Task 2: `19-17-red-task2.json`, `RED_EVIDENCE_OK`; the named preexisting-row test found no snapshot in the v1 manifest. GREEN: 74 targeted tests passed.

## Verification

- Targeted staging tests: 74 passed, 0 failed.
- `npm.cmd test`: 1093 passed, 3 existing skipped, 0 failed.
- `npm.cmd exec tsc -- --noEmit`: passed.
- ESLint on all four changed code and test files: passed.
- `node --experimental-strip-types scripts/phase16-staging.mjs self-test-production-block`: `checked=1, blocked=1`, exit 0.
- Full `npm.cmd run lint`: **failed** on 32 errors in unrelated existing skill scripts. This is recorded in `deferred-items.md`; it is not a pass.
- No live seed, shift, teardown or server was run. Real staging and owner device evidence remain pending.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reject empty DB URL query and fragment delimiters**
- **Found during:** Task 2 safety review.
- **Issue:** URL.search and URL.hash are empty for a bare `?` or `#`, leaving a target-override syntax unguarded.
- **Fix:** Reject raw delimiters as well and test both forms.
- **Commit:** `5e105bb`.

**2. [Rule 2 - Critical functionality] Fail closed on incomplete snapshots and malformed v2 manifests**
- **Found during:** Task 2.
- **Issue:** A capped PostgREST response or malformed snapshot could omit a preexisting row and make cleanup unsafe.
- **Fix:** Require count equality before seed and validate v2 snapshot fields on read.
- **Commit:** `362eb6a`.

## Known Stubs

None.

## Issues Encountered

Global lint remains blocked by preexisting skill-script errors; changed-file lint passes. STAB-PROM-13 and STAB-PROM-15 remain Pending under AGENTS.md because this plan did not execute authenticated Postgres/RLS or owner PC/phone acceptance.

## Next Phase Readiness

Plan 19-18 may use `acceptance-serve` and seed v2 for an isolated staging run. The wrapper's unit tests establish fail-closed behavior; live acceptance still needs separate proof.

## Self-Check: PASSED

Both source scripts, both test files and both RED evidence records exist. All five task commits are ancestors of HEAD.
