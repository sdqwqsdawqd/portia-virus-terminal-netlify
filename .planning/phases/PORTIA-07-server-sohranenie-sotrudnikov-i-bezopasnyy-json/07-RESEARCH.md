# Phase 7: Сервер: сохранение сотрудников и безопасный JSON - Research

**Researched:** 2026-10-20
**Domain:** Next.js 16 route handlers + Supabase (PostgREST) writes; Google Sheet CSV + Roblox lookups; Node `node:test` unit tests
**Confidence:** HIGH on the code seams (every claim below was read in this session); MEDIUM on one PostgREST upsert behaviour (A1, needs the owner's temp-employee check)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward (locked earlier, not re-asked)**
- **D-01:** PATCH contract: absent field = unchanged; `null` (or empty string) clears only that rating; wrong type = 400; the old whole-profile request is accepted (STATE.md, v1.1 roadmap decision).
- **D-02:** Concurrent edits of one employee: last write wins (AR-03.2-01). No locking or version checks.
- **D-03:** Saves are verified only on a temporary employee outside the sheet; no script calls `PUT /api/content` (STATE.md [Данные]). The partial-row upsert for an employee with no stored profile row must be checked (STATE.md [Phase 7] concern).

**Сохранение без таблицы (EMP-03)**
- **D-04:** If the employee id is already known to the database (a row in `portia_employee_profiles` or in the manual-employees table), the server saves immediately — no Google Sheet fetch and no Roblox call on this path.
- **D-05:** An id the database does not know (a sheet newcomer never saved before) is checked against the Google Sheet only — without any Roblox lookup. If the sheet does not answer, the server refuses with a clear Russian message (e.g. «Таблица не отвечает, попробуйте через минуту»), not 404 «Сотрудник не найден».
- **D-06:** Roblox is never needed to save a profile.
- **D-07:** The PATCH response returns only the stored profile (biography, photo, ratings, plus id and — for manual employees — the saved details), not the full roster employee with avatar / sheet title. The current editor replaces the whole card with `payload.employee` (`components/portia-editor.tsx:1455-1457`); Phase 7 must keep it working — merge the returned profile onto the existing card (minimal editor change) rather than losing the avatar. — **Reversibility:** costly — the response shape is a contract the Phase 8 client builds on.

**Детали сотрудника вне таблицы (EMP-04)**
- **D-08:** All or nothing. Title / rank / callsign are written first; if the profile write then fails, the details are restored to their previous values. The editor gets one error with the correct reason; the database never keeps a half-saved state.
- **D-09:** Title, rank and callsign follow the same partial rule as the profile: absent field = unchanged, empty string = clear, wrong type = 400. One rule for the whole request.

**Ник в написании Roblox и удаление (EMP-09)**
- **D-10:** New manual employees are stored with the nickname exactly as Roblox spells it (from the Roblox lookup already done on add).
- **D-11:** Old manual rows are not rewritten in the database. When reading, the nickname is shown in Roblox spelling if Roblox answered; otherwise the stored spelling.
- **D-12:** Refusing to delete a sheet employee keeps the current text «Нельзя удалить сотрудника из таблицы.»; the editor decides by a machine-readable response code/field, not by matching the Russian string (`components/portia-editor.tsx:1552`).

**Лимит таблицы (EMP-10)**
- **D-13:** The limit stays at 34 staff slots (sheet rows 2–35). Owner confirmed rows after 34 are never filled; the sheet has exactly 34 places. Close EMP-10 by stating this as a rule in code (comment at `staffRowsEnd` in `lib/portia-employees.ts`) and in the requirement record — no warning UI, no raise.

**Безопасный JSON (ROB-02)**
- **D-14:** Empty body, non-JSON and non-object bodies in the employees (PATCH/POST/DELETE), editors (POST/DELETE) and content (PUT) APIs return 400 with a short Russian message in the style of the existing ones («Некорректные данные.»), never 500.

### Claude's Discretion
- Exact Russian wording of new error messages (short, matching current style).
- The machine-readable form of the sheet-delete refusal (D-12): response field name/value or status code.
- How "known to the database" is looked up (D-04) and how the details rollback (D-08) is implemented (sequential writes with compensation vs an RPC) — within the constraint that no new SQL is required from the owner in this phase unless unavoidable.
- Shared helper for safe JSON body parsing across the three route files.

### Deferred Ideas (OUT OF SCOPE)
- **Erase the stored profile of a person removed from the sheet ("fired")** — owner wants it. New, irreversible capability; deleting on a single sheet read risks wiping profiles when the sheet briefly returns a partial list. Belongs in its own phase with a safety design (e.g. absent for several consecutive syncs, or an owner-only "delete fired profile" action). Not part of v1.1 Phase 7.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMP-01 | Save changes only sent fields; absent = unchanged; empty rating clears only itself; wrong type = 400; old whole-profile request accepted | Rework `sanitizeEmployeeUpdate` / `saveEmployeeProfile` (Patterns 1, 2); partial upsert (A1) |
| EMP-03 | Profile save independent of Roblox and the Google Sheet; no 404, no ~18 s wait | New known-id lookup + sheet-only unknown path (Pattern 3); Open Question 1 (id derivation) |
| EMP-04 | Manual employee details: no half-saved state, correct failure reason | Details first, compensation on profile failure; new `not-found` status (Pattern 4) |
| EMP-09 | Manual nickname in Roblox spelling; sheet-delete refusal by code not Russian string | Add `name` to `RobloxProfile` (it is NOT there today); `code` field on 403 (Pattern 5, 6) |
| EMP-10 | 35th+ sheet employee not silently lost | Close by rule: comment at `staffRowsEnd` + requirement record text (Pattern 7) |
| ROB-02 | Bad/empty/non-object JSON gives 400 not 500 | One shared `readJsonObject` helper used by employees, editors, content (Pattern 8) |
</phase_requirements>

## Summary

All six requirements live in four files: `lib/portia-employees.ts` (sanitizers, save, roster loading), `app/api/employees/route.ts` (PATCH/POST/DELETE), `app/api/editors/route.ts` (POST) and `app/api/content/route.ts` (PUT), plus a small merge change in `components/portia-editor.tsx`. No new packages and no new SQL are needed. `npm test` (204 tests pass) and `npx tsc --noEmit` (clean) are green on the current tree, so any regression is attributable to this phase.

The slow/404 behaviour comes from one line: `app/api/employees/route.ts:37` calls `loadEmployees` (Google Sheet 8 s timeout, then up to 5 s Roblox calls in series with thumbnails) before every save, then 404s if the id is not in that roster. The field-wiping comes from `sanitizeEmployeeUpdate` defaulting missing `biography`/`photoUrl` to `""` and `knowledgeRating` to `1`, and from `sanitizeManualDetails` defaulting to `""`. The fix is a lookup of the id in the two database tables (two parallel single-row selects), then a partial upsert that writes only the keys the client sent; the stored row is returned with `.select()` so the response is the merged stored profile with no extra read.

**One decision conflict the planner must resolve (Open Question 1):** a never-saved sheet newcomer's id is `roblox-<N>`, which cannot be derived from the sheet alone. D-05 ("sheet only, no Roblox") therefore needs the client to send the employee's `nickname` as a hint on the first save. Recommended: add an optional `nickname` to the PATCH body (one extra field in the current editor), and verify only that nickname against the sheet.

**Primary recommendation:** Put the whole save orchestration in one exported `lib/portia-employees.ts` function that returns a status union (the same pattern `addManualEmployee` already uses), map statuses to responses in the route, and put the JSON guard in one tiny helper; every success criterion is then unit-testable with the existing `node:test` + fake Supabase client style, because route files cannot be imported by node (`@/` alias).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Partial-field merge / clear-one-rating semantics | API / Backend (`lib/portia-employees.ts` sanitizer + save) | Database (omitted columns keep value) | Server must own the contract (D-01); client only sends what changed (Phase 8) |
| "Known id" lookup (D-04) | Database / Storage (2 selects) | API / Backend | Avoids Sheet+Roblox entirely on the hot path |
| Newcomer verification (D-05) | API / Backend → Google Sheet CSV | — | Sheet decides who works there (CONTEXT specifics) |
| Manual details atomicity (D-08) | API / Backend (write, compensate) | Database | No RPC allowed without owner SQL |
| Roblox canonical nickname (D-10/D-11) | API / Backend (add path + roster read) | — | Comes from the Roblox lookup already done |
| Sheet-delete refusal code (D-12) | API / Backend (emit `code`) | Browser (reads `code`) | Browser must not parse Russian text |
| Safe JSON parsing (D-14) | API / Backend (shared helper) | — | Trust boundary |
| Merge returned profile onto card (D-07) | Browser / Client (`portia-editor.tsx`) | — | Server returns profile only |
| 34-slot rule (D-13) | API / Backend (comment + doc) | — | No behaviour change |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.117.3 (installed `@supabase/postgrest-js` 2.117.3) | DB reads/writes | Already the project's client [VERIFIED: package.json, node_modules/@supabase/postgrest-js/package.json:3] |
| `next` | 16.4.2 | Route handlers, `Response.json` | Pinned exactly [VERIFIED: package.json] |
| `node:test` + `node:assert/strict` | Node v24.21.0 locally (`engines` >=22.13 <23) | Unit tests | `npm test` = `node --experimental-strip-types --test lib/*.test.ts` [VERIFIED: package.json, `node --version`] |

### Supporting
None. **Do not add dependencies** (no zod/valibot: the validation is ~15 lines and the project style is hand-written `sanitize*` functions).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sequential writes + compensation (D-08) | Postgres RPC doing both writes in one transaction | Truly atomic, but needs new SQL from the owner — CONTEXT forbids unless unavoidable |
| Partial `upsert` (known path) | `update().eq()` for existing rows + `insert` for new | Removes reliance on A1, but needs a second code path and a race on first save; use only if the owner's temp-employee check fails |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed or added in this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
PATCH /api/employees  { id, nickname?, changes, details? }
   |
   v
auth (createServerSupabaseClient + getEditorAccess)  --no--> 403 {error}
   |
   v
readJsonObject(request) --bad/empty/non-object--> 400 «Некорректные данные.»
   |
   v
sanitizeEmployeeUpdate(changes) / sanitizeManualDetails(details)
   |  wrong type / bad photo url --> 400
   v
findKnownEmployee(id): 2 parallel selects (profiles row?, manual row?)  --DB error--> 500
   |
   +-- KNOWN (profile row or manual row) ------------------------------+
   |       (no Sheet, no Roblox)                                         |
   |                                                                     v
   +-- UNKNOWN: fetchSheetRows() --fail--> 503 «Таблица не отвечает…»   [manual row?]
           + readEmployeeProfiles --fail--> 503 (existing wording)        | yes: updateManualEmployee(details) FIRST
           nickname hint not in sheet --> 404 «Сотрудник не найден…»      |      zero rows & row gone --> 404
           seed = legacy profile row (nick-<key>) merged under changes    v
           |                                                       saveEmployeeProfile(partial upsert .select("*").single())
           +---------------------------------------------------------->  |  throws -> restore previous details -> 500 (profile reason)
                                                                          v
                                                  purgeCacheTag(employeesCacheTag)
                                                          |
                                                          v
              200 { employee: { id, ...storedProfile, [title, rank, callsign] }, ratingsPending?, detailsPending? }
                                                          |
                                                          v
              editor: card = { ...selected, ...payload.employee }  (avatar, nickname, source kept)
```

### Recommended Project Structure
```
lib/
├── portia-employees.ts        # edit: sanitizers, saveEmployeeProfile, findKnownEmployee, saveEmployeePatch, fetchSheetRows, RobloxProfile.name
├── portia-employees.test.ts   # edit + extend (existing home for these)
├── request-json.ts            # NEW (≈10 lines): readJsonObject(request)
└── request-json.test.ts       # NEW (picked up by the lib/*.test.ts glob)
app/api/employees/route.ts     # edit: thin handlers, status -> Response maps
app/api/editors/route.ts       # edit: POST uses readJsonObject
app/api/content/route.ts       # edit: PUT keeps 413 check, parses via try/catch -> 400
components/portia-editor.tsx   # edit: merge on save (1455-1457), send nickname, delete refusal by code (1552)
```

### Pattern 1: Partial sanitizer (D-01, D-09)
**What:** `sanitizeEmployeeUpdate` returns an object containing **only keys that were present**; `null` result means 400.
**Rules (all current behaviour is kept except the defaults):**
- `changes` not an object (incl. array) -> `null` -> 400. `{}` is valid (no-op save; still touches `updated_at`).
- `biography`: present -> must be string (else 400); `.slice(0, 20_000)` (existing cap).
- `photoUrl`: present -> must be string (else 400); `.trim().slice(0, 2048)`; non-empty must start `https://` or `/` else 400 (existing rule); `""` clears the photo (DB check allows `photo_url = ''`).
- each of the six rating keys: absent -> key absent; `null` or whitespace/empty string -> `null`; finite number or numeric string -> `Math.min(10, Math.max(1, Math.round(n)))` (keeps existing clamp test); **anything else (boolean, object, array, non-numeric string) -> 400** (today it silently leaves unchanged).
- `knowledgeRating`: **ignored completely, never written** (today the route overwrites it with the stored value; "Знания" is no longer edited). Drop it from the update type.
- `EmployeeUpdate` becomes `Partial<Pick<EmployeeProfile, "biography" | "photoUrl" | OptionalRatingKey>>`.
- `sanitizeManualDetails`: returns `{title?, rank?, callsign?}` with only present keys; each present key must be a string (else 400), `.trim().slice(0, 64)`; absent `details` entirely = no details change. Hoist the duplicated `text` closure (closes 03.3-IN-02).

The old whole-profile request is a subset of this contract (same envelope `{ id, changes, details }`), so it needs no special code; a stale client that sends `knowledgeRating` is simply ignored.

### Pattern 2: Partial upsert returning the stored row (EMP-01, D-07)
**What:** keep `saveEmployeeProfile`'s upsert and its missing-column fallback; write only defined keys; chain `.select("*").single()` to get the stored row and return `profileFromRow(row)`.
**Why:** the schema has defaults for every NOT NULL column, so a partial INSERT is valid, and the existing select policy lets `.select()` read the row back [VERIFIED: supabase/portia_setup.sql:19-26, 153-175]:
`biography text not null default '' …`, `photo_url text not null default '' …`, `knowledge_rating integer not null default 1 …`, `grant insert, update on table public.portia_employee_profiles to authenticated;`, and `create policy "Public can read PORTIA employee profiles"`.
**Row shape to write:**
```typescript
// Source: lib/portia-employees.ts:412-431 (current), reworked
const base = {
  employee_id: employee.id,
  ...(employee.nickname ? { nickname: employee.nickname } : {}),   // omit on the known-profile path: keeps the stored one
  ...(profile.biography === undefined ? {} : { biography: profile.biography }),
  ...(profile.photoUrl === undefined ? {} : { photo_url: profile.photoUrl }),
  updated_at: new Date().toISOString(),
  updated_by: userId,
};
// ratings: the existing optionalRatings.flatMap(...) line stays as is (undefined = leave out, null = clear)
```
Keep the fallback exactly: `if (!isMissingColumnError(error) || !Object.keys(ratings).length) throw error;` then retry `upsert(base)` and report `ratingsSaved: false` [VERIFIED: lib/portia-employees.ts:67-69 `error?.code === "PGRST204" || error?.code === "42703"`].
**The STATE.md [Phase 7] concern (employee with no stored profile row):** a partial object that omits `biography`/`photo_url`/`knowledge_rating` inserts with the column defaults above. The one risk is the ON CONFLICT branch, see A1.

### Pattern 3: Known-id lookup, then sheet-only for unknown ids (EMP-03, D-04..D-06)
```typescript
// Source: pattern from readManualEmployees (lib/portia-employees.ts:274-288) + supabase-js maybeSingle
export async function findKnownEmployee(supabase: SupabaseClient, id: string) {
  const [profile, manual] = await Promise.all([
    supabase.from("portia_employee_profiles").select("employee_id").eq("employee_id", id).maybeSingle(),
    supabase.from(manualTableName).select("employee_id, nickname, title, rank, callsign").eq("employee_id", id).maybeSingle<ManualRow>(),
  ]);
  if (profile.error) throw profile.error;
  if (manual.error && !isMissingTableError(manual.error)) throw manual.error;   // missing table = no manual employees
  return { hasProfile: Boolean(profile.data), manual: manual.error ? null : manual.data };
}
```
- Known (`hasProfile || manual`): save at once; **no `fetch` of any kind**.
- Unknown: new exported `fetchSheetRows()` (`fetch(sheetCsvUrl, { cache: "no-store", signal: AbortSignal.timeout(8_000) })` + `parseCsv`; factor it out of `loadEmployees` lines 316 and 323-324 so the URL stays in one place). Failure/non-OK -> status `sheet-unavailable` -> 503 «Таблица не отвечает, попробуйте через минуту.» (never 404). Then `readEmployeeProfiles(supabase)`; if it throws -> keep the existing 503 «Профили сотрудников не загрузились. Обновите страницу через минуту.» (this is the only path where a blank row could shadow a legacy profile, so the old gate stays here and is dropped from the known path).
- Newcomer identity: see Open Question 1. With the recommended nickname hint: `rosterFromRows(rows, new Map(), index.robloxIdByNickname)` (no Roblox) gives the sheet nicknames; require `hint` to be one of them (case-insensitive via `nicknameKey`), take the sheet's spelling as `employee.nickname`, accept `id` only if it matches `/^roblox-\d+$/` or equals `employeeId(nickname, null)`.
- Unknown-path write is a **full** row: `seed = profiles.byId.get(id) ?? profiles.byId.get(employeeId(nickname, null))` (the legacy `nick-<key>` row that `withProfile` already falls back to, lines 251-255); write `{...profileOf-without-knowledge(seed ?? emptyProfile), ...changes}`. Otherwise a one-field first save would hide a legacy `nick-…` biography behind a fresh row (Pitfall 3).

### Pattern 4: Manual details first, compensate on profile failure (EMP-04, D-08)
Order for a manual employee (row found by `findKnownEmployee`):
1. If `details` has keys: `updateManualEmployee(supabase, { id } as RosterEmployee-ish, details)`. Today a zero-row result is always reported `pending-database` (03.3-WR-03 b). Add a status `not-found`: on zero rows, re-select the row; if it still exists -> `pending-database` (missing update policy), if gone -> `not-found` -> 404 «Сотрудник не найден. Обновите страницу.» and **do not write the profile**.
2. `pending-database` (42501 / missing table / policy absent): continue to the profile write and return `detailsPending: true` (current editor behaviour at `portia-editor.tsx:1458-1460`).
3. `saveEmployeeProfile(...)`. If it throws: call `updateManualEmployee` again with the **previous values of only the keys that were changed** (taken from the row `findKnownEmployee` already read), inside its own try/catch that only logs, then rethrow so the route answers 500 «Не удалось сохранить профиль. Звание, ранг и позывной не изменены.» (wording is discretion). If the restore itself fails, log it and answer with the same message — documented residual risk, last-write-wins already accepted (D-02).
4. Skip step 1 entirely when `details` is empty (`update({})` must not be sent).
`details` sent for a non-manual id is ignored (as today: `employee.source === "manual" ? … : null`).

### Pattern 5: Roblox canonical nickname (EMP-09, D-10, D-11)
**CONTEXT says `resolveRobloxProfiles` "already returns Roblox's own `name`". It does not.** Verbatim: `type RobloxProfile = { id: number; avatarUrl: string; fullAvatarUrl: string };` and `byName.set(nicknameKey(user.requestedUsername || user.name), { id: user.id, avatarUrl: headshots.get(user.id) ?? "", fullAvatarUrl: fullAvatars.get(user.id) ?? "" });` [VERIFIED: lib/portia-employees.ts:86, 166]. The Roblox payload type already carries `name: string` (line 149), so the change is:
- add `name: string` to `RobloxProfile` and `name: user.name` in the `byName.set` (line 166);
- `addManualEmployee`: insert and return `nickname: found.name` instead of `input.nickname` (lines 354-360 and 369); duplicate detection is already case-insensitive (`nicknameKey`) so it is unaffected;
- `mergeManualEmployees`: `nickname: profile?.name ?? row.nickname` (D-11, read-time only, no DB rewrite). Its dedupe against the sheet uses `row.nickname` lowercase, unchanged.
- Existing test fixtures build `RobloxProfile` objects without `name` (e.g. `new Map([["alpha", { id: 7, avatarUrl: "", fullAvatarUrl: "" }]])`, test line ~197); `tsc --noEmit` includes `**/*.ts`, so either add `name` to the fixtures or declare it `name?: string`. Prefer the smaller diff: required `name` in the Roblox producer, fixtures updated, since a missing name would silently reintroduce the bug.

### Pattern 6: Machine-readable sheet-delete refusal (D-12)
Server (`app/api/employees/route.ts:107`): `Response.json({ error: "Нельзя удалить сотрудника из таблицы.", code: "sheet-employee" }, { status: 403 })` — keep status 403 and the exact text. Client (`portia-editor.tsx:1552`): change the type to `{ id?: string; error?: string; code?: string }` and the condition to `response.status === 403 && payload.code !== "sheet-employee"` (session-expired message). The auth-failure 403 has no `code`, so the two stay distinguishable [VERIFIED: current condition `response.status === 403 && !payload.error?.includes("таблицы")`].

### Pattern 7: EMP-10 closes by rule, no behaviour change (D-13)
Current: `// The sheet has 34 numbered staff slots (rows 2-35); row 36 onwards holds totals and notes.` / `const staffRowsEnd = 35;` [VERIFIED: lib/portia-employees.ts:90-91]. `rows.slice(1, staffRowsEnd)` (line 190) = sheet rows 2..35 = 34 slots, correct. Add to the comment: the owner confirmed (2026-10-20) the sheet has exactly 34 places and rows after 34 are never filled, so there is no raise and no warning; if the sheet ever grows, change this constant and the comment. Update the EMP-10 line in `.planning/REQUIREMENTS.md` (line 27) to state the rule; the existing test «only the 34 staff slots are read» already pins it.

### Pattern 8: One JSON guard for all routes (ROB-02, D-14)
```typescript
// lib/request-json.ts — NEW
/** The body as a plain object, or null for an empty, non-JSON, array, null or primitive body. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
}
```
- employees PATCH (`route.ts:33`), POST (`:69`), DELETE (`:102`), editors POST (`editors/route.ts:33`): `const body = await readJsonObject(request); if (!body) return Response.json({ error: "Некорректные данные." }, { status: 400 });`
- Order matters: keep **auth first** (403), then JSON (400). An unauthenticated caller sees 403 regardless of body.
- employees POST today: `sanitizeManualEmployee(await request.json())` — pass `body` instead. `sanitizeManualEmployee` already rejects non-objects.
- content PUT: keep the existing `raw.length > 2_000_000` -> 413 check and `await request.text()`; replace `JSON.parse(raw) as {…}` (line 44) with a try/catch that yields the same 400 «Некорректные данные.», and require a non-array object (`body.content` of a `null` body currently throws -> 500). The existing 400 «Некорректная структура данных.» for a bad `content`/`revision` stays.
- **editors DELETE has no JSON body** — it reads `?email=` and already returns 400 «Некорректный email.» for a bad value (`editors/route.ts:67-68`). Nothing to change there; D-14's "editors (POST/DELETE)" is satisfied for DELETE already. State this in the plan so a task is not invented.
- employees DELETE currently: `typeof body?.id !== "string"` after `request.json()`; a `null` JSON body passes `?.`, but empty/garbage throws -> 500. Replace with the helper.
- `POST /api/editors` is **not** inside a try/catch today; an unguarded throw there is a framework 500 with no body. The helper removes the throw; no try/catch needed.

### Anti-Patterns to Avoid
- **Loading the roster to find one employee** (`loadEmployees` in PATCH): the whole bug. `loadEmployees` stays for GET and POST/DELETE.
- **Calling `resolveRobloxProfiles` anywhere on the PATCH path**, including "just for the nickname spelling".
- **Writing `knowledge_rating` from the request** (old behaviour wrote the stored value back; new behaviour must not write it).
- **Matching Russian strings in the client** for control flow.
- **A try/catch per sanitizer**: sanitizers return `null`; the route turns `null` into 400 (existing pattern).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Partial update of a row | Manual read-modify-write of the profile | PostgREST upsert of only the sent columns + `.select("*").single()` | One round trip, no lost-update window beyond accepted last-write-wins |
| Reading the merged result | A second SELECT after the write | `.select()` chained on the upsert | Returns the stored row |
| "Known id" test | Reading the whole `portia_employee_profiles` | Two `eq("employee_id", id).maybeSingle()` selects | O(1) |
| Mapping a stored row to a profile | New mapper | `profileFromRow` (lib/portia-employees.ts:220) | Already clamps junk ratings to `null` |
| Missing-table / missing-column tolerance | New error sniffing | `isMissingTableError`, `isMissingColumnError` (lines 67-74) | Keeps the "pending-database" tolerance |
| Status -> HTTP mapping | Throwing HTTP errors from lib | Status union + a `refusals` table in the route, as POST already does (`route.ts:76-83`) | Existing pattern; lib stays testable |
| Roster id for a legacy profile | New lookup | `withProfile` fallback `employeeId(employee.nickname, null)` (line 253) | Same rule the reader uses |

**Key insight:** the phase is a rework of defaults and ordering, not new machinery; every helper it needs exists.

## Runtime State Inventory

Not a rename/migration phase. One data-shape note only:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `portia_manual_employees` rows keep the typed-casing nickname (D-11: not rewritten). Profile rows' `nickname` column may be stale for renamed sheet people if the known path omits it | None (read-time Roblox spelling); accept stale `nickname` on profile rows (see A3) |
| Live service config | None — verified: no Netlify/Supabase setting is touched | None |
| OS-registered state | None | None |
| Secrets/env vars | None; `.env.local` exists but is not needed | None |
| Build artifacts | None | None |

## Common Pitfalls

### Pitfall 1: Sheet newcomer id cannot be derived without Roblox
**What goes wrong:** the id the editor sends is `roblox-<N>` (from the full roster); the sheet only has nicknames. A sheet-only check cannot match `roblox-<N>`, so a first-time save would be a false 404 again (the exact bug).
**How to avoid:** Open Question 1 (nickname hint). Test: unknown `roblox-5` + hint "Fox" present in sheet -> saved; hint absent from sheet -> 404; sheet down -> 503; no Roblox URL in `fetch` mock calls.

### Pitfall 2: Partial upsert and the ON CONFLICT branch (A1)
**What goes wrong:** if PostgREST's `DO UPDATE SET` covered all table columns (not just the payload's), a one-field save would reset `biography` to its default. The supabase-js `upsert` for a single object sends **no** `columns` parameter [VERIFIED: node_modules/@supabase/postgrest-js/dist/index.cjs:3263-3269 — `columns` is set only `if (Array.isArray(values))`]; the existing code already relies on omitted rating keys being left alone [VERIFIED: existing test «a rating key missing from the update is left out of the row», lib/portia-employees.test.ts:135-143, but that test uses an in-memory fake, not PostgREST].
**How to avoid:** the only authoritative check is D-03: on a **temporary manual employee**, save only the biography, then only one rating, then only the photo, reading the profile after each; nothing else may change. Do it in the plan's manual checkpoint (the owner's rule: never on a sheet employee, never `PUT /api/content`).
**Fallback if it fails:** known-row path uses `update().eq("employee_id", id).select("*").single()` for existing rows and `insert` only when no row exists (the lookup already knows which).

