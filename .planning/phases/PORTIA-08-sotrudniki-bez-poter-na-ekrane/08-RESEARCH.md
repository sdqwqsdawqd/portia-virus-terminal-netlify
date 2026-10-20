# Phase 8: Сотрудники без потерь на экране - Research

**Researched:** 2026-10-20
**Domain:** React 19 client state for the employee data path (editor tab + public Personnel window), Next 16 route handlers behind the Netlify CDN
**Confidence:** HIGH (everything is in-repo code read this session; the only external fact is the Netlify cache key, handled by a mechanism that does not depend on it)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward (locked earlier, not re-asked)**
- **D-01:** Concurrent edits of one employee: last write wins (AR-03.2-01). No locking or version checks.
- **D-02:** PATCH contract from Phase 7: absent field = unchanged, `null`/empty clears that field only, wrong type = 400. The response is the stored profile only; the editor merges it onto the existing card (Phase 7 D-07).
- **D-03:** Saves are verified only on a temporary employee outside the sheet; no script calls `PUT /api/content`.

**Набор во время сохранения (EMP-05)**
- **D-04:** Fields stay editable while a save is in flight. Text typed after the request was sent stays in the field; when the answer arrives, the draft is NOT replaced — only the fields still equal to what was sent take the server copy. If anything was typed meanwhile, the draft stays dirty: «СОХРАНЕНО» is not shown, the leave/switch guard still asks, and the editor presses «СОХРАНИТЬ» again. No automatic second save. Same behaviour as the content editor.
- **D-05:** Clicking another employee while a save is in flight is remembered, not ignored. After the answer for employee A, the editor opens employee B (if A has no newer unsaved edits; otherwise the usual unsaved-changes dialog). The answer for A is never applied to B's draft — the response is matched by id to the employee it was sent for.
- **D-06:** The «СОХРАНЕНО» timer is held in a ref, cleared before each new save and on unmount, so an earlier timer never flips a later save to idle (03.1-WR-06; mirror the desktop's `saveStateTimer`).

**Сайт при сбое чтения (EMP-06)**
- **D-07:** When profiles or manual employees fail to read, the visitor silently keeps the last good biographies, ratings, photos and manual employees — no "may be outdated" notice. The degraded answer only refreshes what it did read (roster / avatars / sheet fields). The device cache (`employeesCacheStorageKey`) is never overwritten by a degraded answer.
- **D-08:** First visit with no cache and profiles not read: the card says the profile did not load (e.g. «Профиль временно не загрузился») instead of «Биография не заполнена» and «—» ratings. Roster, titles and avatars still show. Exact wording is Claude's discretion, short, in the existing style.

**Редактор при неполном списке (EMP-02)**
- **D-09:** The editor accepts the list only when `profilesRead === true` (absent key = reject; covers old cached copies — 03.2-WR-02). Otherwise the tab shows a clear error with a «ПОВТОРИТЬ» button that reloads the list in place — no page reload, other tabs' unsaved edits untouched. No auto-retry.
- **D-10:** The editor loads `/api/employees` bypassing the CDN cache, so it always works from the current database. Note: client `cache: "no-store"` alone does not bypass Netlify's `Netlify-CDN-Cache-Control` (`lib/portia-cdn.ts`) — researcher must pick a mechanism that actually reaches the origin (e.g. a distinct editor request the CDN does not cache). The public visitor path keeps its CDN caching.
- **D-11:** The editor sends only fields that differ from the loaded profile (plus the id / required identity); `profileOf` must not turn a missing rating key into an explicit `null`.

### Claude's Discretion
- Photo fix (EMP-07, 03.1-WR-05): reset `EmployeeImage` state when `src` changes (e.g. `key={src}`) at both call sites.
- Empty list (EMP-08, 03.3-WR-04): render the list aside with «+ ВНЕ ТАБЛИЦЫ» and the add form even with no employees or after deleting the last one; the empty state applies only to the profile pane. Wording and whether the form opens by default are Claude's choice.
- How "only changed fields" and the sent-snapshot comparison are implemented (reuse `profileChanged` / `profileOf` in `lib/portia-employees.ts`).
- Whether the public GET adds a `manualRead` flag or the client merges back known manual entries when `degraded` is true (03.3-WR-02 offers both).
- Exact Russian wording of the new error / unavailable texts.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMP-02 | Editor sends only changed fields and saves only on a fully read list (`profilesRead === true`) | Pattern 1 (`changedFields`), Pattern 2 (`acceptsEditorList` + ПОВТОРИТЬ), Pattern 3 (editor-only no-store route for D-10) |
| EMP-05 | Text typed during a save is kept; response never overwrites another employee's draft; «СОХРАНЕНО» timer reset | Pattern 4 (`settleDraft`, queued switch, timer ref, id-matched apply) |
| EMP-06 | Read failure keeps last good data on the visitor's screen; device cache not overwritten by partial data | Pattern 5 (`mergeEmployeesAnswer`, `manualRead` on the GET, cache only on a complete answer, D-08 text) |
| EMP-07 | Corrected photo URL shows at once | Pattern 6 (`EmployeeImage` keyed wrapper) |
| EMP-08 | «+ ВНЕ ТАБЛИЦЫ» and the add form work with an empty list | Pattern 7 (restructure the render: aside always, empty state only in the profile pane) |
</phase_requirements>

## Summary

Phase 8 is a client-side phase on top of a finished server contract. No new packages are needed: every fix is React state discipline plus a handful of pure helpers in `lib/portia-employees.ts` (testable with the existing `node --test` setup) and one small server addition (flag `manualRead` on the public GET, and an editor-only, never-cached read route). The two big components (`components/portia-editor.tsx`, `components/portia-desktop.tsx`) are touched in disjoint places, so editor work and desktop work can run as parallel plans after a shared lib/server plan.

The biggest design traps are (1) the CDN: the public GET is cached by path (`Netlify-CDN-Cache-Control` with `s-maxage`), so the editor needs a **different path** that is gated to editors and answered with `noStoreHeaders`; a query parameter is not a reliable mechanism (see A1); (2) the editor's `dirty` flag is *derived* (`profileChanged(profileOf(selected), draft)`), so the cleanest D-04 implementation is to update the baseline (`employees` entry) from the server answer and update the draft only field-by-field — dirty then falls out correctly with no extra flag; (3) the desktop persists the whole payload to localStorage and also re-dumps its in-memory state from `updateEmployee`, so a degraded state can leak into the cache through the editor save path unless that path is changed to patch the cached array instead of dumping state.

**Primary recommendation:** Three plans: (1) lib helpers + tests, `manualRead` on GET, new `GET /api/employees/editor` (no-store, editor-gated); (2) desktop: merge-on-degraded, cache only on complete answers, "profile did not load" card text, keyed `EmployeeImage`, cache-patching `updateEmployee`; (3) editor: `loadList`/ПОВТОРИТЬ, diff-only save with sent-snapshot reconcile, queued employee switch, timer ref, always-rendered list aside. Plans 2 and 3 are file-disjoint and can be one wave.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Editor reads a guaranteed-fresh, fully read roster | API / Backend (new no-store route) | Browser (accepts only `profilesRead === true`) | CDN keys by path; only a distinct uncached path reaches the origin |
| Only changed fields sent | Browser (diff against loaded profile) | API (already partial, Phase 7) | Server contract already treats absent = unchanged |
| Typing during save kept; id-matched apply | Browser | — | Pure client state |
| Last-good data on read failure | Browser (merge + localStorage) | API (exposes `profilesRead`, `manualRead`) | Server cannot know what the client last showed; it can only say what it read |
| Device cache never overwritten by partial data | Browser (localStorage) | — | Cache is client-owned |
| Fixed photo shows at once | Browser (`EmployeeImage` state) | — | Image load state is local to the component |
| Add control with empty list | Browser (render structure) | API (POST already works for an empty roster) | Dead end is a render early-return |

## Standard Stack

### Core
No new libraries. Existing, versions read from `package.json` this session:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.2 | Route handlers (`app/api/employees/**`) | Already the app framework [VERIFIED: package.json] |
| react / react-dom | 19.2.6 | Component state, refs | Already in use [VERIFIED: package.json] |
| @netlify/functions | ^6.0.2 | `purgeCache` (already used by `lib/portia-cdn.ts`) | Existing [VERIFIED: package.json] |
| node:test | node built-in | Unit tests for lib helpers (`node --experimental-strip-types --test lib/*.test.ts`) | Existing `npm test` script [VERIFIED: package.json `"test"`] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New editor-only route | `?editor=1` query param on `/api/employees` | Unreliable: the repo comment says the Netlify Next.js runtime keys this cache by path only (route.ts line 12-13), while Netlify docs say query strings are part of the key for function responses by default. The two disagree; a distinct path works under either reading. |
| New editor-only route | `Netlify-Vary: header=…` / `cookie=…` on the public GET | Changes the visitor path's cache keying (D-10 says it keeps its CDN caching); more moving parts |
| `key={src}` at each call site | Keyed wrapper component | Three `EmployeeImage` usages exist (full avatar, portrait in `<a>`, portrait in `<figure>`), not two; a wrapper fixes all of them in one place |

**Installation:** none. **Package Legitimacy Audit:** not applicable — this phase installs no external packages.

## Architecture Patterns

### System Architecture Diagram

```
                          Google Sheet  Roblox API  Supabase (profiles, manual rows)
                                   \         |         /
                                    loadEmployees()  ->  { employees, syncedAt, complete,
                                         |                 profilesRead, manualRead }
              +--------------------------+---------------------------+
              |                                                      |
   GET /api/employees (public, CDN-cached)             GET /api/employees/editor (NEW)
   body: { employees, syncedAt, degraded,              editor access check -> 403 if none
           profilesRead, manualRead(NEW) }             noStoreHeaders, same body shape
              |                                                      |
   portia-desktop fetchEmployees                       EmployeeProfilesEditor.loadList
              |                                                      |
   mergeEmployeesAnswer(previous, answer)              accept only profilesRead === true
     complete  -> take all, write cache                  else -> error pane + «ПОВТОРИТЬ» (loadList again)
     degraded  -> keep old profiles / manual /           ok -> employees + draft
                  avatars; DO NOT write cache                    |
              |                                         edit draft (fields stay editable)
   Personnel window (+ "profile did not load"           save: PATCH { id, nickname,
   text when no profile data ever read)                          changes: changedFields(...),
              ^                                                  details: changedDetails(...) }
              |  onSaved(merged) / onRemoved(id)                 |
              +--------------------------------------------------+
                  updateEmployee patches the CACHED array (not state dump)
                  answer applied by id: baseline <- server copy;
                  draft <- settleDraft(sent, current, stored); queued switch resolved
```

### Recommended Project Structure
```
lib/portia-employees.ts        # + changedFields, changedDetails, settleDraft, acceptsEditorList, mergeEmployeesAnswer
lib/portia-employees.test.ts   # + tests for each (pure, node:test)
app/api/employees/route.ts     # GET adds manualRead
app/api/employees/editor/route.ts   # NEW: GET only, editor-gated, noStoreHeaders
components/portia-editor.tsx   # EmployeeProfilesEditor rewrite of load/save/render skeleton
components/portia-desktop.tsx  # fetchEmployees, updateEmployee/removeEmployee, boot cache read, card text, EmployeeImage
```

### Pattern 1: Diff-only save (EMP-02, D-11)
**What:** Send only the keys whose value differs from the loaded profile; a rating missing on the loaded object counts as `null` for comparison but is never sent unless the user changed it. Same for manual `details`.
**Why it works with the existing code:** `profileChanged` already treats `saved[key] ?? null` and `draft[key] ?? null` as equal; the diff helper must use the same rule. `profileOf` can stay as is for building the *draft* (the draft is only compared, never sent whole). If the planner prefers to honour D-11 literally, `profileOf` may keep its `?? null` provided nothing sends the whole draft.
**Server accepts it:** `sanitizeEmployeeUpdate` keeps only keys that were sent, `null` clears a rating; `body.details === undefined ? {}` and `sanitizeManualDetails` is partial too [VERIFIED: app/api/employees/route.ts, lib/portia-employees.ts:392-403]. An empty `changes` object is valid and upserts only `employee_id` + `updated_at` + `updated_by`, then returns the stored row [VERIFIED: lib/portia-employees.ts `saveEmployeeProfile`], so a request with `changes: {}` is safe — but prefer not sending it (see Pitfall 6).
**Example (skeleton, `lib/portia-employees.ts`):**
```ts
export function changedFields(saved: EmployeeProfile, draft: EmployeeProfile): EmployeeUpdate {
  const update: EmployeeUpdate = {};
  if (draft.biography !== saved.biography) update.biography = draft.biography;
  if (draft.photoUrl !== saved.photoUrl) update.photoUrl = draft.photoUrl;
  for (const { key } of employeeRatings) {
    if ((saved[key] ?? null) !== (draft[key] ?? null)) update[key] = draft[key] ?? null;
  }
  return update;
}
export function changedDetails(saved: ManualDetails, draft: ManualDetails): Partial<ManualDetails> {
  return Object.fromEntries((["title", "rank", "callsign"] as const).filter((key) => saved[key] !== draft[key]).map((key) => [key, draft[key]]));
}
```
Editor call: `body: JSON.stringify({ id, nickname, changes: changedFields(profileOf(selected), sentProfile), ...(manual && keys ? { details } : {}) })`.

### Pattern 2: Accept-only-complete list + in-place retry (EMP-02, D-09)
**What:** A separate `loadState: "loading" | "ready" | "error"` for the *list* (today `state` is shared between list loading and save errors, which is why a save error cannot be told from a load error). `loadList` is a `useCallback` that fetches the editor route, applies `acceptsEditorList(payload)` (`Array.isArray(employees) && profilesRead === true`; a missing key rejects), and is called by the mount effect and by «ПОВТОРИТЬ». Guard against a late answer with a request-counter ref (`const seq = ++loadSeq.current; … if (seq !== loadSeq.current) return;`) and against unmount with the existing `active` pattern.
**Note on lint:** `eslint-plugin-react-hooks` is 7.1.1 [VERIFIED: node_modules/eslint-plugin-react-hooks/package.json]; a synchronous `setState` directly in the effect body can trip `react-hooks/set-state-in-effect`. The current code avoids it because `setState` runs inside `.then`. Keep `setLoadState("loading")` inside the click handler / `.then`, or initialise to `"loading"` (already the case) and only set it in the retry handler.
**Behaviour:** ПОВТОРИТЬ is shown only when no list exists, so there is no unsaved draft to lose; other tabs' state lives in the parent and is untouched.

### Pattern 3: Editor-only, never-cached read route (D-10)
**What:** `app/api/employees/editor/route.ts` with `GET`: check `getEditorAccess` (403 otherwise, same text as PATCH: «Нет доступа к редактору.»), call `loadEmployees(supabase)`, answer with `noStoreHeaders` and the same body as the public GET.
**Why a different path:** the public GET sets `"Netlify-CDN-Cache-Control": "public, durable, s-maxage=…, stale-while-revalidate=86400"` [VERIFIED: lib/portia-cdn.ts]. A request to the same path can be answered from that cached copy even if the *new* response would be no-store, because the lookup happens before the origin is reached. A path that has never been cacheable cannot be served from the CDN. `noStoreHeaders` is `{ "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store" }` [VERIFIED: lib/portia-cdn.ts].
**Why gate it:** the uncached path hits Google Sheets + Roblox on every call; the public path is shielded by the CDN. Requiring editor access keeps this amplification away from anonymous callers (ASVS V4). It exposes nothing the public GET does not.
**Example:**
```ts
// app/api/employees/editor/route.ts — mirrors the PATCH access check in app/api/employees/route.ts
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    const access = await getEditorAccess(supabase, data.user);
    if (!data.user || !access.canEdit) return Response.json({ error: "Нет доступа к редактору." }, { status: 403 });
    const { employees, syncedAt, complete, profilesRead, manualRead } = await loadEmployees(supabase);
    return Response.json({ employees, syncedAt, degraded: !complete, profilesRead, manualRead }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA editor employee read failed", error);
    return Response.json({ error: "Не удалось получить список сотрудников из таблицы." }, { status: 502, headers: noStoreHeaders });
  }
}
```
The proxy matcher does not cover `/api/employees*` ([VERIFIED: proxy.ts matcher `["/owner-login/:path*", "/api/access", "/api/editors", "/api/uploads"]`]); PATCH/POST/DELETE already work without it, so the new route needs no matcher change. The editor fetch: `fetch("/api/employees/editor", { credentials: "same-origin", cache: "no-store" })`. A 403 should read «Сессия редактора истекла. Войдите в редактор снова.» (the editor already keys the «ВОЙТИ СНОВА» link off that text via `errorMessage.includes("Войдите")`) — keep error texts distinct for list-load error vs save error.

### Pattern 4: Save without losing typing (EMP-05, D-04/D-05/D-06)
The baseline is `employees` (what `selected` is), the draft is `draft`; `dirty` is derived. So:
1. At save start: `const sentProfile = draft; const sentDetails = details; const sentId = selected.id;` clear the timer (`savedTimer`), `setState("saving")`.
2. Build the body from `changedFields(profileOf(selected), sentProfile)` and `changedDetails(detailsOf(selected), sentDetails)` (details only for `source === "manual"`). If both are empty: return `true` without a request (as the content editor does with `if (!dirty) return true`).
3. On success: `merged = { ...selected, ...payload.employee }` (selected is A's closure copy; keep this); `setEmployees(map by merged.id)`; `onSaved(merged)`; **only if `selectedIdRef.current === sentId`**: `setDraft(cur => cur && settleDraft(sentProfile, cur, profileOf(merged)))` and, unless `detailsPending`, the same for details (field-wise: a detail still equal to what was sent takes `detailsOf(merged)`). Never `setDraft(profileOf(merged))`.
4. «СОХРАНЕНО»: set `state` to `"saved"` and start the timer from `savedTimer.current = window.setTimeout(() => setState("idle"), 1800)`; render the label only when `state === "saved" && !dirty` (derived at render, so typed-meanwhile text hides it with no race). Return `!typedMeanwhile`, where `typedMeanwhile` compares `sentProfile`/`sentDetails` with the latest draft read from a ref (`draftRef`, synced in an effect exactly like the existing `selectedIdRef` / `askingRef`). Input events are discrete, so React flushes their effects synchronously and the ref is current.
5. Unmount: `useEffect(() => () => { if (savedTimer.current !== null) window.clearTimeout(savedTimer.current); }, [])`.
6. Queued switch (D-05): `chooseEmployee` currently drops the click when `state === "saving"` (`if (state !== "saving") setPendingEmployeeId(employee.id)`). Replace the drop with `queuedEmployeeIdRef.current = employee.id`. After a successful save that left nothing typed: if a queued id exists, `openEmployee(<that employee from the latest list>)`; if something was typed meanwhile: `setPendingEmployeeId(queued)` so the usual dialog asks. On failure drop the queue (the error is shown on A; the next click goes through the normal path). Do not consult the queue inside the dialog flow (`save().then(...)` in the «СОХРАНИТЬ» dialog button): the dialog is modal, nothing can be queued or typed there.
7. `settleDraft` skeleton:
```ts
const profileKeys = ["biography", "photoUrl", "knowledgeRating", ...employeeRatings.map(({ key }) => key)] as const;
export function settleDraft(sent: EmployeeProfile, current: EmployeeProfile, stored: EmployeeProfile): EmployeeProfile {
  const next: Record<string, unknown> = { ...current };
  for (const key of profileKeys) if ((current[key] ?? null) === (sent[key] ?? null)) next[key] = stored[key];
  return next as EmployeeProfile;
}
```
(If the planner prefers, reuse `profileKeys` inside `changedFields`.) `settleDraft` is the unit-test target for D-04: typed-after-send field kept, untouched field takes stored value, `profileChanged(profileOf(merged), settled)` is true iff something was typed.

### Pattern 5: Last-good data on the visitor's screen (EMP-06, D-07/D-08)
**Server:** add `manualRead` to the public GET body (`loadEmployees` already returns it [VERIFIED: lib/portia-employees.ts:344 `manualRead: manual.ok`]). Chosen over client-only merge-back because it lets the client distinguish "manual rows failed to read" from "an editor removed the last manual employee"; with merge-back alone a deletion made on another device could never propagate while `degraded` is true for an unrelated reason (Roblox outage).
**Client rule (pure function `mergeEmployeesAnswer(previous, answer, previousProfilesRead)`):**
- `answer.degraded === false` → take the answer as is; `cacheable: true`; `profilesRead: true`.
- otherwise (`degraded` true or absent-key safety: anything that is not exactly `false`):
  - profiles trusted iff `answer.profilesRead === true`; manual trusted iff `answer.manualRead === true` (absent = not trusted, covers a CDN copy from before the deploy).
  - roster / sheet fields (nickname, callsign, title, rank, order, ids) come from the answer — the sheet read succeeded or the route would have answered 502.
  - not trusted profiles → for each answer employee that has a previous entry, copy `biography, photoUrl, knowledgeRating` and the six ratings from the previous entry.
  - not trusted manual → drop `source === "manual"` entries from the answer and append previous manual entries (those whose id is not already in the answer).
  - avatars: if the answer's `robloxAvatarUrl` / `robloxFullAvatarUrl` is empty and the previous entry has one, keep the previous (Roblox outage empties avatars while `profilesRead` is still true).
  - `cacheable: false`.
- Return `profilesRead` for the card text: `answer.profilesRead === true || (previousProfilesRead && previous.length > 0)`.
**Cache (D-07):** `fetchEmployees` writes localStorage only when `cacheable`. On boot read the stored flag: `parsed.profilesRead === false` → profiles unread; absent → treat as read (an old cache without the flag must not trigger "did not load" for everyone). The payload written on a complete answer already contains `profilesRead: true` because the whole payload is stored.
**State:** keep `employeesRef` (mirror of `employees`, synced in an effect like other refs in these files) so `fetchEmployees` (a `useCallback` with `[]` deps) can read the previous list; add a `profilesRead` state/ref for the card.
**D-08 card text:** when `profilesRead` is false for the visible employee, replace the ratings block and the biography paragraph with one short line, e.g. «Профиль временно не загрузился.»; the biography fallback «Биография сотрудника пока не заполнена.» stays for the case where profiles *were* read and the field is empty. Roster, titles, avatars unchanged. Known small gap: an employee who appears for the first time inside a degraded answer has no previous entry and, when the global flag is true, shows the empty-biography text; acceptable (a brand-new sheet row has no profile yet).
**The editor-save path must not leak degraded data into the cache.** `updateEmployee` / `removeEmployee` currently do `JSON.stringify({ ...cached, employees: next })` where `next` is the in-memory state — if that state came from a degraded answer, or there was no cache at all, this writes blank profiles/partial roster to the device cache (and creates a cache with no `profilesRead` flag, which the boot rule above would then trust). Change both to patch the **cached array** (replace/append/remove one entry in `cached.employees`) and to do nothing when no cache exists.

### Pattern 6: Image state reset (EMP-07, D-discretion)
`EmployeeImage` keeps `loaded` and `failed` in `useState` and never resets them; the parent only re-keys by employee id (`<div className="personnel-profile-body content-fade" key={selectedEmployee.id}>`) [VERIFIED: components/portia-desktop.tsx:1191, 1379-1388]. Rename the current component to an inner one and export a thin wrapper:
```tsx
function EmployeeImage(props: { src: string; alt: string; fallbackClassName?: string }) {
  return <EmployeeImageInner key={props.src} {...props} />;
}
```
This covers all three usages (lines 1194, and the two portrait branches on line 1195) with no call-site edits and matches the fix suggested in 03.1-REVIEW WR-05. `src` changes reach the component through `updateEmployee` (editor save) and through a poll.

### Pattern 7: Empty list (EMP-08)
Today `if (!selected || !draft) return <div className="editor-empty">…` precedes the layout, so the aside (list, «+ ВНЕ ТАБЛИЦЫ», add form) is unreachable [VERIFIED: components/portia-editor.tsx:1503-1504]. Restructure to: `loadState === "loading"` → loader; `loadState === "error"` → error pane + ПОВТОРИТЬ; otherwise always render the layout with the aside, and render the profile form only when `selected && draft`, else `<div className="editor-empty">…</div>` in the profile pane. Notes:
- Adding the first person: `addEmployee` appends to `employees` but leaves `draft === null`, so the new person would not open. Open them when there was no draft: `setSelectedId(emp.id); setDraft(profileOf(emp)); setDetails(detailsOf(emp));` (functions `openEmployee` etc. are defined after the early returns today; moving them above the render keeps hooks order unchanged since they are not hooks).
- Deleting the last person: `removeSelected` already does `setDraft(null)`; with the restructure the aside stays.
- Recommended default: the form stays closed (button toggles it); the empty profile pane says that the list is empty and points at «+ ВНЕ ТАБЛИЦЫ». Wording is discretionary.
- The mobile layout uses `data-mobile-view={recordOpen ? "record" : "list"}`; with no profile pane the list view is what shows, which is correct.

### Anti-Patterns to Avoid
- **Replacing the draft from the answer** (`setDraft(profileOf(merged))`, today's line 1459) — the exact 03.2-WR-03 bug.
- **Dumping React state into localStorage** from the editor callbacks (see Pattern 5).
- **One `state` for load and save** in the editor — the load error pane and the save error label need different lifetimes.
- **Using `cache: "no-store"` as the CDN bypass** — it only affects the browser (D-10).
- **Awaiting anything between the response and the `return` value of `save()`** — the existing dialog flow reads `askingRef.current` in `.then`, and relies on that running before React re-renders and clears `leaving`/`asking`; keep the clean/typed computation synchronous after the `await`s.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is the draft dirty?" | A separate `dirty`/`typedDuringSave` flag | Existing derived `profileChanged(profileOf(selected), draft)` + baseline update | Two sources of truth drift; derived dirty is automatically right after a field-wise reconcile |
| Rating null-vs-missing rule | A new comparison | `(a[key] ?? null) !== (b[key] ?? null)` as in `profileChanged` | Same rule in diff, dirty check and reconcile |
| Unsaved-changes guard | New dialog | Existing `pendingEmployeeId` + `ConfirmDialog` + `continueLeave` | Already wired to the parent's tab-leave/close flow |
| Delayed "saved" label | Per-save timers | One ref'd timer mirroring `saveStateTimer` in the desktop (cleared before each save and on unmount) | Prevents the stale-timer flip |
| Cache bypass | Query-string cache busting | A distinct, editor-gated no-store route | Does not depend on how the Netlify Next runtime keys its cache |

**Key insight:** the dangerous behaviour is all in *who is allowed to overwrite what*: draft vs answer, degraded answer vs last good data, stale CDN copy vs database. Each fix is a small pure rule; put the rules in `lib/portia-employees.ts` where they can be unit-tested, and keep the components thin.

## Runtime State Inventory

Not a rename/refactor/migration phase — omitted. (The one persisted client artifact, localStorage key `employeesCacheStorageKey`, is covered in Pattern 5 and Pitfall 3.)

## Common Pitfalls

### Pitfall 1: A late/duplicate response applied to the wrong draft
**What goes wrong:** `selected` in the `save` closure is A, but between request and response the selection may change (queue resolution, tab/leave flows), and `setDraft` is unconditional.
**How to avoid:** apply draft updates only when `selectedIdRef.current === sentId`; the baseline update (`setEmployees` by id) is always safe.
**Warning signs:** after saving A and clicking B, B shows A's biography.

### Pitfall 2: Timer from a previous save
**What goes wrong:** `window.setTimeout(() => setState("idle"), 1800)` is untracked [VERIFIED: components/portia-editor.tsx:1465]; a save started within 1.8 s is flipped to idle mid-request, re-enabling the button and (today) the employee switch.
**How to avoid:** ref + clear at save start + clear on unmount; also clear in `openEmployee` is unnecessary once the start-of-save clear exists, but harmless.

### Pitfall 3: Degraded data reaching localStorage by a side door
**What goes wrong:** besides `fetchEmployees`, `updateEmployee` and `removeEmployee` write `employees: next` (state) into the cache.
**How to avoid:** patch `cached.employees` only; skip when no cache. Keep `{ ...cached }` so `profilesRead`/`syncedAt` flags survive.

### Pitfall 4: Old shape from the CDN or cache
**What goes wrong:** a CDN copy (`stale-while-revalidate=86400`) or a localStorage copy written before this phase has no `manualRead` and maybe no `profilesRead`.
**How to avoid:** every "trusted" test is `=== true`; for the visitor boot cache treat only `profilesRead === false` as unread. For the editor the absent key rejects (D-09) — and the editor no longer reads the CDN path anyway.

### Pitfall 5: `degraded` also means "Roblox failed"
**What goes wrong:** `complete = Boolean(profiles) && roblox.ok && manual.ok` [VERIFIED: lib/portia-employees.ts:340]. A Roblox outage alone sets `degraded: true` with `profilesRead: true`, `manualRead: true` and empty avatars; treating all degraded answers as "profiles lost" would discard fresh bios.
**How to avoid:** decide per flag (profiles, manual, avatars), not per `degraded`; only the cache write uses `degraded` as a whole.

### Pitfall 6: A clean "save" still creating a row
**What goes wrong:** with diff-only bodies a clean draft yields `changes: {}`; the server would still upsert an (otherwise empty) profile row for a never-saved sheet employee.
**How to avoid:** return `true` before the request when both diffs are empty.

### Pitfall 7: Save landing while the visitor fetch is in flight (optional)
A `fetchEmployees` started before a same-device editor save can resolve after `updateEmployee` and put the pre-save profile back until the next poll (5 min). Content has `savesStarted` counters for this; the employee path has none. Low impact (editor device only, a ~1 s window); the planner may add a simple "saves started" ref check or leave it as a documented limitation (see Open Questions).

### Pitfall 8: Local Node version
`package.json` pins `"engines": { "node": ">=22.13.0 <23" }`; this machine runs v24.21.0 (tests/tsc pass). Not a blocker; Netlify builds with 22.13.0 per `netlify.toml`.

## Code Examples

Verified current shapes the new code must match:

```ts
// GET body today (app/api/employees/route.ts:13-15) — add manualRead beside profilesRead
{ employees, syncedAt, degraded: !complete, profilesRead }

// loadEmployees already returns (lib/portia-employees.ts:340-344)
complete: Boolean(profiles) && roblox.ok && manual.ok,
profilesRead: Boolean(profiles),
manualRead: manual.ok,

// PATCH answer consumed by the editor (components/portia-editor.tsx:1448,1456)
{ employee?: Partial<PortiaEmployee> & { id: string }; ratingsPending?: boolean; detailsPending?: boolean; error?: string }
const merged: PortiaEmployee = { ...selected, ...payload.employee };
```

Unit-test targets (pure, `lib/portia-employees.test.ts`, run with `node --experimental-strip-types --test lib/portia-employees.test.ts`):
- `changedFields`: unchanged draft → `{}`; one rating changed → only that key; rating cleared (7 → null) → `{ key: null }`; employee object lacking a rating key + draft null → `{}` (the D-11 case).
- `changedDetails`: only differing keys.
- `settleDraft`: typed-after-send field kept; untouched fields take the stored copy; `profileChanged(stored, settled)` true iff something was typed.
- `acceptsEditorList`: `profilesRead: true` accepted; `false` and absent rejected; non-array rejected.
- `mergeEmployeesAnswer`: complete answer replaces all; degraded + `profilesRead:false` keeps previous bios/ratings/photo while taking roster fields; degraded + `manualRead:false` (and absent) keeps previous manual entries; `manualRead:true` with a missing manual employee removes it; empty avatars keep previous avatars; `cacheable` false for degraded; first visit (no previous) with `profilesRead:false` returns `profilesRead:false`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Send whole draft, replace draft from answer | Diff-only body, field-wise reconcile | This phase | Concurrent stale tabs and typing during save no longer lose data |
| Cache whatever answered | Cache only complete answers | This phase | Degraded sync can't poison the device cache |

**Deprecated/outdated:** `if (payload.profilesRead === false) throw` in the editor (rejects only an explicit false; an absent key slips through) — replaced by `!== true`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Netlify Next.js runtime serves a cached `/api/employees` copy regardless of query string, so a query-param bypass is unreliable. Source is a code comment in `app/api/employees/route.ts` (lines 12-13), which conflicts with Netlify docs saying function-response query strings are in the cache key by default [CITED: docs.netlify.com/build/caching/caching-overview]. | Pattern 3, Alternatives | Low: the recommended distinct path works under either reading; only the "query param is unreliable" rationale could be wrong |
| A2 | A brand-new sheet employee appearing for the first time in a degraded answer may show the empty-biography text rather than the "did not load" text (global flag, not per employee). | Pattern 5 | Cosmetic; a new row normally has no profile yet |
| A3 | Input events flush `useEffect` synchronously (discrete events), so a ref synced in an effect is current when `save()` resumes after `await`. A non-event update (upload callback) could lag by one render. | Pattern 4 | Rare mislabel of «СОХРАНЕНО» for a photo uploaded within the same tick as the response |
| A4 | `save()`'s `.then(…)` in the leave dialog runs before React re-renders (microtask vs scheduled render), which is what lets `askingRef.current` still be true. Observed from existing code behaviour, not tested. | Anti-patterns | If wrong, existing leave-after-save flow would already be broken; the new code must simply not add awaits |
| A5 | Skipping the request for a clean save (no feedback) is acceptable UX; the content editor does the same. | Pitfall 6 | Owner might expect a brief «СОХРАНЕНО» on a no-op save |

## Open Questions

1. **Should the editor also require `manualRead === true`?**
   - What we know: D-09 locks only `profilesRead`; with `manualRead:false` the editor list silently lacks manual employees (not destructive; POST/DELETE re-check on the server).
   - Recommendation: do not require it (stay within D-09); optionally show nothing. Planner may escalate to the owner if a visible warning is wanted.
2. **Guard `fetchEmployees` against a save that started after it?** (Pitfall 7) — recommend a small `employeeSavesStarted` ref bumped in `updateEmployee`/`removeEmployee` and compared in `fetchEmployees`, mirroring content; skip if the plan is already large.
3. **Wording** of «Профиль временно не загрузился», the list-load error, and the empty-pane text — discretionary; keep short, Russian, existing style.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tests, build | ✓ | v24.21.0 (engines says 22.x; works) | — |
| npm test | unit tests | ✓ | 234 pass, 0 fail at baseline | — |
| `npx tsc --noEmit` | gate | ✓ | clean at baseline | — |
| `npx eslint app lib components` | gate | ✓ | 0 errors, 14 warnings (all `@next/next/no-img-element`) at baseline | — |
| Live Supabase / Sheet / Roblox | UAT only | not used in code verification | — | D-03: verify only on a temporary employee outside the sheet; no `PUT /api/content` |

No component-test infrastructure exists (no jsdom / testing-library; only `node:test` on `lib/*.test.ts`). Component behaviour (typing during save, queued switch, ПОВТОРИТЬ, empty list, photo reset, degraded merge on screen) is therefore verified by pure-helper unit tests plus tsc/eslint/build and a manual UAT checklist; plans should state this explicitly rather than invent a test harness.

## Validation Architecture

Skipped: `workflow.nyquist_validation` is `false` in `.planning/config.json` [VERIFIED: .planning/config.json]. See the test-target list under Code Examples for the unit-testable seam.

## Security Domain

`security_enforcement` is `true`, ASVS level 1 [VERIFIED: .planning/config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | existing Supabase session |
| V3 Session Management | no (unchanged) | existing |
| V4 Access Control | **yes** | New `GET /api/employees/editor` must run `getEditorAccess` and answer 403, same as PATCH/POST/DELETE |
| V5 Input Validation | yes (unchanged server side) | `sanitizeEmployeeUpdate` / `sanitizeManualDetails` already reject wrong types; client now sends fewer fields, never wider |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anonymous callers hammering an uncached origin route (Sheets + Roblox fan-out) | Denial of service | Editor-only gate on the new route; public path keeps CDN caching |
| Stale/old-shape cached payload driving a destructive save | Tampering (data loss) | Editor reads a no-store route and requires `profilesRead === true`; diff-only bodies cannot null untouched ratings |
| `photoUrl` rendered into `<img src>` | XSS (low) | Server already restricts to `https://` or `/` prefix [VERIFIED: lib/portia-employees.ts `sanitizeEmployeeUpdate`]; React escapes attributes; no change |
| Error text leakage | Information disclosure | Return fixed Russian strings, log details server-side (pattern already used in the route) |

## Sources

### Primary (HIGH confidence — files opened this session)
- `components/portia-editor.tsx` lines 750-840, 1350-1645 (employee editor, content save reference)
- `components/portia-desktop.tsx` lines 388-493, 895-940, 1176-1205, 1375-1388
- `lib/portia-employees.ts` lines 1-565 (types, `profileOf`, `profileChanged`, `acceptsRoster`, `loadEmployees`, sanitizers, `saveEmployeePatch`)
- `app/api/employees/route.ts`, `lib/portia-cdn.ts`, `proxy.ts`, `lib/editor-access.ts`, `package.json`, `.planning/config.json`, `eslint.config.mjs`
- `.planning/phases/PORTIA-07-*/07-03-SUMMARY.md`, `07-VERIFICATION.md`; review findings 03.1 WR-01/05/06, 03.2 WR-02/03/04, 03.3 WR-02/04 under `.planning/milestones/v1.0-phases/`
- Baselines run this session: `npm test` (234 pass), `npx tsc --noEmit` (clean), `npx eslint app lib components` (0 errors, 14 warnings)

### Secondary (MEDIUM confidence)
- Netlify caching overview (https://docs.netlify.com/build/caching/caching-overview/) — `Netlify-Vary` options, `no-store`, query strings in the key for function responses

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies
- Architecture: HIGH — all call sites and shapes read from source; only the CDN key rationale (A1) is soft and the design is independent of it
- Pitfalls: HIGH — derived from the actual code paths and the three review documents

**Research date:** 2026-10-20
**Valid until:** 2026-11-19 (stable; re-check only if `portia-editor.tsx` / `portia-desktop.tsx` change before planning)
