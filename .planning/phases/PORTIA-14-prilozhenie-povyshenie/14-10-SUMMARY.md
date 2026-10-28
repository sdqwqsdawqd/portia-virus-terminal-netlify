---
phase: 14-prilozhenie-povyshenie
plan: 10
subsystem: promotion-database-security
tags: [postgresql, concurrency, heartbeat, qualification, security]
requires:
  - phase: 14-09
    provides: owner-applied Phase 14 base schema and qualification workflow
provides:
  - atomic rate-limit, device-binding and request admission transaction
  - compare-and-set qualification answer advancement
  - immutable qualification client mode and server-observable heartbeat lease
  - normalized parity checks for Phase 14 SQL definitions
affects: [14-11, 14-12, 14-13, 14-14]
tech-stack:
  added: []
  patterns: [advisory-lock-ordering, compare-and-set, server-lease, sql-definition-parity]
key-files:
  modified: [supabase/portia_setup.sql, supabase/phase14_apply.sql, lib/portia-promotion-db.test.ts, lib/portia-promotion-security.test.ts]
key-decisions:
  - "Admission locks bucket, normalized nickname and device token in a stable order before changing any workflow state."
  - "Qualification answers carry the expected question index; only one transaction can store the answer and increment it."
  - "Active tests use a 45-second server lease and preserve the client mode selected at attempt creation."
requirements-completed: [PROM-04, PROM-05, QUAL-06, QUAL-07, QUAL-08, QUAL-09, DATA-02, DATA-03, PERM-03]
duration: 25 min
completed: 2026-10-28
---

# Phase 14 Plan 10: Database Concurrency and Test Lease Summary

Promotion admission and qualification progress now have database-level concurrency protection, and abandoned tests can fail without trusting a final browser request.

## Accomplishments

- Combined request throttling, first device binding and request creation in one security-definer transaction with deterministic advisory locks and explicit neutral result codes.
- Added `current_question_index` and compare-and-set answer submission so concurrent or stale answers cannot advance a test twice; accepted nonce retries remain idempotent.
- Added `last_seen_at`, `lease_expires_at`, a device-authenticated heartbeat RPC and an idempotent stale-attempt transition using server time.
- Made `client_mode` immutable after attempt creation and required current-test reads to match the stored snapshot.
- Added normalized table/function parity coverage between the canonical setup and owner-run Phase 14 SQL files.
- Removed obsolete deployed overloads for the earlier submit and answer signatures during migration.

## Commits

| Commit | Description |
|--------|-------------|
| `e0a6628` | Add failing concurrency contract tests |
| `96c7fe2` | Serialize promotion admission and answer advancement |
| `ab9cce3` | Add failing lease and SQL parity contracts |
| `3aab381` | Add immutable test leases and heartbeat expiry |

## Migration Notes

- `supabase/phase14_apply.sql` must be rerun by the owner at the final rollout gate because this plan adds columns, replaces RPC signatures and introduces heartbeat functions.
- The migration drops the obsolete seven-argument submit function and five-argument answer function before exposing the new contracts, preventing old public overloads from remaining callable.
- The 45-second lease is refreshed only for the matching active attempt and device token. Deadline expiry and lease expiry preserve existing answers and retain the first technical failure reason.

## Deviations from Plan

- The parity regression compares every Phase 14 table and function definition. Policy, grant and cron coverage remains in the existing dedicated structural assertions rather than one monolithic text comparison, because the canonical setup contains surrounding non-Phase-14 schema.

## Verification

- `npm test`: 532 tests passed.
- PostgreSQL parser: both `phase14_apply.sql` and `portia_setup.sql` parsed successfully (147 and 237 statements).
- SQL mirror regression: all Phase 14 table and function definitions match after whitespace normalization.

## Self-Check: PASSED

All plan artifacts exist, both TDD cycles are green, old callable overloads are removed by migration, and no production database mutation was performed in this plan.
