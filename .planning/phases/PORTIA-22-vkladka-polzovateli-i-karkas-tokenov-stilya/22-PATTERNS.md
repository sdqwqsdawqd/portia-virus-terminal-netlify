# Phase 22: Вкладка «Пользователи» и каркас токенов стиля - Pattern Map

**Mapped:** 2026-11-09
**Files analyzed:** 22 (new/modified)
**Analogs found:** 20 / 22 (все analog-пути проверены `git ls-files`, tracked)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/20261110000000_portia_users_tab.sql` | migration | CRUD / request-response (definer RPC) | `supabase/migrations/20261109000000_portia_access_foundation.sql` (clear_cooldown, стр. 599-632; trigger 595-596) | exact |
| `lib/access-store.ts` (+ `listAccess`, `accessHistory`, `bulkCandidates`, `accessRpc.*`) | service | request-response | сам файл, `decideAccessRequest` / `clearAccessCooldown` (стр. 117-205) | exact |
| `lib/users-api.ts` | service (DI handler) | request-response | `lib/portia-promotion-api.ts` (+ тест `lib/portia-promotion-api.test.ts`) | exact |
| `lib/users-model.ts` | utility | transform | `lib/access-store.ts` (`isRecord`, `unexpected`, fail-closed parse) | role-match |
| `lib/users-view.ts` | utility | transform | `lib/editor-tabs.ts` (чистые функции над реестром) | role-match |
| `lib/users-time.ts` | utility | transform | RESEARCH «Code Examples» (Intl Moscow, plural) | no analog (используйте RESEARCH) |
| `lib/users-copy.ts` | config (тексты) | static | `lib/app-state.ts` `failureCopy` (стр. 6) | exact |
| `lib/users-roster.ts` | service | request-response (+TTL cache) | `lib/portia-promotion-sheet.ts` `loadPromotionAccessRoster` + `lib/portia-promotion-api.ts` | role-match |
| `app/api/users/route.ts` | route | request-response | `app/api/editors/route.ts` (requireOwner, 403, `pendingDatabase`) | exact |
| `proxy.ts` (+`"/api/users"` в matcher) | config | middleware | сам файл, стр. 12-21 | exact |
| `lib/editor-tabs.ts` (+ строка `users`) | config | static | сам файл, стр. 12-16 | exact |
| `lib/editor-tabs.test.ts` | test | - | сам файл, стр. 8-21 | exact |
| `components/portia-users-tab.tsx` | component | request-response, polling | `components/portia-editor-dossier.tsx` `ConfirmDialog` (307-340) + employees-вкладка в `components/portia-editor.tsx` | role-match |
| `components/portia-editor.tsx` (EditorTab union ~41, historyTab ~1058, бейдж, 403 -> `AppDeniedPanel` ~1152) | component | event-driven | сам файл | exact |
| `app/portia.css` (токены в ПЕРВЫЙ `:root` стр. 8; `users-*` в конец; CRLF!) | config | static | сам файл, `:root` стр. 8-30 | exact |
| `lib/style-tokens.test.ts` | test | file-I/O | RESEARCH «Pin the radius count» | no analog |
| `lib/users-sql.test.ts` | test | file-I/O (SQL text contract) | `lib/portia-sql.test.ts`, `lib/portia-migration-fingerprint.test.ts` | role-match |
| `lib/users-api.test.ts` | test | request-response | `lib/portia-promotion-api.test.ts` (стр. 1-50) | exact |
| `lib/access-foundation.test.ts` (allow-list вместо запрета) | test | file-I/O | сам файл, стр. 347-363 | exact |
| `tests/e2e/fixtures/data/expected-authz.json`, `supabase/fingerprint/expected/portia.fingerprint.json`, `lib/portia-canonical-parity.test.ts`, `lib/portia-migration-fingerprint.test.ts`, `lib/phase16-expected-authz.test.ts` | config/test | evidence | существующие записи Phase 21 в тех же файлах | exact |
| `22-SECURITY-MATRIX.md`, `lib/security-matrix.test.ts` (repoint) | doc/test | evidence | `21-SECURITY-MATRIX.md` + тест | exact |
| `22-MIGRATION-APPLY.md`, `22-STYLE-DIRECTION.md` | doc | - | `21-MIGRATION-APPLY.md` | role-match |

## Pattern Assignments

### `supabase/migrations/20261110000000_portia_users_tab.sql` (migration, definer RPC)

**Analog:** `supabase/migrations/20261109000000_portia_access_foundation.sql` (заморожен; sha-пин в `lib/portia-canonical-parity.test.ts`; не править)

**Форма definer-функции + revoke ДО grant** (стр. 599-632):
```sql
create or replace function public.portia_access_clear_cooldown(p_nickname_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.portia_is_owner() then raise exception 'owner-required'; end if;
  ...
  return jsonb_build_object('code', 'invalid');
end; $$;

revoke all on function public.portia_access_clear_cooldown(text) from public, anon, authenticated;
grant execute on function public.portia_access_clear_cooldown(text) to authenticated;
grant execute on function public.portia_access_clear_cooldown(text) to service_role;
```
Применить для `portia_access_list`, `_history`, `_bulk_candidates` (gate `portia_can_edit_tab('users')` -> `raise exception 'forbidden'`; bulk: `portia_is_owner()` -> `'owner-required'`). Тело строго между `as $$` и `$$;` (парсит fingerprint-тест). Никогда `set search_path = public`.

**Триггеры журнала** (стр. 595-596, не менять; меняется только тело функции `portia_access_journal_append_only` + новый AFTER INSERT `portia_access_journal_prune`, см. RESEARCH §5):
```sql
drop trigger if exists portia_access_journal_no_truncate on public.portia_access_journal;
create trigger portia_access_journal_no_truncate before truncate on public.portia_access_journal for each statement execute function public.portia_access_journal_append_only();
```
Внутренний хелпер `portia_access_mask_email`: revoke от public/anon/authenticated, grant только service_role (как `portia_access_nickname_key`). Поиск через `strpos`, не `ilike`.

---

### `lib/access-store.ts` (service, request-response)

**Analog:** сам файл. Новые wrappers копируют `call()` + switch по кодам и fail-closed `unexpected()`:
```ts
export const accessRpc = { ..., clearCooldown: "portia_access_clear_cooldown", ... } as const;   // + list/history/bulkCandidates

export async function clearAccessCooldown(client: AccessRpcClient, input: { nicknameKey: string }): Promise<ClearCooldownResult> {
  const data = await call(client, accessRpc.clearCooldown, { p_nickname_key: input.nicknameKey });
  switch (data.code) {
    case "cleared": case "no-cooldown": case "invalid": return { code: data.code };
    default: throw unexpected();
  }
}
```
Ошибка RPC -> `AccessStoreError(error.message)`; неизвестная форма -> `unexpected-reply`. Файл входит в covered paths матрицы (Pitfall 1).

---

### `lib/users-api.ts` + `lib/users-api.test.ts` (DI handler)

**Analog:** `lib/portia-promotion-api.ts` (стр. 1-70) и `lib/portia-promotion-api.test.ts` (стр. 1-50)

Импорты в `lib/` относительные с `.ts` (иначе `node --test` не резолвит):
```ts
import { loadPromotionAccessRoster, type PromotionAccessResult } from "./portia-promotion-sheet.ts";
export type PromotionApiDependencies = { now: () => Date; loadAccessRoster: () => Promise<PromotionAccessResult>; ... };
```
Тест: фабрика `dependencies(overrides)` возвращает `{ deps, calls }`, фикстуры `accessRoster: { status: "ok", roster: [{ nickname: "Alice", nicknameKey: "alice" }] }`; handlers возвращают `{ status, body }`, проверяются без Next.

---

### `app/api/users/route.ts` (route)

**Analog:** `app/api/editors/route.ts`

**Imports / gate** (стр. 1-21):
```ts
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { parseJsonObject } from "@/lib/request-json";
import { noStoreHeaders } from "@/lib/portia-cdn";
export const dynamic = "force-dynamic";

async function requireOwner() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const access = await getEditorAccess(supabase, data.user);
  if (!data.user || !access.canManageEditors) return null;
  return { supabase, user: data.user };
}
```
Для `users`: `access.canEdit && access.openTabs.includes("users")` иначе `403` без `code`; owner-only (`view=bulk`, bulk approve, clear_cooldown) через `canManageEditors`.

**pending-database** (стр. 25-28):
```ts
const pendingDatabase = () => Response.json(
  { code: "pending-database", error: "..." }, { status: 503, headers: noStoreHeaders });
