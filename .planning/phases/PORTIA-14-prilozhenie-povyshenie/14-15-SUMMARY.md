---
phase: 14-prilozhenie-povyshenie
plan: 15
subsystem: promotion-api-database
tags: [supabase, rpc, device-binding, atomic-admission, live-preflight]
requires:
  - phase: 14-13
    provides: reviewed participant and reviewer Promotion UI
provides:
  - read-only nickname lookup with device cookie issued only after accepted first submission
  - typed rollout, database and malformed-contract failures for participant routes
  - deployed inventory proof for all 18 RPC signatures used by participant, reviewer and bank routes
  - atomic SQL ordering that refuses duplicate requests before creating or replacing a device binding
affects: [14-16, 14-19, 14-14]
tech-stack:
  added: []
  patterns: [accepted-write-cookie, typed-rpc-failure, read-only-live-preflight, atomic-binding-and-request]
key-files:
  created: []
  modified: [lib/portia-promotion-api.ts, lib/portia-promotion-api.test.ts, lib/portia-promotion-live.test.ts, lib/portia-promotion-security.test.ts, app/api/promotion/status/route.ts, supabase/phase14_apply.sql, supabase/portia_setup.sql]
key-decisions:
  - "Nickname lookup remains read-only; a fresh device token is persisted only after the atomic submit RPC returns created."
  - "Public failures distinguish missing rollout, temporary database failure and malformed RPC projection without exposing database internals."
  - "Because no isolated Supabase project exists, production received only read-only RPC inventory checks; mutating round-trip evidence is deferred to owner UAT rather than faked on live data."
requirements-completed: [PROM-01, PROM-03, PROM-04, PROM-05, COOL-05, DATA-02, DATA-06]
duration: 9 min
completed: 2026-10-28
---

# Phase 14 Plan 15: Live Request and Device-Binding Contract Summary

**First-request admission now owns both request creation and device-cookie persistence, with typed rollout failures and synchronized atomic SQL deployed by the owner.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-28T16:46:40Z
- **Completed:** 2026-10-28T16:55:38Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Reversed the broken token lifecycle: a status lookup no longer writes a cookie, while an accepted first request creates one token, submits its digest atomically and returns the HttpOnly cookie exactly once.
- Added safe API distinctions for missing/mismatched RPC rollout, transient database failure and invalid RPC projection; rejected paths never return a new cookie.
- Added a deployed, non-skipped read-only preflight that confirmed all 18 RPC signatures required by participant, reviewer and bank routes after the owner migration.
- Extended the guarded isolated-project suite with first submit, token restore, same-device other-nickname refusal and parallel-submit assertions.
- Moved the active-request check before the device-binding insert in both canonical SQL sources, then the owner applied the idempotent migration successfully (`Success. No rows returned`).

## Task Commits

1. **Task 1 RED: expose first-request binding regressions** — `51014ba` (test)
2. **Task 1 GREEN: bind only after accepted request** — `08f0498` (fix)
3. **Task 2 RED: require deployed participant round trip** — `94c0073` (test)
4. **Task 3: prevent rejected submits from binding** — `e037151` (fix)

## Files Created/Modified

- `lib/portia-promotion-api.ts` — read-only lookup, accepted-submit cookie and typed RPC failure mapping.
- `lib/portia-promotion-api.test.ts` — first-submit, rejection and failure-category regressions.
- `lib/portia-promotion-live.test.ts` — 18-signature preflight and guarded isolated participant round trip.
- `lib/portia-promotion-security.test.ts` — binding-order transaction assertion.
- `app/api/promotion/status/route.ts` — status route no longer emits a device cookie.
- `supabase/phase14_apply.sql` — owner-run binding-order repair.
- `supabase/portia_setup.sql` — canonical schema synchronized with the repair.

## Decisions Made

- Device identity is represented by a candidate token only in memory until the submit RPC returns `created`; all other outcomes discard it.
- A missing test project does not authorize temporary production fixtures. The production check is read-only and the remaining end-to-end write proof stays visible for final owner UAT.

## Deviations from Plan

### Owner-approved safe fallback

**1. [Environment constraint] Isolated mutating live suite could not run**
- **Found during:** Task 2 (deployed contract gate)
- **Issue:** No isolated Supabase test project or service-role credentials exist, and Docker/Supabase local runtime is unavailable.
- **Resolution:** Ran a non-skipped read-only preflight against the deployed project, retained the complete mutation suite behind `ISOLATED_TEST_PROJECT`, and deferred its behavioral proof to owner UAT. No production fixture or real employee was mutated.
- **Verification:** 18/18 deployed route RPC signatures passed; owner migration returned `Success. No rows returned`; 42/42 targeted API/database/security tests passed.

---

**Total deviations:** 1 environment-constrained fallback. **Impact:** Static, unit and deployed-signature evidence is complete; the first real accepted submit and restore still require explicit owner UAT in Plan 14-14.

## Issues Encountered

- The original tests encoded the inverse lifecycle (cookie on lookup, existing cookie required for first submit). TDD exposed and corrected it.
- Canonical SQL inserted the binding before returning `active-request`; the order was repaired so rejected duplicates cannot create or replace bindings.

## User Setup Required

None. The owner applied the reviewed SQL migration successfully.

## Verification

- `node --experimental-strip-types --test lib/portia-promotion-api.test.ts lib/portia-promotion-db.test.ts lib/portia-promotion-security.test.ts`: 42/42 passed.
- `npm run test:promotion-live` with `READ_ONLY_PREFLIGHT`: 1/1 passed, 18 deployed signatures checked, no skip.
- `npx tsc --noEmit`: passed.
- Full isolated mutation suite: not run because no isolated project exists; production mutation was intentionally refused.

## Next Phase Readiness

- Typed request outcomes and accepted-submit binding are ready for participant UI remediation in 14-16.
- Plan 14-14 must include the first real owner-approved request, reload restore and safe different-nickname refusal before milestone closure.

## Self-Check: PASSED

All code, canonical SQL, deployed read-only inventory and owner migration checks passed. The unavailable isolated mutation proof is explicitly preserved as final owner UAT and is not represented as automated evidence.

---
*Phase: 14-prilozhenie-povyshenie*
*Completed: 2026-10-28*
