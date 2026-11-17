# Phase 8: Сотрудники без потерь на экране - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Client side of the employee data path: the editor's «Сотрудники» tab (`components/portia-editor.tsx`) and the public Personnel window (`components/portia-desktop.tsx`). Edits are never lost, a partial or stale read never overwrites good data on screen or in the device cache, a fixed photo URL shows at once, and the add-manual-employee control works with an empty list. Requirements: EMP-02, EMP-05, EMP-06, EMP-07, EMP-08. Server contract is already in place from Phase 7 — this phase changes the server only where the client needs a flag it does not yet get (e.g. `manualRead` on the public GET).

</domain>

<decisions>
## Implementation Decisions

### Carried forward (locked earlier, not re-asked)
- **D-01:** Concurrent edits of one employee: last write wins (AR-03.2-01). No locking or version checks.
- **D-02:** PATCH contract from Phase 7: absent field = unchanged, `null`/empty clears that field only, wrong type = 400. The response is the stored profile only; the editor merges it onto the existing card (Phase 7 D-07).
- **D-03:** Saves are verified only on a temporary employee outside the sheet; no script calls `PUT /api/content`.

### Набор во время сохранения (EMP-05)
- **D-04:** Fields stay editable while a save is in flight. Text typed after the request was sent stays in the field; when the answer arrives, the draft is NOT replaced — only the fields still equal to what was sent take the server copy. If anything was typed meanwhile, the draft stays dirty: «СОХРАНЕНО» is not shown, the leave/switch guard still asks, and the editor presses «СОХРАНИТЬ» again. No automatic second save. Same behaviour as the content editor.
- **D-05:** Clicking another employee while a save is in flight is remembered, not ignored. After the answer for employee A, the editor opens employee B (if A has no newer unsaved edits; otherwise the usual unsaved-changes dialog). The answer for A is never applied to B's draft — the response is matched by id to the employee it was sent for.
- **D-06:** The «СОХРАНЕНО» timer is held in a ref, cleared before each new save and on unmount, so an earlier timer never flips a later save to idle (03.1-WR-06; mirror the desktop's `saveStateTimer`).

### Сайт при сбое чтения (EMP-06)
- **D-07:** When profiles or manual employees fail to read, the visitor silently keeps the last good biographies, ratings, photos and manual employees — no "may be outdated" notice. The degraded answer only refreshes what it did read (roster / avatars / sheet fields). The device cache (`employeesCacheStorageKey`) is never overwritten by a degraded answer.
- **D-08:** First visit with no cache and profiles not read: the card says the profile did not load (e.g. «Профиль временно не загрузился») instead of «Биография не заполнена» and «—» ratings. Roster, titles and avatars still show. Exact wording is Claude's discretion, short, in the existing style.

### Редактор при неполном списке (EMP-02)
- **D-09:** The editor accepts the list only when `profilesRead === true` (absent key = reject; covers old cached copies — 03.2-WR-02). Otherwise the tab shows a clear error with a «ПОВТОРИТЬ» button that reloads the list in place — no page reload, other tabs' unsaved edits untouched. No auto-retry.
- **D-10:** The editor loads `/api/employees` bypassing the CDN cache, so it always works from the current database. Note: client `cache: "no-store"` alone does not bypass Netlify's `Netlify-CDN-Cache-Control` (`lib/portia-cdn.ts`) — researcher must pick a mechanism that actually reaches the origin (e.g. a distinct editor request the CDN does not cache). The public visitor path keeps its CDN caching.
- **D-11:** The editor sends only fields that differ from the loaded profile (plus the id / required identity); `profileOf` must not turn a missing rating key into an explicit `null`.

### Claude's Discretion
- Photo fix (EMP-07, 03.1-WR-05): reset `EmployeeImage` state when `src` changes (e.g. `key={src}`) at both call sites.
- Empty list (EMP-08, 03.3-WR-04): render the list aside with «+ ВНЕ ТАБЛИЦЫ» and the add form even with no employees or after deleting the last one; the empty state applies only to the profile pane. Wording and whether the form opens by default are Claude's choice.
- How "only changed fields" and the sent-snapshot comparison are implemented (reuse `profileChanged` / `profileOf` in `lib/portia-employees.ts`).
- Whether the public GET adds a `manualRead` flag or the client merges back known manual entries when `degraded` is true (03.3-WR-02 offers both).
- Exact Russian wording of the new error / unavailable texts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — EMP-02, EMP-05, EMP-06, EMP-07, EMP-08
- `.planning/ROADMAP.md` §Phase 8 — goal and 5 success criteria

### Review findings this phase closes (each has a suggested fix)
- `.planning/milestones/v1.0-phases/PORTIA-03.1-stabilizatsiya/03.1-REVIEW.md` — WR-01 (degraded roster wipes profiles + cache), WR-05 (EmployeeImage keeps failed state), WR-06 («СОХРАНЕНО» timer)
- `.planning/milestones/v1.0-phases/PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW.md` — WR-02 (missing rating keys become null; `profilesRead !== true`), WR-03 (typing during save lost)
- `.planning/milestones/v1.0-phases/PORTIA-03.3-sotrudniki-vne-tablitsy-i-gaydy-v-informatsii/03.3-REVIEW.md` — WR-02 (manual read failure removes manual employees + cache), WR-04 (empty list dead end)

### Server contract from Phase 7
- `.planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-CONTEXT.md` — D-01..D-14 (partial PATCH, response shape, read flags, `sheet-employee` code)
- `.planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-03-SUMMARY.md` — what the PATCH and editor merge look like now

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/portia-employees.ts`: `profileOf`, `profileChanged`, `acceptsRoster`, `mergeManualEmployees`, `employeeRatings` — the diff/merge helpers to build on; tests in `lib/portia-employees.test.ts`.
- `components/portia-desktop.tsx` `saveStateTimer` (~line 900) — the pattern for a guarded «СОХРАНЕНО» timer.
- `lib/portia-cdn.ts` — the CDN cache headers the editor fetch must get past.

### Established Patterns
- Editor employees tab: load effect ~`portia-editor.tsx:1410`, `save` ~1432, `chooseEmployee`/`continueLeave` (pending-employee flow) ~1500, early empty return ~1495, list aside ~1578.
- Desktop: `fetchEmployees` ~`portia-desktop.tsx:418` writes state + localStorage; `updateEmployee`/`removeEmployee` keep cache in step; `EmployeeImage` ~1379.
- `/api/employees` GET returns `{ employees, syncedAt, degraded, profilesRead }` (`app/api/employees/route.ts:13-15`); `loadEmployees` also knows `manualRead` (`lib/portia-employees.ts:344`) but the GET does not expose it.

### Integration Points
- Editor → desktop via `onSaved` / `onRemoved` callbacks (`updateEmployee`, `removeEmployee`).
- localStorage key `employeesCacheStorageKey` — read on boot, written on fetch and on editor saves.

</code_context>

<specifics>
## Specific Ideas

- Unsaved-after-save behaviour should match the content editor (draft stays dirty, guard asks, press save again).
- Visitors are not told about stale data; only the no-data case gets an honest "did not load" line.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 8-Сотрудники без потерь на экране*
