---
phase: PORTIA-08-sotrudniki-bez-poter-na-ekrane
plan: 01
subsystem: ui
tags: [react, nextjs, localstorage, cdn-cache, employees]
status: complete

requires: []
provides:
  - "mergeEmployeesAnswer: per-flag merge of an /api/employees answer onto the last good list"
  - "public GET /api/employees exposes manualRead beside profilesRead"
  - "Personnel window keeps good biographies, manual employees and avatars on partial reads; degraded answers never reach the device cache"
  - "EmployeeImage reloads on a new src"
affects: [PORTIA-08-02, PORTIA-08-03, PORTIA-08-04]

actuals:
  tokens: 75000
  tasks: 3
  commits: 5
plan_head_before: dbafcadb9dc031464a81008b980cee100be05c75
plan_head_after: 6738626f91fecd96d18235f4f42101e787a7fd53

tech-stack:
  added: []
  patterns:
    - "Refs synced by a no-deps effect so a deps-free useCallback reads the last good list"
    - "Edit counter compared before and after an async fetch (mirrors savesStarted)"
    - "Cache patch helper that never creates a cache"

key-files:
  created: []
  modified:
    - lib/portia-employees.ts
    - lib/portia-employees.test.ts
    - app/api/employees/route.ts
    - components/portia-desktop.tsx

key-decisions:
  - "Merge decides per flag (profilesRead, manualRead, Roblox fields), never by degraded alone; every trusted flag is tested with === true"
  - "Only degraded === false answers are cacheable; editor callbacks patch cached.employees and write nothing when no cache exists"
  - "A poll that started before a local save or delete is dropped via the employeeEdits counter"
  - "EmployeeImage wrapper keyed on src instead of a reset effect"

requirements-completed: [EMP-06, EMP-07]

duration: 3 min
completed: 2026-10-20

coverage:
  - id: D1
    description: "Profiles not read: last good biography, photo and ratings stay; answer's title/rank/order win; not cached"
    requirement: EMP-06
    verification:
      - kind: unit
        ref: "lib/portia-employees.test.ts#mergeEmployeesAnswer: profiles not read keep the last good biography, photo and ratings"
        status: pass
    human_judgment: false
  - id: D2
    description: "Manual employees and Roblox id/avatars survive a partial read; a read manual deletion propagates"
    requirement: EMP-06
    verification:
      - kind: unit
        ref: "lib/portia-employees.test.ts#mergeEmployeesAnswer: manual employees not read stay from the last good list"
        status: pass
      - kind: unit
        ref: "lib/portia-employees.test.ts#mergeEmployeesAnswer: without Roblox data the previous avatars and Roblox id stay"
        status: pass
    human_judgment: false
  - id: D3
    description: "Device cache written only for complete answers; editor save/delete patch the cache; stale poll ignored; first-visit card text"
    requirement: EMP-06
    verification:
      - kind: other
        ref: "grep acceptance criteria + npx tsc --noEmit + npm run build (no component test harness)"
        status: pass
    human_judgment: true
    rationale: "Desktop wiring has no component tests; the browser check is plan 08-04"
  - id: D4
    description: "A corrected photo URL loads at once in the Personnel window"
    requirement: EMP-07
    verification:
      - kind: other
        ref: "grep key={props.src}; tsc; eslint; build"
        status: pass
    human_judgment: true
    rationale: "Image remount is observable only in a browser; checked in 08-04"
---

# Phase 8 Plan 01: Employees without losses on screen Summary

**Per-flag merge of /api/employees answers (mergeEmployeesAnswer) so a partial read keeps good profiles, manual employees and Roblox avatars on screen and out of the device cache, plus a src-keyed photo remount.**

## Performance

- **Duration:** about 3 min of commits (first commit 12:02 +05:00); 3 tasks, 4 files
- **Completed:** 2026-10-20

## Accomplishments

- `mergeEmployeesAnswer` (lib): complete answer replaces the list and is cacheable; otherwise profiles are carried only when `profilesRead !== true`, manual employees are carried when `manualRead !== true`, Roblox id and avatars are kept when the answer has none; matching is by id then nickname.
- Public GET now answers `manualRead` beside `profilesRead`; CDN headers unchanged.
- `fetchEmployees` merges through refs, writes localStorage only for a cacheable answer, and drops an answer older than a local editor save or delete (`employeeEdits`).
- `updateEmployee` / `removeEmployee` patch the cached list through `patchEmployeesCache`; no cache means no write.
- First visit with profiles unread shows «Профиль временно не загрузился.» and hides the ratings block; an old cache without the flag counts as read.
- `EmployeeImage` is a `key={props.src}` wrapper over `EmployeeImageInner`, so a corrected URL starts a fresh load even after a failure.

## Task Commits

1. Task 1 (tracer) RED: `077a35d` test; GREEN: `a6849de` fix (profiles not read)
2. Task 2 RED: `d92b4fa` test; GREEN: `36abe03` fix (manual, Roblox, editor callbacks, poll guard)
3. Task 3: `6738626` fix (photo remount)

## Deviations from Plan

None - plan executed exactly as written. (Tasks 1 and 2 were committed as a RED test commit then a GREEN fix commit per the TDD reference, instead of the single commit the plan text names; the fix commit messages are the planned ones.) Task 2's nickname match was written in the shared match step, which Task 1's id-only version lacked.

**Total deviations:** 0 auto-fixed.

## Verification

- `npm test`: 246 pass, 0 fail (baseline 234)
- `npx tsc --noEmit`: clean
- `npx eslint app lib components`: 0 errors, 14 warnings (same as baseline)
- `npm run build`: passes
- All task acceptance greps pass (`<EmployeeImage ` occurs 3 times; `grep -c` shows 2 lines because two sit on one line)

## Known Stubs

None.

## Threat Flags

None. `manualRead` is a boolean about read success (T-08-04, accepted).

## Issues Encountered

None. Accepted residual from the plan: a cache written before this phase from a degraded answer is trusted on boot until the next complete answer.

## Next Phase Readiness

Ready for 08-02. Browser confirmation of the first-visit text, cache behavior and photo reload belongs to 08-04.

## Self-Check: PASSED

- FOUND: lib/portia-employees.ts, lib/portia-employees.test.ts, app/api/employees/route.ts, components/portia-desktop.tsx
- FOUND commits: 077a35d, a6849de, d92b4fa, 36abe03, 6738626
