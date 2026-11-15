# Phase 25: Переключение закрытия - Pattern Map

**Mapped:** 2026-11-15
**Files analyzed:** 22 (новых и изменяемых)
**Analogs found:** 20 / 22
Все аналоги проверены `git ls-files` (отслеживаемые, не зеркала).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/20261115000000_portia_server_read_expand.sql` | migration | request-response (RPC) | `supabase/migrations/20261109000000_portia_access_foundation.sql` (`portia_access_submit_request`, стр. ~195-235) | exact |
| `supabase/migrations/20261115000100_portia_closure_contract.sql` | migration | batch (DDL, revoke/policy) | `supabase/migrations/20261101000000_portia_baseline.sql` (стр. 245-319, 1636-1673) + `20261114000000_portia_access_closure_default_on.sql` | role-match |
| `supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql` | migration (не применяется) | batch | `supabase/teardown/portia_teardown.sql` (шапка-маркер) | role-match |
| `lib/server-read.ts` (+ `.test.ts`) | service | request-response (подпись HMAC) | `lib/access-session.ts` (`signAccessSubmit`, `accessSubmitSecret`) + `lib/access-requests.test.ts` | exact |
| `lib/gate-for-request.ts` | utility | request-response | `app/api/content/route.ts` стр. 21-36 (inline `resolveGate`) | exact |
| `app/api/content/route.ts` GET (edit) | controller | request-response | сам файл + новая `server-read.ts` | exact |
| `app/api/employees/route.ts` GET (edit) | controller | request-response | `app/api/content/route.ts` GET | exact |
| `lib/employees-snapshot-cache.ts` | service | cache/transform | нет | no analog |
| `lib/portia-employees.ts` (edit) | service | CRUD/transform | сам файл | exact |
| `lib/portia-content.ts` (edit: убрать сид) | model | transform | сам файл | exact |
| `lib/testing/portia-content-fixture.ts` | test fixture | — | дословный перенос сида | exact |
| `lib/phase25-fixture-boundary.test.ts` (граница импорта) | test | file-I/O | `lib/e2e-import-boundary.test.ts` | exact |
| `scripts/phase25-build-scan.mjs` (+ `lib/phase25-build-scan.test.ts`) | utility/script | file-I/O | `scripts/phase20-release-gate.mjs` (`offlineChildEnv`) + `lib/e2e-import-boundary.test.ts` (обход каталогов) | role-match |
| `.claude/skills/portia-check/run.sh` (edit) | config | batch | сам файл (`step`) | exact |
| `lib/device-cache.ts` (edit) | utility | event-driven | сам файл | exact |
| `components/portia-access-gate.tsx` (edit) | component | event-driven (опрос 5 с) | сам файл (`refresh`) | exact |
| `lib/access-gate-view.ts` (edit, D-09) | utility | transform | сам файл (`accessGateLayout`) | exact |
| `components/portia-desktop.tsx` (edit: ключи, WR-03, IN-07, 401 в employees) | component | request-response | сам файл | exact |
| `app/api/uploads/route.ts` (edit: rewrite + DELETE) | controller | file-I/O | сам файл POST | exact |
| `lib/media-rewrite.ts` | utility | transform | `lib/media-url.ts` | role-match |
| `components/portia-editor*.tsx`, `portia-level-picker.tsx` (кнопка D-14) | component | request-response | `raisedNotice` механизм (`portia-editor.tsx` ~514, 1357, 1421) | role-match |
| `tests/e2e/specs/access-levels.spec.ts` (edit, SEC-04) | test | request-response (мок) | сам файл (`mockApi`, стр. 101-105, 303-335) | exact |
| `25-OWNER-CHECKLIST.md`, `25-POLL-BUDGET.md`, `lib/phase25-evidence.test.ts`, `lib/phase25-poll-budget.test.ts` | doc/test | — | `23-MIGRATION-APPLY.md`, `lib/phase24-evidence.test.ts`, `lib/portia-desktop.test.ts` | role-match |

## Pattern Assignments

### Миграция expand: `portia_content_read` / `portia_employees_read` (migration, request-response)

**Analog:** `supabase/migrations/20261109000000_portia_access_foundation.sql` стр. ~195-235.

**Проверка подписи (копировать форму, менять метку на `'content-read-v1|' || p_issued_at::text`):**
```sql
select s.secret into signing_secret from public.portia_access_secrets s where s.name = 'submit';
expected_signature := encode(extensions.hmac('access-submit-v1|' || ... || p_issued_at::text, signing_secret, 'sha256'), 'hex');
if signing_secret is null or length(signing_secret) < 32
  or p_issued_at is null or p_signature is null or p_signature !~ '^[0-9a-f]{64}$'
  or p_issued_at < now_epoch - 300 or p_issued_at > now_epoch + 60
  or extensions.digest(p_signature, 'sha256') is distinct from extensions.digest(expected_signature, 'sha256') then
  return jsonb_build_object('code', 'unauthorized');