```
Тело: `parseJsonObject(await request.text())`, `400` на невалидный. Результат-коды (`already-decided` и т.п.) идут как `200 { code }`; `409` для self/owner/level-above-own. Роут тонкий, логика в `lib/users-api.ts`. Не импортировать строку `portia_access_` (только `accessRpc.*` в `lib/`).

---

### `components/portia-users-tab.tsx` (component)

**Analog:** `components/portia-editor-dossier.tsx` `ConfirmDialog` (стр. 307-340) для нативного `<dialog class="portia-dialog">`:
```tsx
useEffect(() => {
  const dialog = dialogRef.current;
  if (!dialog || dialog.open) return;
  dialog.showModal();
  dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
}, []);
<dialog ref={dialogRef} className="portia-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId}
  onClose={() => onCancel()} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
  <div><h2 id={titleId}>{title}</h2><p id={textId}>{text}</p>
  <div className="portia-dialog-actions"> {actions.map(a => <button className={`${a.tone}-control`} ... />)} </div></div></dialog>
```
Reject/revoke: переиспользовать `ConfirmDialog` (`text` только строка). Bulk-окно (списки) и phone action window: сестринский `<dialog>` на тех же стилях. Состояния: `AppSkeleton shape="employees"`, `AppFatalPanel`, `AppStaleBanner`, `AppDeniedPanel` из `components/portia-desktop-states.tsx`. 403 без `code` = «Доступ закрыт» (прецедент: `components/portia-promotion-editor-main.tsx` `isDenied`).
**Критично:** любой кириллический литерал >= 7 слов в `components/*.tsx` валит `phase20-hints-inventory` -> такие тексты только в `lib/users-copy.ts` (шаблон: `lib/app-state.ts`, `export const failureCopy: Record<...> = { heading, body }`, стр. 6).

---

### `lib/editor-tabs.ts` + `lib/editor-tabs.test.ts`

**Analog:** стр. 12-16 реестра:
```ts
export const tabRegistry: TabDef[] = [
  ...editorSections.map((id) => ({ id, label: sectionLabels[id], kind: "regular" as const })),
  { id: "employees", label: "Сотрудники", kind: "regular" },
  // + { id: "users", label: "Пользователи", kind: "regular" },   (после employees, до promo)
  { id: "promo", label: "Повышение", kind: "trusted" },
];
```
Тест (стр. 8-21) жёстко пинит `regularTabs`, `slice(0, 8)`, `tabRegistry[8]` -> обновить: `regularTabs` + `"users"`, `slice(0, 9)`, `tabRegistry[9]` = promo, «all eight closed» -> nine. `EditorTab` union в `portia-editor.tsx` (~41) + исключение в `historyTab` (~1058).

---

### `proxy.ts`

Добавить `"/api/users"` в matcher (стр. 13-20), рядом с `"/api/editors"`; комментарий объясняет allow-list. Это covered path для матрицы.

---

### `app/portia.css` (токены)

**Analog:** первый `:root` (стр. 8-30): `--teal: #00bca6; --danger: #d55449; --accent-hue: 180.4; ...`. Токены только объявляются (declare-only), не переупорядочивать каскад; файл CRLF (`git ls-files --eol` i/lf w/crlf) - писать с родными окончаниями; в комментарии не писать литерал `border-radius`. Счёт `/border-radius\s*:/g` = 129 (portia.css), 6 (portia-promotion-editor.css) - пересчитать при плане. Не определять `--muted`.

---

### `lib/access-foundation.test.ts`

**Analog:** стр. 347-363, сканирует `app/` и `components/`, запрещает `/access-store|access-session|access-levels|\/nickname(\.ts)?["']/` и `portia_access_`. Заменить на явный allow-list (`app/api/users/route.ts`, `components/portia-users-tab.tsx`, при необходимости `components/portia-editor.tsx`); остальные посетительские файлы остаются под запретом.

## Shared Patterns

### Гейт и маскирование в БД, а не только в роуте
**Source:** `20261109000000_portia_access_foundation.sql` (gate `portia_can_edit_tab('users')`, стр. 404/498/547; owner: `portia_is_owner()`)
**Apply to:** все новые RPC. Редакторы имеют browser-сессию и могут вызвать RPC напрямую.

### Fail-closed коды результата
**Source:** `lib/access-store.ts` `call()` + `unexpected()`
**Apply to:** `access-store.ts`, `users-model.ts`, `users-api.ts`. UI читает коды, не сырые ошибки.

### Общие правила ника
**Source:** `lib/nickname.ts` `nicknameKey`; метки уровней `lib/access-levels.ts` (`accessLevelLabel`, `defaultApprovalLevel`) - нигде не хардкодить «Уровень N».

### Evidence в том же коммите, что и SQL
`expected-authz.json`, `portia.fingerprint.json` (`counts.triggers` 2 -> 3, пересчитать `src_sha256` у `append_only`), новый pin в `portia-canonical-parity.test.ts` (старые не трогать), `22-SECURITY-MATRIX.md` + repoint `security-matrix.test.ts`. Pin commit матрицы - последним (любая правка covered path после него = stale).

### Живое выполнение = BLOCKED
Postgres/RLS, авторизованные роли, гонки, ссылка Roblox (A3) - BLOCKED (ENV), не PASS. Owner-чекпоинт A/B/C (D-12) блокирующий; агент не выбирает букву.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `lib/users-time.ts` | utility | нет Moscow-форматтера; брать `Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Moscow",hourCycle:"h23"}).formatToParts` и `pluralZayavka` из RESEARCH |
| `lib/style-tokens.test.ts` | test | аналогов пина CSS нет; шаблон в RESEARCH (нормализовать CRLF, sha остатка после вырезания маркированных блоков) |

## Metadata

**Analog search scope:** `lib/`, `app/api/`, `components/`, `proxy.ts`, `supabase/migrations/`
**Прочитано:** CONTEXT, RESEARCH (стр. 1-433 из 558; остаток не читался), 8 analog-файлов
**Pattern extraction date:** 2026-11-09
