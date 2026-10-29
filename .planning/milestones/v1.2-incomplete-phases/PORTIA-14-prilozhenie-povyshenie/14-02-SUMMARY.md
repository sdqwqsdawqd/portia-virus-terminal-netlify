---
phase: 14-prilozhenie-povyshenie
plan: 02
subsystem: database
tags: [promotion, supabase, rls, rpc, pg-cron, permissions]

requires:
  - phase: PORTIA-12
    provides: trusted-tab grants and owner/editor access helpers
provides:
  - normalized private storage for ordinary promotion tasks and qualification checks
  - atomic device, request, claim, test, close, pruning and cleanup RPC contracts
  - trusted promo tab closed by default and granted separately by the owner
affects: [14-03, 14-04, 14-05, 14-06, 14-07, 14-08, 14-09]

tech-stack:
  added: []
  patterns: [security-definer RPC boundary, conditional claim winner, immutable snapshots, compact three-result history]

key-files:
  created: [supabase/phase14_apply.sql, lib/portia-promotion-db.test.ts]
  modified: [supabase/portia_setup.sql, lib/editor-tabs.ts, lib/editor-tabs.test.ts, lib/editor-access.test.ts]

key-decisions:
  - "All promotion workflow tables deny direct public, anonymous and authenticated access; clients use narrowly granted RPCs."
  - "The promo tab is trusted, absent by default for editors, and available to the owner through the existing owner path."
  - "Phase 14 SQL is recorded but not applied; the owner-run gate remains Plan 14-09."

patterns-established:
  - "Reviewer transitions verify portia_has_tab_grant('promo') inside the database function before mutation."
  - "Closing a workflow writes a compact result, removes live payload and retains the newest three results in one transaction."

requirements-completed: [PROM-04, PROM-05, PERM-01, PERM-02, PERM-03, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06]

duration: 3h 42min
completed: 2026-10-27
---

# Phase 14 Plan 02: Database Contract and Trusted Tab Summary

**Private normalized promotion storage, atomic race-safe workflow RPCs and a trusted «Повышение» tab that is closed until explicitly granted.**

## Performance

- **Duration:** 3h 42min
- **Started:** 2026-10-27T10:28:00Z
- **Completed:** 2026-10-27T14:10:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added separate constrained tables for ordinary requests/tasks and qualification requests/tests, including immutable assignment/question snapshots and private answer keys.
- Added pinned-search-path RPCs for device binding, throttling, submit/claim/release/reject, assignment/test confirmation, the 15-minute test lifecycle, grading, retake control and transactional close.
- Enforced one active request per nickname and kind, one conditional claim winner, three-result history retention, three-day abandoned-data cleanup and seven-day cron-history cleanup.
- Registered `promo` as a trusted tab: regular editors do not receive it by default, granted editors do, and the owner retains the full registry.
- Prepared an owner-only application script with preflight checks, post-apply assertions and manual rollback guidance.

## Task Commits

1. **Task 1 RED: promotion SQL contracts** — `a3d9a5d` (test)
2. **Task 1 GREEN: normalized promotion schema** — `ef458d8` (feat)
3. **Task 2: atomic RPCs and owner-run apply script** — `43895f8` (feat)
4. **Task 3: trusted promotion tab** — `681e75d` (feat)

## Files Created/Modified

- `supabase/portia_setup.sql` — canonical private schema, RPCs, grants and cleanup schedule.
- `supabase/phase14_apply.sql` — owner-run Phase 14 application and verification script.
- `lib/portia-promotion-db.test.ts` — static privacy, transition and migration-contract tests.
- `lib/editor-tabs.ts` — trusted `promo` registry entry.
- `lib/editor-tabs.test.ts` — default-closed, grant-only and parser tests.
- `lib/editor-access.test.ts` — owner, legacy and granted-editor access projections.

## Decisions Made

- Device fingerprints are stored only as hashes and risk buckets; no raw fingerprint or IP is persisted in the public contract.
- Reviewers cannot race successfully for the same request because the claim update requires both `pending` status and no reviewer in one statement.
- Live payload is removed only by the close transaction after the compact result is inserted.
- Cleanup is deliberately status- and age-bounded; destructive rollback is not automated.

## Deviations from Plan

### Auto-fixed Issues

**1. Extended the owner-path test file named by the task behavior**
- **Found during:** Task 3
- **Issue:** The plan listed only `editor-tabs.test.ts`, but proving the existing owner projection requires `editor-access.test.ts`.
- **Fix:** Added explicit owner, legacy-default and granted-editor expectations there.
- **Files modified:** `lib/editor-access.test.ts`
- **Verification:** focused tests and full suite pass.

## Issues Encountered

- Repository-wide lint remains blocked by three pre-existing errors outside this plan: two archived CommonJS scripts and an existing ref access during render in `components/portia-desktop.tsx`. Scoped ESLint for every Plan 14-02 TypeScript file passes.

## User Setup Required

- None now. **SQL recorded, not applied.** The owner applies `supabase/phase14_apply.sql` only at the manual gate in Plan 14-09.

## Next Phase Readiness

- Plan 14-03 can build public status, device binding and request APIs on the stable RPC boundary.
- Plan 14-04 can build reviewer queues and immutable task/test snapshot creation.
- No production database connection or SQL execution occurred.

## Self-Check: PASSED

- All six key files exist and all four task commits are present.
- `npm test`: 444/444 passed.
- `npx tsc --noEmit`: passed.
- Scoped ESLint passed; unrelated repository lint debt is recorded above.
- SQL recorded, not applied.

---
*Phase: 14-prilozhenie-povyshenie*
*Completed: 2026-10-27*
