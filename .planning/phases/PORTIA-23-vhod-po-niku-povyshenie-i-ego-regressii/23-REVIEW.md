---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
reviewed: 2026-11-14T00:00:00Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - app/api/access/editor-request/route.ts
  - app/api/access/request/route.ts
  - app/api/access/status/route.ts
  - app/api/promotion/requests/route.ts
  - app/api/promotion/status/route.ts
  - app/api/promotion/test/route.ts
  - app/page.tsx
  - app/portia.css
  - components/portia-access-gate.tsx
  - components/portia-promotion-ordinary-editor.tsx
  - components/portia-promotion-qualification-editor.tsx
  - components/portia-promotion.tsx
  - components/portia-template-builder.tsx
  - lib/access-editor-request.test.ts
  - lib/access-foundation.test.ts
  - lib/access-gate-view.ts
  - lib/access-gate.test.ts
  - lib/access-gate.ts
  - lib/access-identity.test.ts
  - lib/access-identity.ts
  - lib/access-store.ts
  - lib/phase16-expected-authz.test.ts
  - lib/phase20-hints-inventory.test.ts
  - lib/phase23-evidence.test.ts
  - lib/portia-canonical-parity.test.ts
  - lib/portia-promotion-api.test.ts
  - lib/portia-promotion-api.ts
  - lib/portia-promotion-editor.test.ts
  - lib/portia-promotion-security.test.ts
  - lib/portia-promotion-ui.test.ts
  - lib/portia-qualification.test.ts
  - lib/portia-sql.test.ts
  - lib/portia-template-dossier.test.ts
  - lib/portia-template-dossier.ts
  - lib/portia-template-export.ts
  - lib/promotion-participant.ts
  - lib/request-json.test.ts
  - lib/request-json.ts
  - lib/security-matrix.test.ts
  - lib/style-tokens.test.ts
  - scripts/phase23-sync-evidence.mjs
  - supabase/fingerprint/expected/portia.fingerprint.json
  - supabase/fingerprint/portia_schema_fingerprint.sql
  - supabase/migrations/20261113000000_portia_access_promotion.sql
  - tests/e2e/fixtures/data/expected-authz.json
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 23: Отчёт о код-ревью

**Проверено:** 2026-11-14
**Глубина:** standard
**Файлов:** 45
**Статус:** issues_found

## Summary

Проверены ворота доступа (`lib/access-gate.ts`, `lib/access-gate-view.ts`, `components/portia-access-gate.tsx`), путь идентификации и RPC повышения (`lib/promotion-participant.ts`, `lib/access-identity.ts`, `lib/portia-promotion-api.ts`, три маршрута `app/api/promotion/*`, миграция `20261113000000_portia_access_promotion.sql`), а также побочные правки (шаблон досье, CSS, evidence-скрипт).

Итог по плану 23-08: порядок «редактор раньше флага закрытия» реализован корректно. Редактор решается до чтения RPC закрытия, а ошибки RPC закрытия не блокируют подтверждённого редактора. Откат в `open` срабатывает только для `PGRST202`/`42883` при совпадении имени функции с границами идентификатора. Все остальные ошибки (`PGRST002`, `42501`, таймауты, сетевые, неверный тип ответа) остаются fail-closed. Это подтверждено тестами. Критических дефектов (обход авторизации, инъекции, утечка секретов) не найдено. В SQL-слое подпись HMAC сравнивается через `digest`, внутренние функции отозваны у `anon/authenticated`, идентичность участника привязана к `requested_by`/`auth.uid()` и не принимает ник.

Остаются предупреждения по надёжности и согласованности поведения; главное из них — `test/route.ts` без `try/catch`, в отличие от соседних маршрутов.

