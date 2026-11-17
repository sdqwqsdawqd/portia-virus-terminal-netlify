---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
reviewed: 2026-11-15T12:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - app/api/content/route.ts
  - app/portia.css
  - components/portia-access-gate.tsx
  - components/portia-desktop-documents.tsx
  - components/portia-desktop-dossier.tsx
  - components/portia-desktop.tsx
  - components/portia-editor-dossier.tsx
  - components/portia-editor.tsx
  - components/portia-level-picker.tsx
  - components/portia-redacted.tsx
  - lib/access-levels.ts
  - lib/access-viewer.ts
  - lib/content-response.ts
  - lib/content-save.ts
  - lib/content-sync.ts
  - lib/device-cache.ts
  - lib/editor-changes.ts
  - lib/embedded-documents.ts
  - lib/level-copy.ts
  - lib/level-hierarchy.ts
  - lib/level-placeholders.ts
  - lib/level-redact.ts
  - lib/portia-content-normalize.ts
  - lib/portia-content.ts
  - proxy.ts
  - tests/e2e/specs/access-levels.spec.ts
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
  necessity: 0
status: issues_found
---

# Phase 24: Отчёт о код-ревью

**Проверено:** 2026-11-15
**Глубина:** standard
**Файлов:** 26
**Статус:** issues_found

## Summary

Просмотрены все перечисленные файлы по `git diff d9114aa HEAD`. Дополнительно прочитаны `lib/access-gate.ts`, `app/api/access/status/route.ts`, `lib/portia-content-normalize.ts` (целиком вокруг рециклбина и вирусов), `lib/app-state.ts` (`appViewState`), `next.config.ts` (CSP `frame-src`). Локально выполнены `tsc --noEmit` (чисто) и `node --experimental-strip-types --test lib/*.test.ts` (2104 теста, 0 падений). `npm test` через npm не запустился (в Node во временной папке нет `node-gyp`), поэтому тесты гонялись напрямую через `node`.

Серверная часть (`lib/level-redact.ts`, `lib/content-response.ts`, `lib/content-save.ts`, `app/api/content/route.ts`) собрана аккуратно: массивы строятся по именам полей, `formattedText` идёт через allow-list, маркеры из хранилища не принимаются, PUT отказывает по ключу `redaction` и по `withheld`. Новых утечек закрытого содержимого поверх RLS24-01..09 я не нашёл и не повторяю их. Критических дефектов нет.

Найдено 3 предупреждения (одна реальная функциональная ошибка на телефонной раскладке «Информации», одна ошибка семантики/доступности в `LevelPicker`, один отказ «открыто по умолчанию» в показе уровня) и 7 замечаний по качеству. Необходимость (necessity) не оценивалась как отдельная категория: единственное обобщение (`LEVELED_APP_IDS` с одним элементом) прямо запланировано владельцем (O-1), его «упадок» из репозитория не доказывается.

## Warnings

### WR-01: На телефоне тело открытого раздела «Информации» недостижимо, если все его подразделы закрыты

**File:** `components/portia-desktop.tsx:1987-1994` (также `:1999`)
**Issue:** `hasSubsections` теперь считается по `subRows.length > 0`, то есть вместе с заглушками закрытых подразделов:

```tsx
const subRows = mergePlaceholders(section.subsections, content.redaction?.infoSubsections?.[section.id]);
const hasSubsections = subRows.length > 0;
```

Для открытого раздела с непустым `body`, у которого все подразделы закрыты для зрителя, на телефоне (`infoPhone`) получается:
- клик по строке раздела идёт в ветку `hasSubsections ? toggleInfoExpanded(...)`, а не в `openInfoArticle(section.id)`;
- в раскрытой группе кнопка «Обзор раздела» зависит от `infoOverviewVisible(section)` (`lib/info-phone-nav.ts:43`), а она считает `section.subsections.length > 0` по отфильтрованному (открытому) списку, то есть здесь `false`;
- в группе остаются только статичные заглушки.

Итог: текст раздела (`section.body`), который зритель вправе читать, открыть нельзя. Это регрессия относительно поведения до фазы 24 (раздел без подразделов открывался сразу) и нарушение D-10/D-22 по духу: закрытые дети не должны отнимать у зрителя открытый родитель. Сценарий e2e не покрывает: в `mock-info-1` один подраздел открыт, поэтому «Обзор раздела» показывается.

**Fix:** поведение (открыть статью или раскрыть группу) решать по открытым подразделам, а заглушки только рисовать:

```tsx
const hasOpenSubsections = section.subsections.length > 0;
const hasSubsections = hasOpenSubsections;            // для toggle, data-info-id, current
const markerCount = subRows.length;                   // только для счётчика и aria-label
// заглушки закрытых подразделов выводить под статьёй раздела (или на телефоне внутри открытой статьи),
// а не вместо неё, если открытых подразделов нет
```

