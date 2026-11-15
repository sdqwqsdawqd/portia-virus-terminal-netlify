---
phase: PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische
plan: 03
subsystem: api
tags: [nextjs, supabase-rpc, access-gate, no-store, server-cache, google-sheets, roblox]
status: complete

requires:
  - phase: PORTIA-25 plan 01
    provides: readContentRow pattern, signServerRead, ServerReadError, resolveGateFor, portia_employees_read (expand migration)
provides:
  - "GET /api/employees by viewer: resolveGateFor -> viewerOf -> 401 contentAccessRequired | readEmployeeRows -> loadEmployeesFromRows, every answer no-store, no cache tag"
  - "lib/server-read.ts: readEmployeeRows(viewer, clients, options) -> { profiles, manual }"
  - "lib/portia-employees.ts: profileIndexFromRows, manualRowsFromRows, loadEmployeesFromRows(rows | null), one shared roster build with loadEmployees"
  - "lib/employees-snapshot-cache.ts: createSnapshotCache, employeesSnapshot, resetEmployeesSnapshot (5 min complete / 30 s incomplete, one load for concurrent requests)"
affects: [25-04 contract migration, 25-07 owner checklist and poll budget, 25-10 security matrix and supabase-rls-reviewer]

actuals:
  tokens: 10700
  tasks: 2
  commits: 2
plan_head_before: d61cb0adfe35174101c9c2dd69ce8ad9726a8e4a
plan_head_after: 58262812b6765579a6369ce1f17a89eaabbf6463
commits: 2

tech-stack:
  added: []
  patterns:
    - "The roster build lives in one assembleEmployees(rows, roblox, profiles, manual); the editor read (loadEmployees, live Sheets and Roblox) and the viewer read (loadEmployeesFromRows, snapshot) differ only in where the inputs come from"
    - "The shared snapshot holds only the sheet rows and the Roblox map; stored profiles and manual rows are read per request through the signed function"
    - "A refused or failed signed read degrades like the old failed profile read: list from the sheet, degraded true, profilesRead false, manualRead false; only the kind is logged"

key-files:
  created:
    - lib/employees-snapshot-cache.ts
    - lib/employees-snapshot-cache.test.ts
    - lib/phase25-employees-route.test.ts
  modified:
    - app/api/employees/route.ts
    - lib/server-read.ts
    - lib/server-read.test.ts
    - lib/portia-employees.ts
    - lib/portia-employees.test.ts
    - proxy.ts

key-decisions:
  - "Editor paths (GET /api/employees/editor, POST, DELETE through loadEmployees) keep reading Sheets and Roblox live and the tables with the editor session; only the viewer GET uses the snapshot, so an editor never sees a 5-minute-old sheet"
  - "The snapshot loader resolves Roblox for the sheet nicknames (read with an empty id map) plus the manual nicknames of the request that fills it; a manual employee added later has an empty avatar until the next snapshot or the writer's reset"
  - "Gate failure is a 503 and a Sheets failure is a 502, both no-store: two separate try blocks inside GET"
  - "Writes keep purgeCacheTag(employeesCacheTag) for one release and call resetEmployeesSnapshot() after it; the refusal order is unchanged"

requirements-completed: []  # SEC-01 and SEC-02 are not checked off: contract migration (25-04), live CDN headers/Cache-Status, the owner purge by tag and Postgres/RLS execution are BLOCKED here

duration: about 25 min (not timed by a clock)
completed: 2026-11-15

