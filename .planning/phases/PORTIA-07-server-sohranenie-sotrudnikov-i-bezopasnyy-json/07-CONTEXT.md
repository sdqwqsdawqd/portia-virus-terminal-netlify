# Phase 7: Сервер: сохранение сотрудников и безопасный JSON - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Server side of employee saving (`app/api/employees`, `lib/portia-employees.ts`) plus JSON hardening of the employees, editors and content APIs. Requirements: EMP-01, EMP-03, EMP-04, EMP-09, EMP-10, ROB-02.

- PATCH changes only the fields that were sent; the old whole-profile request keeps working.
- Saving does not wait for Roblox and, for known employees, not for the Google Sheet.
- A manual (outside-the-sheet) employee is never left half-saved.
- Bad / empty / non-object JSON gives 400 with a short Russian message instead of 500.
- Manual nicknames are stored in Roblox spelling; the sheet-delete refusal is detected by response code.
- EMP-10 is closed by documenting the 34-slot sheet rule (no raise, no warning).

The editor client (send only changed fields, `profilesRead` gate, draft handling — EMP-02, EMP-05..08) is Phase 8. Phase 7 may touch `components/portia-editor.tsx` only as far as needed to keep the current editor working with the new server responses.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (locked earlier, not re-asked)
- **D-01:** PATCH contract: absent field = unchanged; `null` (or empty string) clears only that rating; wrong type = 400; the old whole-profile request is accepted (STATE.md, v1.1 roadmap decision).
- **D-02:** Concurrent edits of one employee: last write wins (AR-03.2-01). No locking or version checks.
- **D-03:** Saves are verified only on a temporary employee outside the sheet; no script calls `PUT /api/content` (STATE.md [Данные]). The partial-row upsert for an employee with no stored profile row must be checked (STATE.md [Phase 7] concern).

### Сохранение без таблицы (EMP-03)
- **D-04:** If the employee id is already known to the database (a row in `portia_employee_profiles` or in the manual-employees table), the server saves immediately — no Google Sheet fetch and no Roblox call on this path.
- **D-05:** An id the database does not know (a sheet newcomer never saved before) is checked against the Google Sheet only — without any Roblox lookup. If the sheet does not answer, the server refuses with a clear Russian message (e.g. «Таблица не отвечает, попробуйте через минуту»), not 404 «Сотрудник не найден».
- **D-06:** Roblox is never needed to save a profile.
- **D-07:** The PATCH response returns only the stored profile (biography, photo, ratings, plus id and — for manual employees — the saved details), not the full roster employee with avatar / sheet title. The current editor replaces the whole card with `payload.employee` (`components/portia-editor.tsx:1455-1457`); Phase 7 must keep it working — merge the returned profile onto the existing card (minimal editor change) rather than losing the avatar. — **Reversibility:** costly — the response shape is a contract the Phase 8 client builds on.

### Детали сотрудника вне таблицы (EMP-04)
- **D-08:** All or nothing. Title / rank / callsign are written first; if the profile write then fails, the details are restored to their previous values. The editor gets one error with the correct reason; the database never keeps a half-saved state.
- **D-09:** Title, rank and callsign follow the same partial rule as the profile: absent field = unchanged, empty string = clear, wrong type = 400. One rule for the whole request.

### Ник в написании Roblox и удаление (EMP-09)
- **D-10:** New manual employees are stored with the nickname exactly as Roblox spells it (from the Roblox lookup already done on add).
- **D-11:** Old manual rows are not rewritten in the database. When reading, the nickname is shown in Roblox spelling if Roblox answered; otherwise the stored spelling.
- **D-12:** Refusing to delete a sheet employee keeps the current text «Нельзя удалить сотрудника из таблицы.»; the editor decides by a machine-readable response code/field, not by matching the Russian string (`components/portia-editor.tsx:1552`).

### Лимит таблицы (EMP-10)
- **D-13:** The limit stays at 34 staff slots (sheet rows 2–35). Owner confirmed rows after 34 are never filled; the sheet has exactly 34 places. Close EMP-10 by stating this as a rule in code (comment at `staffRowsEnd` in `lib/portia-employees.ts`) and in the requirement record — no warning UI, no raise.

