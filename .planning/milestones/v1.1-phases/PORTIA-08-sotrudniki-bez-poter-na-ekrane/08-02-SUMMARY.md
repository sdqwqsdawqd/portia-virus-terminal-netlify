---
phase: PORTIA-08-sotrudniki-bez-poter-na-ekrane
plan: 02
subsystem: ui
tags: [react, nextjs, cdn-cache, employees, editor]
status: complete

requires:
  - phase: PORTIA-08-sotrudniki-bez-poter-na-ekrane
    provides: "08-01 manualRead flag on the public employees answer and per-flag merge helpers"
provides:
  - "GET /api/employees/editor: editor-gated, never cached, same body as the public GET"
  - "acceptsEditorList, changedFields, changedDetails; profileOf keeps a missing rating missing"
  - "EmployeeProfilesEditor with its own load state and ПОВТОРИТЬ, diff-only PATCH body, list column and add form that survive an empty list"
affects: [PORTIA-08-03, PORTIA-08-04]

actuals:
  tokens: 6000
  tasks: 3
  commits: 3
plan_head_before: 6f6afc066962b33e262ac85841035516e849e7fc
plan_head_after: 084e30a4ff1b0b4f946a9ef1dada6ce43114080b

tech-stack:
  added: []
  patterns:
    - "Separate never-cached path for editor reads so a CDN copy of the public path cannot seed drafts"
    - "Diff-only PATCH body; a clean save sends nothing"

key-files:
  created:
    - app/api/employees/editor/route.ts
  modified:
    - lib/portia-employees.ts
    - lib/portia-employees.test.ts
    - components/portia-editor.tsx

key-decisions:
  - "The editor accepts a list only when profilesRead === true (a missing flag rejects); an empty list is accepted so EMP-08 works"
  - "Load error and save error are separate states: loadState replaces the tab, state stays on the save line"
  - "A clean save returns true without a request or a СОХРАНЕНО flash"
  - "Handlers openEmployee..removeSelected stay below the loading/error early returns (plain functions, null-safe) instead of being moved"

requirements-completed: [EMP-02, EMP-08]

coverage:
  - id: D1
    description: "Editor list gate: only profilesRead true is accepted, empty list allowed"
    requirement: EMP-02
    verification:
      - kind: unit
        ref: "lib/portia-employees.test.ts#acceptsEditorList: only a list with profilesRead true is accepted"
        status: pass
    human_judgment: false
  - id: D2
    description: "Editor route answers 403 with no-store to an anonymous caller"
    requirement: EMP-02
    verification:
      - kind: other
        ref: "curl http://localhost:3123/api/employees/editor -> 403, cache-control: no-store"
        status: pass
    human_judgment: false
  - id: D3
    description: "Diff-only save body; missing rating never sent as null; profileOf keeps missing missing"
    requirement: EMP-02
    verification:
      - kind: unit
        ref: "lib/portia-employees.test.ts#changedFields: only changed keys are sent, a missing rating is never sent as null"
        status: pass
      - kind: unit
        ref: "lib/portia-employees.test.ts#changedDetails: only the changed title, rank or callsign"
        status: pass
      - kind: unit
        ref: "lib/portia-employees.test.ts#profileOf keeps a missing rating missing (D-11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ПОВТОРИТЬ reloads in place; list column and add form render with an empty list and after deleting the last person; first added person opens"
    requirement: EMP-08
    verification:
      - kind: other
        ref: "grep acceptance criteria + tsc + eslint (0 errors) + npm run build"
        status: pass
    human_judgment: true
    rationale: "No component test harness; browser check (incl. phone layout) is plan 08-04"
---

# Phase 8 Plan 02: Editor reads a complete list and sends only changes Summary

**The employees editor now loads from a never-cached, editor-only route, rejects any list whose profiles were not fully read (with an in-place ПОВТОРИТЬ), saves only the fields it changed, and keeps the list column and add form available when the roster is empty.**

## Accomplishments

- `GET /api/employees/editor`: access check first (403 `Нет доступа к редактору.`), then `loadEmployees`; `noStoreHeaders` on 200, 403 and 502; only a GET handler.
- `acceptsEditorList` replaces the old `profilesRead === false` check, so an old cached copy with no flag is also refused.
- `EmployeeProfilesEditor`: `loadState/loadError/loadAttempt` and `retryLoad`; load error pane with «ПОВТОРИТЬ» (and «ВОЙТИ СНОВА» on session expiry); save `state` no longer carries `loading`.
- `changedFields` / `changedDetails`; the PATCH body is `{ id, nickname, changes, details? }` with changed keys only; nothing changed means no request. `profileOf` no longer turns a missing rating into `null`.
- Empty list: the empty-selection early return is gone; the profile pane shows «Сотрудников пока нет. …», the list column and «+ ВНЕ ТАБЛИЦЫ» stay; the first added person opens; removing the last person closes the record view so a phone sees the list.

## Task Commits

1. Task 1 (tracer): `5c3ed46` - editor-only uncached route, `acceptsEditorList`, load state and ПОВТОРИТЬ
2. Task 2: `8bce191` - diff-only save (`changedFields`, `changedDetails`, `profileOf`)
3. Task 3: `084e30a` - empty-list layout (EMP-08)

Tests for Tasks 1 and 2 were written first and run red (missing export) before the implementation.

## Deviations from Plan

None - plan executed as written, with two notes:

- Tasks 1 and 2 were each committed as one commit (tests plus code), matching the plan's commit instructions.
- The acceptance grep `grep -c "if (!selected || !draft) return"` prints 1, not 0: the remaining match is the guard inside `save()` (`return false`), which pre-existed and is correct. The removed JSX early return is gone (`В таблице пока нет` count 0).
- The plan suggested moving `openEmployee`..`removeSelected` above the early returns; they are plain functions and now null-safe, so they stayed in place to keep the diff small.

## Verification

- `npm test`: 250 pass, 0 fail
- `npx tsc --noEmit`: clean
- `npx eslint app lib components`: 0 errors, 14 warnings (same as baseline)
- `npm run build`: exit 0
- Anonymous `curl /api/employees/editor` on the dev server (port 3123, already running): 403 with `cache-control: no-store` and `netlify-cdn-cache-control: no-store`
- No sheet employee was saved and `PUT /api/content` was not called (D-03).

## Known Stubs

None.

## Threat Flags

None. The new route is covered by T-08-05..T-08-09 in the plan.

## Issues Encountered

None. Accepted per plan: with `manualRead` false the editor list can silently lack people outside the sheet (nothing destroyed; POST/DELETE re-check on the server).

## Next Phase Readiness

Ready for 08-03 (save answer handling). Browser confirmation of ПОВТОРИТЬ, empty-list and phone behavior is in 08-04.

## Self-Check: PASSED

- FOUND: app/api/employees/editor/route.ts, lib/portia-employees.ts, lib/portia-employees.test.ts, components/portia-editor.tsx
- FOUND commits: 5c3ed46, 8bce191, 084e30a
