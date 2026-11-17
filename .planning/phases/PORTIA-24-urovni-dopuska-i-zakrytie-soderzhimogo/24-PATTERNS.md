# Phase 24: Уровни допуска и закрытие содержимого - Pattern Map

**Mapped:** 2026-11-15
**Files analyzed:** 19 (новых и изменяемых)
**Analogs found:** 17 / 19 (2 без прямого аналога)

Все пути ниже проверены как отслеживаемые исходники (не зеркала `.gsd/capabilities`). Файлы владельца не затрагивались. `.env*` не читались, supabase CLI не запускался.

## File Classification

| Файл (новый / изменяемый) | Role | Data Flow | Ближайший аналог | Качество |
|---------------------------|------|-----------|------------------|----------|
| `lib/access-redact.ts` (НОВЫЙ, чистая `redactContentForLevel`) | utility | transform | `lib/access-gate.ts` (чистая логика + DI) и `lib/portia-content-normalize.ts` (пересборка поле за полем) | role-match |
| `lib/access-redact.test.ts` (НОВЫЙ, тесты-приманки 1–5) | test | transform | `lib/access-closure.test.ts`, `lib/portia-content-normalize.test.ts` | role-match |
| `lib/access-hierarchy.ts` (НОВЫЙ, нормализация «ребёнок не ниже родителя») | utility | transform | `lib/access-levels.ts` (`isAccessLevel`) | role-match |
| `lib/access-hierarchy.test.ts` (НОВЫЙ) | test | transform | `lib/access-levels.test.ts` | exact |
| `lib/access-copy.ts` (НОВЫЙ, тексты заглушки) | config | n/a | `lib/users-copy.ts` (названо в UI-SPEC A-2) | exact |
| `lib/portia-content.ts` (ИЗМ.: `level?`, узел заглушки, `viewer`) | model | CRUD | сам файл (`ScientistLog`, `InfoSection`, `GuideSection`) | exact |
| `lib/portia-content-normalize.ts` (ИЗМ.: `level`, `lockedLevel` по умолчанию 1) | utility | transform | сам файл, строки 336-349 | exact |
| `app/api/content/route.ts` (ИЗМ.: GET per-viewer, PUT нормализация и отказ) | controller | request-response | сам файл + `app/api/access/status/route.ts` | exact |
| `lib/content-sync.ts` (ИЗМ.: принимать смену уровня при той же ревизии) | utility | request-response | сам файл + `lib/content-sync.test.ts` | exact |
| `lib/device-cache.ts` (ИЗМ.: метка уровня, очистка при отзыве) | utility | file-I/O (localStorage) | сам файл | exact |
| `components/portia-access-redacted.tsx` (НОВЫЙ, заглушка 4 формы) | component | request-response | `components/portia-desktop-states.tsx` (`AppDeniedPanel`) и `.empty-state` | role-match |
| `components/portia-level-picker.tsx` (НОВЫЙ, 5 плашек) | component | CRUD | `Field` из `components/portia-editor-dossier.tsx:258` (нативные поля редактора) | partial |
| `components/portia-desktop.tsx` (ИЗМ.: `embeddedApps`, `contentSyncMs`, список, поиск, корзина) | component | request-response | сам файл | exact |
| `components/portia-desktop-dossier.tsx` (ИЗМ.: `roman`, `isOpen`, `RedactedDocument`) | component | request-response | сам файл | exact |
| `components/portia-editor.tsx` (ИЗМ.: 428-429, 1288, 1292) | component | CRUD | сам файл | exact |
| `components/portia-editor-dossier.tsx` (ИЗМ.: 258, 261) | component | CRUD | сам файл | exact |
| `app/portia.css` (ИЗМ.: блок `access-levels` перед `users-tab`) | config | n/a | блок `users-tab` в том же файле | exact |
| `lib/style-tokens.test.ts` (ИЗМ.: `stripMarkedBlocks`) | test | transform | сам файл, строки 64-74, 156-172 | exact |
| `supabase/migrations/2026111x…_portia_….sql` (НОВЫЙ, только если нужен) | migration | batch | `20261114000000_portia_access_closure_default_on.sql` | exact |
| `PROJECT.md`, релизные заметки (SEC-07, D-11 расширен) | config | n/a | нет (см. No Analog Found) | none |

