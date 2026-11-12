---
phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya
plan: "09"
subsystem: security-evidence
tags: [supabase, migration, security-matrix, offline-verification]
requires: [22-07 mocked-browser-contracts, 22-08 final-rls-review]
provides: [frozen-users-migration-record, phase22-security-matrix, closed-three-test-red-window]
affects: [22-10 owner-decision, isolated-staging, phase27-device-uat]
tech-stack:
  added: []
  patterns: [review-commit-tied-matrix, owner-only-migration-apply, explicit-blocked-evidence]
key-files:
  created:
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-MIGRATION-APPLY.md
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-SECURITY-MATRIX.md
  modified:
    - lib/security-matrix.test.ts
    - lib/portia-canonical-parity.test.ts
    - .planning/WINDOWS.md
key-decisions:
  - "Migration remains unapplied; the owner decides on an isolated staging project in plan 22-10."
  - "The final build is blocked by the explicit no-.env* constraint; direct offline checks are reported separately."
actuals:
  tokens: 6583
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 711135fdeaf19ea3f2e0031c7692abb649cedcc8
plan_head_after: 2dae04a7c8053165f21db73acf98b5e2da3fb007
requirements-completed: []
duration: 20m
completed: 2026-11-12
status: blocked
---

# Phase 22 Plan 09: Migration Freeze and Security Evidence Summary

**The users migration is pinned and explicitly unapplied; the Phase 22 matrix covers all 12 routes and 8 migrations and closes the three failing coverage and freshness checks.**

## Accomplishments

- Froze `20261110000000_portia_users_tab.sql` at sha256 `75e9b89d08eb9893dac2bf9fe0f082be5e9ed9ae640dd38f4373535963d70c60` without changing SQL. The record gives the five-file owner apply order, D-01..D-12 traceability, rollback limits and blocked live lanes.
- Added the Phase 22 security matrix tied to the final static reviewed commit `9f2778c49f63ef44925170bcf07df8e98baf842e`; carried Phase 21 migration rows and v1.3 route rows without modifying archived files.
- Repointed current route, migration and freshness tests to Phase 22; retained Phase 21 specific tests against Phase 21. The earlier three-test red window is green.

## Task Commits

1. **Task 1 — migration freeze, apply record, matrix and guards:** `d1756e6`.
2. **Task 2 — safe local verification record:** `2dae04a`.

## Local Verification

| Check | Result |
|---|---|
| Node | v22.13.1 |
| Full unit suite | 1894 tests; 1891 passed, 0 failed, 3 skipped; exit 0 |
| TypeScript | exit 0 |
| ESLint | exit 0; 0 errors, 17 existing warnings, equal to Phase 21 baseline |
| Visual manifest test | 49 passed, 0 failed; exit 0 |
| `--verify-promotion` | 65 approved snapshot bytes verified; 18 excluded; exit 0 |
| Next build | **BLOCKED (ENV)**: not run because it reads `.env.local`, which this execution was explicitly forbidden to read |

The earlier `portia-check` wrapper stopped before tests because its temporary npm installation lacks `node-gyp/bin/node-gyp.js` (`22-08-SUMMARY.md`). Direct `node` commands above supplied the safe local checks. There was no package install or attempt to substitute a package. A green type or test result does not prove that the migration is live.

## Unverified Boundaries

- Browser e2e, visual and mutation tests: **BLOCKED (ENV)** at preflight in 22-07; no browser test started.
- Isolated staging, live PostgreSQL/RLS, authenticated owner/editor roles, and the two-editor race: **BLOCKED (ENV)**. No migration was applied.
- Physical devices: **BLOCKED**, assigned to Phase 27.
- Production: **ОЖИДАЕТ ВЛАДЕЛЬЦА**. The agent made no connection or mutation.

## Deviations from Plan

The plan requested a successful Next build. The parent execution constraint expressly prohibited running it because Next.js reads `.env.local`; therefore the full-check acceptance criterion remains unmet. No build result is inferred from other checks. The documented site visual description is based on source and style-token contracts, not a rendered browser comparison.

## Deferred Issues

- Next build is unrun under the no-`.env*` constraint; the owner or a later authorized environment must perform that gate before describing the full local check as complete.
- Live evidence and owner approval remain for 22-10 and the isolated staging run.
- The unrun build is recorded as open entry 11 in `.planning/WINDOWS.md`.

## Known Stubs

None introduced by this plan. The `pending-database` 503 response is the intentional fail-closed state until the owner applies both access migrations.

## Self-Check: PASSED

The four task files exist; commits `d1756e6` and `2dae04a` are ancestors of HEAD. The Phase 21 and v1.3 archive paths are unchanged, and the protected owner paths were neither staged nor committed.