Оценка необходимости (necessity, #4100) не выполнялась: справочник `necessity-review.md` не загружался, поэтому ключ `necessity:` опущен.

## Warnings

### WR-01: `app/api/promotion/test/route.ts` — GET и POST без `try/catch`, любое исключение превращается в пустой 500

**File:** `app/api/promotion/test/route.ts:49-118`
**Issue:** `status/route.ts` и `requests/route.ts` оборачивают тело в `try/catch` и отдают 503 с `no-store`. В `test/route.ts` обёртки нет. Исключения возможны в трёх местах:
- `resolvePromotionParticipant` бросает `AccessStoreError`, когда `resolveAccess`/`resolveEditorRequest` получают ошибку RPC или «unexpected-reply»;
- `accessSubmitSecret()` и `promotionDeviceSecret()` бросают при отсутствии секрета (`proof()` вызывается на каждом действии);
- `loadPromotionRoster()` или `rpc` могут отклонить промис.

В этом случае Next.js вернёт 500 без JSON и без `Cache-Control: no-store`. Клиент `QualificationRunner` ожидает коды `test-unavailable` и `heartbeat-failed`, поэтому поведение на сбое отличается от остальных маршрутов, а текст ошибки может попасть в логи сервера без маскировки.
**Fix:** вынести тела в `handleGet`/`handlePost` и обернуть так же, как в `status/route.ts`:
```ts
export async function GET(request: Request) {
  try { return await handleGet(request); }
  catch (error) {
    console.error("PORTIA promotion test failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Проверка временно недоступна.", code: "test-unavailable" }, { status: 503, headers: noStoreHeaders });
  }
}
```
То же для `POST`.

### WR-02: откат в `open` по `PGRST202` — fail-open при устаревшем кэше схемы PostgREST

**File:** `lib/access-gate.ts:23-29, 58-65`
**Issue:** Решение владельца от 2026-11-14 (D-01) осознанно открывает сайт, если функция закрытия «отсутствует». Но `PGRST202` возвращается не только когда функции нет в базе. Он же приходит при устаревшем кэше схемы после применения миграции и до `NOTIFY pgrst, 'reload schema'`, при частично применённой или откатившейся миграции и при переименовании функции. Если владелец уже включил закрытие в рабочей базе, в таком окне сайт откроется для всех. При этом предупреждение пишется один раз на процесс (`onceWarn`). На Netlify это один раз на холодный старт функции, а повторные срабатывания не видны. Тест `failClosedReplies` фиксирует корректное различение разных ошибок, но не различает «функции нет совсем» и «кэш устарел».
**Fix:** оставить решение владельца, но уменьшить риск. Варианты:
- логировать каждое срабатывание откат-ветки с ограничением частоты (например, раз в минуту), а не раз на процесс;
- подтверждать отсутствие второй пробой (например, `portia_access_resolve` с нулевым хэшем), и открывать сайт только если отсутствуют обе функции;
- зафиксировать в runbook, что после применения миграций обязателен `reload schema`.

### WR-03: форма заявки показывает пользователю сырой текст исключения разбора JSON

**File:** `components/portia-access-gate.tsx:70, 81-82`
**Issue:** `await response.json()` вызывается до проверки `response.ok`. Если сервер вернул не JSON (502/504 от Netlify, HTML-страница ошибки), `response.json()` бросает `SyntaxError`, и `catch` выводит `error.message` дословно: «Unexpected token '<', "<!DOCTYPE "... is not valid JSON». Это английский технический текст внутри русского интерфейса, а `formError` отображается с `role="alert"`.
**Fix:** различать собственные ошибки и системные:
```ts
const result = await response.json().catch(() => ({})) as { code?: string; error?: string };
// ...
} catch (error) {
  setFormError(error instanceof FormMessage ? error.message : "Не удалось отправить заявку. Проверьте соединение и повторите.");
}
```
где `FormMessage` — небольшой подкласс `Error` для заранее известных сообщений.

### WR-04: подтверждённому редактору в воротах показывается гостевая форма заявки

**File:** `lib/access-gate-view.ts:17-24`, `lib/access-gate.ts:54-57`, `components/portia-access-gate.tsx:107`
**Issue:** Ветка «редактор первым» возвращает `state: { state: "none" }`, а `accessGateLayout` вычисляет `showForm` только из `state`, игнорируя `editor`. Поэтому редактор с открытой карточкой (`cardOpen` по умолчанию `true`) видит форму «ОТПРАВИТЬ ЗАЯВКУ». Форма отправляет на `/api/access/request`, где используется анонимный `createPublicSupabaseClient()`. Заявка получается гостевой (`requested_by IS NULL`) и обходит `editor-request`, который специально привязывает заявку к аккаунту (комментарий в миграции про «cannot be adopted»). Правильный путь для редактора — `/api/access/editor-request` в Promotion.
**Fix:** передавать признак `editor` в раскладку и не показывать гостевую форму:
```ts
const showForm = !(decision?.mode === "closed" && decision.editor)
  && (state === "none" || state === "rejected" || state === "revoked");
```
Добавить тест в `accessGateLayout` для `editor: true`.

### WR-05: `editor-request` молча подменяет гостевой cookie устройства

**File:** `app/api/access/editor-request/route.ts:44-52`, `lib/access-identity.ts:12-14`
**Issue:** `editorRequestToken` переиспользует существующий токен только если `ownStatus.state !== "none"`, где `ownStatus` — статус заявки именно этого редактора. Если в браузере уже лежит гостевой токен (например, с одобренной гостевой заявкой), `ownStatus` будет `none`, будет создан новый токен, а при `created/pending/approved` гостевой cookie перезапишется. Побочные эффекты:
- прежний гостевой доступ этого устройства теряется;
- после выхода из аккаунта новый токен разрешается через `portia_access_resolve`, который не фильтрует по `requested_by`, так что устройство остаётся «одобренным гостем» по заявке, созданной редактором.
**Fix:** хранить токен редактора в отдельном cookie (например, `portia_access_editor`) и читать его только в `editor-request` и `resolvePromotionParticipant` для `editor === true`; либо явно задокументировать и покрыть тестом, что подмена допустима.

### WR-06: `portia-promotion.tsx` — залипание «Проверяем доступ…» и сентинел в `checkedNickname`

**File:** `components/portia-promotion.tsx:327, 382-385`
**Issue:** `loading` начинается с `true` и сбрасывается только в `finally` у `loadStatus`. Начальная загрузка запускается эффектом, который выходит при `document.visibilityState !== "visible"` и не перезапускается при смене видимости (в зависимостях нет состояния видимости). Если окно Promotion стало видимым, когда вкладка скрыта, пользователь видит «Проверяем доступ к повышению…» без кнопки повтора, пока не изменится `visible`. Кроме того, переменная `checkedNickname` теперь содержит магическую строку `"checked"`, и она по-прежнему называется «ник» (параметр `_value` в `loadStatus` не используется). Это скрытая связь между эффектом загрузки и эффектом опроса (строка 389), которую легко сломать.
**Fix:** заменить на явное `const [started, setStarted] = useState(false)`, убрать неиспользуемый параметр `_value`, а в начальном эффекте подписаться на `visibilitychange`, чтобы загрузка стартовала, когда вкладка станет видимой.

## Info

### IN-01: `device-busy`, `unauthorized`, `unavailable` отдаются как HTTP 503

**File:** `app/api/access/request/route.ts:31-32`, `app/api/access/editor-request/route.ts:53-54`
**Issue:** В цепочке `? 200 : invalid ? 400 : throttled ? 429 : cooldown ? 409 : 503` код `device-busy` (состояние клиента: «ник связан с другой записью») попадает в ветку 503 вместе с настоящими сбоями. Клиент различает по `code`, поэтому функционально работает, но мониторинг и ретраи Netlify видят ложные «недоступно». Дублирование цепочки в двух файлах повышает риск расхождения.
**Fix:** вынести `accessSubmitHttpStatus(code)` в `lib/access-store.ts` и вернуть 409 для `device-busy`.

### IN-02: форма заявки редактора теряет причину отказа при `cooldown`/`throttled`

**File:** `components/portia-promotion.tsx:422-425`
**Issue:** Ответы `submitAccessRequest` для `cooldown` и `throttled` содержат только `code` (и `retryAt`), без поля `error`. `publicError(body, …)` берёт `error`, поэтому редактор получает общее «Заявку не удалось отправить», тогда как в `PortiaAccessGate` для тех же кодов есть словарь сообщений. Кроме того, поле ника ограничено `maxLength={20}`, а в проверке на сервере используется `parseNicknameInput`; значения согласованы, но не вынесены в общую константу.
**Fix:** переиспользовать словарь сообщений из ворот (вынести в `lib/access-gate-view.ts`) и общую константу длины ника.

### IN-03: `import` в середине и в конце файла

**File:** `lib/portia-promotion-api.ts:358`, `lib/portia-template-export.ts:33`
**Issue:** В `portia-promotion-api.ts` `import type { SupabaseClient }` стоит в самом конце файла (после использования). В `portia-template-export.ts` новый `import type` вставлен между JSDoc-комментарием и типом `TemplateImage`, поэтому документирующий комментарий «A validated local image…» теперь относится к импорту. Код работает (импорты поднимаются), но это ломает чтение и инструменты документации.
**Fix:** перенести оба импорта в верхний блок импортов.

### IN-04: `AccessStoreError.code` хранит сообщение, а `sqlState` — код PostgREST

**File:** `lib/access-store.ts:31-40, 86`, `lib/access-gate.ts:24-29, 63`
**Issue:** Конструктор вызывается как `new AccessStoreError(error.message, error.code)`, поэтому поле `code` содержит сообщение, а `sqlState` — настоящий код (включая `PGRST202`, который не является SQLSTATE). Решение `isMissingClosureFunction` держится на этой инверсии и поясняется только комментарием. В `resolveGate` добавлено лишнее приведение `(error as AccessStoreError).sqlState`: после `isMissingClosureFunction` тип не сужается, потому что функция не объявлена как type guard.
**Fix:** объявить `isMissingClosureFunction(error): error is AccessStoreError`; переименовать поля в `message`/`rpcCode`, когда это не заденет остальные модули.

### IN-05: дублирующее CSS-правило и переименованный «пин» хэша

**File:** `app/portia.css:22-23`, `lib/style-tokens.test.ts:20-24`
**Issue:** Строки `html:is([data-motion="reduced"], [data-motion="off"]) .access-dots` и `html[data-motion=off] .access-dots` задают одинаковые свойства, вторая избыточна. В `style-tokens.test.ts` константа `PRE_PHASE_PORTIA_CSS_SHA256` теперь содержит хэш текущего файла (комментарий: «keep the current unmarked stylesheet pinned»), а название по-прежнему говорит «до фазы». Тест перестал отражать состояние до фазы и фиксирует любую текущую правку, а имя вводит в заблуждение.
**Fix:** удалить второе правило; переименовать константу в `PORTIA_CSS_SHA256` и обновить комментарий.

---

_Проверено: 2026-11-14_
_Ревьюер: Claude (gsd-code-reviewer)_
_Глубина: standard_