## Pattern Assignments

### `lib/access-redact.ts` (utility, transform) — серверная очистка

**Analog:** `lib/access-gate.ts` (чистая логика, зависимости через параметры, `.ts`-расширения в импортах для `node --experimental-strip-types`).

**Импорты** (access-gate.ts:1-3): относительные пути с расширением `.ts`, потому что файл должен запускаться из `lib/*.test.ts`:
```typescript
import { EDITOR_ACCESS_LEVEL, type AccessLevel } from "./access-levels.ts";
```
Файл НЕ должен импортировать `@/…` алиасы (тесты `node --test` их не разрешают). Исключение в проекте — `app/` и `components/`.

**Чтение уровня (D-03, fail closed):** в `access-levels.ts:15-17` есть `isAccessLevel`; нужна парная функция «нет поля = 1, мусор = 5»:
```typescript
export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_ACCESS_LEVEL && value <= MAX_ACCESS_LEVEL;
}
```
Новое: `requiredLevelOf(raw: unknown): AccessLevel` — `undefined` -> 1, `isAccessLevel` -> значение, иначе `MAX_ACCESS_LEVEL`. Добавлять рядом с `isAccessLevel` в `lib/access-levels.ts` (единственный источник шкалы, комментарий в шапке: «no other file may hard-code them»).

**Список префиксов `formattedText` (D-04).** Ключи строятся в `lib/portia-content.ts:247-260` (`portiaTextKey`). Для разрешённого списка использовать эти же префиксы, неизвестные — отбрасывать:
```typescript
virus: `virus:${virusId}:${field}`            // virus:<id>:external|physiology|ppu-*|mutation:<i>:description
info: `info:${sectionId}:body`
infoBlock: `info-block:${blockId}:text`
guideBlock: `guide-block:${blockId}:text`
broadcast / recycle: `broadcast:<id>:body`, `recycle:<fileId>:content`
```
Ключ закрытого вируса: `virus:<id>:*` (включая записи учёных, если для них есть ключи) нужно удалять; ключи `info:<sectionId>:` и `info-block:<blockId>:` удалять по id закрытого раздела/подраздела; `guide-block:<blockId>:` — по блокам закрытого раздела/карточки; `recycle:<fileId>:content` — по закрытым файлам корзины. Ключи видны `editor-items.ts:25` (`key.startsWith(\`virus:${id}:\`)`) и `editor-changes.ts:39` (разбор префиксов `"info:"`, `"virus:"`) — это готовые образцы разбора префикса.

**Ядро (ориентир):** `.planning/research/ARCHITECTURE.md` §3.4, но с поправкой на заглушку (D-08..D-12): закрытая запись заменяется узлом `{ redacted: true, requiredLevel, slot }` на той же позиции; `ScientistLog` закрытой записи сохраняет `id` (для открытия документа), `title`, `scientist`, `lockedLevel`, а `content`/`richContent` и ключи `formattedText` не отдаются (D-12). Закрытый вирус: настоящие `id`, `code`, `name`, картинки, `formattedText virus:<id>:*`, `mutations`, `recycleOrder` ключ `virus:<id>`, `recycleFiles` с `virusId` — не отдаются.

**Утечки, которые тесты-приманки обязаны ловить** (источник — `.planning/research/PITFALLS.md`): `recycleOrder` (ключи `virus:<id>`), `recycleFiles[].virusId` и `content`, `recycledViruses`, `broadcastSections`/`searchRecommendationSections`/`searchRecommendations` (плоский список рекомендаций может содержать названия закрытых вирусов), `ScientistLog.richContent`, длина слов в `RedactedDocument` (см. ниже).

**Fail closed:** любой неизвестный верхний ключ контента не попадает в ответ посетителю, если очистка его не знает. Для редакторов (уровень 5) — функция возвращает контент без изменений (`EDITOR_ACCESS_LEVEL`, D-05).

---

### `lib/access-redact.test.ts` (test, transform) — тесты-приманки

**Analog:** `lib/access-closure.test.ts` (структура, текстовые проверки) и `lib/access-levels.test.ts` (структура `node:test`).