Добавить тест (`lib/level-ui.test.ts` или e2e-сценарий на 390 px): открытый раздел с телом и только закрытыми подразделами открывается тапом.

### WR-02: В `LevelPicker` с `caption` элемент `<legend>` не первый потомок `<fieldset>`: группа теряет имя

**File:** `components/portia-level-picker.tsx:22-23`
**Issue:** при `caption` разметка такая:

```tsx
<fieldset ...>
  {caption ? <strong className="access-level-caption">{caption}</strong> : null}
  <legend>{levelCopy.pickerLegend}</legend>
```

По HTML-спецификации `legend` служит заголовком `fieldset` только как первый потомок. Здесь первым идёт `<strong>`, поэтому для пикера «Приложения → Устав» (`components/portia-editor.tsx:1338`) fieldset не получает доступного имени, а каждая радиокнопка называется просто «Допуск N» (`aria-label`) без указания, к чему он относится. Для остальных пикеров (без `caption`) всё корректно, но имя там тоже общее («Нужен допуск»), и ссылки на запись (вирус/раздел/карточка) нет. Скринридер читает пять одинаковых групп подряд.

**Fix:** поставить `legend` первым и вложить в него подпись записи:

```tsx
<fieldset ...>
  <legend>
    {caption ? <strong className="access-level-caption">{caption}</strong> : null}
    {levelCopy.pickerLegend}
  </legend>
```

И/или передавать в `aria-label` радиокнопки имя записи (`Допуск 3: ${caption}`), если по UI-SPEC видимая подпись не должна меняться.

### WR-03: Показ уровня по умолчанию «5» для копии без маркера (fail-open на отображении)

**File:** `lib/level-placeholders.ts:111-113` (использование: `components/portia-desktop.tsx:1887`, `:1914`, `:2078`)
**Issue:** `shownViewerLevel(content)` возвращает `EDITOR_ACCESS_LEVEL` (5), когда маркера нет. Это верно для копии редактора, но функция не различает «копия редактора» и «копия, у которой маркера нет по другой причине». Конкретный путь: первая загрузка без кэша и без сети. `contentReady` становится `true` в `finally` даже при ошибке (`portia-desktop.tsx:~641`), `content` остаётся `defaultPortiaContent` без маркера, и заголовок окна «База вирусов» рисует «ДОПУСК 5» посетителю уровня 1, у которого `viewerLevel` из решения шлюза равен 1. Записи при этом не показываются (`appViewState` даёт `fatal`), но ложный максимальный допуск на экране есть. D-15 требует показывать реальный уровень зрителя, а fail-closed принцип фазы (D-03) тут не соблюдён: неизвестное значение читается как наивысшее вместо наименьшего.

**Fix:** брать уровень зрителя из решения шлюза, а из копии только как резерв:

```tsx
meta={levelCopy.archiveMeta(viewerLevel ?? shownViewerLevel(content))}
// и для VirusRecord / ScientistDocument:
viewerLevel={content.redaction?.level ?? viewerLevel ?? shownViewerLevel(content)}
```

(для редактора `viewerLevel` и так 5 из `viewerOf`). Тест: `shownViewerLevel` для копии без маркера при заданном `viewerLevel` отдаёт `viewerLevel`.

## Info

### IN-01: `reconcileSelection` не держит заглушку, если после потери записи закрылся и её родитель

**File:** `lib/level-placeholders.ts:129-138`
**Issue:** при уже «потерянном» выборе (`prev.id === ""`, `prev.lostSlot = S`) цепочка `prevChain` строится из `infoSlotChain(previous, "")` и пуста, остаётся единственный кандидат `[S]`. Если на следующем опросе закрылся родительский раздел, у закрытого раздела нет ключей детей (D-10), заглушки `S` в `placeholders` уже нет, и функция возвращает `{ id: "", lostSlot: null }`. `selectionResult` в `portia-desktop.tsx:41-44` подставляет первую открытую запись, то есть окно молча переходит на другую запись, хотя D-20 велит оставить блок «ЗАСЕКРЕЧЕНО» на месте. Узкий случай (два повышения уровня подряд на открытом окне), без утечки.
**Fix:** запоминать в `LostSelection` не только свой `slot`, но и слоты родителей на момент потери (`chain`), и передавать их как кандидатов; тест на цепочку «подраздел закрылся, затем закрылся раздел».

### IN-02: `normalizeDocumentLinks` обещает больше, чем проверяет

