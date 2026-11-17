---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
plan: 10
subsystem: desktop
tags: [recycle-bin, charter, search, access-levels, editor-wiring, lvl-05, lvl-08, d-11, d-15, d-17, sec-07]
requires:
  - phase: PORTIA-24-05
    provides: embeddedDocuments (только сервер), redaction.apps.charter, redaction.recycle
  - phase: PORTIA-24-06
    provides: levelsRaised в ответе PUT, отказ 422 для копии «для зрителя»
  - phase: PORTIA-24-08
    provides: пропсы редактора contentIncomplete и saveNotice
  - phase: PORTIA-24-09
    provides: applySelections, потерянный выбор, заглушки окон записей
provides:
  - «Корзина»: заглушка-строка на месте закрытого файла или вируса, счётчик и пустое состояние считают заглушки, блок вместо закрывшегося файла
  - окно «Устав» читает ссылку из ответа сервера; ниже уровня только блок «ЗАСЕКРЕЧЕНО · нужен допуск N», рамка не монтируется
  - ссылка «Устава» убрана из клиентского кода (остаётся только «Таблица», O-1)
  - глобальный поиск без закрытого «Устава» (иконка на месте)
  - «ДОПУСК N» в заголовке окна архива и «ПРОВЕРКА ДОПУСКА… УРОВЕНЬ N» в строке загрузки, арабскими цифрами
  - редактор получает contentIncomplete и saveNotice, после серверного подъёма уровней рабочий стол перечитывает копию
affects: [PORTIA-24-11]
requirements-completed: [LVL-08]
actuals:
  tokens: 14000
  tasks: 3
  commits: 3
plan_head_before: 4a51982d4944f2af60407e76c59e1fc368493276
plan_head_after: 8ab9923e90bbf83366df45d0fb9ede407dbca6d0
tech-stack:
  added: []
  patterns: [четвёртый выбор «Корзины» идёт через тот же reconcileSelection и applySelections, ключи virus:<id> переводятся в обычный id для цепочки слотов, окно документа выбирает ветку block / frame / skeleton по ответу сервера]
key-files:
  created: []
  modified:
    - components/portia-desktop.tsx
    - lib/level-copy.ts
    - lib/level-ui.test.ts
key-decisions:
  - "«Корзина» — тот же механизм потерянного выбора, что у трёх окон из 24-09: состояние trashLost действует, пока activeTrashFileId пуст; кнопка «Закрыть файл» сбрасывает и выбор, и потерю. Ключи virus:<id> сопоставляются со слотами по обычному id вируса (reconcileTrashSelection, trashRecordId)."
  - "Окно «Устав» без ссылки и без отказа в ответе показывает AppSkeleton, а при сбое синхронизации — contentFatal; пустого окна нет."
  - "savedRaised приведён к UI-SPEC: «Уровни приведены к иерархии: изменено k.» (было «Сохранено. Поднято уровней: k.»); UI-SPEC — контракт."
patterns-established:
  - "Заголовок окна и строка загрузки берут уровень из ответа, до ответа — из решения шлюза (viewerLevel), без уровня — без числа."
status: complete
completed: 2026-11-15
---

# Phase 24 Plan 10: «Корзина», «Устав», поиск, уровень и проводка редактора Summary

Оставшиеся поверхности посетителя закрыты на стороне клиента: «Корзина» рисует закрытое заглушками на местах, «Устав» ниже уровня показывает только блок без ссылки в коде, поиск его не предлагает, уровень в заголовке и загрузке арабскими цифрами, а редактор знает о неполном содержимом и видит серверный подъём уровней.

## Что сделано

**Задача 1, коммит `57652c3`: «Корзина» (O-3, допущение A-4).**
- `mergePlaceholders(trashOrder, content.redaction?.recycle)`: заглушка `RedactedPlaceholder variant="row"` с `key={row.slot}` и номером позиции; столбцов расположения и типа у неё нет, кнопок и обработчиков нет. Строки открытых файлов и вирусов (`hitAttrs("file", …)`) не менялись.
- Счётчик «ФАЙЛОВ NN» считает строки вместе с заглушками; пустая корзина — только когда нет ни файлов, ни заглушек.
- `reconcileTrashSelection` и `trashLost`: четвёртый выбор подключён к `applySelections` (ответ сервера и кэш устройства). Если просматриваемый файл закрылся, тело просмотра — блок, в шапке только «Закрыть файл» без имени; вернувшийся файл открывается молча.

**Задача 2, коммит `7a9703f`: «Устав», поиск, заголовок, загрузка.**
- `embeddedApps` содержит только `sheet`; окно «Устав» (заголовок «ДОКУМЕНТ ОТДЕЛА») по порядку: `redaction.apps.charter` — блок; `documents.charter` — `EmbeddedDocument`; иначе скелет или `contentFatal("flaskEmpty")`. Закрытый раньше открытого, поэтому при отзыве доступа рамка размонтируется, окно остаётся.
- `searchApps` — `globalSearchApps` без `charter`, когда ответ несёт `redaction.apps.charter`; индекс и проверка существования результата используют его. Иконка, меню и ярлыки «Устава» не тронуты. Ветка пропавшей записи в `openSearchResult` не менялась.
- `levelCopy.archiveMeta(contentReady ? shownViewerLevel(content) : viewerLevel)`; `bootLines(level)` строится из `levelCopy.bootCheck(level)`; проп `viewerLevel` теперь читается. Дополнение к плану: зависимость `searchApps` добавлена в `useMemo` индекса.

