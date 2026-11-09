---
phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal
reviewed: 2026-11-09T12:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - lib/access-levels.ts
  - lib/access-session.ts
  - lib/access-store.ts
  - lib/nickname.ts
  - supabase/migrations/20261109000000_portia_access_foundation.sql
  - lib/access-closure.test.ts
  - lib/access-decisions.test.ts
  - lib/access-foundation.test.ts
  - lib/access-ip-bucket.test.ts
  - lib/access-levels.test.ts
  - lib/access-requests.test.ts
  - lib/access-rls-round2.test.ts
  - lib/phase16-expected-authz.test.ts
  - lib/portia-canonical-parity.test.ts
  - lib/portia-migration-fingerprint.test.ts
  - lib/portia-sql.test.ts
  - lib/portia-staging-live.test.ts
  - lib/security-matrix.test.ts
  - .env.example
  - package.json
findings:
  critical: 0
  warning: 5
  info: 9
  total: 14
  necessity: 1
status: issues_found
---

# Phase 21: отчёт code review

**Проверено:** 2026-11-09T12:00:00Z
**Глубина:** standard
**Файлов:** 20
**Статус:** issues_found

## Summary

Проверены серверные модули доступа (`lib/nickname.ts`, `lib/access-levels.ts`, `lib/access-session.ts`, `lib/access-store.ts`), миграция `20261109000000_portia_access_foundation.sql`, офлайн-тесты контракта и `.env.example`/`package.json`.

Контракт TS и SQL сходится. Коды ответов `submit`/`resolve`/`decide`/`set_level`/`revoke`/`clear_cooldown`/`set_closure`, имена параметров, сообщение подписи (`access-submit-v1|origin|nickname|token_hash|ip_bucket|issuedAt`, `String(n)` против `bigint::text`), окно времени 300/60 с, лимиты D-06 и значения по умолчанию D-04 совпадают. Расхождений, которые ломают поведение, не найдено. Порядок замков (queue -> nick в submit, только nick в остальных функциях) взаимной блокировки не даёт. Канонизация IPv6 в `ipv6Groups` правильно разбирает `::`, хвост IPv4, mapped, zone id и скобки.

Блокирующих находок нет. Главные замечания касаются тестов и неявных контрактов:
- живой прогон матрицы пишет в таблицу настроек на стенде, а тест называет все пробы «инертными»;
- тест «parity» для правила ника тавтологичен;
- инвариант «секрет подписи не равен секрету устройства» записан только в комментариях;
- защита self-decision по `requested_by` зависит от того, каким клиентом Фаза 23 вызовет submit, и это нигде не закреплено;
- `submitAccessRequest` бросает обычный `Error` вместо `AccessStoreError`.

Находки RLS21-01..16 из `21-RLS-REVIEW.md` здесь не повторяются: учтены, в том числе RLS21-16 (`x-forwarded-for` и группа `unknown`) и гонка `account_unique` (RLS21-04, раунд 2). Миграция заморожена хешем (`lib/portia-canonical-parity.test.ts:28-31`). Поэтому любая правка SQL ниже делается новой forward-only миграцией или шагом в `21-MIGRATION-APPLY.md`, а не изменением файла.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Живой прогон матрицы пишет на стенде через `portia_access_set_closure`, а тест утверждает, что пробы «инертны»

