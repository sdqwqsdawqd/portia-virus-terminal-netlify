# Phase 8: Сотрудники без потерь на экране - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 7 (2 new-ish additions, 5 modified)
**Analogs found:** 7 / 7
All paths below are git-tracked (verified with `git ls-files`). Line numbers are from the current working tree.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/portia-employees.ts` (+ `changedFields`, `changedDetails`, `settleDraft`, `acceptsEditorList`, `mergeEmployeesAnswer`) | utility | transform | same file: `profileChanged` (62-65), `acceptsRoster` (77-80) | exact |
| `lib/portia-employees.test.ts` | test | transform | same file (node:test, header lines 1-8) | exact |
| `app/api/employees/route.ts` (GET adds `manualRead`) | route | request-response | same file GET (11-26) | exact |
| `app/api/employees/editor/route.ts` (NEW) | route | request-response | `app/api/employees/route.ts` PATCH access check (32-36) + GET body (11-26) | role-match |
| `components/portia-desktop.tsx` (fetchEmployees, updateEmployee/removeEmployee, boot cache, card text, EmployeeImage) | component | event-driven / cache | same file: `fetchEmployees` 418-432, `updateEmployee` 393-404, `saveStateTimer` 901/933 | exact |
| `components/portia-editor.tsx` `EmployeeProfilesEditor` (load, save, queue, timer, render skeleton) | component | request-response | same file: load effect 1411-1431, `save` 1433-1473, `chooseEmployee` 1507-1516 | exact |
| `components/portia-desktop.tsx` timer for editor `save` | component | event-driven | `saveContent` in desktop 899-933 | role-match |

## Pattern Assignments

### `lib/portia-employees.ts` (utility, transform)

**Analog:** same file. New helpers sit beside `profileOf`/`profileChanged`/`acceptsRoster` and reuse the "`?? null` equals missing" rule.

**Null-vs-missing rule to copy** (lines 62-65):
```typescript
export function profileChanged(saved: EmployeeProfile, draft: EmployeeProfile): boolean {
  return saved.biography !== draft.biography || saved.photoUrl !== draft.photoUrl
    || employeeRatings.some(({ key }) => (saved[key] ?? null) !== (draft[key] ?? null));
}
```

**Type-guard acceptor style** (lines 77-80), model for `acceptsEditorList` (`Array.isArray(employees) && profilesRead === true`) and for `mergeEmployeesAnswer`'s "anything not exactly `false`/`true`" checks:
```typescript
export function acceptsRoster(payload: { employees?: unknown; degraded?: unknown }): payload is { employees: PortiaEmployee[]; syncedAt?: string | null; degraded?: boolean } {
  return Array.isArray(payload.employees) && (payload.employees.length > 0 || payload.degraded === false);
}
```

**Diff helpers** use `employeeRatings` (line 35) as the key list and `EmployeeUpdate` (line 31) / `ManualDetails` (line 390) as return types; see RESEARCH Pattern 1 and 4 skeletons (`changedFields`, `changedDetails`, `settleDraft`). `profileOf` (47-58) keeps `?? null` (draft is compared, never sent whole).

---

### `lib/portia-employees.test.ts` (test, transform)

**Analog:** same file.

**Imports/structure** (lines 1-8): add new names to the existing import list from `"./portia-employees.ts"`.
```typescript
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  acceptsRoster, addManualEmployee, employeeId, employeeRatings, mergeManualEmployees, parseCsv, profileChanged, profileFromRow, profileOf, ...
} from "./portia-employees.ts";
const noRatings = { pawsRating: null, bioRating: null, sRating: null, activityRating: null, testsRating: null, overallRating: null };
```
Style: flat top-level `test("sentence describing behaviour", () => { assert.deepEqual(...) })`. Run: `node --experimental-strip-types --test lib/portia-employees.test.ts`. Test targets are listed in RESEARCH "Code Examples".

---

### `app/api/employees/route.ts` (route, request-response) - GET adds `manualRead`

**Analog:** itself (lines 11-26). Change only the destructure and the body:
```typescript
const { employees, syncedAt, complete, profilesRead } = await loadEmployees(createPublicSupabaseClient());
return Response.json(
  { employees, syncedAt, degraded: !complete, profilesRead },
  { headers: publicCacheHeaders(employeesCacheTag, complete ? 600 : 30) },
);
```
-> add `manualRead` to both. `loadEmployees` already returns it (`lib/portia-employees.ts:344`). Keep the public CDN headers.

---

### `app/api/employees/editor/route.ts` (NEW; route, request-response)

**Analog:** `app/api/employees/route.ts` (imports 1-5, GET 11-26, PATCH access check 32-36).

**Imports** (lines 1-5, trim to what is used):
```typescript
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { loadEmployees } from "@/lib/portia-employees";
export const dynamic = "force-dynamic";
```

**Auth pattern** (lines 32-36):
```typescript
const supabase = await createServerSupabaseClient();
const { data } = await supabase.auth.getUser();
const access = await getEditorAccess(supabase, data.user);
if (!data.user || !access.canEdit) return Response.json({ error: "Нет доступа к редактору." }, { status: 403 });
```

**Error handling** (GET catch, lines 19-25): `console.error("PORTIA ... failed", error)` then `Response.json({ error: "Не удалось получить список сотрудников из таблицы." }, { status: 502, headers: noStoreHeaders })`. Success uses `{ headers: noStoreHeaders }` (as PATCH line 58) with body `{ employees, syncedAt, degraded: !complete, profilesRead, manualRead }`. Full skeleton: RESEARCH Pattern 3. No `proxy.ts` matcher change needed.

---

### `components/portia-desktop.tsx` (component, cache/event-driven)

**Analog:** itself.

**`fetchEmployees`** (lines 418-432) - replace the unconditional `setEmployees(payload.employees)` and `localStorage.setItem(..., JSON.stringify(payload))` with `mergeEmployeesAnswer(employeesRef.current, payload, ...)`; write cache only when `cacheable`:
```typescript
const response = await fetchWithTimeout("/api/employees", {}, 15_000);
if (!response.ok) return;
const payload = await response.json() as { employees?: PortiaEmployee[]; syncedAt?: string | null; degraded?: boolean };
if (!acceptsRoster(payload)) return;
setEmployees(payload.employees);
...
try { window.localStorage.setItem(employeesCacheStorageKey, JSON.stringify(payload)); } catch {}
} catch { /* last successful snapshot remains */ } finally { setEmployeesReady(true); }
```
Extend the payload type with `profilesRead?: boolean; manualRead?: boolean`.

**`updateEmployee` / `removeEmployee`** (lines 393-404): currently dump state `next` into the cache (the leak, RESEARCH Pitfall 3):
```typescript
const cached = JSON.parse(window.localStorage.getItem(employeesCacheStorageKey) ?? "{}") as { syncedAt?: string | null };
window.localStorage.setItem(employeesCacheStorageKey, JSON.stringify({ ...cached, employees: next }));
```
Change to patch `cached.employees` (replace/append/remove one entry), keep `{ ...cached }`, do nothing when no cache. Keep the try/catch `{}` shape.

**Boot cache read** (inside the `cacheTimer` effect, ~lines 452-460): type has only `employees`/`syncedAt`; add `profilesRead?: boolean`; treat only `=== false` as unread.

**Guarded timer pattern to mirror** (desktop `saveContent`, lines 331, 900-901, 933):
```typescript
const saveStateTimer = useRef<number | null>(null);
// An earlier «СОХРАНЕНО» timer must not flip a newer request back to idle mid-save.
if (saveStateTimer.current !== null) window.clearTimeout(saveStateTimer.current);
...
saveStateTimer.current = window.setTimeout(() => setSaveState("idle"), 1800);
```
Also `savesStarted.current += 1` (line 903) is the pattern for the optional Pitfall 7 guard (`employeeSavesStarted`).

**`EmployeeImage`** (lines 1379-1388): rename to inner, add wrapper keyed on `src` (RESEARCH Pattern 6). Existing body for reference:
```tsx
function EmployeeImage({ src, alt, fallbackClassName = "" }: {...}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const fallback = !src || failed;
  return <div className={`personnel-image-loader${loaded ? " is-loaded" : ""}`}> ... </div>;
}
```
Three call sites (lines 1194, 1195 x2) are fixed with no edits by the wrapper.

**Card text** (line ~1201): `selectedEmployee.biography || "Биография сотрудника пока не заполнена."` - when profiles unread show «Профиль временно не загрузился.» instead, and hide ratings (D-08).

---

### `components/portia-editor.tsx` `EmployeeProfilesEditor` (component, request-response)

**Analog:** itself.

**Load effect** (1411-1431) - becomes a `loadList` `useCallback` (called on mount and by «ПОВТОРИТЬ»), fetch `/api/employees/editor`, gate with `acceptsEditorList`; keep the `.then`-only `setState` style (lint rule `react-hooks/set-state-in-effect`):
```typescript
useEffect(() => {
  let active = true;
  void fetch("/api/employees")
    .then(async (response) => { if (!response.ok) throw new Error("load failed"); return response.json() as Promise<...>; })
    .then((payload) => {
      if (!active) return;
      if (payload.profilesRead === false) throw new Error("profiles not read");   // -> !== true
      ...
      setState("idle");
    })
    .catch(() => { if (active) setState("error"); });
  return () => { active = false; };
}, []);
```
Introduce separate `loadState` so list-load error and save error are distinct.

**`save`** (1433-1473): fetch + error mapping to copy:
```typescript
body: JSON.stringify({ id: selected.id, nickname: selected.nickname, changes: draft, ...(selected.source === "manual" ? { details } : {}) }),
...
const message = response.status === 403 ? "Сессия редактора истекла. Войдите в редактор снова." : payload.error || `Сервер отклонил сохранение (${response.status}).`;
...
const merged: PortiaEmployee = { ...selected, ...payload.employee };
setEmployees((current) => current.map((employee) => employee.id === merged.id ? merged : employee));
onSaved(merged);
setDraft(profileOf(merged));                       // REPLACE: settleDraft(sent, cur, profileOf(merged)), only if selectedIdRef.current === sentId
if (!payload.detailsPending) setDetails(detailsOf(merged));
setState("saved");
window.setTimeout(() => setState("idle"), 1800);   // REPLACE: savedTimer ref, cleared at save start and on unmount
```
`changes: draft` -> `changedFields(profileOf(selected), sentProfile)`; skip the request when both diffs empty (Pitfall 6). Existing refs `selectedIdRef` / `askingRef` (synced in effects) are the model for new `draftRef` and `queuedEmployeeIdRef`.

**Queue vs drop** (`chooseEmployee`, 1507-1516):
```typescript
if (!dirty) return openEmployee(employee);
if (employee.id === selected.id) { setRecordOpen(true); revealOnPhone(layoutRef); return; }
// A sent PATCH cannot be cancelled; its answer would overwrite the next employee's draft.
if (state !== "saving") setPendingEmployeeId(employee.id);   // -> else queuedEmployeeIdRef.current = employee.id
```
Note `if (!dirty) return openEmployee(...)` also runs while saving and clean; handle `state === "saving"` first.

**Early-return dead end** (1503-1504) to restructure:
```tsx
if (state === "loading") return <div className="editor-empty">Загрузка сотрудников…</div>;
if (!selected || !draft) return <div className="editor-empty">{...}</div>;
```
-> loading/error(+ПОВТОРИТЬ) returns stay; the layout (aside at ~1579-1592: list, `+ ВНЕ ТАБЛИЦЫ` button, `employee-add-form`) always renders; only the `<div className="editor-form employee-profile-editor">` pane is conditional on `selected && draft`, else `editor-empty`. `openEmployee`/`chooseEmployee` use `selected.id` and must be made null-safe; `addEmployee` (1475-1498) must open the new person when `draft === null` (`setSelectedId; setDraft(profileOf(emp)); setDetails(detailsOf(emp))`). `removeSelected` already sets `setDraft(null)` for the last person (line ~1573).

**Error-pane link keying**: the editor shows «ВОЙТИ СНОВА» when `errorMessage.includes("Войдите")`; keep that 403 text for the new editor route.

## Shared Patterns

### Editor access check (403 text)
**Source:** `app/api/employees/route.ts` lines 32-36 (excerpt above)
**Apply to:** `app/api/employees/editor/route.ts`

### No-store / CDN headers
**Source:** `lib/portia-cdn.ts` lines 6-20
**Apply to:** the new editor route (`noStoreHeaders`); the public GET keeps `publicCacheHeaders(employeesCacheTag, ...)`.
```typescript
export const noStoreHeaders = { "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store" };
```

### Guarded «СОХРАНЕНО» timer
**Source:** `components/portia-desktop.tsx` lines 331, 900-901, 933
**Apply to:** editor `save` (timer ref cleared at save start and in an unmount effect).

### Null-equals-missing rating comparison
**Source:** `lib/portia-employees.ts` line 64 `(saved[key] ?? null) !== (draft[key] ?? null)`
**Apply to:** `changedFields`, `settleDraft`, dirty check.

### Trusted-flag checks use `=== true`
**Source:** `acceptsRoster` (77-80) style
**Apply to:** `acceptsEditorList`, `mergeEmployeesAnswer`; only visitor boot cache treats `profilesRead === false` as unread.

### Cache writes patch the cached array
**Source:** `components/portia-desktop.tsx` 393-404 (anti-example to fix)
**Apply to:** `updateEmployee`, `removeEmployee`, `fetchEmployees`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none for production code) | | | |
| Component tests for editor/desktop | test | event-driven | No jsdom/testing-library in repo; only `node:test` on `lib/*.test.ts`. Verify component behaviour via pure-helper tests + tsc/eslint/build + manual UAT (D-03: temporary employee only). |

## Metadata

**Analog search scope:** `app/api/employees`, `lib/portia-employees*.ts`, `lib/portia-cdn.ts`, `components/portia-editor.tsx` (1405-1600), `components/portia-desktop.tsx` (390-470, 895-935, 1375-1390)
**Files scanned:** 6
**Pattern extraction date:** 2026-10-20