**Задача 3, коммит `8ab9923`: проводка редактора (LVL-08, D-17).**
- `contentIncomplete={isViewerShapedContent(content)}` и `saveNotice={saveNotice}`.
- `saveContent`: сброс `saveNotice` в начале; при `levelsRaised > 0` — строка из `levelCopy.savedRaised(k)`, `knownRevision.current = -1` и `void fetchContent()` после записи кэша. Ветка 409 не тронута. Отказ 422 уже показывается через `setSaveError(body.error)` для любого неуспешного ответа (проверено, тест на это добавлен).

## Проверка

- PASS: `node --experimental-strip-types --test --test-skip-pattern="matrix freshness: the real matrix commit" lib/*.test.ts` — 2093 теста, 0 fail, 3 skipped. Тест «matrix freshness: the real matrix commit» пропущен по имени, красный до плана 24-11, не засчитан как PASS.
- PASS: тесты задач (`level-ui`, `portia-desktop`, `window-open`, `search-index`, `level-docs`, `editor-save-status`, `level-editor`) — 0 fail.
- PASS: `node node_modules/typescript/bin/tsc --noEmit` — 0 ошибок; ESLint по репозиторию — 0 ошибок, 17 предупреждений (как в 24-09).
- Новые тесты исходников в `lib/level-ui.test.ts` (10): заглушки «Корзины», счётчик, блок вместо файла; адреса «Устава» нет ни в одном файле `components/`; блок «Устава» стоит раньше рамки; `apps: searchApps`; арабские уровни, нет «ДОПУСК II» и «УРОВЕНЬ II»; SEC-07 (тот же детектор, что `lib/level-docs.test.ts`); проводка редактора и `levelsRaised`.
- BLOCKED (не доказано, не PASS): поведение в браузере (окно «Устав» без допуска на экране, размонтирование iframe при отзыве доступа, внешний вид заглушек «Корзины», фокус, телефон), живое сохранение с подъёмом уровней, проверка собранных файлов `.next` на отсутствие ссылки (Phase 25, SEC-03), роли и RLS. Тесты проверяют текст исходников. Это backstop S6 и план 24-11.

## Requirements

- LVL-08: отмечено выполненным. Сервер (24-06: отказ 422, подъём иерархии), редактор (24-08: защита от неполного содержимого) и рабочий стол (этот план) связаны; живая проверка сохранения в браузере остаётся BLOCKED до 24-11.
- LVL-04, LVL-05, SEC-07 уже отмечены ранее; этот план закрыл оставшиеся поверхности («Корзина», поиск, окно «Устав»).
- LVL-09 остаётся Pending: живая смена уровня на всех поверхностях (S6) — план 24-11.

## Deviations from Plan

### Отклонения по форме

- Handoff 24-08: `levelCopy.savedRaised` приведён к UI-SPEC («Уровни приведены к иерархии: изменено k.») — правка `lib/level-copy.ts`, не указанного в `files_modified`; других потребителей строки нет.
- Для «Корзины» заведён отдельный `reconcileTrashSelection` (план называл `reconcileSelection`, `simpleSlotChain`): id вируса в корзине имеет вид `virus:<id>`, а слоты ответа привязаны к обычному id, поэтому индекс слотов и цепочка пересчитываются через `trashRecordId`.
- В `useMemo` индекса поиска добавлена зависимость `searchApps` (иначе новое предупреждение `exhaustive-deps`).
- `npm exec tsc` и `npm run lint` не запускаются под временным Node; типы и ESLint запущены прямым вызовом `node node_modules/...`.

### Auto-fixed Issues

Нет.

## Known Stubs

Заглушек данных нет. Записи в `.planning/WINDOWS.md` не добавлялись.

## Threat Flags

Новой сетевой поверхности нет. Митигации: T-24-31 (ссылка «Устава» удалена из клиентского кода, окно берёт её из ответа; тест исходников; остаток — история git, старые сборки, публичный документ — записан как SEC-07), T-24-32 (поиск без закрытого «Устава»; тест исходников).

## Open Items

- Ветка «нет ссылки и нет отказа» окна «Устав» (скелет до ответа) в браузере не проверена.
- Сборка `.next` не проверялась на отсутствие ссылки (Phase 25, SEC-03).

## Self-Check: PASSED

- FOUND: components/portia-desktop.tsx, lib/level-copy.ts, lib/level-ui.test.ts
- FOUND commits: 57652c3, 7a9703f, 8ab9923 (`git rev-list --count` от базы = 3)