**Файлы:** `lib/phase16-expected-authz.test.ts:383-415`, `tests/e2e/fixtures/data/expected-authz.json:1868-1901`, `lib/portia-staging-live.test.ts:334-341`, `supabase/migrations/20261109000000_portia_access_foundation.sql:685-689`
**Проблема:** Тест называется «Phase 21 access functions are inert in a live run: no probe can pass the signature gate or write a row» и требует `creates_rows: false` для всех `portia_access_*`. Но у ячейки `owner` функции `portia_access_set_closure` исход `allow` с `p_enabled: false`, а `portia-staging-live.test.ts:334-341` вызывает каждую функцию от каждой роли. Владелец выполняет `insert ... on conflict (id) do update set closure_enabled = excluded.closure_enabled, updated_at = now(), updated_by = auth.uid()`. Каждый прогон перезаписывает строку `main`: в `updated_by` попадает uuid фикстуры владельца (после teardown фикстуры он висит без FK). Если флаг на стенде был включён ради проверки закрытия, прогон молча его выключает. Утверждение «no probe can write a row» ложно, и тест этого не ловит: `creates_rows` у этой функции `false`, а проверка `p_enabled === false` лишь закрепляет запись значения по умолчанию.
**Исправление:** Признать запись явно: добавить в матрицу поле вроде `"mutates_state": true` для `set_closure` и проверять его в тесте вместо утверждения про инертность. Живой прогон должен прочитать флаг до вызова и восстановить его после. Другой вариант: ячейку `owner` пометить `"verify_live": false`, а ветку владельца проверить отдельным тестом с восстановлением. Минимально нужно поправить название и комментарий теста:
```ts
const writers = new Set(["portia_access_set_closure"]);
for (const fn of access) {
  assert.equal(fn.creates_rows, false, `${fn.key}: creates_rows`);
  if (writers.has(fn.name)) assert.equal(fn.mutates_state, true, `${fn.key}: the owner probe upserts the settings row`);
}
```

### WR-02: Тест «ACC-04 parity» не может упасть: TS-регулярку сравнивают с ней же

**Файл:** `lib/access-foundation.test.ts:86-97`
**Проблема:** Сначала проверяется `literal === NICKNAME_PATTERN.source`. Затем `const sqlRule = new RegExp(literal)`, и цикл сравнивает `sqlRule.test(sample)` с `isValidNickname(sample)`. После первой проверки это один и тот же JS-объект регулярки без флагов, так что цикл тавтологичен и проходит при любых образцах. Название обещает, что «TS and SQL disagree» будет поймано, но семантика Postgres ARE (`~` под `collate "C"`, обработка `$` и `\n`, диапазоны классов) здесь не моделируется. Расхождение движков этот тест не увидит.
**Исправление:** Либо убрать цикл и честно назвать тест «literal equality», либо перенести образцы в живой набор (BLOCKED до стенда) с вызовом `select public.portia_access_nickname_key($1)` через привилегированную роль на изолированном проекте:
```ts
test("ACC-04: the SQL regex literal equals NICKNAME_PATTERN.source (engine semantics: staging only, BLOCKED)", () => {
  const literal = functionParts("portia_access_nickname_key").body.match(/~ '([^']+)'/)?.[1];
  assert.equal(literal, NICKNAME_PATTERN.source);
  assert.equal(NICKNAME_PATTERN.flags, "", "no flags: JS and ARE anchors mean the same");
});
```

### WR-03: Инвариант «секрет подписи не равен секрету устройства» не проверяется в коде

**Файлы:** `lib/access-session.ts:18-22`, `lib/access-session.ts:41-47`, `.env.example:5-7`
**Проблема:** Комментарий в `access-session.ts:18-19` прямо говорит, что секрет подписи хранится и в БД (`portia_access_secrets`), поэтому «it must not be the device secret». Но `accessSubmitSecret()` проверяет только длину. Если оператор задаст `PORTIA_ACCESS_SUBMIT_SECRET` равным `PORTIA_PROMOTION_DEVICE_SECRET` (оба лежат рядом в одном env), секрет устройства окажется в открытом виде в таблице, в Dashboard и в резервных копиях. Этим ключом считаются `token_hash` (`access:`), `ip_bucket` (`access-ip:`) и все digest Promotion (`device:`, `ip:`). Перебор всех /24 IPv4 (2^24 HMAC) тогда деанонимизирует `ip_bucket` заявок и bucket Promotion. Защита держится только на комментарии.
**Исправление:**
```ts
export function accessSubmitSecret(env: Record<string, string | undefined> = process.env) {
  const secret = env[ACCESS_SUBMIT_SECRET_ENV] ?? "";
  if (secret.length < submitSecretMinLength) throw new Error(`${ACCESS_SUBMIT_SECRET_ENV} must contain at least ${submitSecretMinLength} characters.`);
  if (secret === (env.PORTIA_PROMOTION_DEVICE_SECRET ?? "")) {
    throw new Error(`${ACCESS_SUBMIT_SECRET_ENV} must differ from PORTIA_PROMOTION_DEVICE_SECRET (it is also stored in the database).`);
  }
  return secret;
}
```
Добавить к этому негативный тест в `lib/access-foundation.test.ts`.