**File:** `lib/content-sync.ts:41-54`
**Issue:** комментарий: «a damaged copy cannot open a foreign address». На деле пропускается любой `https:` адрес для `src` и `external`. Источник адреса: ответ собственного сервера или `localStorage` устройства (правится владельцем устройства). Ограничивает `src` только CSP `frame-src` (`next.config.ts:21`), а `external` рендерится как `<a href target=_blank>` без ограничений по хосту. Риск самонаведённый (нужна правка собственного хранилища), поэтому только замечание.
**Fix:** сверять с известным списком источников (или ограничить `new URL(value).origin` теми же хостами, что в `frame-src`), либо поправить комментарий.

### IN-03: Кэш после сохранения не содержит `documents`

**File:** `components/portia-desktop.tsx:1410-1416`
**Issue:** запись кэша в `saveContent` кладёт `content`, `revision`, `viewer`, но не `documents` (в `fetchContent`, `:615-622`, кладёт). При следующей загрузке без сети из такого кэша `normalizeDocumentLinks(undefined)` даёт `{}`, окно «Устав» у редактора показывает скелет или фатальную панель, пока не придёт первый ответ. Только офлайн, но это неравномерность двух мест записи одного кэша.
**Fix:** вынести запись кэша в одну функцию `writeContentCache(content, revision, updatedAt)` и использовать из обоих мест (сохраняя `documents` из состояния/ref).

### IN-04: Дублирование сборки зависимостей `resolveGate` в двух маршрутах

**File:** `app/api/content/route.ts:25-35` и `app/api/access/status/route.ts:11-21`
**Issue:** блок `createServerSupabaseClient` + `resolveGate` + замыкание `editorAccess` (`getUser`, `isAuthRetryableFetchError`, `getEditorAccess`) скопирован слово в слово. Решение зрителя в `/api/content` и в `/api/access/status` обязано совпадать (ключ копии, `acceptFetchedContent`, D-23), поэтому расхождение при будущей правке одного из двух мест превратится в тихий дрейф `viewerKey`.
**Fix:** общая функция `resolveGateFor(request)` в `lib/` (рядом с `access-gate.ts`), которую вызывают оба маршрута.

### IN-05: Устаревший комментарий и дубли литералов ключей кэша

**File:** `components/portia-desktop.tsx:240-246`, `:219-222`; `lib/device-cache.ts:21-22`
**Issue:** (а) в `ContentResponse` комментарий «read by later plans» относится к уже реализованным полям `viewer`/`documents`, и они читаются в этом же файле; (б) ключи `portia-content-last-success-v1` и `portia-employees-last-success-v1` объявлены дважды (в `device-cache.ts` как `CONTENT_CACHE_KEY`/`EMPLOYEES_CACHE_KEY` и литералами в `portia-desktop.tsx`), равенство держит только тест `level-visitor.test.ts`. Это работает, но заставляет помнить о синхронизации вручную.
**Fix:** импортировать константы из `lib/device-cache.ts` в `portia-desktop.tsx` (если `lib/portia-desktop.test.ts` читает литералы из текста файла, подправить этот тест на проверку импорта); поправить комментарий.

### IN-06: Секрет слота требуется на пути редактора, где слоты не нужны

**File:** `app/api/content/route.ts:50`; `lib/content-response.ts:24-27`
**Issue:** `slotKeyFactory(accessSessionSecret())` вызывается всегда и бросает при секрете короче 32 символов. Для `viewer.editor === true` `slotOf` не используется (`contentBodyFor` идёт по ветке `clean`), но короткий или отсутствующий `PORTIA_PROMOTION_DEVICE_SECRET` превращает чтение содержимого владельцем тоже в 503. До фазы 24 чтение не зависело от этого секрета. Практически секрет задан (шлюз без него не работает вообще), поэтому это замечание, а не предупреждение.
**Fix:** строить `slotOf` лениво: `slotOf: (id) => (factory ??= slotKeyFactory(secret))(id)`, либо только для не-редактора.

### IN-07: Ответ 401 обрабатывается без проверки порядка запросов

**File:** `components/portia-desktop.tsx:582-591`
**Issue:** ветка `status === 401` с кодом `access-required` стоит до `isNewerAnswer(requestSeq, contentAnsweredSeq.current)`. Поздний 401 от запроса, отправленного до смены состояния (например, до повторного одобрения или входа редактора), после более нового успешного ответа очищает `localStorage`-кэш (`clearDeviceContentCaches`) и дёргает шлюз. Шлюз сам переспросит сервер, поэтому доступ не страдает, но свежий офлайн-кэш теряется.
**Fix:** применять 401 только если `requestSeq === contentRequestSeq.current` (последний отправленный запрос); иначе игнорировать.

---

_Reviewed: 2026-11-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
