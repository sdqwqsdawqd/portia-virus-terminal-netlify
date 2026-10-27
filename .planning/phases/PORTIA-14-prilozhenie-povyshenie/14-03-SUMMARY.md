---
phase: 14-prilozhenie-povyshenie
plan: 03
subsystem: api
tags: [promotion, device-binding, hmac, rate-limit, next-routes]

requires:
  - phase: 14-01
    provides: live roster loader and eligibility rules
  - phase: 14-02
    provides: private tables and atomic RPC boundary
provides:
  - safe anonymous promotion status projection with immediate roster recheck
  - atomic first-request device binding and request creation
  - keyed coarse IP/client buckets with 5/15/60-minute conflict waits
affects: [14-05, 14-07, 14-09, 14-10]

tech-stack:
  added: []
  patterns: [opaque HttpOnly credential, keyed risk buckets, explicit public DTO, pending-database compatibility]

key-files:
  created: [lib/portia-device-binding.ts, lib/portia-promotion-api.ts, app/api/promotion/status/route.ts, app/api/promotion/requests/route.ts]
  modified: [supabase/portia_setup.sql, supabase/phase14_apply.sql, .env.example]

key-decisions:
  - "Nickname lookup never binds; only the same transaction that creates the first accepted request may create a device binding."
  - "A full browser reset plus network change cannot be made impossible; protection layers opaque cookies, keyed coarse signals and reviewer reset."
  - "Before owner SQL rollout, public routes answer pending-database and never fake a successful request."

patterns-established:
  - "Every participant action rechecks the live A61:E85 roster before reading or mutating workflow state."
  - "Public promotion responses are hand-built projections and never wildcard-select private rows."

requirements-completed: [PROM-01, TASK-08, RETRY-01]

duration: 10 min
completed: 2026-10-27
---

# Phase 14 Plan 03: Public Status, Device Binding and Requests Summary

**Anonymous nickname status and request endpoints with atomic first binding, neutral device conflicts and no private workflow leakage.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-27T14:11:00Z
- **Completed:** 2026-10-27T14:21:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added a cryptographically random opaque device token, keyed token digest, secure year-long HttpOnly cookie and bounded coarse IP/client buckets.
- Added safe status and request services plus force-dynamic, no-store route handlers.
- Enforced live roster membership, ordinary/qualification eligibility, active-request conflicts, sheet-change lock and retake dates before submission.
- Made first device binding and request creation one database transaction; retries during an active penalty do not restart its timer.
- Added a security-definer public projection RPC returning only active state, qualification flag and three compact results.

## Task Commits

1. **Task 1 RED: device binding contracts** — `f110d77` (test)
2. **Task 1 GREEN: private binding helpers** — `a290199` (feat)
3. **Task 2 RED: public API contracts** — `57ec471` (test)
4. **Task 2 GREEN: safe status/request APIs and atomic SQL** — `eb6026d` (feat)

## Files Created/Modified

- `lib/portia-device-binding.ts` — token, cookie, HMAC and coarse risk helpers.
- `lib/portia-device-binding.test.ts` — binding, cookie and penalty tests.
- `lib/portia-promotion-api.ts` — explicit DTOs, eligibility and Supabase RPC adapter.
- `lib/portia-promotion-api.test.ts` — outage, leak, conflict, cooldown, retake and first-bind tests.
- `app/api/promotion/status/route.ts` — no-store nickname status endpoint.
- `app/api/promotion/requests/route.ts` — no-store request endpoint and cookie issuance.
- `supabase/portia_setup.sql` — atomic bind-submit, safe status projection and non-extending throttle.
- `supabase/phase14_apply.sql` — mirrored owner-run SQL.
- `lib/portia-promotion-db.test.ts` — new RPC/privacy assertions.
- `.env.example` — required keyed device secret placeholder.

## Decisions Made

- Invalid/missing device cookies are treated as absent; a previously bound nickname then fails neutrally rather than being rebound.
- IP is reduced to a coarse network before keyed hashing; raw IP, browser signal and token are neither stored nor returned by route code.
- Expired failed qualification state permits a new request; a future retake date returns a conflict with only that safe date.

## Deviations from Plan

### Auto-fixed Issues

**1. Completed the atomic bind-submit and public-read database boundary**
- **Found during:** Task 2
- **Issue:** The initial Plan 14-02 SQL had separate bind/submit calls and no safe anonymous projection, so the route could not meet the atomicity and no-direct-table-access contracts.
- **Fix:** Extended both canonical and owner-run SQL with one atomic bind-submit RPC, a safe projection RPC and non-extending penalty behavior.
- **Files modified:** `supabase/portia_setup.sql`, `supabase/phase14_apply.sql`, `lib/portia-promotion-db.test.ts`
- **Verification:** SQL contract tests and full suite pass.

**2. Documented the required HMAC secret**
- **Found during:** Task 1
- **Issue:** Device/IP digests require a server-only deployment secret.
- **Fix:** Added `PORTIA_PROMOTION_DEVICE_SECRET` to `.env.example`; missing configuration fails closed with 503.
- **Files modified:** `.env.example`

## Issues Encountered

- Repository-wide lint still reports the same three pre-existing errors outside this plan. Every Plan 14-03 TypeScript/route file passes scoped ESLint.

## User Setup Required

- At rollout, set a random server-only `PORTIA_PROMOTION_DEVICE_SECRET` of at least 32 characters. No action is needed yet; rollout remains Plan 14-09.
- SQL recorded, not applied.

## Next Phase Readiness

- Reviewer queue APIs can consume the normalized request rows and atomic claim functions in Plan 14-04.
- Participant UI can consume the stable safe DTO in Plan 14-05.

## Self-Check: PASSED

- `npm test`: 458/458 passed.
- `npx tsc --noEmit`: passed.
- Scoped ESLint and route privacy check passed.
- SQL recorded, not applied.

---
*Phase: 14-prilozhenie-povyshenie*
*Completed: 2026-10-27*