### WR-04: Защита self-decision по `requested_by` зависит от клиента, которым Фаза 23 вызовет submit, и этот контракт нигде не закреплён

**Файлы:** `lib/access-store.ts:7-12`, `lib/access-store.ts:83-101`, `supabase/migrations/20261109000000_portia_access_foundation.sql:287-288`, `:361-363`, `:435-442`
**Проблема:** `requested_by` записывается как `auth.uid()` клиента, который вызвал RPC. На этом поле держатся первая проверка `self-decision` в `portia_access_target_guard`, защита `owner-protected` по заявке и ссылка `account_id` (RLS21-04). Подпись делает сервер, поэтому самая естественная реализация маршрута Фазы 23 вызывает submit анонимным серверным клиентом или клиентом без пользовательских cookies. Тогда `requested_by` всегда `null`, и защита по ссылке заявки отключается для всех, а не только для «заявки без входа», которую принял владелец. `AccessRpcClient` принимает любой клиент. Ни комментарий модуля, ни тест не говорят, что нужен клиент с сессией посетителя (`@supabase/ssr` `createServerClient` с cookies запроса).
**Исправление:** Записать требование в шапке `access-store.ts` и в списке переносов Фазы 23 (`21-RLS-REVIEW.md`, раздел «Переносится в Фазу 23»). Ещё лучше сделать тип, который нельзя перепутать:
```ts
// submit MUST be called with the visitor's session-bearing server client (createServerClient + request cookies):
// requested_by = auth.uid() feeds the self-decision and owner-protected guards. An anon/service client records null.
export type VisitorSessionRpcClient = AccessRpcClient & { readonly __visitorSession: true };
```
Добавить тест-контракт для будущего маршрута: в `app/api/visitor` не используются `createClient(url, anonKey)` и `SUPABASE_SERVICE_ROLE` для `accessRpc.submit`.

### WR-05: `submitAccessRequest` бросает обычный `Error`, хотя модуль обещает `AccessStoreError`; код `invalid` из TS недостижим

**Файлы:** `lib/access-store.ts:1`, `lib/access-store.ts:44-46`, `lib/access-store.ts:85-93`, `lib/access-session.ts:57-64`, `:73-75`
**Проблема:** Шапка модуля обещает: «Fail closed: any error or unknown reply throws». Все ошибки RPC приходят как `AccessStoreError`, но `signAccessSubmit` вызывается до RPC и на плохой ник, origin, `tokenHash`, `ipBucket`, `issuedAt` или короткий секрет бросает обычный `Error("Invalid nickname.")` и подобные (это видно в `lib/access-requests.test.ts:307`). Маршрут, который ловит `AccessStoreError` и переводит `code` в ответ, на пользовательском вводе (неверный ник) упадёт с 500. При этом `SubmitResult` объявляет `"invalid"`, а TS отвергает ровно тот же набор полей раньше SQL, поэтому через обёртку `invalid` не приходит никогда. Тип ответа и реальное поведение расходятся.
**Исправление:** Проверять ввод в обёртке и возвращать типизированный ответ без RPC, а ошибки конфигурации (секрет) отдавать как `AccessStoreError`:
```ts
export async function submitAccessRequest(client: AccessRpcClient, input: SubmitInput): Promise<SubmitResult> {
  if (input.submitSecret.length < 32) throw new AccessStoreError("submit-secret-missing");
  if (!isValidNickname(input.nickname) || !(ACCESS_ORIGINS as readonly string[]).includes(input.origin)
    || !/^[0-9a-f]{64}$/.test(input.tokenHash) || !/^[0-9a-f]{32}$/.test(input.ipBucket)) {
    return { code: "invalid" };
  }
  // ... sign and call as before
}
```

## Info