**Шапка и соглашения** (access-closure.test.ts:1-23, access-levels.test.ts:1-3):
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Offline contract tests ... No database is available here: ... Postgres/RLS behaviour stays BLOCKED
```
Правило проекта: комментарий в шапке честно называет, что не доказано (Postgres/RLS, живые роли — BLOCKED).

**Приманки:** строка-канарейка для каждого уровня 1–5 (`CANARY_L3_…`), контент строится вокруг неё, на каждый уровень посетителя 1–5 проверяется `JSON.stringify(redacted)` — канарейки уровня выше уровня посетителя в ответе отсутствуют, включая значения `formattedText` и ключи (проверять и ключи: `Object.keys(formattedText)`). Для записей учёных (D-12): название и имя учёного допускаются, текст — нет. Паттерн проверки по тексту: `assert.ok(!JSON.stringify(x).includes(canary))`.

**Тест исходников (A-3):** паттерн чтения файла как текста, комментарии вырезаются, чтобы упоминание в комментарии не удовлетворило контракт (access-closure.test.ts:22-23):
```typescript
const raw = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const sql = raw.replace(/--[^\n]*/g, "");
```
Для TSX: `replace(/\/\/[^\n]*/g, "")`; проверить отсутствие `roman(`, `onClick`/`tabIndex`/`href` в компоненте заглушки, точную строку `ЗАСЕКРЕЧЕНО · нужен допуск`.

---

### `lib/access-hierarchy.ts` и `.test.ts` (utility/test, transform)

**Analog:** `lib/access-levels.ts` (+ `.test.ts`, тот же стиль «таблица значений -> assert.deepEqual»).

Чистые функции: `effectiveLevel(own, parent) = max(requiredLevelOf(own), parent)` и `raiseChildren(content)` — возвращает контент и число изменённых (`k` для «Уровень подразделов поднят до N: изменено k.»). Используется и клиентом редактора (черновик), и PUT на сервере (D-17), чтобы правило было одно. Структуру теста брать из `access-levels.test.ts:29-47` (`for (const level of [...]) assert.equal(...)`).

---

### `app/api/content/route.ts` (controller, request-response)

**Analog:** сам файл + `app/api/access/status/route.ts` (определение посетителя).

**Текущий GET** (route.ts:16-35) отдаёт публичный кэш — именно это меняется:
```typescript
export async function GET() {
  const { data: row, error } = await createPublicSupabaseClient()
    .from("portia_content").select("payload, revision, updated_at").eq("id", "main").maybeSingle<ContentRow>();
  if (error) { console.error("PORTIA content read failed", error);
    return Response.json({ error: "База временно недоступна." }, { status: 503, headers: noStoreHeaders }); }
  return Response.json({ content: ..., revision: ..., updatedAt: ... }, { headers: publicCacheHeaders(contentCacheTag, 300) });
}
```
Новое: `GET(request: Request)`; уровень берётся через `resolveGate(request.headers, {...})` ровно как в `status/route.ts:10-23`:
```typescript
const client = await createServerSupabaseClient();
const decision = await resolveGate(request.headers, {
  client, sessionSecret: accessSessionSecret(),
  editorAccess: async () => {
    const { data, error } = await client.auth.getUser();
    if (isAuthRetryableFetchError(error)) return { canEdit: false, unavailable: true };
    const access = await getEditorAccess(client, data.user);
    return { canEdit: access.canEdit, unavailable: access.unavailable };
  },
});
```
`GateDecision` (access-gate.ts:5-7): `mode: "open"` — закрытие выключено, уровень не определён; `mode: "closed"` с `allowed`, `level`, `editor`. Решение для открытого режима (A-6, 21/23): очистку делать по уровню, который вернул gate; `open` без токена — самый низкий уровень (1) или поведение Phase 21, это планировщик фиксирует явно и тестом. Ответ посетителю: `noStoreHeaders` (`portia-cdn.ts:15-18`), НЕ `publicCacheHeaders` (ARCHITECTURE D2/D3, §3.3: CDN нельзя варьировать по уровню). Ответ добавляет `viewer: { level }` (UI-SPEC §8).

**Ошибки:** сбой gate -> 503 `{ error: "Проверка доступа временно недоступна." }` с `noStoreHeaders` (status/route.ts:24-27); отозванный/без доступа -> не отдавать контент вовсе.

**PUT** (route.ts:37-92): уже содержит `normalizePortiaContent(body.content)`, проверку `canEdit`, CAS по ревизии (`.eq("revision", baseRevision)`), `purgeCacheTag(contentCacheTag)`. Добавить после `normalizePortiaContent`: (1) отказ 400/422 с текстом «Сохранение отклонено: в данных есть закрытые записи. Обновите страницу и повторите.», если в теле есть узлы заглушек (LVL-08); (2) `raiseChildren` (D-17) до записи; (3) если уровни были подняты — вернуть в ответе `levelsRaised: k` для «Уровни приведены к иерархии: изменено k.». Паттерн ответа с кодом: `Response.json({ error, code, sections }, { status })` (route.ts:69).

**Важно про `purgeCacheTag`:** после перехода GET на `no-store` CDN больше не хранит ответ; `purgeCacheTag` остаётся безвредным, но комментарий над GET («Identical for every visitor, so the CDN serves it») надо заменить.

---

### `lib/portia-content.ts` и `lib/portia-content-normalize.ts` (model, transform)

**Analog:** `lib/portia-content-normalize.ts:336-349` (поле за полем, новые поля иначе теряются):
```typescript
return {
  ...withoutNote(log),
  id: textOf(log.id), title: textOf(log.title), scientist: textOf(log.scientist),
  lockedLevel: typeof log.lockedLevel === "number" && Number.isFinite(log.lockedLevel) ? log.lockedLevel : 3,
  content: ..., richContent: normalizeRichText(log.richContent),
};
```
Изменения: `lockedLevel` -> по правилу D-13 (нет поля = 1, 2/3/4 читаются как есть, мусор = 5); добавить `level` во все нормализаторы: вирус (`normalizeVirus`, строка 311), раздел и подраздел «Информации», раздел и карточка «Справочника», приложение «Устав» (новое поле верхнего уровня, например `appLevels`; такого поля сегодня нет). Тип `level?: AccessLevel` добавляется в `Virus`, `InfoSection`, `InfoSubsection`, `GuideSection`, `GuideCard` (`portia-content.ts:98-174`); поле необязательное (старые сохранения читаются без миграции данных, D-03). Нормализация должна зажимать `level` в 1–5, а не терять.

Новые ограничения: тип узла заглушки не должен нормализоваться обратно в запись (`normalizePortiaContent` для PUT её отклоняет, см. route.ts).

---

### `lib/content-sync.ts` + `lib/device-cache.ts` (utility)

**Analog:** сами файлы. Текущее правило (content-sync.ts:2-4):
```typescript
export function acceptFetchedContent(revision: number, knownRevision: number, savesAtSend: number, savesNow: number): boolean {
  return savesAtSend === savesNow && revision > knownRevision;
}
```
Смена уровня при той же ревизии должна приниматься: добавить параметр (например `viewerKey`: `${level}` или идентичность) и условие `revision > knownRevision || viewerKey !== knownViewerKey`. Параметр с значением по умолчанию, чтобы существующие тесты `content-sync.test.ts` (5-25) остались зелёными; новые случаи добавлять тем же стилем: короткие `test(...)` с `assert.equal(acceptFetchedContent(...), bool)`.

`lib/device-cache.ts` (все 19 строк): сейчас метка — только источник Supabase (`stampCacheSource`, `cacheMatchesSource`). Добавить метку уровня/личности в штамп и очистку кэша `portia-content-last-success-v1` / `portia-employees-last-success-v1` при отзыве (D-21); тесты — по образцу `lib/device-cache.test.ts`. Не показывать кэш с уровнем выше текущего.

---

### `components/portia-desktop.tsx` (component, request-response)

**Analog:** сам файл.

- `embeddedApps` (строки 39-42): сегодня ссылки зашиты в JS. Для D-11 ссылка «Устава» уходит в серверный ответ и отдаётся только при достаточном уровне; `embeddedApps` остаётся для `sheet` (O-1). Использование — строка 1810 `<EmbeddedDocument src={embeddedApps[app].src} external={embeddedApps[app].external} .../>`: для закрытого «Устава» вместо этого рендерить `block`, iframe не монтировать.
- `contentSyncMs` (строка 48): `10_000` -> `30_000` для посетителя (D-23); для редакторов можно оставить 10 с — константа делится на две (`canEditRef.current`). Использование в строке 637: `window.setInterval(... if (document.visibilityState === "visible") { void fetchContent(); ... }, contentSyncMs)` и `onVisible` на строке 638 — немедленное обновление при возврате на вкладку уже есть. Комментарий строки 47 про «CDN-cached» устаревает.
- `fetchContent` (419-445): образец обработки ответа: `acceptFetchedContent` -> `normalizePortiaContent(payload.content)` -> `setContent` -> `localStorage.setItem(contentCacheStorageKey, JSON.stringify(stampCacheSource({...}, source)))`. Сюда добавляется чтение `payload.viewer.level` и сброс дедупликации при смене.
- `globalSearchApps`: отфильтровать «Устав» по уровню (UI-SPEC §2 «Поиск»). `lib/search-index.ts` и `search-recommendations.ts` — чистые функции над пришедшим содержимым, менять не надо (заглушка не индексируется, потому что у неё нет названия).
- Заглушки в списке вирусов, оглавлении «Информации», «Справочнике», «Корзине» (`.trash-file-row`, строки 1822 и 1825): рендер по типу узла, без фильтрации по уровню в React (D-04).
- Заголовок окна (1661) `meta="ДОПУСК II"` и загрузка (1911) `УРОВЕНЬ II` -> арабские цифры из `viewer.level`.

---

### `components/portia-desktop-dossier.tsx` (component, request-response)

**Analog:** сам файл. Что убрать: `roman` (строка 12), зашитое `<strong>II</strong>` (строка 15), `isOpen = log.lockedLevel <= 2` (строки 15 и 29), `Текущий уровень: II` (строка 31). Что оставить: структура строки `.scientist-log-row`, иконки `lock-open`/`lock-closed`, штамп «ДОПУСК ОТКЛОНЁН».

Блок «ЗАПИСИ УЧЁНЫХ» (`DossierSection index="06"`) оборачивать условием `virus.scientistLogs.length > 0`; пустой `scientist-log-empty` удаляется (D-14).

**Опасное место `RedactedDocument`** (строки 39-45): сегодня длина полос берётся из настоящего текста записи:
```typescript
const plainText = scientistDocument(log).runs.map((run) => run.text).join("");
...
? actualParagraphs.map((words) => words.map((word) => Math.max(2.4, ... Array.from(word).length * .72 + .8)))
: generatedRedaction(log.id);
```
Для закрытой записи сервер текст не отдаёт, но ветка `actualParagraphs` всё равно допускает утечку длин слов, если в данных вдруг есть текст. Требование UI-SPEC §3: для закрытого документа всегда `generatedRedaction(log.id)`, ветку по настоящему тексту удалить. Тест A-3: в `RedactedDocument` нет обращения к `scientistDocument(`/`content`.

Принадлежность «закрыта ли запись» определяется серверным признаком, не клиентским сравнением `lockedLevel <= уровень` как фильтром (допустимо только как подпись).

---

### `components/portia-editor.tsx` и `components/portia-editor-dossier.tsx` (component, CRUD)

**Analog:** сами файлы. Места правок:
- `portia-editor.tsx:428-429` — две заготовки «ЗАПИСЬ 01/02» с `lockedLevel: 3` и `4` удалить (`scientistLogs: []`).
- `portia-editor.tsx:1288` и `portia-editor-dossier.tsx:258` — `<Field label="Уровень доступа…"><select value={log.lockedLevel} ...>` с `<option value={2}>II — доступна</option>…` заменить на общий элемент выбора:
```tsx
<Field label="Уровень доступа записи"><select value={log.lockedLevel} onChange={(event) => updateVirus((virus) => { virus.scientistLogs[index].lockedLevel = Number(event.target.value); })}>…</select></Field>
```
Шаблон мутации черновика: `updateVirus((virus) => { virus.scientistLogs[index].lockedLevel = … })` (так же в dossier: `onChange((item) => { item.scientistLogs[index].lockedLevel = … })`).
- `portia-editor-dossier.tsx:261` — «+ ДОБАВИТЬ ЗАПИСЬ» создаёт `lockedLevel: 3` -> `1`; лимит `disabled={virus.scientistLogs.length >= MAX_SCIENTIST_LOGS}` сохранить.
- Конструктор шаблонов `TemplateDossier` (`lib/portia-template-dossier.ts`) уровень не показывает (UI-SPEC §5).

---

### `components/portia-level-picker.tsx` (component, CRUD)

**Analog (partial):** `Field`-обёртка из `portia-editor-dossier.tsx` для окружения; интерактивной «плашки-радио» в коде нет (см. No Analog Found). Опора на контракт UI-SPEC §5: `<fieldset>` + `<legend>` «Нужен допуск» + 5 нативных `input[type=radio]` с общим `name`, имена плашек «Допуск N», `disabled` и `title="не ниже раздела: N"` для уровней ниже родителя, `aria-describedby` на видимую строку «Не ниже раздела: N». Уровни брать из `ACCESS_LEVELS` (`lib/access-levels.ts:8`), метки не хардкодить.

---

### `app/portia.css` + `lib/style-tokens.test.ts`

**Analog:** блок `users-tab` и тест, который его закрепляет.

`lib/style-tokens.test.ts:64-74` сейчас:
```typescript
export function stripMarkedBlocks(css: string) {
  ...
  let skipping: "tokens" | "users" | null = null;
  for (const line of lines) {
    if (!skipping && line.includes("style-tokens:start")) skipping = "tokens";
    if (!skipping && line.startsWith("/* users-tab:start")) skipping = "users";
    if (!skipping) kept.push(line);
    if (skipping === "tokens" && line.includes("style-tokens:end")) skipping = null;
    if (skipping === "users" && line === "/* users-tab:end */") skipping = null;
  }
```
Добавить третий вид `"access"` с маркерами `/* access-levels:start` … `/* access-levels:end */` по тому же образцу. В тесте UI-01 (156-172) повторить проверку блока `users`:
```typescript
assert.doesNotMatch(usersBlock, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:|--muted\s*:/);
```
для блока `access-levels`. Условие: блок `access-levels` вставляется ПЕРЕД `/* users-tab:start` (тест 165-168 требует, чтобы `users-tab` был последним в файле: `^\/\* users-tab:start[\s\S]*\/\* users-tab:end \*\/\n?$`), без правки существующих строк (хэш `PRE_PHASE_PORTIA_CSS_SHA256` вычисляется по тексту без размеченных блоков). Менять `stripMarkedBlocks` и добавлять CSS в одном коммите.

---

### `supabase/migrations/` (migration, batch) — только если нужна

**Analog:** `20261114000000_portia_access_closure_default_on.sql` (последняя применённая цепочка; существуют также `…20261109000000_portia_access_foundation`, `…20261110000000_portia_users_tab`, `…20261112000000_portia_access_decision_mark`, `…20261113000000_portia_access_promotion`).

Наименование: `YYYYMMDDHHMMSS_portia_<snake_case>.sql`, номер больше `20261114000000`. Конвенции (из аналога):
- Шапка-комментарий: что и почему, `Forward-only; no begin/commit (the CLI owns the transaction); idempotent statements.`, строка «Not applied anywhere by the agent (D-72)».
- Функции: `create or replace function public.<name>() ... language sql stable security definer set search_path = '' as $$ … $$;`
- Права: `revoke all on function … from public, anon, authenticated;` затем `grant execute … to anon, authenticated;` и `to service_role;`
- В конце: `notify pgrst, 'reload schema';`
- Для новой RPC обязателен `supabase-rls-reviewer` (CLAUDE.md).

Рекомендация: уровни хранятся в JSON контента (D-03), поэтому миграция для основной работы фазы, скорее всего, не нужна; серверной очистки в SQL нет (D-04, TS). Тест на SQL-текст — шаблон `functionParts`/`grantedRoles` из `access-closure.test.ts:32-47` и `functionBody` из `access-levels.test.ts:22-27`.

---

## Shared Patterns

### Per-viewer ответ сервера
**Source:** `lib/portia-cdn.ts:15-18` (`noStoreHeaders`), `app/api/access/status/route.ts:10-28`
**Apply to:** `app/api/content/route.ts` GET (и любой новый маршрут с очищенным контентом)
```typescript
export const noStoreHeaders = {
  "Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
};
```
Все маршруты `app/api/*` используют `noStoreHeaders` на ответах с данными по личности (`users`, `editors`, `promotion/*`); только `employees` GET и `content` GET сейчас публичны.

### Единый источник шкалы уровней
**Source:** `lib/access-levels.ts:8-21`
**Apply to:** все новые файлы: `ACCESS_LEVELS`, `isAccessLevel`, `accessLevelLabel`, `EDITOR_ACCESS_LEVEL`; числа 1–5 не хардкодить ни в компонентах, ни в тестах (кроме явных таблиц значений).

### Определение посетителя
**Source:** `lib/access-gate.ts:52-85` (`resolveGate`)
**Apply to:** GET контента. Порядок: редактор -> уровень 5 до чтения флага; сбой проверки редактора никогда не даёт доступ; при `isMissingClosureFunction` — закрыто (fail-closed).

### Тесты `lib/*.test.ts`
**Source:** `lib/access-levels.test.ts`, `lib/access-closure.test.ts`, `lib/content-sync.test.ts`
**Apply to:** все новые тесты
- Запуск: `npm test` = `node --experimental-strip-types --test lib/*.test.ts` (плоско в `lib/`, вложенных папок нет).
- Импорты своих модулей с расширением: `from "./access-levels.ts"`; никаких `@/` алиасов в `lib/` (кроме файлов, которые запускаются только в Next).
- Импорт `node:test` и `node:assert/strict`; `readFileSync(new URL("../path", import.meta.url), "utf8").replace(/\r\n/g, "\n")` для проверок исходников (CRLF на Windows).
- Заголовки `test("LVL-0N / D-NN <что доказано>", ...)` — ссылка на требование/решение в названии.
- Живые роли, Postgres/RLS, staging в тестах — BLOCKED, а не PASS; шапка файла говорит об этом.

### Fail closed
**Source:** `lib/access-gate.ts:46-50, 61-69`, `lib/access-levels.ts:35-44`
**Apply to:** очистка и нормализация: неизвестное -> закрыто (уровень 5, ключ отброшен); исключение при проверке не является разрешением.

### Тексты интерфейса
**Source:** `lib/users-copy.ts` (названо в UI-SPEC A-2)
**Apply to:** `lib/access-copy.ts`: константы русских строк, включая точную `ЗАСЕКРЕЧЕНО · нужен допуск N` (U+00B7 с пробелами), используется и тестом, и компонентом.

## No Analog Found

| Файл | Role | Data Flow | Причина |
|------|------|-----------|---------|
| `components/portia-level-picker.tsx` (радио-плашки) | component | CRUD | В коде нет сегментированного выбора; брать контракт UI-SPEC §5 и `Field`-обёртки редактора |
| Серверная очистка контента (`redactContentForLevel`) | utility | transform | Сегодня сервер отдаёт контент без очистки; ориентир только `.planning/research/ARCHITECTURE.md` §3.4 (с поправкой D-08..D-12) |
| Запись SEC-07 / расширение D-11 в `.planning/PROJECT.md` (строка 139), релизные заметки | docs | n/a | Живой аналог — `lib/phase20-release-notes.test.ts` и сами release-notes фазы 20; сверить формат перед правкой |

## Открытые места для планировщика (не решены в CONTEXT/UI-SPEC)

1. Где хранится уровень приложения «Устав»: поле верхнего уровня контента (`appLevels`?) — аналога нет, нужна нормализация и PUT-проверка.
2. Ссылка «Устава» переезжает из `embeddedApps` в серверный ответ — иначе D-11 («URL не приходит») не выполняется.
3. Открытый режим (`GateDecision.mode === "open"`): какой уровень очищать — зафиксировать тестом.
4. `recycleOrder`, `recycleFiles`, `searchRecommendations` — утечки названий; включить в приманки.
5. `purgeCacheTag(contentCacheTag)` после перехода GET на `no-store` — оставить или убрать; комментарий над GET устареет.
6. «Просмотр как уровень N» (D-19): тот же `redactContentForLevel` делает его дешёвым, но UI-SPEC §7 по умолчанию переносит в Future Requirements.

## Metadata

**Analog search scope:** `lib/`, `app/api/`, `components/`, `supabase/migrations/`, `app/portia.css` (через тесты)
**Files scanned:** около 20 прочитано целиком или частично, ~120 найдено по Glob/Grep
**Pattern extraction date:** 2026-11-15
