# Phase 12: Права редакторов и безопасность доступа - Research

**Researched:** 2026-10-26
**Domain:** Next.js 16 route handlers + Supabase (Auth, PostgREST, RLS) access control; owner-applied SQL; pure-TS diff enforcement
**Confidence:** HIGH on codebase facts (all files read this session), MEDIUM on Supabase/PostgREST runtime behaviour (docs + repo precedent, no live probe: the secret-file guard blocked reading `.env.local`, so no request was sent to the owner's project)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
D-00a: Без применённого SQL нового столбца нет, у всех редакторов все вкладки. Код работает и до SQL, и после (v1.1 roadmap, STATE.md).
D-00b: SQL прав и подтверждённой почты — один блок владельца в конце фазы. В нём: предварительная проверка `auth.users`, откат, `begin/commit`. Владелец сам проверяет «Confirm email» в Supabase и сам применяет SQL (SEC-02, STATE.md ⚠️ Phase 12).
D-00c: Опрос контента раз в 10 с, пока вкладка браузера видна (03.2-07). Новые проверки прав опираются на этот опрос.
D-01: Переключатели прямо в строке редактора списка «Аккаунты редакторов»: под почтой ряд из 7 чипов (порядок и названия как во вкладках: `sectionLabels` + «Сотрудники»). Отдельного окна и таблицы нет.
D-02: Нажатие на чип сразу переключает вкладку и сохраняет. В строке короткая пометка «Сохранено» или ошибка. «Доступ» сохраняется отдельно от кнопки «СОХРАНИТЬ» редактора.
D-03: «ВЫДАТЬ ДОСТУП» без выбора вкладок. Новая строка появляется со всеми чипами включёнными (PERM-02).
D-04: До применения SQL чипы видны, все включены и не нажимаются. Под ними строка: «Вкладки по редакторам заработают после применения SQL».
D-05: В базе хранится список **закрытых** вкладок, пустой = «всё открыто». Будущая новая вкладка (например, «Справочник») сама открыта всем. — Reversibility: costly.
D-06: Кнопок «ВСЕ» и «НИЧЕГО» нет, только 7 чипов.
D-07: Можно закрыть все 7 вкладок, не отзывая доступ («заморозка»).
D-08: Открытая вкладка — цвет акцента и ✓, закрытая — серая и перечёркнутая; у чипа `aria-pressed`.
D-09: «Доступ» остаётся вкладкой только владельца. Переключателем не управляется; у владельца всегда все вкладки.
D-10: Сервер сайта проверяет всё. `PUT /api/content` сравнивает сохранённый контент с присланным через `changedSections()`; изменён хоть один закрытый для редактора раздел — отказ. `/api/employees` (PATCH/POST/DELETE) требуют вкладку «Сотрудники».
D-11: В базе по вкладке «Сотрудники» закрыты таблицы `portia_employee_profiles` и `portia_manual_employees` (RLS). Строку `portia_content` база по-прежнему пускает любого редактора (триггер по разделам JSON не делаем). **Принятый риск**: записать в PROJECT.md (Known Limitations) и в записи ревью. — Reversibility: reversible.
D-12: Сохранение с изменённым закрытым разделом отклоняется **целиком** (403 с названием раздела, например «Раздел «Сводка» для вас закрыт»). Частично ничего не пишется, черновик остаётся на экране.
D-13: Удаление вируса переносит его в Корзину и разрешено, даже если «Корзина» закрыта. Перенос считается правкой «Базы вирусов». Менять и восстанавливать что-либо в самой Корзине без этой вкладки нельзя. Серверная проверка различает: вирус ушёл из `viruses` в `recycledViruses`/`recycleOrder`, и меняются его тексты `virus:<id>:*`.
D-14: «Не видеть, что внутри» — только для редактора: у закрытой вкладки нет кнопки, полей, оформления и черновика (PERM-03). Публичный рабочий стол показывает все разделы всем.
D-15: Закрытая вкладка пропадает примерно за 10 с: права перечитываются вместе с опросом контента. Сервер в любом случае отклонит правку (D-12).
D-16: Несохранённые правки закрытого раздела возвращаются к тому, что в базе, + сообщение: «Владелец закрыл раздел «…», несохранённые правки в нём сброшены». Правки открытых разделов остаются.
D-17: Если закрыты все 7 вкладок, значок редактора на рабочем столе остаётся. Внутри нет вкладок, только сообщение «Владелец пока не открыл вам ни одного раздела».
D-18: `getEditorAccess` не даёт доступа пользователю без `email_confirmed_at`, и до SQL, и после.
D-19: Неподтверждённая почта после входа: на странице входа «Почта не подтверждена. Откройте письмо от Supabase и войдите снова». Редактор не открывается. Кнопки повторной отправки нет.
D-20: SQL двумя частями: (1) отдельный файл-инструкция (например `supabase/phase12_apply.sql`) с пронумерованными шагами: 1) предварительная проверка, 2) применение в `begin/commit`, 3) проверка после, 4) откат; (2) обновлённый `supabase/portia_setup.sql` для установки с нуля одним файлом.
D-21: Предварительная проверка выводит владельца и каждого редактора из `portia_editors`: есть ли аккаунт и подтверждена ли почта. Если почта **владельца** не подтверждена, блок прерывается сам и ничего не применяет. Что делать с неподтверждёнными редакторами — решает владелец.
D-22: Исключения для владельца в SQL нет.
D-23: Локальный путь начинается с одного `/`, `//…` не локальный. Касается всех проверок в коде (`lib/portia-content-normalize.ts:83`, `lib/portia-employees.ts:523`, `components/portia-editor.tsx:91`) и CHECK у `portia_employee_profiles.photo_url`. Ограничение добавляется как `not valid` и включается (`validate constraint`) только после проверки существующих строк. Проверку строк включить в предварительную проверку D-21.
D-24: Хранение прав сразу поддерживает два вида вкладок: **обычные** (по умолчанию открыты, список закрытых; 7 вкладок сайта + будущий «Справочник») и **доверяемые** (по умолчанию закрыты, список выданных; первая — будущее «Повышение»). В фазе 12 доверяемых вкладок нет, но столбцы и SQL-функции устроены так, чтобы «Повышение» добавлялось потом только строкой в коде, без нового SQL. — Reversibility: costly.
D-25: Чип «Повышение» появится вместе с приложением; выглядит как остальные, но новая строка получает его выключенным. «Доступ» только у владельца, передать нельзя.

### Claude's Discretion
- Имена столбца и функции (пример: `portia_editors.closed_tabs text[] not null default '{}'` и `portia_can_edit_tab(tab text)`). У владельца нужно право UPDATE на столбец: сейчас на `portia_editors` выданы только select/insert/delete.
- Как код узнаёт, что SQL ещё не применён (пример: по ошибке «нет столбца» при чтении). Тогда всё открыто, владельцу возвращается флаг для D-04.
- `/api/uploads` разрешён, если у редактора открыта хотя бы одна вкладка.
- Если редактор стоял на закрытой вкладке — переходит на первую открытую. Ctrl+Z не возвращает правки закрытого раздела.
- Нужен ли идентификатор «employees» в общем списке разделов или отдельно от `EditorSection`.
- Проверять ли заодно `/\host` (браузер читает как `//host`). Решает исследователь, строже не хуже.

### Deferred Ideas (OUT OF SCOPE)
- Приложение «Справочник» (отдельная фаза 13). Приложение «Повышение» (отдельный milestone; права под него закладываются здесь, D-24/D-25).
- Выключение паука на фоне «Паутина».
- Скрывать закрытые разделы на публичном сайте — не берём.
- Кнопка «Отправить письмо снова» — не берём.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Редактор пускается только при `email_confirmed_at`, проверка в коде до SQL | `getUser()` returns `User.email_confirmed_at` (Standard Stack, Pattern 1); owner-login mapping of `email_not_confirmed`; lockout pitfall P1 |
| SEC-02 | SQL требует подтверждённую почту в `portia_is_owner`/`portia_can_edit`; предпроверка `auth.users`, откат, `begin/commit` | `auth.jwt()` has no confirmation claim, so SQL must read `auth.users` (Pattern 5); apply-file skeleton |
| CONT-09 | `//host/x.png` не локальный в коде и SQL | One shared `isLocalMediaPath` helper in 3 places + SQL regex CHECK `not valid` then `validate` (Pattern 6) |
| PERM-01 | Владелец включает/выключает 7 вкладок на редактора | `closed_tabs` column, `PATCH /api/editors`, chips in `EditorAccessManager` (Patterns 2, 7) |
| PERM-02 | Новый и уже одобренный редактор: все вкладки | `not null default '{}'` backfills existing rows; INSERT unchanged |
| PERM-03 | Редактор не видит закрытые вкладки | Tab filter + revert action + poll of `/api/access` (Pattern 7) |
| PERM-04 | Сервер отклоняет правки закрытых разделов (контент и сотрудники) | `deniedSections()` in `PUT /api/content`, tab guard in employees routes, RLS on 2 tables (Patterns 3, 4) |
</phase_requirements>

