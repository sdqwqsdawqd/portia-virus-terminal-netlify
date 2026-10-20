---
phase: PORTIA-08-sotrudniki-bez-poter-na-ekrane
reviewed: 2026-10-20T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - app/api/employees/editor/route.ts
  - app/api/employees/route.ts
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - lib/portia-employees.test.ts
  - lib/portia-employees.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-20
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the diff 760a4fe..HEAD for the six files. The pure helpers (`changedFields`, `changedDetails`, `settleDraft`, `mergeEmployeesAnswer`, `acceptsEditorList`) are sound and well covered by tests. The new `/api/employees/editor` route checks editor access before any read, returns no sensitive fields, and RLS grants `authenticated` select on both tables, so it works. No security issues or data-loss defects in the main paths. The remaining problems are in the save-in-flight and queued-click flow in `portia-editor.tsx` and in how the editor treats a partial list.

## Warnings

### WR-01: A queued employee click silently discards typed details the database refused

**File:** `components/portia-editor.tsx:1511-1515` (also `1432-1440`)
**Issue:** After a save, `typedMeanwhile` is computed only against what was sent. When the answer has `detailsPending` (database refused title, rank and callsign), the typed details are deliberately left as an unsaved edit (line 1504). But `typedMeanwhile` is false, so `save()` returns `true` and `resolveQueued(true)` calls `openEmployee(next)`. That resets the draft and the details and clears `detailsPending`. If the user clicked another employee during the save, the unsaved details are dropped with no confirm dialog. The same `true` return makes the "СОХРАНИТЬ" dialog path (`continueLeave(true)`) discard them. The "dirty" model says this draft is still unsaved, so this contradicts D-02.
**Fix:** Treat refused details as still dirty when deciding "clean":
```ts
const detailsRefused = Boolean(payload.detailsPending) && Object.keys(detailChanges).length > 0;
const typedMeanwhile = detailsRefused || (stillOpen && (/* existing checks */));
resolveQueued(!typedMeanwhile);
return !typedMeanwhile;
```
Then the queued click opens the "unsaved" dialog instead of dropping the edit.

### WR-02: The editor ignores `manualRead` and shows a roster that is silently missing manual employees

**File:** `components/portia-editor.tsx:1436-1441`, `lib/portia-employees.ts:110-112`
**Issue:** The editor route returns `manualRead`. `acceptsEditorList` checks only `profilesRead`. When the manual table read fails, the editor list is built from the sheet only. Manual employees disappear from the list with no warning, and the editor can mistake that for a deletion. Adding the same nickname again then runs into the duplicate check, or the person looks lost. The public window handles this case by carrying manual employees over from the last good list. The editor, where the stakes are higher, does not.
**Fix:** Reject or flag the list when `manualRead !== true`. For example, let `acceptsEditorList` require `manualRead === true` and reuse the retry screen with a message such as "Список людей вне таблицы не загрузился. Повторите через минуту.", or show a non-blocking warning banner.

### WR-03: Every 403 from the editor list is reported as an expired session

**File:** `components/portia-editor.tsx:1428`, `app/api/employees/editor/route.ts:15`
**Issue:** The route returns 403 for three different cases: no user, a user without edit rights, and `getEditorAccess` failing on its RPC (it logs and returns `noAccess`). The client maps every 403 to "Сессия редактора истекла. Войдите в редактор снова." and shows the "ВОЙТИ СНОВА" link. A signed-in user who lacks rights, or a transient Supabase RPC failure, sees a wrong explanation. The retry button then loops on it. The link decision also depends on `loadError.includes("Войдите")`, which ties behavior to UI copy.
**Fix:** Return 401 when `!data.user`, and 403 with its own message when the user lacks rights. Branch on `response.status` in the client and keep a separate boolean such as `needsLogin` in state instead of matching text.

## Info

### IN-01: `resolveQueued` searches a stale `employees` closure

**File:** `components/portia-editor.tsx:1439`
**Issue:** `resolveQueued` is created in the render that started `save()`. If an employee is added (`addEmployee`) during the save and then clicked, the click is queued. The stale list does not contain that employee, so `find` fails and the queued click is dropped without a message. This is an edge case, but it is silent.
**Fix:** Read the list through a ref (as is done for `draftRef`), or fall back to `setEmployees`-driven resolution.

### IN-02: A queued click gives the user no feedback

**File:** `components/portia-editor.tsx:1571-1575`
**Issue:** While saving, a click on another employee only writes a ref. Nothing on screen shows the click was accepted. If the save then fails or the draft is dirty again, a dialog appears out of nowhere.
**Fix:** Optionally highlight the queued entry, for example keep `queuedEmployeeId` in state in addition to the ref.

### IN-03: `patchEmployeesCache` and `withEmployee` rely on an empty `catch {}` and unvalidated cached shape

**File:** `components/portia-desktop.tsx:146-152`
**Issue:** `cached.employees` is cast to `PortiaEmployee[]` without checking elements. Malformed items in localStorage would throw inside `patch`, and the empty catch hides it, so the cache silently stops updating. This is low risk, since the cache is written by the same code.
**Fix:** Log in the catch (`console.warn`), or filter cached items for `typeof id === "string"` before patching.

---

_Reviewed: 2026-10-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