### Pitfall 3: Legacy `nick-<key>` profile hidden by a fresh `roblox-<N>` row
`withProfile` falls back from `roblox-N` to `nick-<key>` only when the `roblox-N` row does not exist. A partial first save creates `roblox-N` with defaults for everything not sent, so the legacy biography/ratings vanish from the card. **Avoid:** on the unknown path write a full row seeded from the legacy row (Pattern 3). Needs a unit test.

### Pitfall 4: The editor card is replaced by the PATCH answer
`portia-editor.tsx:1455-1457` does `setEmployees(... payload.employee!)` and `onSaved(payload.employee)`; `portia-desktop.tsx:393-396` (`updateEmployee`) also replaces the entry and writes the roster to `localStorage`. With a profile-only answer the avatar, nickname, `source` and sheet title would be lost on screen and in the device cache. **Avoid:** in `save`, build `const saved = { ...selected, ...payload.employee }` once and use it for `setEmployees`, `onSaved`, `setDraft(profileOf(saved))` and `setDetails(detailsOf(saved))`. `selected` cannot change while saving (switching is gated on `state !== "saving"`, line ~1520). The add path (`addEmployee`, line ~1492) keeps using the full POST answer unchanged.

### Pitfall 5: Auth runs before JSON, so unauthenticated curl never shows the 400
Criterion 3 cannot be proven by anonymous `curl`; it returns 403 first. Prove it with unit tests of `readJsonObject` plus a route-shape review, and one owner-session check (Validation Architecture, manual row).

