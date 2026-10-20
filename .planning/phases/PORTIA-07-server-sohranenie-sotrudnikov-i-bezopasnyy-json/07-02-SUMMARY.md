---
phase: PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json
plan: 02
subsystem: api
tags: [roblox, manual-employees, nickname, roster]
requires: []
provides:
  - "Manual employees are inserted and returned in Roblox's own spelling (RobloxProfile.name)"
  - "Roster shows an old manual row in Roblox spelling when Roblox answered, stored spelling otherwise (read-time only)"
  - "The 34-slot sheet limit is a stated rule at staffRowsEnd and in the EMP-10 record"
affects: [PORTIA-07 plan 07-04 (live check)]
status: complete
commits: 3
plan_head_before: 07310bbc1047ecc0029a3c9e80f6d3ce8693ec1a
plan_head_after: 1ea20402ddfabe3beb7963b75cb137d490ff16cf
actuals:
  tokens: 2500
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: ["canonical name comes from the Roblox lookup (user.name); typed input is only the lookup key and duplicate key"]
key-files:
  created: []
  modified: [lib/portia-employees.ts, lib/portia-employees.test.ts, .planning/REQUIREMENTS.md]
key-decisions:
  - "Old manual rows are never rewritten (D-11): the Roblox spelling is applied at read time with a fallback to the stored one"
  - "EMP-10 closed by the owner's rule (D-13), not by code: staffRowsEnd stays 35, no raise, no warning"
patterns-established:
  - "Test fixtures for RobloxProfile carry name"
requirements-completed: [EMP-09, EMP-10]
---

# Phase 07 Plan 02: Roblox spelling for manual employees and the 34-slot rule Summary

Manual employees are now stored, returned and shown in Roblox's own nickname spelling (typed newbie_9 becomes Newbie_9), and the owner's 34-slot rule is written at `staffRowsEnd` and in the EMP-10 record.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 (tracer) | RobloxProfile.name; addManualEmployee inserts and returns found.name | ccd3c65 |
| 2 | mergeManualEmployees shows `profile?.name ?? row.nickname` | 1df1c57 |
| 3 | 34-slot rule comment + EMP-10 record | 1ea2040 |

## Verification

- RED seen first for both new tests (task 1: stored `newbie_9`; task 2: stored spelling shown). After GREEN: `npm test` 208 pass, 0 fail (206 after 07-01, plus 2 new); `npx tsc --noEmit` clean.
- Greps: `name: user.name` 1, `nickname: found.name` 2, `nickname: input.nickname` 0, `profile?.name ?? row.nickname` 1, `exactly 34` on the line 3 above `const staffRowsEnd = 35;`, `ровно 34 места` 1 on the EMP-10 line; no added `.update(` line versus 288aa55.
- Existing tests "only the 34 staff slots are read…", the sheet-wins dedupe and the duplicate test passed unchanged.
- Not run: any live Roblox call or database write (belongs to plan 07-04).

## Deviations from Plan

None - plan executed as written. The EMP-10 checkbox stays `- [ ]` (ticked by phase completion); EMP-09 was already marked complete by 07-01 and stays complete.

## Known Stubs

None.

## Self-Check: PASSED

Commits ccd3c65, 1df1c57, 1ea2040 are ancestors of HEAD; edited files exist.