end if;
```
Заголовок функции: `security definer`, `set search_path = ''`; сразу после — `revoke all ... from public, anon, authenticated;` ПЕРЕД любым `grant` (иначе красный `lib/portia-sql.test.ts`), затем `grant execute ... to anon, authenticated;` и `to service_role;`, `notify pgrst, 'reload schema';`. Операторы grant/revoke писать в одну строку (иначе `lib/phase16-expected-authz.test.ts` их не разберёт). Без `begin`/`commit`. Редактор обходит подпись через `if not public.portia_can_edit() then ... end if;`. Полный пример тела — RESEARCH §Code Examples.

### Миграция contract (migration, batch)

**Analog:** baseline `20261101000000_portia_baseline.sql` (политики/гранты, строки 245-252, 273-280, 312-319, 1647-1651) и `20261114000000_portia_access_closure_default_on.sql` (формат «безопасный повторный запуск»).

Порядок: защитный `DO`-блок (`to_regprocedure(...) is null` -> `raise exception`; строка `portia_access_secrets` с `length(secret) >= 32`) -> `revoke select on table public.portia_content from anon;` (по оператору на таблицу, одна строка) -> `drop policy if exists "Public can read ..."` -> `create policy "Editors can read ..." ... to authenticated using ((select public.portia_can_edit()));` для трёх таблиц и `storage.objects` (`bucket_id = 'portia-media' and ...`) -> `notify pgrst, 'reload schema';`. Не переопределять `portia_access_closure_enabled` (`lib/access-closure.test.ts`).

Обязательные синхронные правки в том же коммите: `migrationHashes` в `lib/portia-canonical-parity.test.ts`, `tests/e2e/fixtures/data/expected-authz.json` (migrations, функции, ячейки, `source` на реальные строки), `supabase/fingerprint/expected/portia.fingerprint.json`, `lib/phase23-evidence.test.ts` / `lib/phase24-evidence.test.ts` (ограничить версией `<= 20261114000000`), `lib/security-matrix.test.ts` (`currentMatrixText` -> Phase 25). До финала — окно красного: `--test-skip-pattern="matrix freshness: the real matrix commit"`.

### Аварийная миграция (не применяется)

**Analog:** `supabase/teardown/portia_teardown.sql` шапка (первая строка-маркер обязательна для теста, без `begin` в самом файле миграции; здесь `begin` не нужен):
```sql
-- ISOLATED TEST PROJECT ONLY. Never run directly and never against production.
```
Для Phase 25 маркер: «НЕ ПРИМЕНЯТЬ БЕЗ АВАРИИ». Лежит в `supabase/emergency/`, НЕ в `supabase/migrations/` (иначе ломает хеши и `db push`). Свой текстовый тест `lib/phase25-emergency.test.ts`: вне `migrations/`, маркер первой строкой, нет `begin`/`commit`, `service_role`, `auth.`.

### `lib/server-read.ts` (service, request-response)

**Analog:** `lib/access-session.ts`.

**Импорт и секрет** (стр. 1, 27-40):
```typescript
import { createHmac } from "node:crypto";
export const ACCESS_SUBMIT_SECRET_ENV = "PORTIA_ACCESS_SUBMIT_SECRET";
export function accessSubmitSecret(env = process.env) {
  const secret = env[ACCESS_SUBMIT_SECRET_ENV] ?? "";
  if (secret.length < submitSecretMinLength) throw new Error(`...`);
  return secret;
}
```
**Подпись** (стр. 75-79):
```typescript
export function signAccessSubmit(fields, secret: string) {
  if (secret.length < submitSecretMinLength) throw new Error(...);
  return createHmac("sha256", secret).update(accessSubmitMessage(fields)).digest("hex");
}
```
`signServerRead(scope, issuedAt, secret)` = `createHmac("sha256", secret).update(`${scope}-read-v1|${issuedAt}`)`. Не импортировать из клиентского кода (тянет `node:crypto`; см. комментарий в `lib/access-gate-view.ts` стр. 1-2). Тест: по образцу `lib/access-requests.test.ts` — раскладка сообщения и окно времени (300 назад / 60 вперёд) пинятся к тексту SQL. Редактор: клиент сессии, `p_issued_at: 0, p_signature: ""`.

### `app/api/content/route.ts` GET (controller, request-response)

**Analog:** сам файл, стр. 21-52. Заменить только блок чтения (стр. 39-47) вызовом `readContentRow`; ворота и `contentBodyFor` не трогать.

**Ворота (-> вынести в `lib/gate-for-request.ts` `resolveGateFor(request)`):**
```typescript
const client = await createServerSupabaseClient();
const decision = await resolveGate(request.headers, {
  client,
  sessionSecret: accessSessionSecret(),
  editorAccess: async () => {
    const { data, error } = await client.auth.getUser();
    if (isAuthRetryableFetchError(error)) return { canEdit: false, unavailable: true };
    const access = await getEditorAccess(client, data.user);
    return { canEdit: access.canEdit, unavailable: access.unavailable };
  },
});
const viewer = viewerOf(decision);
if (!viewer) return Response.json(contentAccessRequired, { status: 401, headers: noStoreHeaders });
```
**Ошибка:** `console.error(...)`; `Response.json({ error: "База временно недоступна." }, { status: 503, headers: noStoreHeaders })`. Строка `row === null`: зритель -> 503 «Данные временно недоступны.», редактор -> 200 с `emptyPortiaContent`, `revision: 0`. Тест-ограничитель `lib/content-response.test.ts:171-184` сравнивает порядок `viewerOf(` < маркер чтения: обновить маркер на `readContentRow(`. PUT (стр. 85-110) остаётся на таблицах сессии; `defaultPortiaContent` там заменить на `emptyPortiaContent`.

### `app/api/employees/route.ts` GET (controller, request-response)

**Analog:** `app/api/content/route.ts` GET (выше). Сейчас (стр. 10-23): без ворот, `loadEmployees(createPublicSupabaseClient())`, `publicCacheHeaders(employeesCacheTag, complete ? 600 : 30)`. Стать: `resolveGateFor` -> 401 `contentAccessRequired` + `noStoreHeaders`; чтение через RPC `portia_employees_read`; все ветки `noStoreHeaders`, без тега. Ветка ошибки уже верная:
```typescript
return Response.json({ employees: [], syncedAt: null, degraded: true, error: "Не удалось получить список сотрудников из таблицы." }, { status: 502, headers: noStoreHeaders });
```
Убрать импорт `publicCacheHeaders`, `createPublicSupabaseClient`; обновить устаревший комментарий (стр. 8-9) и в `proxy.ts`. `purgeCacheTag` в PATCH/POST/DELETE оставить на один релиз (тесты `lib/content-save.test.ts:84,96`, `lib/editor-tabs.test.ts:162`).

### `lib/portia-content.ts` + `lib/testing/portia-content-fixture.ts` (model)

**Analog:** сам `lib/portia-content.ts` (стр. 338 объявление, 549-550 `cloneDefaultContent`). Сид переносится дословно в `lib/testing/portia-content-fixture.ts` (`portiaContentFixture`, `cloneFixtureContent`); в рабочем коде остаются `assistantDefaults` и `emptyPortiaContent` (RESEARCH §3 — готовый код). `lib/portia-content-normalize.ts` (стр. 405-470) переходит на `assistantDefaults`. Потребители сида для механической замены: `components/portia-access-gate.tsx:10,121`, `app/api/content/route.ts:1,91`, `lib/content-response.ts:6,30`, `scripts/phase19-matrix-data.mjs`, ~20 `lib/*.test.ts`, 8 e2e-файлов.

**Граница импорта — analog `lib/e2e-import-boundary.test.ts`:**
```typescript
const productionRoots = ["app", "components", "lib"];
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(path)) || path.endsWith(".test.ts")) return [];
    return [path];
  });
}
```
Копировать; добавить пропуск `lib/testing` и регэксп `/testing[\\/]portia-content-fixture/`. `lib/testing/` не попадает под глоб `lib/*.test.ts`.

### `scripts/phase25-build-scan.mjs` (script, file-I/O)

**Analog:** обход каталога из `lib/e2e-import-boundary.test.ts` (рекурсивный `readdirSync({ withFileTypes: true })`) и стиль ESM-скриптов `scripts/phase20-release-gate.mjs` (обычный `.mjs`, без TS-импортов; офлайн-env `offlineChildEnv`, стр. ~252-266). Маркеры — литералами в файле; экспортировать `scanTree`/`CONTENT_MARKERS` для теста; пропускать `cache`, `dev`, `diagnostics`, `trace*`; искать UTF-8 и `\uXXXX`-вид; печатать только путь и маркер, никогда содержимое. Подключение: `package.json` `"postbuild": "node scripts/phase25-build-scan.mjs"`; в `.claude/skills/portia-check/run.sh` добавить после `build`:
```bash
if [ "${1:-}" = "build" ]; then step "build" npm run build --silent; step "build scan" node scripts/phase25-build-scan.mjs; fi
```
(стиль `step "<имя>" <команда>`, `run.sh` стр. 14-23).

### `lib/device-cache.ts` (utility, event-driven)

**Analog:** сам файл. Менять:
```typescript
export const CONTENT_CACHE_KEY = "portia-content-last-success-v1";   // -> -v2
export const EMPLOYEES_CACHE_KEY = "portia-employees-last-success-v1"; // -> -v2
export function cacheMatchesViewer(cached: unknown, viewerKey: string): boolean { ... .viewer === viewerKey }
export function clearDeviceContentCaches(storage: () => Pick<Storage, "removeItem">): void {
  for (const key of [CONTENT_CACHE_KEY, EMPLOYEES_CACHE_KEY]) { try { storage().removeItem(key); } catch { } }
}
```
Добавить `LEGACY_CACHE_KEYS` (оба `-v1`) + `purgeLegacyDeviceCaches(storage)` (тот же try/catch-образец), `person` в `cacheMatchesViewer(cached, viewerKey, person)`. Дубли литералов в `components/portia-desktop.tsx:220-221` заменить импортом; тесты `lib/device-cache.test.ts:42-43` и `lib/portia-desktop.test.ts:148` обновить.

### `components/portia-access-gate.tsx` `refresh()` (component, event-driven)

**Analog:** сам файл стр. 41-62. Добавить ref предыдущего ключа `viewerKey+person` и очистку при любом изменении рядом с существующей:
```typescript
if (decision.mode === "closed" && decision.allowed) approved.current = true;
if (shouldClearDeviceCaches(decision)) clearDeviceContentCaches(() => window.localStorage);
setView({ kind: "decision", decision });
```
Вызов `purgeLegacyDeviceCaches` — один раз на монтировании. Убрать `initialContent={defaultPortiaContent}` (стр. 121) -> `emptyPortiaContent`.

### `lib/access-gate-view.ts` `accessGateLayout` (D-09)

**Analog:** сам файл стр. 19-40. Единственная правка — до расчёта `showForm`/`status`:
```typescript
const raw = decision?.state.state;
const state = decision?.mode === "open" && (raw === "rejected" || raw === "revoked") ? "none" : raw;
```
Закрытый режим не менять. Менять тест `lib/access-gate.test.ts:299-308` (rejected/revoked в open = как `none`, `status: null`) и добавить тест на закрытый режим. Open Question 2 из RESEARCH (карточка при `none`) — решение владельца уже зафиксировано D-09 (вариант 2).

### `app/api/uploads/route.ts` (controller, file-I/O) + `lib/media-rewrite.ts`

**Analog:** сам файл POST (стр. 14-55) и `lib/media-url.ts` (чистые функции проверки URL).

**Гейт и ответы (копировать для новых веток `rewrite` / `DELETE`):**
```typescript
const supabase = await createServerSupabaseClient();
const { data: authData, error: authError } = await supabase.auth.getUser();
const authRetryable = isAuthRetryableFetchError(authError);
const access = authRetryable ? null : await getEditorAccess(supabase, authData.user);
const refusal = uploadGate({ authRetryable, user: authData.user, access, contentLength: request.headers.get("content-length") });
if (refusal) return Response.json({ error: refusal.error }, { status: refusal.status, headers: noStoreHeaders });
```
**Хранилище:** `supabase.storage.from("portia-media").upload(path, file, { cacheControl: "31536000", contentType, upsert: false })`, путь `recycle/${crypto.randomUUID()}.${ext}`, `getPublicUrl(path)`. Новое: `.copy(src, dst)` и `.remove([path])`. Разбор URL только чистой функцией с регэкспом `^recycle/[0-9a-f-]{36}\.(png|jpg|webp|gif)$` и проверкой хоста `NEXT_PUBLIC_SUPABASE_URL`. Новых `route.ts` не добавлять (ломает `phase23/24-evidence`). Обновить `lib/portia-desktop.test.ts:149-150` (счётчик `"/api/uploads": 1`).

### `tests/e2e/specs/access-levels.spec.ts` (test)

**Analog:** сам файл; `mockApi(page, control)` стр. 101-105: `page.addInitScript(() => window.localStorage.setItem("portia-access-approved-notice-v1", "1"))`, `page.route("**/api/**", ...)`. Чтение кэша стр. 328-329 — сменить ключи на `-v2`. Добавить сценарии: approved -> rejected/revoked (open и closed), падение уровня, выход редактора, стирание `-v1`, чужой `person`. Это «browser test on a local build with mocked /api», не проверка на данных.

### Чек-лист и доказательства

**Analog:** `.planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-MIGRATION-APPLY.md` (структура разделов, тон «Агент не применил ничего и нигде», секреты только по именам, нет слова PASS), `lib/phase24-evidence.test.ts` и `lib/phase23-evidence.test.ts` (проверка документа и `git ls-files`), `lib/portia-desktop.test.ts` (чтение констант 5000 / `30_000` / `5 * 60 * 1000` из исходников для `phase25-poll-budget`). Шаги порядка — RESEARCH §10.

## Shared Patterns

### Per-viewer ответ без кэша
**Source:** `app/api/content/route.ts` GET + `lib/portia-cdn.ts` (`noStoreHeaders = { "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store" }`)
**Apply to:** `/api/content` GET, `/api/employees` GET, новые ветки `/api/uploads`. Никакого `Netlify-Cache-Tag`.

### Ворота и зритель
**Source:** `resolveGate` + `viewerOf` + `contentAccessRequired` (`lib/access-gate.ts`, `lib/access-viewer.ts`, `lib/content-response.ts`); общий хелпер `lib/gate-for-request.ts` (закрывает IN-04).
**Apply to:** оба GET-маршрута.

### Подписанный RPC, fail closed
**Source:** `portia_access_submit_request` (SQL) + `signAccessSubmit` (TS). Нейтральный ответ `{"code":"unauthorized"}`, окно 300/60 с, общий секрет `'submit'`, метки разделяют домены.
**Apply to:** `portia_content_read`, `portia_employees_read`, `lib/server-read.ts`.

### Миграции-ограничители
**Source:** `lib/portia-canonical-parity.test.ts`, `lib/phase16-expected-authz.test.ts`, `lib/portia-migration-fingerprint.test.ts`, `lib/portia-sql.test.ts`
**Apply to:** обе новые миграции: имя `^\d{14}_portia_[a-z0-9_]+\.sql$`, возрастание версий, без `begin;`/`commit;`, revoke до grant, `set search_path = ''`.

### Правила среды (CLAUDE.md)
Ничего не применять к базе; не читать `.env*`; хук блокирует голое слово `supabase` в командах — писать пути `supabase/...`; `supabase-rls-reviewer` обязателен для `supabase/*.sql`; визуальный манифест только `--verify-promotion`; стейдж по явным путям.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `lib/employees-snapshot-cache.ts` | service | in-memory TTL cache | В проекте нет серверных кэшей в памяти (`lib/portia-employees.ts` стр. ~145: «the CDN caches the API response»). Использовать RESEARCH §5 (TTL 60-300 с, ASSUMED); ворота стоят перед кэшем; запись редактора сбрасывает снимок |
| Кнопка «Сменить адрес картинки» (UI целиком) | component | request-response | Ближайший прецедент — `raisedNotice` в `LevelPicker`; готового поведения «предложить действие над картинкой» нет. Список адресов записи — чистая функция `imageUrlsOfRecord` (RESEARCH §7) |

## Metadata

**Analog search scope:** `app/api`, `lib`, `components`, `scripts`, `supabase/migrations`, `supabase/teardown`, `tests/e2e/specs`, `.claude/skills/portia-check`
**Прочитано напрямую:** CONTEXT, RESEARCH (стр. 1-595 из 779; остальное — код-примеры/валидация), `app/api/content|employees|uploads/route.ts`, `lib/access-session.ts`, `lib/device-cache.ts`, `lib/access-gate-view.ts`, `lib/e2e-import-boundary.test.ts`, фрагменты foundation-миграции и gate-компонента
**Pattern extraction date:** 2026-11-15