## Summary

The access model today is two SQL functions (`portia_is_owner`, `portia_can_edit`) called as RPC from `getEditorAccess`, which every route calls. Nothing is per-tab. The phase adds (a) a `closed_tabs`/`granted_tabs` pair of columns on `portia_editors`, read **directly by the site** as a column select (not an RPC), so "column missing" is one detectable Postgres error and everything stays open; (b) server enforcement as pure, unit-testable functions in `lib/` (diff saved vs incoming content with `changedSections`, plus a virus-to-bin special case); (c) an email-confirmed check on the `User` object from `getUser()` in code and on `auth.users` in SQL; (d) one shared "local media path" helper replacing three `startsWith("/")` tests.

Three findings change the plan and are not in CONTEXT.md. **First**, `changedSections` has a hole: formatted-text keys with the `info-block:` prefix (`portiaTextKey.infoBlock`) map to no section, so today a formatting-only edit of an info text block does not mark the draft dirty, and server-side enforcement built on `changedSections` would let a closed-«Информация» editor change them (probed: `changedSections` returned `[]` for a changed `info-block:abc:text`). **Second**, `save()` in the editor rewrites assistant fields before sending (trim, defaults, `assistant:idle` document), so a restricted editor saving content whose stored assistant data is not already in that shape would produce a phantom diff in a section they never touched and get a false 403; the fix is to send closed sections exactly as the baseline has them (`revertSections`) and to extract the save normalization into a tested pure function. **Third**, the 10 s poll cannot carry permissions: `/api/content` GET is CDN-cached and shared (`s-maxage` 300); permissions must come from `/api/access` (no-store), called next to `fetchContent` only while the user can edit, and `/api/access` must stop answering `200 {canEdit:false}` on transient errors or a poll will unmount the editor and destroy drafts.

