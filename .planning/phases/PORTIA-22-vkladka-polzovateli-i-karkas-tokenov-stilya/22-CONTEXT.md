# Phase PORTIA-22: Вкладка «Пользователи» и каркас токенов стиля - Context

**Gathered:** 2026-11-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Editor-side «Пользователи» tab over the Phase 21 access data: list of people and requests, decisions (approve / reject / level / revoke / clear cooldown), who-and-when and per-person history, owner bulk approval of table staff at level 2, and closing the tab for a single editor via the existing tab rights. Plus UI-01: the owner picks one of three style directions (A strict sharp, B soft «window», C mixed by meaning) from a text + values table, and a style-token skeleton lands in code at today's values with no visible change.

Requirements: USR-01, USR-02, USR-03, USR-04, USR-06, USR-07, USR-08, USR-09, UI-01.

Not in this phase: boot-screen request form and `/api/visitor` gate (23), item levels and redaction (24), closing anon reads / CDN / flip (25), the actual restyle (26). Visitor-facing behaviour does not change. Live Postgres/RLS, authenticated roles and staging stay BLOCKED (Phase 21 D-72); nothing here is recorded as PASS without a live run.

</domain>

<decisions>
## Implementation Decisions

### Locked earlier (carried forward, not re-asked)
- D-71 5а / Phase 21 D-02: any editor decides; no self-approval, no level above own, owner cannot be changed; DB enforces; repeat decision returns «уже решено».
- Phase 21 D-04 / D-09: approval default level 2 «из таблицы», 1 «не из таблицы»; previous level is not restored.
- Phase 21 D-06: one pending request per nick; 1-hour cooldown after reject/revoke; owner can clear it.
- D-71 8а: style directions shown as text + values table; no `review.html` galleries, no per-hash ledger; at most one redo per screen.
- Phase 21 D-07 is **amended** by D-07 below (retention).

### Устройство вкладки
- **D-01:** Two sections in one tab: «Заявки» (pending requests) on top, «Люди» below. The tab badge counts pending requests only (USR-01).
- **D-02:** One nickname search field above both sections; no status filters.
- **D-03:** «Люди» lists approved people only, sorted by level (desc), then by nickname. Rejected and revoked people live in a collapsed block «Отклонённые и отозванные» under «Люди» (closed by default); there the row shows status, history and, for the owner only, «снять паузу» while the 1-hour cooldown runs.
- **D-04:** Phone: compact row (nickname + status); tapping a row opens an action window holding the details (type, «в таблице» mark, Roblox profile link), actions and history. No page-level horizontal overflow. PC rows show actions inline.

### Кто и когда, история
- **D-05:** The decider is shown as a masked email (`q•••z@gmail.com` style: first and last char of the local part, full domain) to editors; the owner sees full emails. Masking is done server-side — the full email of another editor never reaches a non-owner client.
- **D-06:** Row caption under the nickname: «одобрил q•••z · 9 нояб., 14:32» (verb follows the event), absolute date/time in Europe/Moscow, device-independent formatting. History opens by expanding the row on PC and inside the action window on phone.
- **D-07:** History shows the last **5** journal entries per person, no «Показать ещё». Storage: the journal keeps the last **20** entries per person; older ones are deleted only by this rule (new forward-only migration; the Phase 21 append-only trigger is changed to allow exactly this prune and nothing else; UPDATE stays forbidden; direct SELECT stays forbidden). Owner reason: «беспокоюсь о памяти»; the risk that 20 new actions can push out an old decision was explained and accepted. — **Reversibility:** one-way — pruned journal rows cannot be restored, and it amends the Phase 21 trigger contract (D-07 of 21, RLS21-03); needs `supabase-rls-reviewer` and a fingerprint / expected-authz update.

### Массовое одобрение «из таблицы»
- **D-08:** Owner-only button. Pressing it opens a confirmation window «Одобрить N заявок с уровнем 2?» listing the nicknames that will be approved, plus a separate line listing «из таблицы» requests whose nickname is not in the table (they are not included). Nothing is approved before «Одобрить» (USR-08).
- **D-09:** Table match = nickname via the shared case-insensitive `nicknameKey` rule (Phase 21 ACC-04), evaluated at decision time (USR-02). `robloxUserId` is not used; a renamed player whose table row is stale is decided by hand.
- **D-10:** If the staff roster is unavailable (`degraded`), the bulk button is disabled with «Таблица сотрудников недоступна, попробуйте позже»; the row mark shows «не проверено» instead of «нет»; single approval still works and the default level comes from the chosen type.
- **D-11:** Bulk run decides each request separately and ends with a summary «Одобрено X, уже решено другим Y, ошибка Z». Requests already decided by another editor are skipped as «уже решено» (USR-07); one failure does not undo the others.

