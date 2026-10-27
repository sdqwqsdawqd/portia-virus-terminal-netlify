---
phase: PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json
fixed_at: 2026-10-20T00:00:00Z
review_path: .planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-10-20
**Source review:** .planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Newcomer check accepts any `roblox-<digits>` id for any sheet nickname

**Files modified:** `lib/portia-employees.ts`, `lib/portia-employees.test.ts`
**Commit:** 364404d
**Status:** fixed: requires human verification (security/logic check)
**Applied fix:** In the never-saved-employee branch of `saveEmployeePatch`, after `profiles` is read, the id's number is compared with `profiles.robloxIdByNickname.get(nicknameKey(person.nickname))`. If the nickname already has a stored Roblox id and the claimed `roblox-<digits>` differs, the answer is `not-found` and nothing is written.

**What is allowed when the nickname has no known Roblox id yet:** any `roblox-<digits>` id is still accepted for a sheet nickname that has no stored profile row with a Roblox id. Roblox is deliberately not asked (D-06), so the server cannot verify the pairing in that case. The residual risk is therefore: a crafted PATCH can still bind a wrong `roblox-<digits>` to a sheet nickname the first time that nickname is ever saved. Once any row exists for the nickname, its id is locked and cannot be re-pointed. Ids of the nickname form (`nick-...`) are unchanged. Closing the first-write gap fully would need a Roblox lookup, which D-06 rules out.

Tests: "a newcomer id cannot be re-pointed" - a mismatched id for a stored nickname is `not-found` with no upsert; the matching id and a nickname with no stored id are still saved.

### WR-02: A thrown sheet-header error in the newcomer check becomes a generic 500

**Files modified:** `lib/portia-employees.ts`, `lib/portia-employees.test.ts`
**Commit:** a63990d
**Applied fix:** `rosterFromRows(...)` and the nickname lookup now run inside the same `try` as `fetchSheetRows()`, so a changed header returns `sheet-unavailable` (503) with the existing log line. Test: a sheet with unknown headers gives `sheet-unavailable` and writes nothing.

### WR-03: A manual-table read failure makes DELETE report "not found"

**Files modified:** `lib/portia-employees.ts`, `app/api/employees/route.ts`, `lib/portia-employees.test.ts`
**Commit:** 4a21aa2
**Applied fix:** `loadEmployees` now also returns `manualRead` (the manual read's `ok`). DELETE destructures it and answers 503 "Список сотрудников не загрузился. Попробуйте через минуту." before `removeManualEmployee` when it is false. A missing table still counts as a healthy read. Test: `loadEmployees` reports `manualRead` false on a manual read error and true otherwise (the route itself is not unit-tested; it only checks the flag).

## Verification

Run in the main checkout after the fast-forward (the isolated worktree has no `node_modules`): `npm test` gives 234 tests, 234 pass, 0 fail; `npx tsc --noEmit` is clean. The three unit-test runs during the fixes ran in the isolated worktree (`node --test`), with the same results. No network requests were made (tests use stubbed fetch).

The unrelated working-tree changes (`.planning/config.json`, `.planning/state.json`, `.planning/milestone.lock`, `&1`, `PR_DESCRIPTION.md`) were not touched.

---

_Fixed: 2026-10-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
