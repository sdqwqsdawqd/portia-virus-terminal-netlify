---
phase: 14-prilozhenie-povyshenie
plan: 12
subsystem: promotion-lifecycle-hardening
tags: [identity, outage, cooldown, cleanup, notifications]
requires:
  - phase: 14-11
    provides: atomic participant API and lease-aware qualification runner
provides:
  - strict unique Unicode-normalized roster identity
  - shared reversible sheet-outage policy for participant and reviewer flows
  - bounded reviewer cleanup preview with three-day server dates
  - once-only first-return retake notification
affects: [14-13, 14-14]
tech-stack:
  added: []
  patterns: [fail-closed-source-validation, reversible-outage-policy, bounded-seen-ledger]
key-files:
  modified: [lib/portia-promotion-sheet.ts, lib/portia-promotion-api.ts, lib/portia-promotion-reviewer.ts, lib/portia-promotion-notifications.ts, app/api/promotion/reviewer/route.ts, supabase/phase14_apply.sql, supabase/portia_setup.sql]
key-decisions:
  - "Partial rows and Unicode-equivalent duplicate nicknames invalidate the entire promotion source instead of selecting a record."
  - "During a sheet outage, existing claims remain visible and only release operations stay available; irreversible decisions and cleanup pause."
  - "Scheduled cleanup never deletes workflow requests without a current validated source; deletion remains an explicit owner action."
  - "Retake readiness is derived on return and recorded as notified only when the in-site toast is emitted."
requirements-completed: [PROM-01, PROM-02, PROM-03, PROM-06, COOL-01, COOL-02, COOL-03, COOL-04, COOL-05, RETRY-05, EDIT-03, DATA-05]
duration: 24 min
completed: 2026-10-28
---

# Phase 14 Plan 12: Lifecycle Hardening Summary

Promotion identity, source outages, cleanup visibility and retake notifications now follow one fail-closed lifecycle without losing reversible work.

## Accomplishments

- Normalized roster nicknames with NFKC plus case folding and rejected partial rows, malformed identities and Unicode-equivalent duplicates as an invalid source.
- Distinguished an invalid source from a temporary unavailable source internally while returning the same safe public unavailable state.
- Applied one reviewer outage policy: preserve claims, permit release and force-release, and block decisions or destructive cleanup that depend on current sheet rank.
- Added a collapsed, bounded cleanup preview with permitted metadata and server-derived deletion dates three days after the latest update.
- Removed automatic workflow-row deletion from scheduled cleanup so a source outage cannot erase requests; bounded technical logs and attempt buckets are still pruned.
- Changed retake notification tracking so the first eligible return emits one quiet in-site toast even when the waiting state was never observed.
- Kept the notification ledger bounded to 200 compact identities without answers or grading details.

## Commits

| Commit | Description |
|--------|-------------|
| `dcf5b56` | Add failing strict sheet identity and cooldown contracts |
| `e0efb2f` | Fail closed on ambiguous promotion sheets |
| `8857e99` | Add failing outage and cleanup contracts |
| `ad377c4` | Unify outage and cleanup policy |
| `e6691ad` | Add failing first-return notification contracts |
| `7531121` | Notify on first eligible return |

## Deviations from Plan

- The plan named the public and reviewer adapters, but safe cleanup also required changing both mirrored SQL files. Scheduled cleanup now intentionally leaves workflow requests untouched because cron cannot validate the live Google Sheet source.
- When the participant is already viewing the ready state, the toast is suppressed but not marked as delivered. It remains eligible for the next non-viewing return, matching the requirement to record delivery only after emission.

## Verification

- `npm test`: 541 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- PostgreSQL parser: both mirrored SQL files parsed successfully.

## Self-Check: PASSED

Strict source identity, outage action boundaries, cleanup metadata, exact cooldown tests and first-return notification behavior are covered by executable regression tests.