### Направление стиля (UI-01)
- **D-12:** The style direction is the owner's choice, not the agent's. The plan includes a blocking owner checkpoint that presents A / B / C as text with a values table (radii, buttons, plaques/badges, tabs/windows) and records the chosen letter in this phase. Tokens are plain `:root` CSS variables in `portia.css` at today's values, edited in place without reordering the cascade; a test pins today's `border-radius` declaration count (129 at discussion time — re-count at plan time); the site does not change visually.

### Claude's Discretion
- Decision UX per row (area not discussed): confirmation dialog for reject and revoke, no rejection-reason field, level picked from a list (inline on PC, in the action window on phone); «уже решено» shown as a refusal message on the row followed by a refresh of that row.
- RPC shape for listing people/requests and reading the last 5 journal entries per person (definer RPCs, server-side masking per D-05), and how the «в таблице» mark is computed server-side at decision time.
- Exact empty states and Russian copy within the rules above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §Phase 22 — goal, success criteria, constraints (RLS review if SQL, text-only visuals, `:root` tokens, cascade order), acceptance gate
- `.planning/REQUIREMENTS.md` — USR-01..04, USR-06..09, UI-01; D-71 owner decisions (line 7)
- `.planning/PROJECT.md` — decisions history (D-70, D-72)

### Phase 21 foundation (data layer this tab sits on)
- `.planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-CONTEXT.md` — D-01..D-10, D-72
- `.planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-MIGRATION-APPLY.md` — apply order, frozen sha256, accepted risks
- `.planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-REVIEW.md` — open WR-01 (staging probe flips closure flag), WR-04 (submit client contract), WR-05
- `supabase/migrations/20261109000000_portia_access_foundation.sql` — frozen; tables `portia_access_*`, journal trigger, `decide` / `set_level` / `revoke` / `clear_cooldown` RPCs. Changes only via a new forward-only migration.
- `supabase/fingerprint/expected/portia.fingerprint.json`, `tests/e2e/fixtures/data/expected-authz.json` — must be updated with any new SQL object

### Code
- `lib/access-store.ts` — RPC client wrappers and result codes
- `lib/access-levels.ts` — level names «Уровень 1…5»
- `lib/nickname.ts` — shared nickname rule / key
- `lib/editor-tabs.ts` — tab registry; «Пользователи» is one `kind: "regular"` line (open by default, closable per editor → USR-09)
- `lib/editor-access.ts`, `app/api/editors/route.ts` — existing per-editor tab rights
- `lib/portia-employees.ts` — staff roster from Google Sheets, `degraded` flag, `nicknameKey` use
- `components/portia-editor.tsx` — editor tab strip and closed-tab message
- `app/portia.css` — style tokens target

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tabRegistry` / `openTabIds` / `closedMessage` in `lib/editor-tabs.ts`: adding `{ id: "users", label: "Пользователи", kind: "regular" }` gives default-open plus owner-closable behaviour and the «Доступ закрыт» path for free.
- `lib/access-store.ts` wrappers already map RPC result codes (`already-decided`, `owner-protected`, …) — UI reads codes, not raw errors.
- `nicknameKey` (Phase 21) for the table match.

### Established Patterns
- Definer RPCs with explicit `revoke` before `grant`, no `set search_path = public`; fingerprint + expected-authz + offline Supabase harness updated in the same commit as any SQL object (Phase 21 constraints).
- Editor windows go full-screen on phone; existing tabs use an action-window pattern on narrow screens.
- Live Postgres behaviour is recorded BLOCKED (ENV), never PASS.

### Integration Points
- New SQL: list RPC(s) for requests/people with masked decider, last-5 history read, journal retention prune (D-07), and an owner-only bulk path or per-request loop (D-11).
- Editor tab strip in `components/portia-editor.tsx`; badge count from pending requests.
- `portia.css` `:root` for token variables.

</code_context>

<specifics>
## Specific Ideas

- Row caption format: «одобрил q•••z · 9 нояб., 14:32» (МСК).
- Bulk summary format: «Одобрено X, уже решено другим Y, ошибка Z».
- Degraded roster copy: «Таблица сотрудников недоступна, попробуйте позже»; row mark «не проверено».

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
- «Стабилизировать Повышение и интерфейс рабочего стола» — keyword-only match; Promotion work belongs to Phase 23.
- «„Информация“ на телефоне — компактная кнопка разделов» — belongs to Phase 26 (ROADMAP lists it there).
- «Окно „Видимая часть“ в шаблоне» (template builder framing) — belongs to Phase 23.

</deferred>

---

*Phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya*