### Pitfall 6: `update({})` and empty details
Do not send an empty update to PostgREST (`details: {}` or all-absent keys); skip the write. Also never default absent detail keys to `""` (that is IN-02, "`{}` wipes the fields").

### Pitfall 7: Stale `nickname` on profile rows
The known path no longer refreshes `portia_employee_profiles.nickname` (it is not known without the sheet). Effect: only the "Roblox down" id-stability fallback (`robloxIdByNickname`, line ~244) could miss a renamed person until the next newcomer-style write. Low impact; note as `shortcut:` comment.

### Pitfall 8: `ratingsSaved: false` fallback on a one-rating save
If the rating columns are absent and only ratings were sent, the retry upserts `base` (metadata only) and reports `ratingsPending: true`. Correct; keep the response flag so the editor's existing «pending» notice still shows.

### Pitfall 9: DELETE and POST still use the slow `loadEmployees`
Out of scope for EMP-03 (profile save only). They keep working; DELETE's 404/500 on a sheet outage is unchanged. Do not widen the phase.

## Code Examples

### Route PATCH (shape, not final code)
```typescript
// Source: app/api/employees/route.ts:26-59 (current), restructured
const body = await readJsonObject(request);
if (!body) return Response.json({ error: "Некорректные данные." }, { status: 400 });
const id = typeof body.id === "string" ? body.id : "";
const changes = sanitizeEmployeeUpdate(body.changes);
const details = body.details === undefined ? {} : sanitizeManualDetails(body.details);
if (!id || !changes || !details) return Response.json({ error: "Некорректные данные." }, { status: 400 });
const result = await saveEmployeePatch(supabase, data.user.id, { id, nickname: body.nickname, changes, details });
if (result.status !== "saved") {
  const refusals = {
    "not-found": { error: "Сотрудник не найден. Обновите страницу.", status: 404 },
    "sheet-unavailable": { error: "Таблица не отвечает, попробуйте через минуту.", status: 503 },
    "profiles-unavailable": { error: "Профили сотрудников не загрузились. Обновите страницу через минуту.", status: 503 },
  };
  const { error, status } = refusals[result.status];
  return Response.json({ error }, { status });
}
await purgeCacheTag(employeesCacheTag);
return Response.json({ employee: result.employee, ratingsPending: result.ratingsPending, detailsPending: result.detailsPending }, { headers: noStoreHeaders });
```
Keep the outer `try/catch` -> 500 «Не удалось сохранить профиль.» (the details-restore message is thrown from lib as a typed error or returned as a status; planner's choice).

### Editor merge (D-07) and delete code (D-12)
```typescript
// Source: components/portia-editor.tsx:1455-1457 and :1552 (current), minimal change
const merged = { ...selected, ...payload.employee };
setEmployees((current) => current.map((employee) => employee.id === merged.id ? merged : employee));
onSaved(merged);
setDraft(profileOf(merged));
if (!payload.detailsPending) setDetails(detailsOf(merged));
// delete:
const message = response.status === 403 && payload.code !== "sheet-employee" ? "Сессия редактора истекла. Войдите в редактор снова." : payload.error || `Сервер отклонил удаление (${response.status}).`;
```
Send `nickname: selected.nickname` in the PATCH body (Open Question 1). The response type must allow a profile-only `employee`: `Partial<PortiaEmployee> & { id: string }`.

### Test double extension
The existing `fakeTable` only models `upsert` returning `{ error }` (no `.select().single()`), and `manualTable` models read/insert/delete/update on the manual table only. Extend them (or add one `fakeDb(from(table))` router) so a test can: (a) look up by `eq("employee_id", id).maybeSingle()` on both tables, (b) `upsert(...).select("*").single()` returning the merged row, (c) fail the profile upsert while the manual update succeeds, and assert the second manual update restores the previous values. Stub the sheet with `t.mock.method(globalThis, "fetch", …)` exactly as `stubRoblox` does (test lines ~262-275) and assert that **no recorded URL contains `roblox.com`**.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Whole-profile PATCH with defaults | Partial PATCH, absent = unchanged | This phase | Stale/single-field clients cannot wipe data |
| Roster load (Sheet + Roblox) per save | Id lookup in the DB; sheet only for newcomers | This phase | Seconds -> two indexed selects |
| Russian string as control flow | `code` field | This phase | Wording can change safely |

**Deprecated/outdated:** the `changes.knowledgeRating = employee.knowledgeRating` overwrite in the route (line 42) — remove with the rework.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgREST `ON CONFLICT DO UPDATE` for a single-object upsert updates only the columns present in the payload (omitted columns keep their stored value; omitted NOT NULL columns take defaults on first insert). The PostgREST docs page fetched this session states only the INSERT half ("Missing properties will be set to default values when applicable") and does not describe the conflict branch; a web search found no authoritative statement either way | Pattern 2, Pitfall 2 | One-field save resets biography/photo — the exact bug being fixed. Mitigated by the D-03 temp-employee check and the update/insert fallback |
| A2 | Editors are trusted to send a correct `id`/`nickname` pairing (the server cannot verify `roblox-N` <-> nickname without Roblox). Editors can already write any profile row directly under RLS (`Editors can create PORTIA employee profiles`) | Open Question 1 | A wrong pairing maps a nickname to another account's id in `robloxIdByNickname`; same capability exists today |
| A3 | A stale `nickname` column on profile rows (known path no longer refreshes it) has no user-visible effect other than the Roblox-outage id fallback | Pitfall 7 | A renamed sheet person could briefly get a `nick-…` id while Roblox is down |
| A4 | Keeping the numeric clamp (1-10) and numeric-string acceptance for ratings is wanted (existing test); only non-numeric types become 400 | Pattern 1 | If the owner wants out-of-range -> 400, one test changes |
| A5 | `details: {}` / `changes: {}` are valid no-ops rather than 400 | Pattern 1 | Cosmetic |

## Open Questions

1. **How is a never-saved sheet newcomer's id verified without Roblox? (decision needed before planning)**
   - What we know: D-05 says sheet only, no Roblox; D-06 says Roblox never needed. The id the editor holds for a newcomer is `roblox-<N>` whenever Roblox answered at roster load, and `nick-<key>` only when it did not. `employeeId()` is `roblox-${id}` or `nick-…` (line 134-136).
   - What's unclear: the sheet contains nicknames only, so `roblox-<N>` cannot be matched by the sheet alone.
   - Recommendation (A, honours D-05/D-06 literally): the PATCH body carries optional `nickname` (the editor sends `selected.nickname`; one added field). On an unknown id the server requires the hint to be a sheet nickname and `id` to be `roblox-<digits>` or `employeeId(nickname, null)`. A request without a hint for an unknown id gets the clear 404 «Сотрудник не найден. Обновите страницу.» Record `nickname` as part of the contract the Phase 8 client builds on (same reversibility class as D-07).
   - Alternative (B): on the unknown path only, call the existing `resolveRobloxProfiles` for the sheet nicknames and match the id; if Roblox fails, answer 503. This breaks D-06 for the first save of a newcomer, so choose it only if the owner prefers not changing the request.

2. **Wording of the compensation failure message** — «Не удалось сохранить профиль. Звание, ранг и позывной не изменены.» proposed; also what to say if the restore fails (same text plus a server log). Planner discretion (D-08).

3. **Should the known path refresh `nickname` when the client sends a hint?** Recommended no (keep it simple, A3).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | `npm test`, build | ✓ | v24.21.0 (project `engines` says >=22.13 <23) | — |
| npm / TypeScript | `npx tsc --noEmit` | ✓ | tsc 5.9.3 pinned; run is clean | — |
| Live Supabase (editor session) | Manual temp-employee check (A1), manual 400 check | Not probed (needs an editor login; D-03 forbids data scripts) | — | Owner-run manual checkpoint |
| Google Sheet / Roblox network | Not needed by automated tests (stubbed) | n/a | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** live editor session -> owner-run checkpoint.

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`, so this section is optional; it is included because the orchestrator asked for it.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` via `node --experimental-strip-types` [VERIFIED: package.json `test` script] |
| Config file | none (glob `lib/*.test.ts`) |
| Quick run command | `node --experimental-strip-types --test lib/portia-employees.test.ts lib/request-json.test.ts` |
| Full suite command | `npm test` (currently 204 pass, 0 fail), then `npx tsc --noEmit` (currently clean), `npm run lint`, `npm run build` |

Route files import `@/lib/...`, which plain node cannot resolve, so route logic must live in `lib/` to be unit-tested.

### Phase Requirements -> Test Map
| Req / Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------------|----------|-----------|-------------------|-------------|
| EMP-01 / C1 | One sent field leaves biography, photo, other ratings in the stored row; only keys sent appear in the upsert row; `null`/`""` clears just that rating | unit (fake db) | `node --experimental-strip-types --test lib/portia-employees.test.ts` | extend (existing tests at :114-156 need rewrite: they assert `knowledgeRating` defaulting) |
| EMP-01 / C1 | Wrong type (`biography: 5`, `pawsRating: true`, `photoUrl: "ftp://x"`) -> sanitizer returns `null` | unit | same | extend |
| EMP-01 / C1 | Old whole-profile body (all fields + `knowledgeRating`) still accepted; `knowledge_rating` never in the row | unit | same | extend |
| EMP-01 / C1 | Partial first save for an id with no profile row writes a row with only sent keys (+ nickname when given) | unit + A1 manual | same + owner checkpoint | extend |
| EMP-03 / C2 | Known id (profile row OR manual row): saved with zero `fetch` calls | unit with `fetch` mock asserting `calls.length === 0` | same | new |
| EMP-03 / C2 | Unknown id: exactly one fetch (sheet), no URL contains `roblox.com`; sheet 500/throw -> `sheet-unavailable` (not `not-found`); hint not in sheet -> `not-found` | unit | same | new |
| EMP-03 / C2 | Legacy `nick-` row seeds the first full row | unit | same | new |
| EMP-04 / C2 | Profile write fails after details write -> details restored to previous values; error is the profile reason; no restore when the details write was `pending-database`; zero rows + row gone -> `not-found` and no profile write | unit | same | new |
| EMP-04 / C2 | `details` with absent keys keep stored values; `""` clears; non-string -> 400 | unit | same | extend (:380-383 asserts the old defaults) |
| ROB-02 / C3 | `readJsonObject` returns `null` for empty body, `not json`, `[]`, `null`, `5`, `"x"`; returns the object for `{}` and `{"a":1}` | unit (`new Request(url, { method: "POST", body })`) | `node --experimental-strip-types --test lib/request-json.test.ts` | new |
| ROB-02 / C3 | Route returns 400 text «Некорректные данные.» for employees PATCH/POST/DELETE, editors POST, content PUT | grep guard + owner session | `grep -rn "request.json()\|JSON.parse(raw)" app/api` must return only `lib/request-json.ts`-style safe calls; manual call with the editor cookie (auth precedes JSON) | manual-only: needs a signed-in editor |
| EMP-09 / C4 | `addManualEmployee` inserts and returns `found.name` ("bOb" typed -> "Bob" stored); duplicate check still case-insensitive; `mergeManualEmployees` shows Roblox spelling, falls back to stored when Roblox did not answer | unit | `node --experimental-strip-types --test lib/portia-employees.test.ts` | extend (:327-340) |
| EMP-09 / C4 | DELETE of a sheet id returns 403 with `code: "sheet-employee"` and the unchanged text; editor source no longer contains `includes("таблицы")` | grep guard | `grep -n 'includes("таблицы")' components/portia-editor.tsx` must be empty; `removeManualEmployee` sheet test already exists (:342) | partly exists |
| EMP-10 / C5 | `staffRowsEnd` rule comment present; the 34-slot test still passes | unit + grep | `grep -n "staffRowsEnd" lib/portia-employees.ts`; existing test :22 | exists |
| types / all | Editor merge compiles with profile-only `employee` | typecheck | `npx tsc --noEmit` | n/a |

### Sampling Rate
- **Per task commit:** the quick run command above.
- **Per wave merge:** `npm test && npx tsc --noEmit`.
- **Phase gate:** `npm run check` (test + build + lint) green, then the owner-run manual checkpoint below, before `/gsd-verify-work`.

### Manual checkpoint (cannot be automated, per D-03)
With an editor session on `localhost:3123`, **on a temporary employee outside the sheet only** (add via «+ ВНЕ ТАБЛИЦЫ», delete afterwards; never a sheet employee; never `PUT /api/content`): save biography only -> reload; set one rating -> others unchanged; clear that rating -> only it empties; change title only -> rank/callsign unchanged; send a broken body (e.g. devtools `fetch` with `body: "x"`) -> 400 text, not 500; try «Удалить» on a sheet employee -> the «Нельзя удалить сотрудника из таблицы.» message (not the session-expired text). This also closes A1.

### Wave 0 Gaps
- [ ] `lib/request-json.test.ts` — covers ROB-02
- [ ] A fake-db router (or extend `fakeTable`/`manualTable`) that supports `eq().maybeSingle()` and `upsert().select().single()` — covers EMP-01/03/04
- [ ] No framework install needed

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high) in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | Supabase session via `createServerSupabaseClient` (existing) |
| V3 Session Management | no change | Supabase cookies (existing) |
| V4 Access Control | yes | `getEditorAccess` stays the first check in every handler; the RLS policies already enforce `portia_can_edit()`; the sheet-delete refusal stays decided before any DB call (T-03.3-02, `removeManualEmployee`) |
| V5 Input Validation | yes | Hand-written `sanitize*` returning `null` -> 400; caps kept (biography 20 000, photo 2048, details 64); `photoUrl` allow-list `https://` or `/`; new: `id` must be a non-empty string, bounded length (add a cap, e.g. 64); `nickname` hint trimmed and capped |
| V6 Cryptography | no | none |
| V7 Error handling / logging | yes | 400/503 with fixed Russian text; internals only in `console.error`; never echo `error.message` to the client |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed body causing unhandled 500 / stack in logs | Denial of Service | `readJsonObject` before any property access |
| Client-supplied `id`/`nickname` pairing written to the DB | Tampering | Editor-only (RLS + `getEditorAccess`); sheet membership checked for the nickname; format-check the id (A2) |
| Mass-assignment of unexpected columns | Tampering | The row is built from an explicit allow-list of keys; `employee_id`, `updated_by` come from the server, never the body |
| Wipe via stale/partial client | Tampering | Partial semantics (this phase) + the `profilesRead` gate kept on the only wipe-capable path (unknown id) |
| Sheet-employee deletion by crafted request | Elevation | Refusal by roster source before any delete (existing) |
| Oversized content body | DoS | Existing 2 MB check stays before parse |
| Information leak in new `code` field | Info disclosure | A constant string, no data |

