# Phase 7: Server employee saving and safe JSON - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 9 (1 new lib, 1 new test, 7 modified)
**Analogs found:** 9 / 9 (all analogs are git-tracked, verified with `git ls-files`)

Newcomer-id resolution (RESEARCH Open Question 1): option A. PATCH body is `{ id, nickname?, changes, details? }`. Unknown id requires `nickname` to be a sheet nickname (via `nicknameKey`), and `id` to match `/^roblox-\d+$/` or equal `employeeId(nickname, null)`. No Roblox call on this path.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/request-json.ts` (new) | utility | request-response | `sanitizeManualEmployee` guard style in `lib/portia-employees.ts:264-271` | role-match |
| `lib/request-json.test.ts` (new) | test | transform | `lib/portia-employees.test.ts:258-261` (table of bad inputs) | role-match |
| `lib/portia-employees.ts` (sanitizers, `saveEmployeeProfile`, new `findKnownEmployee`/`saveEmployeePatch`/`fetchSheetRows`, `RobloxProfile.name`, `staffRowsEnd` comment) | service | CRUD | itself: `addManualEmployee` (status union), `updateManualEmployee`, `readManualEmployees` | exact |
| `lib/portia-employees.test.ts` (extend) | test | CRUD | itself: `fakeTable` (:79-100), `manualTable` (:206-245), `stubRoblox` (:265-277) | exact |
| `app/api/employees/route.ts` | route | request-response | itself: POST `refusals` map (:75-84) | exact |
| `app/api/editors/route.ts` | route | request-response | `app/api/employees/route.ts` PATCH/POST (auth then body) | exact |
| `app/api/content/route.ts` | route | request-response | itself, PUT :42-49 | exact |
| `components/portia-editor.tsx` (save merge ~1441-1461, delete ~1543-1554, send `nickname`) | component | request-response | itself | exact |
| `.planning/REQUIREMENTS.md` EMP-10 line | doc | n/a | itself | exact |

## Pattern Assignments

### `lib/request-json.ts` (utility, request-response)

**Analog:** guard style of `sanitizeManualEmployee` (`lib/portia-employees.ts:264-266`): `if (!value || typeof value !== "object") return null;` and the route turning `null` into 400. Add the array exclusion. Code is given in RESEARCH Pattern 8 (use verbatim):
```typescript
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
}
```
No `@/` imports in `lib/*.ts` that tests load: use relative imports (`./portia-employees.ts` style, see test header :4-8).

### `lib/request-json.test.ts` (test)

**Analog:** `lib/portia-employees.test.ts:1-3` and :258-261.
```typescript
import test from "node:test";
import assert from "node:assert/strict";
// bad-input table loop, same shape as:
for (const bad of [null, "Fox", 7, {}, { nickname: 5 }, { nickname: "   " }]) assert.equal(sanitizeManualEmployee(bad), null);
```
Use `new Request("http://x", { method: "POST", body })` for: empty, `not json`, `[]`, `null`, `5`, `"x"` -> null; `{}`, `{"a":1}` -> object. Import path with `.ts` extension (`./request-json.ts`).

### `lib/portia-employees.ts` (service, CRUD)

**Analog:** same file.

**Status-union pattern to copy for `saveEmployeePatch`** (lines 341-343, 346-351, 362-364):
```typescript
export type AddManualResult =
  | { status: "added"; employee: RosterEmployee }
  | { status: "not-found" | "duplicate" | "roblox-unavailable" | "pending-database" };
...
if (error?.code === "23505") return { status: "duplicate" };
if (isMissingTableError(error)) return { status: "pending-database" };
if (error) throw error;
```

**Known-id lookup, copy from `readManualEmployees`** (:274-288) but with `.eq("employee_id", id).maybeSingle<ManualRow>()`; tolerate missing table with `isMissingTableError` (:72-74).

**Partial upsert: rework `saveEmployeeProfile`** (current :412-431). Keep the fallback unchanged:
```typescript
const ratings = Object.fromEntries(optionalRatings.flatMap((rating) => (profile[rating.key] === undefined ? [] : [[rating.column, profile[rating.key]]])));
const table = supabase.from("portia_employee_profiles");
const { error } = await table.upsert({ ...base, ...ratings });
if (!error) return { ratingsSaved: true };
// Tolerates the rating columns being absent until 03.2-06 applies the SQL.
if (!isMissingColumnError(error) || !Object.keys(ratings).length) throw error;
const retry = await table.upsert(base);
if (retry.error) throw retry.error;
return { ratingsSaved: false };
```
Change `base` so biography/photo_url/knowledge_rating/nickname are included only when defined (`...(profile.biography === undefined ? {} : { biography: profile.biography })`), drop `knowledge_rating`, chain `.select("*").single()` and return `profileFromRow(row)` (:220-232). Current `base` (:413-421) wrote all of them unconditionally: that is the wipe.

**Sanitizer rework** (current :433-454 and :384-389). The existing rating loop (:444-452) is the base; change "anything else leaves unchanged" into `return null`:
```typescript
for (const { key } of optionalRatings) {
  const raw = candidate[key];
  if (raw === null || (typeof raw === "string" && !raw.trim())) update[key] = null;
  else if (typeof raw === "number" || typeof raw === "string") {
    const rating = Number(raw);
    if (Number.isFinite(rating)) update[key] = Math.min(10, Math.max(1, Math.round(rating)));
  }
}
```
Keep `photoUrl` rule (:436-437: `https://` or `/`, `.slice(0, 2048)`) and biography cap `.slice(0, 20_000)`, only when key present. `sanitizeManualDetails`: hoist the duplicated `text` closure (present at :267 and :387) to one module-level helper.

**Details with compensation** (D-08): copy the `updateManualEmployee` write (:394-398) for both the forward write and the restore; add a `not-found` status when zero rows and a re-select finds nothing. Skip when details has no keys (never `update({})`).

**Roblox name** (EMP-09): add `name: string` to `RobloxProfile` (:86) and `name: user.name` at the `byName.set` (:166); `addManualEmployee` use `found.name` at :356 and :369; `mergeManualEmployees` (:300) `nickname: profile?.name ?? row.nickname`.

**Sheet fetch factor-out:** lift `fetch(sheetCsvUrl, { cache: "no-store", signal: AbortSignal.timeout(8_000) })` + `parseCsv(await ....text())` from `loadEmployees` (:316, :323-324) into exported `fetchSheetRows()`; `loadEmployees` keeps its `Promise.all` (the fetch must stay parallel with the profile reads).

**Unknown-path seed:** `profiles.byId.get(id) ?? profiles.byId.get(employeeId(nickname, null))` mirrors `withProfile` (:253).

**EMP-10 comment** at :90-91 (extend, no code change):
```typescript
// The sheet has 34 numbered staff slots (rows 2-35); row 36 onwards holds totals and notes.
const staffRowsEnd = 35;
```

### `lib/portia-employees.test.ts` (test, CRUD)

**Analog:** same file. Reuse, do not rewrite:
- `fakeTable` (:79-100) models only `upsert` returning `{error}` and `select().returns()`. Extend with `eq("employee_id", id).maybeSingle()` and `upsert(...).select("*").single()` returning the merged row (line :94 already merges `{...rows.get(id), ...row}`, which is exactly the partial-upsert semantics to pin; note it does not prove PostgREST behavior, A1 stays a manual check).
- `manualTable` (:206-245) already asserts table name at :213 and records `updates`; extend `select` for `eq().maybeSingle()` and add a way to fail the Nth call so a test can see the restore update.
- `stubRoblox` (:265-277) as the template for a sheet stub: `t.mock.method(globalThis, "fetch", async (url) => { calls.push(String(url)); ... })`; assert `calls.length === 0` on known path and no URL contains `roblox.com` on the unknown path.
- Tests asserting old defaults to rewrite: :114-120 (knowledge kept), :122-127, :135-143 (`knowledgeRating: 2`), :145+ (knowledge defaults to 1), ~:380-383 (details defaults).
- Existing `RobloxProfile` fixtures without `name` (e.g. `{ id: 7, avatarUrl: "", fullAvatarUrl: "" }` around :197) need `name` added once the type requires it.

### `app/api/employees/route.ts` (route, request-response)

**Analog:** same file.

**Auth pattern to keep first in every handler** (:28-31):
```typescript
const supabase = await createServerSupabaseClient();
const { data } = await supabase.auth.getUser();
const access = await getEditorAccess(supabase, data.user);
if (!data.user || !access.canEdit) return Response.json({ error: "Нет доступа к редактору." }, { status: 403 });
```

**Status -> response map, copy from POST** (:75-84) for PATCH statuses `not-found` 404, `sheet-unavailable` 503 «Таблица не отвечает, попробуйте через минуту.», `profiles-unavailable` 503 (existing text :38):
```typescript
const refusals = { "not-found": { error: "...", status: 404 }, ... };
const { error, status } = refusals[result.status];
return Response.json({ error }, { status });
```

**Write tail** (:50-51, :86-87): `await purgeCacheTag(employeesCacheTag);` then `Response.json({...}, { headers: noStoreHeaders })`; outer `try/catch` with `console.error("PORTIA employee update failed", error)` and `500 "Не удалось сохранить профиль."` (:55-58).

**JSON guard sites:** PATCH :33, POST :69 (`sanitizeManualEmployee(await request.json())`), DELETE :102 (`typeof body?.id !== "string"`). Replace with `readJsonObject` after auth; reuse the existing 400 text «Некорректные данные.» (:36, :70, :103).

**Delete refusal (D-12)**, :107: change to `Response.json({ error: "Нельзя удалить сотрудника из таблицы.", code: "sheet-employee" }, { status: 403 })`.

Remove the `loadEmployees` call from PATCH (:37-40) and the `changes.knowledgeRating = employee.knowledgeRating` overwrite (:41-42). POST and DELETE keep `loadEmployees`.

### `app/api/editors/route.ts` (route, request-response)

**Analog:** employees route. Only POST changes (:33). Auth (`requireOwner`, :8-14, 403 at :31) stays first.
```typescript
const body = await request.json() as { email?: unknown };   // :33, replace with readJsonObject + 400 «Некорректные данные.»
```
POST has no try/catch today; the helper removes the throw, so none is needed. DELETE reads `?email=` (:59-60) and already returns 400: no change, do not invent a task.

### `app/api/content/route.ts` (route, request-response)

**Analog:** same file, PUT :42-49. Keep the 413 check (:43) and `request.text()`; replace `JSON.parse(raw) as {...}` (:44) with try/catch to 400 «Некорректные данные.» and require a non-array object (a `null` JSON body throws at :45 today). Keep existing 400 «Некорректная структура данных.» (:47-49). Do not use `readJsonObject` here because the body is already read as text for the size check.

### `components/portia-editor.tsx` (component, request-response)

**Analog:** same file.

Save (:1441-1461): add `nickname: selected.nickname` to the PATCH body `JSON.stringify({ id: selected.id, changes: draft, ...(selected.source === "manual" ? { details } : {}) })`; replace the `payload.employee!` uses (:1455-1457) with `const merged = { ...selected, ...payload.employee };` used for `setEmployees`, `onSaved`, `setDraft(profileOf(merged))`, `setDetails(detailsOf(merged))`. Widen the payload type to `employee?: Partial<PortiaEmployee> & { id: string }`. `portia-desktop.tsx:393-396` `updateEmployee` replaces the entry and caches to localStorage, so it must receive `merged`, never the profile-only answer.

Delete (:1543-1554): payload type add `code?: string`; condition becomes `response.status === 403 && payload.code !== "sheet-employee"` (replaces `!payload.error?.includes("таблицы")`).

## Shared Patterns

### Auth first, then body
**Source:** `app/api/employees/route.ts:28-31`; `app/api/editors/route.ts:8-14`; `app/api/content/route.ts:34-40`.
**Apply to:** all five mutating handlers. An unauthenticated caller gets 403 whatever the body.

### Russian error body, status in options
**Source:** `app/api/employees/route.ts:36` `Response.json({ error: "Некорректные данные." }, { status: 400 })`.
**Apply to:** every new refusal; never echo `error.message`; internals only via `console.error("PORTIA ... failed", error)`.

### Missing table/column tolerance
**Source:** `lib/portia-employees.ts:67-74` (`isMissingColumnError`, `isMissingTableError`) and the `pending-database` status (:396).
**Apply to:** `findKnownEmployee`, details write, profile upsert.

### Lib returns status, route maps to HTTP
**Source:** `AddManualResult` (:341-343) with the POST `refusals` map. Keeps logic in `lib/` where `node --test` can import it (route files use the `@/` alias and cannot be imported by node).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (none) | | | All new code has an in-repo analog. Exception: a truly atomic details+profile write has none (no RPC allowed); use sequential write with compensation. |

## Notes for the planner

- Pre-existing tests will fail after sanitizer rework (listed under the test file); rewrite them in the same plan as the code.
- A1 (PostgREST partial upsert on conflict) is not provable with the in-memory fake; keep the owner manual checkpoint on a temporary manual employee (D-03) and the update/insert fallback.
- `.planning/REQUIREMENTS.md` line ~27 (EMP-10) must state the 34-slot rule.

## Metadata

**Analog search scope:** `app/api/**`, `lib/portia-employees.ts`, `lib/portia-employees.test.ts`, `components/portia-editor.tsx`
**Files scanned:** 6 read directly, plus grep of the test file
**Pattern extraction date:** 2026-10-20
