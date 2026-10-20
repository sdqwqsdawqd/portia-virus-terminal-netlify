---
phase: PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json
plan: 01
subsystem: api
tags: [json, validation, nextjs-route-handlers, error-codes]
requires: []
provides:
  - "parseJsonObject(raw): plain object or null, shared by all JSON-reading API handlers"
  - "400 «Некорректные данные.» instead of 500 for empty/broken/non-object bodies (employees PATCH/POST/DELETE, editors POST, content PUT)"
  - "403 sheet-employee code on the sheet-delete refusal, read by the editor instead of Russian text"
affects: [PORTIA-07 plan 07-03 (rewrites PATCH), PORTIA-07 plan 07-04 (live check)]
status: complete
commits: 2
plan_head_before: f17be45f2024f4fafdb7ba06276fbd2605d29229
plan_head_after: 423579e043778089366fa8d75c68d8d740388b7b
actuals:
  tokens: 1500
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: ["string-level safe JSON parse: callers read request.text() then parseJsonObject; null maps to a fixed 400 after the access check"]
key-files:
  created: [lib/request-json.ts, lib/request-json.test.ts]
  modified: [app/api/employees/route.ts, app/api/editors/route.ts, app/api/content/route.ts, components/portia-editor.tsx]
key-decisions:
  - "One string-level helper (not a Request-level one) because content PUT must read the text first for its 2 MB check"
  - "Machine-readable code value is the constant sheet-employee; error text unchanged"
patterns-established:
  - "Control flow in the editor depends on response codes, never on Russian message text"
requirements-completed: [ROB-02, EMP-09]
---

# Phase 07 Plan 01: Safe JSON bodies and sheet-refusal code Summary

parseJsonObject turns an empty, broken or non-object request body into a fixed 400 on all five JSON-reading handlers, and the sheet-employee delete refusal now carries `code: "sheet-employee"` that the editor checks instead of a Russian substring.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 (tracer) | parseJsonObject + test, DELETE /api/employees, editor reads payload.code | 2cd4851 |
| 2 | parseJsonObject in employees PATCH/POST, editors POST, content PUT | 423579e |

## Verification

- `node --experimental-strip-types --test lib/request-json.test.ts`: 2 tests, 0 fail (RED seen first: module missing).
- `npm test`: 206 pass, 0 fail (baseline 204 + 2 new). `npx tsc --noEmit`: clean.
- Greps: no `request.json()` left in app/api; `parseJsonObject(` counts 3 / 1 / 1 as planned; every call comes after its handler's 403 return; content 2 MB check precedes `parseJsonObject(raw)`; editors DELETE untouched; `includes("таблицы")` gone from the editor.
- Not run: any live write endpoint (D-03); the live check belongs to plan 07-04.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: lib/request-json.ts, lib/request-json.test.ts, this SUMMARY
- FOUND commits: 2cd4851, 423579e