### IN-01: Неявная зависимость от pgcrypto в схеме `extensions`

**Файл:** `supabase/migrations/20261109000000_portia_access_foundation.sql:224-230`
**Проблема:** Функция вызывает `extensions.hmac` и `extensions.digest`, но миграция не объявляет зависимость (`create extension ... with schema extensions`), а отпечаток (`portia.fingerprint.json:2421-2423`) проверяет только `present`, без схемы. PL/pgSQL связывает имена поздно: если на проекте pgcrypto нет или он стоит в другой схеме, миграция применится без ошибок, и каждый `submit` после проверки формата будет падать с ошибкой «function extensions.hmac does not exist». Это fail closed, но выглядит как поломка, а не как `unauthorized`. На Supabase pgcrypto по умолчанию лежит в `extensions`, поэтому риск низкий.
**Исправление:** Файл заморожен, поэтому добавить в «Проверки после применения (владелец)» в `21-MIGRATION-APPLY.md` запрос `select extnamespace::regnamespace from pg_extension where extname = 'pgcrypto';` (ожидается `extensions`). По желанию можно закрепить схему расширения в отпечатке.

### IN-02: Impossible-state guard: проверки `level-above-own` никогда не срабатывают

**Файлы:** `supabase/migrations/20261109000000_portia_access_foundation.sql:52-60`, `:452-453`, `:512-513`
**Category:** necessity
**Проблема:** `portia_access_caller_level()` возвращает либо `5`, либо `null`, а `null` отвергается `forbidden` (`:406`, `:500`). До сравнения с `caller_level` уровень уже ограничен диапазоном 1..5 (`:452`, `:512`). Значит, `new_level > caller_level` и `p_level > caller_level` при текущей модели ложны всегда, и тесты (`lib/access-decisions.test.ts:84-91`) закрепляют ветку, которая никогда не срабатывает. Это заметил и RLS-ревьюер («выше своего уровня фактически пусто»). Ветка осмысленна, только если у редакторов появятся уровни ниже 5, а это решение на будущее (USR-05), поэтому здесь Info.
**Исправление:** Ничего не удалять без решения владельца. Записать в шапке `lib/access-levels.ts`, что USR-05 «не выше своего уровня» сейчас вырожден (все решающие имеют уровень 5) и оживёт только с уровнями редакторов.

### IN-03: Указатели `source` в матрице проверяются слабо: 204 номера строк, а имя объекта не сверяется

**Файлы:** `lib/phase16-expected-authz.test.ts:249-265`, `tests/e2e/fixtures/data/expected-authz.json` (204 ссылки `20261109000000_portia_access_foundation.sql:N`)
**Проблема:** Для `42501` проверяется только то, что строка содержит `grant` или `revoke`. Для `allow` проверяется лишь, что строка не пустая и не комментарий. Указатель на чужой `grant` (например, у ячейки `resolve` строка `:293` от `submit`) пройдёт. Сейчас все проверенные указатели верны, а файл заморожен хешем, так что сдвигов не будет. Слабость в другом: тест подтверждает формат указателя, а не его смысл. Сами исходы `42501` независимо проверяются воспроизведением грантов (`:282-294`).
**Исправление:** В проверке ячейки функции требовать, чтобы строка-источник содержала `public.${fn.name}(`, а для таблиц `public.${table.name}`:
```ts
if (cell.outcome === "42501" || cell.outcome === "allow") assert.ok(text.includes(`public.${objectName}`), `${label}: source line names another object`);
```

### IN-04: Часть тестов читает SQL с комментариями, в отличие от остальных файлов

**Файлы:** `lib/access-foundation.test.ts:36`, `:332-345`; `lib/access-levels.test.ts:20`, `:64-66`; `lib/access-rls-round2.test.ts:11`, `:36-45`
**Проблема:** `access-closure`, `access-decisions` и `access-requests` вырезают `--` комментарии («so a rule mentioned only in a header comment cannot satisfy a contract»). Эти три файла этого не делают, и их проверки `sql.includes("alter table ... enable row level security;")`, `sql.includes("revoke all on sequence ...")` и подобные выполнились бы и на закомментированной строке. Пока файл заморожен хешем, вреда нет, но правила внутри набора тестов расходятся.
**Исправление:** Вынести общий загрузчик (см. IN-05), который отдаёт `raw` и `code` (без комментариев), и в проверках наличия операторов использовать `code`.