### Безопасный JSON (ROB-02)
- **D-14:** Empty body, non-JSON and non-object bodies in the employees (PATCH/POST/DELETE), editors (POST/DELETE) and content (PUT) APIs return 400 with a short Russian message in the style of the existing ones («Некорректные данные.»), never 500.

### Claude's Discretion
- Exact Russian wording of new error messages (short, matching current style).
- The machine-readable form of the sheet-delete refusal (D-12): response field name/value or status code.
- How "known to the database" is looked up (D-04) and how the details rollback (D-08) is implemented (sequential writes with compensation vs an RPC) — within the constraint that no new SQL is required from the owner in this phase unless unavoidable.
- Shared helper for safe JSON body parsing across the three route files.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` — EMP-01, EMP-03, EMP-04, EMP-09, EMP-10, ROB-02 (with the review finding ids each closes)
- `.planning/ROADMAP.md` § Phase 7 — goal and the 5 success criteria
- `.planning/STATE.md` § Decisions / Blockers — PATCH contract, last-write-wins, [Данные] test rules, [Phase 7] upsert concern
- `.planning/PROJECT.md` § Known Limitations — accepted risks that must stay accepted

### Review findings being closed
- `.planning/milestones/v1.0-phases/PORTIA-03.1-stabilizatsiya/03.1-REVIEW-DISPOSITION.md` — 03.1-WR-02, WR-03, IN-03, IN-06
- `.planning/milestones/v1.0-phases/PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW-DISPOSITION.md` — 03.2-WR-04
- 03.3 review record under `.planning/milestones/v1.0-phases/` — 03.3-WR-03, IN-01, IN-02, IN-03, IN-04 (part 2)

### Data safety
- Owner backup outside git: `C:\Users\User\backups\portia\portia_employee_profiles_2026-10-19.json` (18 rows), `portia_content_2026-10-19.json` (1 row) — names and counts only, never print contents

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sanitizeEmployeeUpdate` / `sanitizeManualDetails` / `sanitizeManualEmployee` (`lib/portia-employees.ts:384-454`): today they default missing fields to `""`/`1` — the source of field wiping; rework for D-01/D-09.
- `saveEmployeeProfile` (`lib/portia-employees.ts:412`): upsert with the missing-column fallback (`isMissingColumnError`) — keep the fallback.
- `readEmployeeProfiles`, `readManualEmployees`: DB reads usable for the "known id" lookup (D-04) without the sheet/Roblox.
- `resolveRobloxProfiles` already returns Roblox's own `name` per requested nickname — source of the canonical spelling (D-10/D-11).
- `lib/portia-employees.test.ts` (387 lines): existing unit-test home for the sanitizers and roster helpers.

### Established Patterns
- Route handlers: auth via `createServerSupabaseClient` + `getEditorAccess`, `Response.json({ error: "<Russian>" }, { status })`, `purgeCacheTag(employeesCacheTag)` after writes, `noStoreHeaders` on write responses.
- "pending-database" statuses tolerate SQL not yet applied by the owner (manual table, rating columns).

### Integration Points
- `app/api/employees/route.ts` PATCH calls `loadEmployees` (sheet + Roblox, up to ~18 s) before every save — the EMP-03 bottleneck.
- `request.json()` unguarded at `app/api/employees/route.ts:33,69,102`, `app/api/editors/route.ts:33` (and DELETE), content PUT — ROB-02.
- Editor consumers of PATCH/DELETE responses: `components/portia-editor.tsx:1441-1461` (save), `:1543-1554` (delete refusal string match).

</code_context>

<specifics>
## Specific Ideas

- Owner's model of the roster: the Google Sheet decides who works there — removed from the sheet = fired (disappears from the site), row moved = promoted (same person, profile kept because profiles are keyed by Roblox account). Current behaviour already matches; Phase 7 must not break it.

</specifics>

<deferred>
## Deferred Ideas

- **Erase the stored profile of a person removed from the sheet ("fired")** — owner wants it. New, irreversible capability; deleting on a single sheet read risks wiping profiles when the sheet briefly returns a partial list. Belongs in its own phase with a safety design (e.g. absent for several consecutive syncs, or an owner-only "delete fired profile" action). Not part of v1.1 Phase 7.

</deferred>

---

*Phase: 7-Сервер: сохранение сотрудников и безопасный JSON*
