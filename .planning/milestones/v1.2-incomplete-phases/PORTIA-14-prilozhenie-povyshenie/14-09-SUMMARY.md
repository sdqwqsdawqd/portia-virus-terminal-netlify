---
phase: 14-prilozhenie-povyshenie
plan: 09
subsystem: notifications-database
tags: [retake, notification, supabase, rls, cron]
requires:
  - phase: 14-08
    provides: qualification participant and reviewer interfaces
provides:
  - once-only in-site retake-ready notification
  - owner-applied Phase 14 production schema, policies, RPCs and cleanup schedule
affects: [14-10]
tech-stack:
  added: []
  patterns: [bounded-seen-ledger, owner-controlled-rollout, transactional-postflight]
key-files:
  created: [lib/portia-promotion-notifications.ts, lib/portia-promotion-notifications.test.ts]
  modified: [components/portia-desktop.tsx, components/portia-promotion.tsx, app/portia.css, supabase/phase14_apply.sql, supabase/portia_setup.sql]
key-decisions:
  - "A notification is emitted only after this device previously observed the same nickname waiting for a retake."
  - "The owner alone applied the production SQL; Codex performed no live database mutation."
  - "A successful transaction with no returned rows is the expected SQL Editor result because postflight failures raise and abort."
requirements-completed: [RETRY-05, DATA-03, DATA-04, DATA-05, EDIT-03]
duration: owner-paced
completed: 2026-10-28
---

# Phase 14 Plan 09: Retake Notification and Database Rollout Summary

The participant now receives one quiet in-site notification when a previously observed retake wait expires, and the owner has applied the complete Phase 14 database rollout.

## Accomplishments

- Added a nickname-isolated, bounded local ledger that emits each retake-ready notification once and never exposes a nickname in the toast.
- Reused the existing quest-toast interaction to open or focus the Promotion application, with reduced-motion support and suppression while the ready state is already visible.
- Kept the owner rollout transactional and manual; Codex did not execute SQL against production.
- Removed one stray SQL patch marker found by the owner's first run, synchronized both SQL sources, and reran all static contracts.
- Owner reran `supabase/phase14_apply.sql` on 2026-10-28 and reported `Success. No rows returned`; therefore the transaction and its embedded post-apply assertions completed without an exception.

## Commits

| Commit | Description |
|--------|-------------|
| `88417f4` | Add failing retake notification contracts |
| `bb9f1df` | Add one-time retake-ready notification |
| `ad5feda` | Remove SQL rollout syntax artifact |

## Deviations from Plan

- The first owner-run SQL attempt stopped at an accidental standalone `+` between functions. Because the script is wrapped in one transaction and never reached `commit`, it left no partial rollout. Both SQL copies were corrected before the successful rerun.
- The SQL Editor reports no result rows on success; the script verifies rollout invariants with assertions that raise and roll back on failure instead of returning a report table.

## Verification

- Owner production SQL: successful on 2026-10-28; no assertion or transaction error.
- `npm test`: 497 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Full repository lint retains the same three pre-existing errors: two archived Phase 06 CommonJS checkers and the Guide ref initializer. No Phase 14 lint error was introduced.

## Self-Check: PASSED

The one-time notification exists, both SQL sources are synchronized, the production transaction was applied only by the owner, and automated checks confirm the local contracts.