**Primary recommendation:** Build in this order: pure `lib/` (media-url, editor-tabs, deniedSections/revertSections, history revert, prefix fix) with tests first; then `getEditorAccess` + routes; then UI; SQL files last and applied by the owner after the code is deployed, with a read-only preflight handed to the owner **before** deploy because the code-level SEC-01 check takes effect immediately.

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md` does not exist (config points at `./.claude/CLAUDE.md`; not found in the repo root listing). Constraints taken from `.planning/codebase/CONVENTIONS.md`/`TESTING.md` and the code instead:
- Tests: Node built-in runner, `node --experimental-strip-types --test lib/*.test.ts`; only `lib/*.test.ts` is globbed, so anything that must be tested lives in `lib/` with **relative `.ts` imports** (no `@/` alias). `app/api/*` handlers cannot be unit-tested; keep them thin. [VERIFIED: package.json `"test": "node --experimental-strip-types --test lib/*.test.ts"`]
- User-facing text in Russian; API errors JSON `{ error }` with 403/400/500. [CITED: 12-CONTEXT.md code_context]
- SQL file stays re-runnable (`create or replace`, `if not exists`, `drop policy if exists`). [VERIFIED: supabase/portia_setup.sql line 1 "It is safe to run again after code updates."]
- ESLint react-hooks rule: existing code never calls setState synchronously in an effect; it wraps in `window.setTimeout(..., 0)` or uses render-time derived reset (see `portia-editor.tsx` lines 729-737 and 1115). Follow the same.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email-confirmed gate (SEC-01) | API / Backend (`getEditorAccess`) | Database (SQL functions, SEC-02) | One server choke point; SQL repeats it so direct REST calls with a token also fail |
| Which tabs an editor has | Database (`portia_editors` columns) | API (reads columns, computes open set) | Owner-managed data; site derives; RLS reuses it for the two employee tables |
| Reject closed-section content save | API / Backend (`PUT /api/content`) | — (D-11: DB deliberately does not enforce) | Diff needs normalizer + `changedSections`; accepted risk recorded |
| Reject closed employee writes | API (`/api/employees*`) | Database (RLS via `portia_can_edit_tab('employees')`) | Cheap in SQL because tables are separate |
| Hide closed tabs / drop drafts | Browser (editor) | — | UI only; server is the real gate |
| Pick up permission changes in ~10 s | Browser (poll) | API (`/api/access`, no-store) | Content GET is CDN-shared and cannot carry per-user data |
| `//host` rejection | API normalizer + editor input | Database CHECK | Same helper in code; regex CHECK in SQL |
| Apply SQL safely | Owner (Supabase SQL editor) | — | Executor cannot reach the DB; preflight + rollback ship in a file |

## Standard Stack

No new packages. Everything uses what is installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.117.3 [VERIFIED: node_modules/@supabase/supabase-js/package.json] | `getUser()` (returns `email_confirmed_at`), PostgREST client | Already the access layer |
| `@supabase/ssr` | ^0.12.7 [VERIFIED: package.json] | Cookie-bound server client | Already used by all routes |
| Node built-in `node:test` + `node:assert/strict` | Node 24.21.0 locally, `engines` says `>=22.13.0 <23` [VERIFIED: `node --version`, package.json] | Unit tests | Existing convention |
| Postgres / PostgREST (Supabase hosted) | n/a | Columns, SQL functions, RLS | Owner's project |

`User.email_confirmed_at?: string` exists in the installed types. [VERIFIED: node_modules/@supabase/auth-js/dist/main/lib/types.d.ts:418 `email_confirmed_at?: string;`]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Site reads `closed_tabs` column directly | RPC `portia_can_edit_tab(tab)` per tab or `portia_my_tabs()` | RPC adds a "function missing" branch (PGRST202/42883) and N round trips; a column select has one missing-column branch and the rules (membership in a list) are trivial to mirror in TS. Keep the SQL function **only** for RLS. |
| Postgres trigger on `portia_content` sections | — | Rejected by D-11 (accepted risk) |
| Whitelist of tab ids in a SQL CHECK | Shape-only CHECK | A whitelist forces new SQL for «Справочник»/«Повышение», contradicting D-24. Use shape-only CHECK; the API validates ids against the code registry. |

**Installation:** none. **Version verification:** no packages added, so the legitimacy gate does not apply.

## Package Legitimacy Audit

No external packages are installed by this phase. Nothing to audit. **Packages removed [SLOP]:** none. **Packages flagged [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
Browser (desktop + editor)                        Next.js route handlers                     Supabase
─────────────────────────                        ──────────────────────                     ────────
every 10 s (visible tab):
  fetchContent ──GET /api/content (CDN, shared)──► public read ─────────────────────────────► portia_content
  if canEdit: fetchAccess ─GET /api/access (no-store)─► getUser() ─► Auth server (email_confirmed_at)
                                                      getEditorAccess:
                                                        rpc portia_can_edit ───────────────► function (SQL; after SEC-02 also checks auth.users)
                                                        rpc portia_is_owner ───────────────► function
                                                        select closed_tabs,granted_tabs ───► portia_editors (own row via RLS)
                                                          └─ 42703/PGRST204 => tabsEnforced=false, closed=[]
                  ◄── {canEdit, canManageEditors, closedTabs, tabsEnforced}
  editor: hide closed tabs, revertSections(baseline, draft, closed) + notice (D-16)

Save (СОХРАНИТЬ):
  editor builds payload = revertSections(baseline, saveNormalize(draft), closed)  [no phantom diff]
  PUT /api/content ──► getEditorAccess ─► not canEdit ─► 403
                       parse+normalize ─► restricted editor? (not owner, closed non-empty)
                          yes: select payload,revision (id='main'); revision != base ─► 409
                               denied = deniedSections(baseline, normalized, closed)  [virus->bin allowed]
                               denied non-empty ─► 403 {error, sections}  (nothing written)
                       conditional update .eq(revision) ─► purge CDN tag

Owner chips: click ─► optimistic ─► per-row queue ─► PATCH /api/editors {email, closedTabs}
                       requireOwner ─► validate ids vs registry ─► update portia_editors
                       column/grant/policy missing (PGRST204|42703|42501|0 rows) ─► 503 {code:"pending-database"}

Employees: PATCH|POST|DELETE /api/employees, GET /api/employees/editor ─► require tab "employees" open ─► else 403
Uploads:   POST /api/uploads ─► owner or at least one open tab ─► else 403
```

### Recommended Project Structure
```
lib/
├── media-url.ts            # NEW isLocalMediaPath(): one rule for 3 call sites (+ test)
├── editor-tabs.ts          # NEW registry (kind regular|trusted), parse/open/deny helpers (+ test)
├── editor-changes.ts       # EDIT: add "info-block:" prefix; add deniedSections, revertSections
├── editor-history.ts       # EDIT: new "restrict" action (+ editor-history.test.ts cases)
├── editor-access.ts        # EDIT: confirmed check, tab read, "unavailable" state (+ editor-access.test.ts with fake client)
├── editor-save.ts          # NEW (recommended): save normalization extracted from PortiaEditor.save() (+ test)
app/api/{content,editors,access,uploads,employees,employees/editor}/route.ts   # EDIT
app/owner-login/{actions.ts,page.tsx}                                           # EDIT (D-19)
components/{portia-editor.tsx,portia-desktop.tsx}, app/portia.css               # EDIT
supabase/portia_setup.sql, supabase/phase12_apply.sql (NEW)
.planning/PROJECT.md (Known Limitations: D-11 risk)
```

### Pattern 1: `getEditorAccess` (single point; SEC-01 + tabs + "unavailable")
**What:** Return a richer object. Distinguish *denied* from *lookup failed* (today both are `noAccess`).
**Existing code (verbatim, to be replaced):** [VERIFIED: lib/editor-access.ts:3-20]
```ts
const noAccess = { canEdit: false, canManageEditors: false };
...
  if (!user?.email) return noAccess;
  const [canEdit, isOwner] = await Promise.all([
    supabase.rpc("portia_can_edit"),
    supabase.rpc("portia_is_owner"),
  ]);
  if (canEdit.error || isOwner.error) {
    console.error("PORTIA editor access lookup failed", canEdit.error ?? isOwner.error);
    return noAccess;
  }
  return { canEdit: canEdit.data === true, canManageEditors: isOwner.data === true };
```
**Target shape (recommended):**
```ts
export type EditorAccess = {
  canEdit: boolean; canManageEditors: boolean;
  closedTabs: string[]; grantedTabs: string[];   // empty for owner
  tabsEnforced: boolean;                          // false = SQL not applied (D-04 flag)
  unavailable?: true;                             // lookup failed: caller must NOT treat as "revoked"
};
export async function getEditorAccess(supabase, user) {
  if (!user?.email || !user.email_confirmed_at) return noAccess;       // D-18, before and after SQL
  const email = normalizeEditorEmail(user.email);
  const [canEdit, isOwner, tabs] = await Promise.all([
    supabase.rpc("portia_can_edit"), supabase.rpc("portia_is_owner"),
    supabase.from("portia_editors").select("closed_tabs, granted_tabs").eq("email", email).maybeSingle(),
  ]);
  if (canEdit.error || isOwner.error) return { ...noAccess, unavailable: true };
  const missing = isMissingColumnError(tabs.error);                    // reuse lib/portia-employees.ts:93
  if (tabs.error && !missing) return { ...noAccess, unavailable: true }; // fail closed, same as the rpc errors
  ...
}
```
`isMissingColumnError` is exported from `lib/portia-employees.ts` [VERIFIED: lib/portia-employees.ts:93-95]:
```ts
export function isMissingColumnError(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST204" || error?.code === "42703";
}
```
Move it (or re-export) so `editor-access.ts` does not import the 600-line employees module; `editor-access.ts` must keep only relative `.ts` imports for tests.
**Why a column select detects "SQL not applied" even for the owner:** Postgres resolves column names at parse time, so `select closed_tabs` on `portia_editors` errors with undefined_column even when zero rows match; the owner has no row and still gets the signal. [ASSUMED: PostgREST forwards Postgres SQLSTATE 42703 for a select on a missing column; the repo already treats 42703 as "column absent" for selects: lib/portia-employees.test.ts:89 `return { data: null, error: { code: "42703" } }`. The PostgREST error page documents PGRST204 as "Caused when the column specified in the columns query parameter is not found." and says "PostgREST will forward errors coming from PostgreSQL."] Handling both codes (as the repo already does) covers both paths.

### Pattern 2: tab registry with two kinds (D-24) in `lib/editor-tabs.ts`
```ts
import { editorSections, sectionLabels, type EditorSection } from "./editor-changes.ts";
export type TabKind = "regular" | "trusted";
export const tabRegistry: { id: string; label: string; kind: TabKind }[] = [
  ...editorSections.map((id) => ({ id, label: sectionLabels[id], kind: "regular" as const })),
  { id: "employees", label: "Сотрудники", kind: "regular" },
  // phase 13: { id: "reference", label: "Справочник", kind: "regular" }
  // later:    { id: "promotion", label: "Повышение", kind: "trusted" }
];
export const openTabIds = (closed: readonly string[], granted: readonly string[]) =>
  tabRegistry.filter((t) => (t.kind === "regular" ? !closed.includes(t.id) : granted.includes(t.id))).map((t) => t.id);
```
Quote of the in-repo values the registry reuses: [VERIFIED: lib/editor-changes.ts:3,5,7-14]
```
export type EditorSection = "viruses" | "info" | "broadcasts" | "recycle" | "search" | "assistant";
export const editorSections: EditorSection[] = ["viruses", "info", "broadcasts", "recycle", "search", "assistant"];
viruses: "База вирусов", info: "Информация", broadcasts: "Сводка", recycle: "Корзина", search: "Рекомендации", assistant: "Помощник",
```
Decision on the discretion item: keep `"employees"` **out of `EditorSection`** (it is not a content section; `changedSections` must keep returning only content sections, see its comment "Employees and access are saved on their own, outside the draft"). The editor's local `EditorTab` already adds `"employees" | "access"` [VERIFIED: components/portia-editor.tsx:30]; the registry is the shared list for chips, tab strip, and API validation. "access" is never in the registry (D-09).

Tab-id strings stored in the DB are exactly these ids. Unknown ids in stored arrays are ignored on read (tab removed from code), and the API rejects unknown ids on write.

### Pattern 3: server diff — `deniedSections` (D-10, D-12, D-13) in `lib/editor-changes.ts`
```ts
// closed: tab ids the editor lacks. Returns the closed content sections the incoming copy changes.
export function deniedSections(baseline: PortiaContent, incoming: PortiaContent, closed: readonly string[]): EditorSection[] {
  const shut = new Set(closed);
  // D-13: a live virus that appears in the bin is a "viruses" edit, not a "recycle" edit.
  let compared = incoming;
  if (shut.has("recycle")) {
    const live = new Set(incoming.viruses.map((v) => v.id));
    const binned = new Set((baseline.recycledViruses ?? []).map((v) => v.id));
    const moved = new Set(baseline.viruses.filter((v) => !live.has(v.id) && !binned.has(v.id)
      && (incoming.recycledViruses ?? []).some((r) => r.id === v.id)).map((v) => v.id));
    if (moved.size) compared = { ...incoming,
      recycledViruses: (incoming.recycledViruses ?? []).filter((v) => !moved.has(v.id)),
      recycleOrder: (incoming.recycleOrder ?? []).filter((k) => !(k.startsWith("virus:") && moved.has(k.slice(6)))) };
  }
  return changedSections(baseline, compared).filter((s) => shut.has(s));
}
```
Why this is sufficient: `changedSections` already treats `virus:<id>:*` text keys as `viruses` while the id is in either list (`[...baseline.viruses, ...draft.viruses].some(...)`) [VERIFIED: lib/editor-changes.ts:34-38], so the moved virus's texts are `viruses` edits automatically; only the structural `recycledViruses`/`recycleOrder` change needs stripping. The existing test documents the baseline behaviour: [VERIFIED: lib/editor-changes.test.ts "moving a virus to the bin changes viruses and the bin" → `["viruses", "recycle"]`]. A moved id must exist in `baseline.viruses` and not already be in the bin, so injecting a brand-new record or deleting/reordering other bin entries still counts as `recycle`. The stripped copy is used only for comparison; the saved payload is the real incoming one. If `viruses` is also closed the move is denied through `viruses`.
Restore (bin → live) is deliberately **not** special-cased: it changes both sections, so it needs `recycle` open (D-13 "восстанавливать ... нельзя").

### Pattern 4: enforcement in routes
`PUT /api/content` (after `normalizePortiaContent`, before the write). Existing write is a compare-and-swap on `revision` [VERIFIED: app/api/content/route.ts:57-65], which makes this race-free: read the pre-image **with its revision**; if `row.revision !== baseRevision` return the existing 409 text; else diff. If another save slips in between, the conditional update matches 0 rows and the existing 409 path fires, so the diff is always computed against exactly the row that gets replaced.
```ts
const restricted = !access.canManageEditors && access.closedTabs.length > 0;   // owner never restricted
if (restricted) {
  const { data: row } = await supabase.from("portia_content").select("payload, revision").eq("id", "main").maybeSingle();
  if (row && row.revision !== baseRevision) return Response.json({ error: "<existing 409 text>" }, { status: 409 });
  const baseline = (row?.payload ? normalizePortiaContent(row.payload) : null) ?? defaultPortiaContent;
  const denied = deniedSections(baseline, normalized, closedTabIds);
  if (denied.length) return Response.json({ error: deniedMessage(denied), code: "section-closed", sections: denied }, { status: 403 });
}
```
- `deniedMessage`: one section → `Раздел «Сводка» для вас закрыт`; several → `Разделы «A», «B» для вас закрыты` (D-12 gives the singular wording only).
- Also deny when the editor has zero open tabs (D-17 "заморозка"): 403 `Владелец пока не открыл вам ни одного раздела`.
- A rejected request must return **before** the write and before `purgeCacheTag` (no stale-cache or half-write).
- `defaultPortiaContent` is already imported in this route.

Employees: add a helper `requireTab(access, "employees")` and call it in `PATCH`, `POST`, `DELETE` of `app/api/employees/route.ts` and in `GET` of `app/api/employees/editor/route.ts` (that route exposes the editor-only roster = "looking inside"); public `GET /api/employees` is untouched (D-14). Currently each handler checks `!data.user || !access.canEdit` [VERIFIED: app/api/employees/route.ts:32,70,103; editor/route.ts:15]. Message: reuse `Нет доступа к редактору.` style → `Вкладка «Сотрудники» для вас закрыта.` with 403.
Uploads: allowed if `canManageEditors || openTabIds(...).length > 0` [Claude's Discretion item]. [VERIFIED: app/api/uploads/route.ts:18 `if (!authData.user || !access.canEdit)`].

Editors route (`app/api/editors/route.ts`): `GET` selects `email, created_at, closed_tabs, granted_tabs`, retrying without the two columns on a missing-column error and returning `tabsEnforced:false` (same retry pattern as `saveEmployeeProfile`, [VERIFIED: lib/portia-employees.ts:502-508]). New `PATCH {email, closedTabs?, grantedTabs?}`: validate email with the existing `emailPattern`, closedTabs ⊆ regular ids, grantedTabs ⊆ trusted ids (400 otherwise), dedupe, then
```ts
const { data, error } = await supabase.from("portia_editors").update(patch).eq("email", email).select("email");
if (error?.code === "42501" || isMissingColumnError(error)) → 503 { code: "pending-database", error: "Вкладки по редакторам заработают после применения SQL." }
if (error) → 500
if (!data?.length) → exists? 404 : 503 pending-database   // policy missing => zero rows (precedent below)
```
Precedent: [VERIFIED: lib/portia-employees.ts:468-477] `updateManualEmployee` returns `pending-database` for `error?.code === "42501" || isMissingTableError(error)` and for "row exists but update touched no row". POST (grant) stays `insert({ email, granted_by })`; new row gets `'{}'` defaults (PERM-02, D-03, D-25).

### Pattern 5: SQL (inside `supabase/phase12_apply.sql`, mirrored into `portia_setup.sql`)
Order matters: columns first (SQL-language function bodies are validated at `create function` time), then functions in dependency order, then grants/policies.
```sql
-- columns (defaults backfill existing editors => PERM-02)
alter table public.portia_editors
  add column if not exists closed_tabs  text[] not null default '{}',
  add column if not exists granted_tabs text[] not null default '{}';
-- shape-only check, NOT a whitelist, so new tabs need no SQL (D-24)
-- (add constraint via do-block / drop-if-exists + add, re-runnable)
--   check (cardinality(closed_tabs) <= 32 and cardinality(granted_tabs) <= 32
--          and array_to_string(closed_tabs, ',') ~ '^([a-z][a-z-]{0,31}(,[a-z][a-z-]{0,31})*)?$'  -- same for granted_tabs)

create or replace function public.portia_email_confirmed() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null);
$$;
-- portia_is_owner: existing body AND public.portia_email_confirmed()   (D-22: no owner exception)
-- portia_can_edit: (portia_is_owner() or exists(editors row)) AND portia_email_confirmed()  -- owner branch already includes it
create or replace function public.portia_can_edit_tab(tab_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.portia_is_owner() or (public.portia_can_edit() and exists (
    select 1 from public.portia_editors
    where email = lower(coalesce(auth.jwt() ->> 'email', '')) and not (tab_id = any(closed_tabs))));  -- null tab_id => null => denied
$$;
-- trusted tabs (used later, no new SQL then): portia_has_tab_grant(tab_id) = owner or tab_id = any(granted_tabs)
revoke all on function ... from public, anon;  grant execute on function public.portia_can_edit_tab(text) to authenticated;
grant update (closed_tabs, granted_tabs) on table public.portia_editors to authenticated;
create policy "Owner can change editor tabs" on public.portia_editors for update to authenticated
  using ((select public.portia_is_owner())) with check ((select public.portia_is_owner()));
-- employee tables (D-11): replace portia_can_edit() with portia_can_edit_tab('employees') in the insert/update/delete policies
notify pgrst, 'reload schema';
```
Why `auth.users`: the access-token claims are `iss, aud, exp, iat, sub, role, aal, session_id, email, phone, is_anonymous` (+ optional `jti, nbf, app_metadata, user_metadata, amr`); there is no confirmation claim. [CITED: https://supabase.com/docs/guides/auth/jwt-fields.md] So `auth.jwt()` cannot tell confirmed from unconfirmed, and the existing functions (which read only `auth.jwt() ->> 'email'`, [VERIFIED: supabase/portia_setup.sql:59,71]) never could.
Existing facts the SQL must respect (verified by reading): editors may only select their own row: policy `using (email = lower((select auth.jwt() ->> 'email')) or (select public.portia_is_owner()))` [VERIFIED: supabase/portia_setup.sql:109]; `grant select, insert, delete on table public.portia_editors to authenticated;` [VERIFIED: :103] so UPDATE needs a new column grant **and** a new policy (without the policy an UPDATE silently matches zero rows).
Privilege hygiene: only owner can update the new columns (policy), so an editor cannot clear their own `closed_tabs`.

### Pattern 6: `//host` (CONT-09) — one helper, three call sites, one CHECK
Current code, verbatim: [VERIFIED: lib/portia-content-normalize.ts:83] `return url.startsWith("https://") || url.startsWith("/") ? url : fallback;` ; [VERIFIED: lib/portia-employees.ts:523] `if (photoUrl && !photoUrl.startsWith("https://") && !photoUrl.startsWith("/")) return null;` ; [VERIFIED: components/portia-editor.tsx:91] `... ?? (trimmed.startsWith("/") ? trimmed : "")).replace(...)`. SQL: [VERIFIED: supabase/portia_setup.sql:22] `photo_url text not null default '' check (photo_url = '' or photo_url like 'https://%' or photo_url like '/%'),`.
The call sites for `normalizeMediaUrl` are file/mutation/infected image and info photo block [VERIFIED: portia-content-normalize.ts:38,178,235,239].
```ts
// lib/media-url.ts  (decision on /\host: reject. Browsers parse "/\host" as "//host"; and the URL parser also drops tab/newline anywhere, so "/\t/host" == "//host")
export const isLocalMediaPath = (u: string) => /^\/(?![\/\\])[^\u0000-\u001f\u007f]*$/.test(u);
```
(A bare `"/"` still passes: the lookahead sees no second character. Run this session: `"/"`, `"/a/b.png"`, `"/%2F/x"` accepted; `"//host/x.png"`, the backslash form, `"/<TAB>/host"`, a newline, `https://x` and `x` rejected.) Tests: `//host/x.png`, `/\host/x.png`, `/\t/host`, `/%2F/x` (allowed: percent-encoding is not a separator), `/a/b.png`, `/` , `https://x/y`, `http://x`, `javascript:...`, empty.
SQL (named constraint, re-runnable): drop any check on the table whose definition mentions `photo_url` (the old one is unnamed: Postgres default name is `<table>_<column>_check` [ASSUMED], so look it up instead of hard-coding), then
```sql
alter table public.portia_employee_profiles drop constraint if exists portia_employee_profiles_photo_url_local;
alter table public.portia_employee_profiles add constraint portia_employee_profiles_photo_url_local
  check (photo_url = '' or photo_url like 'https://%' or photo_url ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$') not valid;
-- after the preflight shows 0 bad rows:
alter table public.portia_employee_profiles validate constraint portia_employee_profiles_photo_url_local;
```
`NOT VALID` is enforced on every later insert **and update** of any row: "The constraint will still be applied against subsequent inserts or updates ... But the database will not assume that the constraint holds for all rows in the table, until it is validated". [CITED: https://www.postgresql.org/docs/current/sql-altertable.html] Consequence: if a row already violates, the next ordinary profile save (`upsert`, even for biography only) of that employee fails. That is why the bad-row listing is part of the preflight (D-23) and `validate` is a separate numbered step that is skipped when the listing is non-empty. `VALIDATE CONSTRAINT` takes only `SHARE UPDATE EXCLUSIVE` (does not block writes) [CITED: same page].
Existing stored `//` URLs inside `portia_content.payload`: the normalizer runs on read (`GET /api/content` calls `normalizePortiaContent(row.payload)` [VERIFIED: app/api/content/route.ts:28]) so they are blanked on the public side as soon as the code deploys, and rewritten blank on the next save. Add an informational preflight query: `select count(*) from public.portia_content where payload::text ~ '": "(//|/\\\\)'` [ASSUMED: jsonb::text prints `"key": "value"` with one space; backslash is JSON-escaped, hence four]. SQL regexes cannot be run locally (no `psql`/Docker, see Environment), so step 3 of the apply file must contain self-test `select`s with expected true/false for the regex.
Also add read-side defense in `profileFromRow` (lib/portia-employees.ts:287 `photoUrl: row.photo_url`): pass through `isLocalMediaPath || https`, else `""`, so a pre-existing bad row never renders.

### Pattern 7: editor UI + poll (PERM-03, D-15, D-16, D-17)
Touchpoints (all verified by reading):
- Tabs strip: [VERIFIED: components/portia-editor.tsx:1139-1152] builds from `editorSections` + `["employees","Сотрудники"]` + owner-only `["access","Доступ"]`; initial `useState<EditorTab>("viruses")` [VERIFIED: :674]. Filter by open ids; derive the shown tab at render (`openIds.includes(tab) ? tab : openIds[0] ?? null`) instead of an effect. `tab === "employees"` rendering at :1543 and the employee `leaveTo`/`employeeDirty` state at :684-686 must also reset when employees closes (else the leave dialog / dirty flag lingers; `onDirtyChange(dirty || employeeDirty)` at :1079).
- `Props` gains `closedTabs`/`openTabs` and `tabsEnforced`. `PortiaEditor` is rendered once at [VERIFIED: components/portia-desktop.tsx:1425] with `canManageEditors={canManageEditors}`; state lives at :273-274; `fetchAccess` at :406-414.
- Poll: [VERIFIED: portia-desktop.tsx:500-501]
  `const syncTimer = window.setInterval(() => { if (document.visibilityState === "visible") void fetchContent(); }, contentSyncMs);` and `const onVisible = () => { if (document.visibilityState === "visible") void fetchContent(); };`. Add `if (canEditRef.current) void fetchAccess();` to both. `contentSyncMs = 10_000` [VERIFIED: :44]. Mirror `canEdit` in a ref with the existing "latest ref in an effect" idiom (see :990-991 in the editor). Do **not** poll `/api/access` for anonymous visitors (everyone on the public site would pay a function call every 10 s).
- `fetchAccess` today ignores non-OK [VERIFIED: portia-desktop.tsx:409 `if (!response.ok) return;`], so making `/api/access` return **503** when `access.unavailable` is enough to keep the editor mounted through a Supabase blip. Currently the route's `catch` returns `200 {canEdit:false,...}` [VERIFIED: app/api/access/route.ts:14] and `getEditorAccess` returns `noAccess` on any rpc error, which, polled every 10 s, would flip `canEdit` to false and unmount the editor with unsaved drafts (P3).
- Drafts of closed sections (D-16): add history action `{ type: "restrict"; project: (content: T) => T }` to the generic reducer in `lib/editor-history.ts`: apply `project` to `present`, every `past` and `future` entry (drop adjacent duplicates), leave `baseline`/`source` alone, `key: null`. This satisfies "Ctrl+Z does not bring back closed-section edits" without losing open-section undo. `project = (c) => revertSections(history.baseline, c, closedSections)`. Dispatch it from a `window.setTimeout(...,0)` effect keyed on the closed-set string, show the D-16 sentence in the existing `role="status"` region (:1547) or a visible notice, and move `tab` to the first open one (derived).
- Chips: in `EditorAccessManager` [VERIFIED: portia-editor.tsx:2531-2612], row markup is `<div key={editor.email}><div><strong>…</strong><small>ДОСТУП К РЕДАКТОРУ</small></div><button …>ОТОЗВАТЬ</button></div>`; add a chip row under the email (`<button type="button" aria-pressed>`; ✓ open / struck-through closed per D-08; disabled with the D-04 sentence when `tabsEnforced === false`). CSS lives in `app/portia.css` next to `.access-editor-list`.
- Optimistic chips (D-02) race: send the **full** `closedTabs` list from the row's latest local state, serialize requests per row (promise chain or "pending" flag; keep the latest click queued), and on error roll the row back to the last server-confirmed list. `loadEditors()` after a grant must not overwrite a row with an in-flight PATCH. Full-list PATCH is idempotent, so a lost response cannot corrupt state, unlike server-side toggle (read-modify-write on an array column over PostgREST is not atomic).
- Restore button in Корзина [VERIFIED: portia-editor.tsx:1436-1444 `restored = next.recycledViruses.find…`, `switchTab("viruses")`] moves a virus to `viruses`: disable it when `viruses` is closed (otherwise the server will refuse the save with a confusing message). Likewise, the 403 response should call `fetchAccess()` immediately so the revert (D-16) does not wait for the next tick.
- Save error text: `saveContent` [VERIFIED: portia-desktop.tsx:1000 `if (!response.ok) throw new Error("save failed");`] discards the body. Read `{error}` on 403 and surface it (the savebar shows only `ОШИБКА`), D-12 requires the section name to be visible.
- `save()` input must come from a pure extracted function (`lib/editor-save.ts`), then `revertSections(history.baseline, normalized, closedSections)` so closed sections are byte-identical to baseline (P4).

`revertSections(baseline, content, sections)` (in `editor-changes.ts`): for every top-level key with `sectionOfKey(key) ∈ sections` copy the baseline value; for `formattedText` keys with `sectionOfFormattedKey(...) ∈ sections` copy from baseline or delete if absent there. **Coupling rule:** if `viruses` xor `recycle` is among the reverted sections and a virus id is in a different list in baseline vs content (a move/restore in the draft), revert **both** `viruses` and `recycle` for that id; otherwise reverting `viruses` alone after a restore leaves the virus in neither list (silent loss). Test: no baseline virus id is ever lost by `revertSections`.

### Pattern 8: login messages (D-19)
[VERIFIED: app/owner-login/actions.ts:14-15] `const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) redirect("/owner-login?error=invalid");`. With "Confirm email" on, Supabase refuses the sign-in itself: error code `email_not_confirmed` ("Signing in is not allowed for this user as the email address is not confirmed." [CITED: https://supabase.com/docs/guides/auth/debugging/error-codes]; present in the installed `ErrorCode` union [VERIFIED: node_modules/@supabase/auth-js/dist/main/lib/error-codes.d.ts]). So: `if (error?.code === "email_not_confirmed") redirect("/owner-login?error=unconfirmed")`, and after a successful sign-in `if (!data.user.email_confirmed_at) { signOut; redirect(unconfirmed) }` (covers "Confirm email" off + admin-created users). In `page.tsx` add `unconfirmed` to the specific-message list: today the catch-all [VERIFIED: page.tsx:54] `error && !["denied", "not-approved", "setup"].includes(error)` would show the generic text. `editorSignUp` needs no change (no session before confirmation).

### Anti-Patterns to Avoid
- **Permissions inside `/api/content` payload or headers:** that response is CDN-shared (`publicCacheHeaders(contentCacheTag, 300)`); per-user data would leak to all visitors. Use `/api/access` (`noStoreHeaders`) only.
- **Whitelisting tab ids in SQL:** breaks D-24 (new tab = new SQL).
- **RPC per tab from the site:** more failure modes, same answer as the column.
- **Treating a transient lookup error as "no access" in the polled path:** loses drafts.
- **Diffing against the client's idea of the baseline:** always diff against the row read server-side in the same revision.
- **Stripping the virus move on the saved payload:** strip only a comparison copy.
- **Validating the new CHECK in the same step as adding it without a preflight:** it will abort the whole apply block or, if skipped, break later profile saves.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section diff | A second differ | `changedSections()` + the two small helpers above | Already tested, already used for the dirty indicator; add the missing `info-block:` prefix instead |
| Missing-column / missing-table detection | New code-matching | `isMissingColumnError` / `isMissingTableError` (lib/portia-employees.ts:93-100) | Proven by existing tests |
| "SQL pending" UX | New state machine | The `pending-database` pattern from manual employees (`app/api/employees/route.ts:83`) | Same wording/shape |
| Email-confirmed truth | Parsing JWT | `user.email_confirmed_at` from `getUser()` in code; `auth.users` lookup in SQL | JWT has no such claim |
| Atomic array toggle | Read-modify-write route | Full-list PATCH, serialized per row | One writer (owner), idempotent |
| Local-path rule in 3 places | Three regexes | `lib/media-url.ts` | The bug *is* the three copies |
| Confirm dialogs/notices | New modal | Existing `ConfirmDialog`, `role="status"` region | Matches the app |

**Key insight:** every piece of this phase is a small pure function plus a thin wiring layer; the only genuinely risky parts are ordering (code deploy vs SQL), false positives of the diff, and the owner lockout.

## Runtime State Inventory

> Not a rename phase, but it changes stored schema and live auth rules, so the five categories are answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `portia_editors` rows (existing approved editors) get `'{}'` for both new columns automatically via `not null default '{}'` (all open = PERM-02). `portia_employee_profiles.photo_url` rows may contain `//host` or `/\host` (unknown; owner's data not readable from here). `portia_content.payload` may contain `//host` image URLs (unknown). | Preflight listing of bad `photo_url` rows (D-23); informational count for payload; data fix by owner only if rows are listed |
| Live service config | Supabase Auth dashboard "Confirm email" provider setting (not in git). Supabase PostgREST schema cache. | Owner verifies "Confirm email" is ON before applying (D-00b); `notify pgrst, 'reload schema'` at the end of the script |
| OS-registered state | None. Hosting is Netlify (`netlify.toml`); no cron/scheduler involved. | None — verified by reading repo root and `netlify.toml` listing |
| Secrets/env vars | None change (no new env vars; `portia_owner_email()` unchanged). | None |
| Build artifacts / installed packages | None. No package changes. | None |

## Common Pitfalls

### P1: Owner lockout by the code check, not only by the SQL
**What goes wrong:** D-18 takes effect on deploy. If the owner's `auth.users.email_confirmed_at` is null (e.g., the account was created while "Confirm email" was off and Supabase left it empty), the owner cannot open the editor the moment the code ships, before any SQL runs. After the SQL, the RLS side locks the same way (policies call `portia_is_owner`).
**Why it happens:** the check is deliberately exception-free (D-22).
**How to avoid:** make the read-only preflight (apply-file step 1) available to the owner **before** the deploy, not only at the end; put a `checkpoint:human-action` in the plan ahead of the merge. Include the recovery statement in the rollback section: `update auth.users set email_confirmed_at = now() where lower(email) = '<owner>' and email_confirmed_at is null;` (run in the dashboard SQL editor, which is not subject to these RLS rules [ASSUMED: it runs as the `postgres` role]). The dashboard is always reachable independent of the app, so lockout is recoverable, but the plan must say so.
**Warning signs:** after login `owner-login?error=unconfirmed` for the owner.

### P2: "Confirm email" off in the dashboard
**What goes wrong:** with confirmation disabled, sign-up returns a session and `email_confirmed_at` may be empty even though the user can log in [search summary of Supabase reference, not verified against the auth source: MEDIUM-LOW]; if so every new editor is blocked by the check. Conversely, with it off anyone can register an address they do not own, which is the SEC-02 threat the owner is closing.
**How to avoid:** the apply file's first instruction is the dashboard check (Authentication → Providers → Email → "Confirm email" ON). The preflight lists every editor's confirmed state. D-21: unconfirmed editors do not abort the block; only an unconfirmed owner does.

### P3: Polled `/api/access` unmounts the editor on a blip
Covered in Pattern 7. Fix: `unavailable` → 503, client keeps previous state. Also keep `canEdit=false` authoritative answers working (revoked editor: editor unmounts, same as a reload today).

### P4: Phantom diff → false 403 on an untouched section
**What goes wrong:** `save()` normalizes assistant fields (`trim().filter(Boolean)`, fallback phrases, `assistantPatienceVariants`, writes `formattedText["assistant:idle"]`/`["assistant:activity"]`, clamps timings) [VERIFIED: components/portia-editor.tsx:1003-1034]. Stored content that was never through exactly this shape (the default content, or seeded rows) differs after normalization, so `changedSections` reports `assistant` for an editor whose «Помощник» is closed.
**How to avoid:** (1) send closed sections byte-identical to the baseline: `revertSections(history.baseline, normalized, closedSections)` before the PUT, so the phantom diff cannot occur whatever the stored shape; (2) extract the save normalization into `lib/editor-save.ts` and test that `deniedSections(stored, saveNormalize(stored), [])` stays consistent, i.e. that `saveNormalize` of `defaultPortiaContent` followed by `revertSections` for every closed section yields `[]` denied; (3) test `normalizePortiaContent` is idempotent (`normalize(normalize(x))` deep-equals `normalize(x)`) on the default content, because the server compares `normalize(stored)` with `normalize(incoming)`.
**Warning signs:** a restricted editor gets 403 naming a section they never opened.

### P5: `info-block:` hole in `changedSections`
`prefixSections` lists `info:`, `broadcast:`, `recycle:`, `search:`, `assistant:` [VERIFIED: lib/editor-changes.ts:26-32] but the editor writes `info-block:<blockId>:text` [VERIFIED: lib/portia-content.ts:182 `infoBlock: (blockId: string) => \`info-block:${blockId}:text\``, used at portia-desktop.tsx:1332]. Probe this session: `changedSections` of a draft that adds `formattedText["info-block:abc:text"]` returned `[]`. Fix: add `"info-block:": "info"` (must be checked before/independent of `info:` since `"info-block:".startsWith("info:")` is false, order is irrelevant). Add a test that **every `portiaTextKey` builder output classifies to a section** (and `virus:`/`mutation` ones). Fail closed on the server: for a restricted editor, also reject changes to formattedText keys that classify to no section (`unclassifiedChanges`), so a future key without a prefix cannot bypass the gate.

### P6: Stale PostgREST schema cache after the SQL
`select closed_tabs` works as soon as the column exists (Postgres resolves it), but an `update … set closed_tabs` is validated against PostgREST's schema cache and fails with `PGRST204` until reload [PGRST204 "column … not found": CITED docs; the cache-staleness cause is ASSUMED]. The script ends with `notify pgrst, 'reload schema';` (existing idiom [VERIFIED: supabase/portia_setup.sql:40,226]). If the owner still sees "pending" chips after applying, reload the schema from the dashboard (API settings). The API maps `PGRST204` to `pending-database`, so nothing breaks, only the chips stay disabled/erroring until reload. Likewise PostgREST reports a missing function as `PGRST202` (404) and Postgres as `42883`. [CITED: https://docs.postgrest.org/en/stable/references/errors.html]; irrelevant to the site because the recommended design never calls a new function.

### P7: Race with optimistic chips (D-02)
See Pattern 7. Without serialization, two quick clicks send `[a]` then `[a,b]` and out-of-order arrival can persist the older list.

### P8: Restoring a virus while «База вирусов» is closed
Disable the restore button; the server denies it (changes `viruses`). Coupled revert rule prevents data loss in D-16.

### P9: Caching
`contentCacheTag` is purged only after a **successful** write [VERIFIED: content/route.ts:68]; denied requests return earlier, so nothing to purge. `/api/access` and `/api/editors` are per-user and must keep `noStoreHeaders` / `force-dynamic`. `localStorage` content cache holds public content only; nothing new is stored there.

### P10: Lint rule on effects
Dispatch/setState from effects must go through `window.setTimeout(…, 0)` as elsewhere in the file, or the build's lint step fails (`npm run check` runs lint).

### P11: SQL apply block behaviour
Wrap in `begin; … commit;`. A `do $$ … raise exception … $$` first block aborts the transaction when the owner is unconfirmed. [ASSUMED: the Supabase SQL editor sends the script as one batch, so an error stops the rest and the transaction rolls back; the apply file should still say "if you see an error, nothing was applied; run step 3 to confirm".] Do not put `validate constraint` for `photo_url` inside the unconditional path unless the preflight query returned zero rows.

## Code Examples

### getEditorAccess unit test with a fake client (pattern from existing tests)
[Precedent: lib/portia-employees.test.ts builds fake `supabase` objects returning `{ data, error: { code: "42703" } }`.]
```ts
// lib/editor-access.test.ts
const fake = (tabs: { data?: unknown; error?: { code: string } }) => ({
  rpc: async (name: string) => ({ data: true, error: null }),
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: tabs.data ?? null, error: tabs.error ?? null }) }) }) }),
}) as never;
test("unconfirmed email gets no access, even for the owner", async () => {
  assert.deepEqual(await getEditorAccess(fake({}), { email: "a@b.c" } as never), noAccess);
});
test("missing column => everything open, tabsEnforced false", ...);   // code "42703" and "PGRST204"
test("other tab read error => unavailable", ...);
```

### Apply-file skeleton (`supabase/phase12_apply.sql`)
```sql
-- STEP 0 (dashboard, not SQL): Authentication -> Providers -> Email -> "Confirm email" must be ON.
-- STEP 1 PREFLIGHT (read-only, safe any time, run BEFORE deploying the site)
select 'owner' as role, o.email, (u.id is not null) as has_account, (u.email_confirmed_at is not null) as confirmed
from (select public.portia_owner_email() as email) o left join auth.users u on lower(u.email) = o.email
union all
select 'editor', e.email, (u.id is not null), (u.email_confirmed_at is not null)
from public.portia_editors e left join auth.users u on lower(u.email) = e.email order by 1 desc, 2;
select employee_id, photo_url from public.portia_employee_profiles
where not (photo_url = '' or photo_url like 'https://%' or photo_url ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$');   -- must return 0 rows before step 2b
select count(*) as content_rows_with_double_slash from public.portia_content where payload::text ~ '": "(//|/\\\\)';
-- STEP 2 APPLY
begin;
do $$ begin
  if not exists (select 1 from auth.users where lower(email) = public.portia_owner_email() and email_confirmed_at is not null)
  then raise exception 'Owner email is not confirmed: nothing was applied'; end if;
end $$;
-- ...columns, functions, grants, policies, constraint NOT VALID...
notify pgrst, 'reload schema';
commit;
-- STEP 2b (only if the bad-photo listing above was empty):
alter table public.portia_employee_profiles validate constraint portia_employee_profiles_photo_url_local;
-- STEP 3 CHECK AFTER: columns exist; select public.portia_can_edit_tab('info') as owner session note; regex self-tests, e.g.
select ('//x' ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$') as must_be_false, ('/a/b.png' ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$') as must_be_true;
-- STEP 4 ROLLBACK (begin; ... commit;): restore the pre-phase bodies of portia_is_owner/portia_can_edit and the employee policies
--   (copy verbatim from the git version before this phase: supabase/portia_setup.sql lines 52-73 and 164-223), drop the new
--   photo constraint and re-add the old check, optionally drop the tab columns (data-preserving alternative: leave them).
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `auth.jwt() ->> 'email'` only | plus `auth.users.email_confirmed_at` lookup in a `security definer` function | Required because the JWT has no confirmation claim [CITED: jwt-fields doc] |
| `photo_url like '/%'` | regex excluding `//`, `/\`, control chars | CONT-09 |

**Deprecated/outdated:** none relevant; `proxy.ts` (Next 16 name for middleware) is already used and its matcher already covers `/api/access`, `/api/editors`, `/api/uploads` [VERIFIED: proxy.ts matcher]. `/api/content` and `/api/employees` writes refresh the session in the handler.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgREST returns SQLSTATE `42703` (not only `PGRST204`) for a `select` of a missing column | Pattern 1 | Low: code accepts both, repo tests already assume it; if some third code appeared, `getEditorAccess` would return `unavailable` (503, editor stuck closed) before SQL: the plan should include a manual check on the owner's live project (`GET /api/access` as owner returns `tabsEnforced:false`, not 503) |
| A2 | Supabase SQL editor runs as `postgres` (bypasses RLS) and aborts/rolls back a multi-statement batch on error | P1, P11 | Medium: affects wording of apply-file instructions, not code |
| A3 | Default name of the inline column check is `<table>_<column>_check` | Pattern 6 | Low: apply file looks the constraint up by definition instead of by name |
| A4 | With "Confirm email" off, new users may have null `email_confirmed_at` | P2 | Medium: if instead they are auto-confirmed, the check is simply ineffective until the owner turns the setting on (still covered by step 0) |
| A5 | SQL regex `'^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$'` behaves as intended under `standard_conforming_strings=on`; `payload::text ~ '": "(//|/\\\\)'` matches stringified JSON | Pattern 6, apply file | Medium: cannot be executed locally (no psql/Docker); step 3 self-tests make the owner's run the verification, and a wrong regex fails closed only for photo URLs (rejects) |
| A6 | URL parsers drop ASCII tab/newline inside a URL so `/<TAB>/host` becomes `//host` | Pattern 6 | Low: stricter rule costs nothing |
| A7 | `getUser()` validates against the Auth server (so `email_confirmed_at` is fresh) | Pattern 1 | Low: it is the call every route already uses |
| A8 | Supabase REST rejects an `update` body with a column unknown to the schema cache with `PGRST204` until reload | P6 | Low: either way the API maps both `PGRST204` and `42703` to `pending-database` |
| A9 | Roster of `portia_editors` has no row for the owner | Pattern 1 | None: the design works either way |

## Open Questions

1. **Owner confirmation state is unknown.**
   - What we know: nothing in the repo records `email_confirmed_at` for the owner or editors.
   - What's unclear: whether any approved editor is unconfirmed (they would be locked out the moment the code ships).
   - Recommendation: plan a `checkpoint:human-action` ("run apply-file step 1, paste the result") **before** merge/deploy; surface the unconfirmed editors list to the owner (D-21).
2. **Should `canEdit` flipping to false on the poll unmount the editor with unsaved drafts?**
   - What we know: it only happens on an authoritative answer after Pattern 7's 503 fix; same as reload-after-revoke today.
   - Recommendation: accept (owner revoked access on purpose; server would reject anyway). Mention in plan.
3. **Coupled revert rule for viruses/recycle** (Pattern 7) is new behaviour not stated in CONTEXT.md. Recommendation: implement as specified; it only triggers when a cross-list move exists in an unsaved draft.
4. **Unclassified formattedText keys for restricted editors**: fail-closed rejection (P5) is stricter than CONTEXT.md D-10 literally says but needed to make the gate sound. Recommendation: include; the editor never produces such keys.
5. **Zero-diff save by a frozen editor** (all tabs closed): recommended 403 (D-17), trivial to drop if undesired.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tests, build | ✓ | 24.21.0 (engines wants 22.x; the suite still passes: 335 tests, 0 fail, ~1.2 s) | — |
| npm test baseline | regression gate | ✓ | `npm test` → `ℹ tests 335 ℹ pass 335 ℹ fail 0` [VERIFIED: ran this session] | — |
| `psql` / Docker / `supabase` CLI | executing SQL locally | ✗ | — | None: SQL is verified by static review + the owner running preflight/check steps; apply file includes self-tests |
| Live Supabase access for the executor | integration probes | ✗ (and must not be used: `.env.local` is a protected secret file) | — | Owner-run checkpoints; unit tests with fake clients |
| Supabase dashboard (owner) | "Confirm email", SQL editor, schema reload | Owner only | — | — |

**Missing dependencies with no fallback:** none blocking code work.
**Missing with fallback:** local SQL execution → owner verification checkpoints.

## Validation Architecture

> `.planning/config.json` has `"nyquist_validation": false`, so this section is not required by config; included because the orchestrator asked for it.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner + `node:assert/strict` (no third-party) |
| Config file | none; script in `package.json` |
| Quick run command | `node --experimental-strip-types --test lib/editor-changes.test.ts lib/editor-tabs.test.ts lib/editor-access.test.ts lib/media-url.test.ts lib/editor-history.test.ts` |
| Full suite command | `npm test` (≈1.2 s); gate: `npm run check` (tests + `next build` + lint) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | No `email_confirmed_at` ⇒ no access, owner included | unit (fake client) | `node --experimental-strip-types --test lib/editor-access.test.ts` | ❌ Wave 0 |
| SEC-01 | `email_not_confirmed` / unconfirmed session ⇒ `?error=unconfirmed` | manual (server action) | owner/dev login with an unconfirmed account | manual-only: server action not importable by `node:test` |
| SEC-02 | SQL functions, preflight, rollback | manual (owner-run) + static review of `phase12_apply.sql` | owner runs steps 1–4 | manual-only: no Postgres locally |
| CONT-09 | `//host`, `/\host`, tab-split rejected; `/a.png`, `https://` kept | unit | `node --experimental-strip-types --test lib/media-url.test.ts lib/portia-content-normalize.test.ts lib/portia-employees.test.ts` | ❌ media-url (Wave 0); others exist (extend) |
| PERM-01/02 | open set from closed/granted; defaults all-open; registry kinds | unit | `node --experimental-strip-types --test lib/editor-tabs.test.ts` | ❌ Wave 0 |
| PERM-01 | missing column ⇒ `tabsEnforced:false`, all open; other error ⇒ `unavailable` | unit | `lib/editor-access.test.ts` | ❌ Wave 0 |
| PERM-03 | `revertSections`, `restrict` history action, undo cannot resurrect | unit | `lib/editor-changes.test.ts`, `lib/editor-history.test.ts` | ✅ files exist (extend) |
| PERM-04 | `deniedSections`: closed section edit denied; virus→bin allowed with recycle closed; restore denied; foreign bin edit denied; `info-block:` classified; unclassified key denied; no phantom diff on default content | unit | `lib/editor-changes.test.ts`, `lib/editor-save.test.ts` | ✅ / ❌ (editor-save Wave 0) |
| PERM-04 | Route wiring (403s, 409 ordering, `pending-database` 503) | manual smoke with two accounts, or thin-handler review | `npm run build` compiles; hand-test with curl on `next dev` | manual-only: handlers import `@/` alias |

### Sampling Rate
- **Per task commit:** the quick command for the touched module.
- **Per wave merge:** `npm test`.
- **Phase gate:** `npm run check` green; owner-run SQL steps recorded; manual two-account smoke (restricted editor vs owner) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `lib/media-url.ts` + `lib/media-url.test.ts`
- [ ] `lib/editor-tabs.ts` + `lib/editor-tabs.test.ts`
- [ ] `lib/editor-access.test.ts` (fake Supabase client)
- [ ] `lib/editor-save.ts` + `lib/editor-save.test.ts` (extract from `PortiaEditor.save()`)
- [ ] extend `lib/editor-changes.test.ts`, `lib/editor-history.test.ts`, `lib/portia-content-normalize.test.ts` (idempotence), `lib/portia-employees.test.ts`
- Framework install: none.

## Security Domain

### Applicable ASVS Categories (level 1 per config)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth; confirmed email required in code and SQL; map `email_not_confirmed` |
| V3 Session Management | yes (unchanged) | `@supabase/ssr` cookie client; `getUser()` (server-validated) in every handler |
| V4 Access Control | yes (core) | Tab permissions server-side (`deniedSections`, `requireTab`), RLS on employee tables, owner-only `UPDATE` policy on `portia_editors`; deny by default on lookup failure |
| V5 Input Validation | yes | Validate PATCH ids against the registry (400), email pattern, `isLocalMediaPath`, normalizer on incoming content |
| V6 Cryptography | no | none hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Editor calls `PUT /api/content` directly with a closed section changed | Tampering / Elevation | `deniedSections` against server-read baseline at the same revision (CAS) |
| Same, but bypassing the site via Supabase REST with own token | Tampering | **Accepted risk D-11** for `portia_content`; record in PROJECT.md Known Limitations and review notes. RLS closes the two employee tables |
| Bypass via unclassified `formattedText` key (`info-block:`) | Tampering | Add prefix + fail-closed on unclassified changes (P5) |
| Editor self-escalates by clearing own `closed_tabs` | Elevation | Update policy `portia_is_owner()` only; column-level grant |
| Unconfirmed email registers owner/editor address | Spoofing | `email_confirmed_at` in code and SQL + dashboard "Confirm email" (SEC-02); no owner exception |
| Protocol-relative / backslash / tab-split image URL (external load, tracking) | Info disclosure / Spoofing | `isLocalMediaPath` + SQL CHECK |
| Lockout by transient lookup error | Denial of service | `unavailable` ⇒ 503; client keeps state |
| Permission data leaking via CDN-cached endpoint | Info disclosure | Permissions only on `no-store` `/api/access` |

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `lib/editor-access.ts`, `lib/editor-changes.ts` (+ test), `lib/editor-history.ts`, `lib/portia-content-normalize.ts`, `lib/portia-employees.ts`, `lib/portia-cdn.ts`, `lib/supabase/{server,proxy}.ts`, `proxy.ts`, `app/api/{content,editors,access,uploads,employees,employees/editor}/route.ts`, `app/owner-login/{actions.ts,page.tsx}`, `supabase/portia_setup.sql`, `components/portia-editor.tsx` (lines 26-120, 656-1180, 2528-2612), `components/portia-desktop.tsx` (366-530, 975-1021), `package.json`, `.planning/config.json`, ROADMAP/REQUIREMENTS/STATE excerpts.
- `npm test` run (335 pass); `changedSections` probe run with `node --experimental-strip-types` (info-block gap).
- `node_modules/@supabase/auth-js` types (`email_confirmed_at`, `email_not_confirmed`).

### Secondary (MEDIUM confidence)
- https://docs.postgrest.org/en/stable/references/errors.html — PGRST202/204/205 meanings, 42883/42P01/42501 HTTP mapping, "PostgREST will forward errors coming from PostgreSQL".
- https://supabase.com/docs/guides/auth/jwt-fields.md — access-token claim list (no confirmation claim).
- https://supabase.com/docs/guides/auth/debugging/error-codes — `email_not_confirmed`, `invalid_credentials`.
- https://www.postgresql.org/docs/current/sql-altertable.html — `NOT VALID` / `VALIDATE CONSTRAINT` semantics and lock.

### Tertiary (LOW confidence)
- WebSearch summary on "Confirm email" disabled ⇒ `email_confirmed_at` possibly empty (A4); not verified against Supabase auth source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all versions read from `node_modules`/`package.json`.
- Architecture: HIGH for code paths (read in full); MEDIUM for Supabase runtime error codes and SQL-editor behaviour (no live probe possible).
- Pitfalls: HIGH for P4/P5 (reproduced/derived from code, P5 probed), MEDIUM for P2/P6/P11 (external behaviour).

**Research date:** 2026-10-26
**Valid until:** 2026-11-25 (stable stack; re-check Supabase auth docs if the dashboard flow changes)