## Sources

### Primary (HIGH confidence) — files read this session
- `C:/Users/User/code/portia-site/lib/portia-employees.ts` (whole file), `app/api/employees/route.ts`, `app/api/editors/route.ts`, `app/api/content/route.ts`, `app/api/access/route.ts`, `lib/editor-access.ts`, `lib/portia-cdn.ts` (headers)
- `components/portia-editor.tsx` lines 1400-1580, `components/portia-desktop.tsx:393-401`
- `supabase/portia_setup.sql` lines 19-40, 153-226
- `lib/portia-employees.test.ts` (fake clients, Roblox stub, existing assertions), `package.json`, `tsconfig.json`, `.planning/config.json`
- `node_modules/@supabase/postgrest-js/dist/index.cjs:3255-3280` (upsert implementation)
- `.planning/milestones/v1.0-phases/PORTIA-03.3-.../03.3-REVIEW.md` (WR-03, IN-01..IN-04 text)
- Commands run: `npm test` (204 pass), `npx tsc --noEmit` (clean)

### Secondary (MEDIUM confidence)
- [PostgREST tables/views reference](https://docs.postgrest.org/en/stable/references/api/tables_views.html) — INSERT defaults for missing properties; does not state the ON CONFLICT column set

### Tertiary (LOW confidence)
- Web search on PostgREST partial upsert — no authoritative statement of the conflict-update column set (hence A1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; versions read from package.json/node_modules
- Architecture: HIGH — every touched function was read; one open design conflict (Open Question 1) is identified, not guessed
- Pitfalls: HIGH for code-level ones; MEDIUM for A1 (PostgREST conflict branch), with a prescribed check and fallback

**Research date:** 2026-10-20
**Valid until:** 2026-11-19 (stable; re-check if `@supabase/supabase-js` or `next` is bumped)
