---
phase: 14-prilozhenie-povyshenie
plan: 04
subsystem: api
tags: [promotion, reviewer, banks, atomic-claim, signed-preview]

requires:
  - phase: 14-02
    provides: trusted promo tab, private workflow tables and transition RPCs
provides:
  - fail-closed reviewer queue and typed commands with atomic claim ownership
  - separate ordinary-task and qualification-question bank CRUD
  - quota-aware manual/random previews with signed version and immutable confirmation
affects: [14-06, 14-07, 14-08, 14-09]

tech-stack:
  added: []
  patterns: [double reviewer authorization, signed short-lived preview, bank-version revalidation, immutable snapshot]

key-files:
  created: [lib/portia-promotion-reviewer.ts, app/api/promotion/reviewer/route.ts, app/api/promotion/banks/route.ts]
  modified: [proxy.ts, supabase/portia_setup.sql, supabase/phase14_apply.sql]

key-decisions:
  - "Every reviewer route checks the authenticated access projection and every database RPC independently checks portia_has_tab_grant('promo')."
  - "Manual preview order is preserved; random selection excludes inactive rows and samples without replacement."
  - "Preview confirmation requires a signed short-lived token and the current bank version."

patterns-established:
  - "A lost claim/update race returns HTTP 409 with refreshed reviewer state."
  - "Bank configuration remains mutable, while confirmed assignment/test rows are immutable snapshots."

requirements-completed: [TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, EDIT-02]

duration: 6 min
completed: 2026-10-27
---

# Phase 14 Plan 04: Reviewer Queue and Banks Summary

**Trusted reviewer queues with one atomic claim winner, separate configurable banks and tamper-resistant previews that become immutable snapshots.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-27T14:21:30Z
- **Completed:** 2026-10-27T14:27:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added a fail-closed reviewer guard and middleware coverage for both promotion reviewer routes.
- Added queue projection and typed commands for claim, release, owner force-release, neutral reject, task approval, technical override, early retake release and device reset.
- Added separate ordinary and qualification bank state/CRUD RPCs with inactive items and per-bank quotas.
- Added deterministic manual/random selection, duplicate and insufficiency checks, type-safe answer shapes and ten-minute signed preview tokens.
- Revalidated bank version at confirmation and copied exact task/question content into immutable snapshot tables.

## Task Commits

1. **RED: reviewer and bank contracts** — `b4e6a9b` (test)
2. **Task 1: trusted queue and commands** — `1e61a54` (feat)
3. **Task 2: versioned banks and previews** — `560fc94` (feat)

## Files Created/Modified

- `lib/portia-promotion-reviewer.ts` — access guard, command parser, previews, question validation and signed tokens.
- `lib/portia-promotion-reviewer.test.ts` — guard, command, quota, duplicate, expiry and route tests.
- `app/api/promotion/reviewer/route.ts` — queue reads and reviewer transition commands.
- `app/api/promotion/banks/route.ts` — bank CRUD, preview and immutable confirmation.
- `proxy.ts` — authenticated session refresh coverage for reviewer endpoints.
- `supabase/portia_setup.sql` — canonical queue, approval and bank RPCs.
- `supabase/phase14_apply.sql` — mirrored owner-run migration.
- `lib/portia-promotion-db.test.ts` — privilege and snapshot contract checks.

## Decisions Made

- Device reset is available to any explicitly granted `promo` reviewer and is audit-recorded; force-release remains owner-only in SQL.
- Answer keys appear only in the authenticated bank projection and immutable private snapshot, never in participant DTOs.
- An irreversible ordinary-task approval rechecks current sheet membership and title immediately before the RPC.

## Deviations from Plan

None — implementation follows the planned queue, bank, preview and snapshot boundaries.

## Issues Encountered

- Repository-wide lint retains the same three pre-existing errors outside this plan. All Plan 14-04 files pass scoped ESLint.

## User Setup Required

- None now. SQL recorded, not applied.

## Next Phase Readiness

- Plan 14-05 can render the participant application and ordinary task flow from the stable DTOs.
- Plan 14-06 can render the trusted reviewer workspace over the queue/bank APIs.
- Plan 14-07 can extend the prepared qualification snapshot into the timed participant engine.

## Self-Check: PASSED

- `npm test`: 466/466 passed.
- `npx tsc --noEmit`: passed.
- Scoped ESLint: passed.
- `npm run build`: passed.
- SQL recorded, not applied.

---
*Phase: 14-prilozhenie-povyshenie*
*Completed: 2026-10-27*