coverage:
  - id: D1
    description: "GET /api/employees decides the viewer by the gate before any read; a closed site without access is a 401 contentAccessRequired before Sheets, Roblox or the database"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/phase25-employees-route.test.ts#GET /api/employees: the gate decides the viewer before any read, a closed site without access is a 401"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every GET answer is no-store with no cache tag and no public cache helper; the file no longer imports the helper"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "lib/phase25-employees-route.test.ts#GET /api/employees: every answer is no-store, no shared cache helper, no tag"
        status: pass
    human_judgment: true
    rationale: "Source text only. The real CDN headers and Cache-Status on Netlify are BLOCKED (owner step)."
  - id: D3
    description: "readEmployeeRows: signed call for a visitor, session call without signature or secret for an editor, updated_by dropped, unauthorized and unavailable kinds, empty lists healthy"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/server-read.test.ts#readEmployeeRows (5 cases)"
        status: pass
    human_judgment: true
    rationale: "Offline contract with a fake client. Execution of portia_employees_read on Postgres/RLS and with real roles is BLOCKED."
  - id: D4
    description: "loadEmployeesFromRows gives the same list as loadEmployees from the same rows; empty lists are a healthy read; null is the old degradation; a failing sheet throws"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/portia-employees.test.ts#loadEmployeesFromRows (4 cases) and profileIndexFromRows/manualRowsFromRows"
        status: pass
    human_judgment: false
  - id: D5
    description: "Server snapshot: TTL 5 min / 30 s, one load for concurrent requests, errors not cached, reset also drops a waiting load, three viewers cost one sheet read and keep their own profiles"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "lib/employees-snapshot-cache.test.ts"
        status: pass
    human_judgment: true
    rationale: "TTL values are [ASSUMED] (A6): the limits of Google Sheets and Roblox were not measured, and the behavior on a real Netlify instance is BLOCKED."
  - id: D6
    description: "Editor writes keep the session client and the purge for one release and reset the instance snapshot after the refusal checks"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "lib/phase25-employees-route.test.ts#editor writes keep the session client, their purge for one release, and reset the server snapshot after the purge"
        status: pass
    human_judgment: false
---

# Phase 25 Plan 03: Employees list by viewer, signed read, server snapshot Summary

**GET /api/employees now goes through the same gate as /api/content, reads profiles and manual employees through the signed `portia_employees_read`, answers `no-store` for every viewer, and shields Google Sheets and Roblox with a 5 min / 30 s in-memory snapshot.**

## Accomplishments

- Tracer (D-23): the closed site refuses an unadmitted caller with 401 `contentAccessRequired` before any read; a visitor reads with the public client plus the `employees-read-v1|<issuedAt>` signature, an editor with the session and no signature; a failed or refused read gives the old degraded list from the sheet (`degraded: true`, `profilesRead: false`, `manualRead: false`) with only the failure kind in the log.
- `readEmployeeRows` validates the reply (`profiles` and `manual` arrays of objects) and removes `updated_by` in TypeScript as a second line behind the SQL projection.
- `profileIndexFromRows`, `manualRowsFromRows` and `loadEmployeesFromRows` share one `assembleEmployees` with the editor's `loadEmployees`; `loadEmployeesFromRows` equals `loadEmployees` on the same rows (test).
- `lib/employees-snapshot-cache.ts`: `createSnapshotCache` with TTL, shorter TTL for an incomplete snapshot, a shared promise for concurrent requests, no caching of errors, generation guard so a load that finishes after `reset()` cannot refill the cache.
- Editor PATCH/POST/DELETE reset the snapshot of their instance after `purgeCacheTag(employeesCacheTag)`; the stale CDN comments in `proxy.ts` and `lib/portia-employees.ts` are replaced.

## Task Commits

1. Task 1 (tracer): `4ab2ed9` feat(PORTIA-25-03): employees list by viewer through the gate and the signed read, no-store
2. Task 2: `5826281` feat(PORTIA-25-03): server snapshot of Google Sheets and Roblox for the employees list (D-23)

Tracer feedback gate: the tracer's `<verify>` (six test files and `tsc --noEmit`) was re-run after the commit and passed; log: tracer verified end-to-end, expanding.

## Decisions Made

See `key-decisions` above. The notable one is that the editor path stays live: `loadEmployees` does not use the snapshot, so `lib/portia-employees.ts` has `employeesSnapshot(` only in `loadEmployeesFromRows`. The plan text said both loaders take the snapshot; the plan's own wording for the editor ("paths ... still read and write the tables with the session client") and the editor route's documented purpose ("every call reaches Sheets and Roblox") point the other way, and the snapshot would have made the editor see a sheet up to 5 minutes old.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing snapshot-sensitive tests needed a reset**
- **Found during:** Task 2
- **Issue:** The snapshot is a module singleton, so the four new `loadEmployeesFromRows` tests written in Task 1, each with a different stubbed sheet, would have read each other's snapshot.
- **Fix:** each of them calls `resetEmployeesSnapshot()` first and in `t.after`.
- **Files modified:** `lib/portia-employees.test.ts`
- **Commit:** `5826281`