### IN-05: Копии вспомогательных функций в пяти тестовых файлах с разной семантикой

**Файлы:** `lib/access-foundation.test.ts:39-60`, `:175-184`; `lib/access-requests.test.ts:27-48`, `:159-168`; `lib/access-decisions.test.ts:19-40`, `:196-205`; `lib/access-closure.test.ts:25-40`, `:151-160`; `lib/access-levels.test.ts:22-27`
**Проблема:** `functionParts`, `parameterNames`, `grantedRoles` и `stubClient` скопированы по файлам, и копии уже разошлись: одни работают на тексте с комментариями, другие без них (IN-04), а `access-levels` пропускает проверку границ тела.
**Исправление:** Вынести их в `lib/test-support/access-sql.ts` (имя без `.test.ts`, чтобы `npm test` не запускал его как тест) и импортировать.

### IN-06: Мёртвая замена в тесте политики очистки

**Файл:** `lib/access-requests.test.ts:153`
**Проблема:** `sql.replace(/portia_access_fingerprint/g, "")` ничего не делает: такой подстроки в миграции нет. Строка намекает на исключение, которого не существует.
**Исправление:** `assert.ok(!/cron\.schedule/i.test(sql), "no new scheduled job in Phase 21");`

### IN-07: `AccessStoreError` теряет SQLSTATE

**Файл:** `lib/access-store.ts:25-32`, `:76-81`
**Проблема:** В `code` записывается `error.message`, а `error.code` (`P0001`, `42501`, `23505`) отбрасывается. Бизнес-отказ `forbidden` (P0001), отсутствие гранта («permission denied for function …», 42501) и гонка уникального индекса из `decide` («duplicate key value violates unique constraint …», 23505) приходят как строки произвольного текста в поле с именем `code`. Маршруту Фазы 23 будет трудно отличить ожидаемый отказ от поломки.
**Исправление:** Хранить оба значения: `constructor(code: string, readonly sqlState?: string)` и `throw new AccessStoreError(error.message, error.code)`.

### IN-08: Мелочи в `access-session.ts`: `.slice(0, 64)` ничего не делает, и хелперы cookie продублированы

**Файл:** `lib/access-session.ts:27`, `:78-91`
**Проблема:** HMAC-SHA256 в hex всегда длиной 64 символа, поэтому `.slice(0, 64)` ничего не меняет. `buildAccessCookie` и `readAccessToken` построчно повторяют `buildDeviceCookie` и `readDeviceToken` (`lib/portia-device-binding.ts:28-41`) с другим именем cookie.
**Исправление:** Убрать `.slice(0, 64)`. Общие `buildCookie(name, token)` и `readCookieToken(headers, name, pattern)` можно вынести, когда это разрешит D-10 (Promotion не трогать), иначе оставить как есть с комментарием.

### IN-09: Хрупкие проверки точного текста и точных количеств

**Файлы:** `lib/access-ip-bucket.test.ts:92`, `lib/security-matrix.test.ts:407`
**Проблема:** `access-ip-bucket.test.ts:92` сверяет точную строку исходника другого модуля (`if (value.includes(":")) return ...`), и переформатирование `portia-device-binding.ts` уронит тест без изменения поведения. Поведение Promotion уже закреплено строками `:89-90`. `security-matrix.test.ts:407` требует ровно `16` находок, и новая находка в ревью уронит тест, хотя её статус может быть допустимым.
**Исправление:** В `access-ip-bucket.test.ts` удалить проверку текста исходника и оставить проверки результатов. В `security-matrix.test.ts` проверять `findings.length >= 16` и то, что все ID из `21-RLS-REVIEW.md` есть в матрице, вместо точного числа.

---

_Проверено: 2026-11-09T12:00:00Z_
_Ревьюер: Claude (gsd-code-reviewer)_
_Глубина: standard_
