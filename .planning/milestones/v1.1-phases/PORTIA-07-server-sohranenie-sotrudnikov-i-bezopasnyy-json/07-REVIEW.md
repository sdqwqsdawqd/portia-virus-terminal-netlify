---
phase: PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json
reviewed: 2026-10-20T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/api/content/route.ts
  - app/api/editors/route.ts
  - app/api/employees/route.ts
  - components/portia-editor.tsx
  - lib/portia-employees.test.ts
  - lib/portia-employees.ts
  - lib/request-json.test.ts
  - lib/request-json.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-10-20
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the diff f17be45..HEAD. `node --test` on the two lib test files passes (66 tests). The new `parseJsonObject` is used consistently in the content, editors and employees routes. No `request.json()` or bare `JSON.parse` remains under `app/api`. The server-side partial save and the details-first/restore flow are sound. The main gap is that the "never-saved sheet employee" check validates the nickname but not the id, so a request can write a profile row under a mismatched id. No blockers found.

## Warnings

### WR-01: Newcomer check accepts any `roblox-<digits>` id for any sheet nickname

**File:** `lib/portia-employees.ts:523-535`
**Issue:** For a never-saved employee, the nickname is verified against the sheet. The id is only checked against the pattern `/^roblox-\d+$/`, and Roblox is deliberately not asked (D-06). The id is therefore not tied to the nickname. A crafted or stale PATCH `{id: "roblox-<B's id>", nickname: "<A's nickname>"}` passes for any person B who has no profile row yet. It writes B's profile with `nickname = A`. `readEmployeeProfiles` then maps `nicknameKey(A) -> B's roblox id` in `robloxIdByNickname`. During a Roblox outage `rosterFromRows` gives A the id `roblox-<B>`, which collides with B. `seenIds` then silently drops one of the two people from the roster. The legitimate editor sends a matching pair, so this needs a crafted request or a stale client. Editors are semi-trusted, but a single bad write corrupts roster identity and is not self-healing.
**Fix:** Refuse an id that another sheet person already owns, or accept only ids this server could have produced. Cheapest: if `/^roblox-\d+$/` matches, require that no existing profile row has the same `nickname` under a different `employee_id`, and that `profiles.robloxIdByNickname.get(nicknameKey(person.nickname))` is either absent or equals the id's number. `profiles` is already read a few lines later. Move that check there and return `not-found` on mismatch.

### WR-02: A thrown sheet-header error in the newcomer check becomes a generic 500

**File:** `lib/portia-employees.ts:523`
**Issue:** `fetchSheetRows()` is wrapped in a try block and maps to `sheet-unavailable` (503). `rosterFromRows(rows, new Map())` sits outside it and throws `"The Portia sheet headers have changed."`. That reaches the route catch and returns 500 "Не удалось сохранить профиль.". The sheet-down case and the sheet-changed case therefore get different handling, and the changed-header case gets no tailored message or distinct log line.
**Fix:** Put the `rosterFromRows` call in the same try as `fetchSheetRows`, and return `sheet-unavailable` for both.

### WR-03: A manual-table read failure makes DELETE report "not found"

**File:** `app/api/employees/route.ts:108-113`, `lib/portia-employees.ts:276-290, 416-419`
**Issue:** `readManualEmployees` swallows a non-missing-table error and returns `{rows: [], ok: false}`. The DELETE route destructures only `employees` and ignores `complete`. During a transient Supabase error, a real manual employee is absent from the roster. `removeManualEmployee` then returns `not-found`, and the user sees 404 "Сотрудник не найден. Обновите страницу." even though the person exists. POST guards the equivalent case with `profilesRead`. DELETE has no such guard.
**Fix:** Read `complete` or the manual-read status from `loadEmployees` in DELETE. When the manual read failed, answer 503 with a retry message instead of falling through to `removeManualEmployee`.

## Info

### IN-01: `photoUrl` accepts protocol-relative URLs

**File:** `lib/portia-employees.ts:459`
**Issue:** `startsWith("/")` also accepts `//host/path`, which browsers resolve as an external URL. The intent (comment and test) is a same-site path or https. This predates the phase but sits in the sanitizer that was rewritten.
**Fix:** `|| (photoUrl.startsWith("/") && !photoUrl.startsWith("//"))`, or reject when `photoUrl.startsWith("//")`.

### IN-02: Restore result is ignored in the details rollback

**File:** `lib/portia-employees.ts:545-549`
**Issue:** `updateManualEmployee` returns `pending-database` or `not-found` without throwing. The rollback logs only on a thrown error, so a restore that is refused (for example the row was deleted concurrently) is silent. The known-limit `shortcut:` comment does not cover this case.
**Fix:** `const r = await updateManualEmployee(...); if (r.status !== "updated") console.error("PORTIA manual details restore not applied", r.status);`

### IN-03: Client merges the PATCH answer into the stale `selected` closure

**File:** `components/portia-editor.tsx:1456-1461`
**Issue:** `merged = { ...selected, ...payload.employee }` uses the `selected` captured when save started. If the user switches to another employee while the request is in flight, `setDraft(profileOf(merged))` and `setDetails(detailsOf(merged))` overwrite the new selection's draft with the old employee's data. The list update by `merged.id` is correct. This predates the diff and is only slightly widened by it.
**Fix:** Guard the `setDraft` and `setDetails` calls with `if (selectedIdRef.current === merged.id)`, or disable the selector while `state === "saving"`.

---

_Reviewed: 2026-10-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