**2. [Rule 1 - Bug] Test generics**
- **Found during:** Task 2 (`tsc --noEmit`)
- **Issue:** `createSnapshotCache({...})` without a type argument inferred only `{ complete: boolean }`, so `.n` in the tests did not type-check.
- **Fix:** an explicit `Entry` type in `lib/employees-snapshot-cache.test.ts`.
- **Commit:** `5826281`

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), both test-only. **Impact:** none on behavior.

Departures from the letter of the plan, not rule-driven:
- `lib/access-foundation.test.ts` needed no change (step 4 of Task 1 was conditional): the route imports only `gate-for-request`, `access-viewer`, `content-response`, `server-read` and the snapshot module, none of which match the forbidden patterns.
- `loadEmployees` (editor) stays off the snapshot, see Decisions Made.
- `app/api/employees/editor/route.ts` line 9 still says "The public /api/employees is CDN-cached by path". It is not in this plan's file list and was left untouched; the comment is stale now (see Deferred Items).

## Authentication Gates

None.

## Verification

- Red-window gate (`node --experimental-strip-types --test --test-skip-pattern=... lib/*.test.ts`): 2163 tests, 2160 pass, 0 fail, 3 skipped (the two 25-01 skip patterns apply; the third skip was not investigated). Run before the last test-only type fix in `lib/employees-snapshot-cache.test.ts`; the affected four files were re-run afterwards (133 pass, 0 fail).
- `node node_modules/typescript/bin/tsc --noEmit`: 0 errors.
- ESLint over the repo: 0 errors (17 pre-existing warnings, all in untracked `tests/e2e/visual-candidates/.runs`, not touched). `npm` itself was not used (temp Node 22.13.1 lacks node-gyp); tools were run directly.
- Acceptance greps: `publicCacheHeaders` in the route 0; `resolveGateFor(` 1; `contentAccessRequired` 2; `export async function readEmployeeRows` 1; `purgeCacheTag(employeesCacheTag)` 3; `resetEmployeesSnapshot()` 3; `export function createSnapshotCache` 1; "the CDN caches the API response" 0; "still CDN-cached" 0.

## BLOCKED (not proved, not recorded as pass)

- Live CDN headers and `Cache-Status` on Netlify, and the owner purge by tags `portia-content` and `portia-employees` (D-07, plan 25-07 checklist). The agent did not call the Netlify API.
- Execution of `portia_employees_read` on Postgres/RLS with real roles; authenticated and visitor roles end to end.
- Behavior of the snapshot on a real function instance, and the limits of Google Sheets and Roblox (A6, TTL values `[ASSUMED]`; to be written into 25-POLL-BUDGET.md by plan 25-07).
- schema push: BLOCKED — owner step. This plan changes no `supabase/*.sql`, RLS, RPC or storage policy; plan 25-10 runs `supabase-rls-reviewer` over the phase.

## Known Stubs

None.

## Threat Flags

None. The new surface (the viewer GET and the in-memory snapshot) is exactly T-25-11..T-25-14 of the plan's threat model; all four are mitigated in code and covered by offline tests, with the live parts BLOCKED as above.

## Deferred Items

- `app/api/employees/editor/route.ts:9` comment ("The public /api/employees is CDN-cached by path ...") is stale after this plan; reword in a later plan that touches the file (comment only).
- The one-release `purgeCacheTag(employeesCacheTag)` in the three writes is intentionally kept; removing it is a later-release decision (D-07 / Discretion).

## Self-Check: PASSED

- Files present: `lib/employees-snapshot-cache.ts`, `lib/employees-snapshot-cache.test.ts`, `lib/phase25-employees-route.test.ts` (checked below with `[ -f ]`).
- Commits `4ab2ed9` and `5826281` are ancestors of HEAD.
