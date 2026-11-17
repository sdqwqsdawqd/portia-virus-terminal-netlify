---
phase: PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json
plan: 03
subsystem: api
tags: [employees, patch, partial-upsert, sheet-check, manual-details]
requires: ["07-01", "07-02"]
provides:
  - "PATCH /api/employees writes only the sent fields (absent = unchanged, null/empty clears a rating, wrong type = 400)"
  - "Known ids (profile row or manual row) save with zero network calls"
  - "A never-saved sheet newcomer is checked against the Google Sheet only, by nickname; sheet down = 503; legacy nick- profile seeds the first row"
  - "Manual details (title, rank, callsign) follow the same partial rule, are written first and restored if the profile write fails"
  - "PATCH answer is the stored profile; the editor merges it onto its card"
affects: [PORTIA-07 plan 07-04 (live check of the upsert conflict branch, A1), Phase 8 client]
status: complete
commits: 3
plan_head_before: b93e97b6e040c851086b272b164517df8ec2bb25
plan_head_after: 9c9e13bf5d58fd4c5f4ac2d8ee25580ba236a843
actuals:
  tokens: 30000
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: ["status union from lib mapped once by a refusals table in the route", "fake db router (fakeDb) with per-table fakes and a stubbed fetch"]
key-files:
  created: []
  modified: [lib/portia-employees.ts, lib/portia-employees.test.ts, app/api/employees/route.ts, components/portia-editor.tsx]
key-decisions:
  - "knowledge_rating is never read from a request or written by a save (D-01)"
  - "Newcomer path: the PATCH body carries an optional nickname; the server accepts it only if it is a sheet nickname and the id is roblox-<digits> or that nickname's nick- id; Roblox is never called (orchestrator default, owner may override)"
  - "No locking or version check: concurrent saves stay last-write-wins (D-02)"
  - "Manual details are written before the profile; a failed profile write restores only the changed keys; a failed restore is logged only (no RPC without new SQL, D-08)"
requirements-completed: [EMP-01, EMP-03, EMP-04]
---

# Phase 07 Plan 03: Server-side employee save Summary

PATCH now saves only the fields it was sent, with no Google Sheet or Roblox call for any employee the database already knows, and keeps manual-employee details and profile all-or-nothing.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 (tracer) | Partial sanitize and upsert returning the stored row, `findKnownEmployee`, `saveEmployeePatch`, thin PATCH without the roster, editor merge | d3bfdd9 |
| 2 | Sheet-only newcomer check (`fetchSheetRows`), 503 on a dead sheet, legacy `nick-` seed | 05342e8 |
| 3 | `clip64`, partial `sanitizeManualDetails`, `updateManualEmployee(id, details)`, details-first save with restore | 9c9e13b |

## Verification

- RED seen first for each task (task 1: missing export; task 2: 5 failing; task 3: 10 failing). Final: `npm test` 231 pass, 0 fail (was 204 plus wave 1 tests); `npx tsc --noEmit` clean.
- Greps: `loadEmployees(` in the route 3 (GET, POST, DELETE); `const text = (field: unknown)` 0; `const clip64` 1; both `shortcut:` comments 1 each; `sanitizeManualDetails(body.details)` 1; `nickname: selected.nickname` and `...selected, ...payload.employee` 1 each in the editor.
- Tests pin: exact upserted keys for a one-field save, no `knowledge_rating` key, zero fetch calls for known ids, one sheet fetch and no `roblox.com` URL for a newcomer, restore update values.

## Deviations from Plan

None - plan executed as written. Test-design notes: the manual fake returns row copies (like a real database) so a later update cannot rewrite an earlier read; extra fake options `failUpdatesFrom`, `updateMatchesNoRow`, `updateRemovesRow`, and a `readError` argument for `fakeTable`.

Out-of-plan observation: the editor sends `details` only for manual employees, and the route ignores details for ids without a manual row, as specified.

## Flagged Assumptions

- A1 (PostgREST ON CONFLICT updates only the payload's columns) cannot be proven with the in-memory fake; plan 07-04's owner check on a temporary manual employee closes it. Fallback on record: `update().eq()` for a known profile row, insert only when there is none.
- No live endpoint, database, Sheet or Roblox call was made (D-03).

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-07-06..T-07-10 mitigated as planned; residual A2 and failed-restore logging accepted).

## Self-Check: PASSED

- Files: lib/portia-employees.ts, lib/portia-employees.test.ts, app/api/employees/route.ts, components/portia-editor.tsx exist.
- Commits d3bfdd9, 05342e8, 9c9e13b are ancestors of HEAD.
