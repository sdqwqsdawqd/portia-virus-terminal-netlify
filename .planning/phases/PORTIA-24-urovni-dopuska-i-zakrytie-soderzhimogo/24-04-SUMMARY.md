---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
plan: 04
subsystem: access
tags: [access-levels, content-sync, device-cache, gate, dossier]
requires:
  - phase: PORTIA-24-01
    provides: GET /api/content по зрителю (viewer, documents), viewerOf, shownViewerLevel, levelCopy, тип withheld
provides:
  - acceptFetchedContent с ключом зрителя, isNewerAnswer, viewerKeyOf, normalizeDocumentLinks (lib/content-sync.ts)
  - CONTENT_CACHE_KEY, EMPLOYEES_CACHE_KEY, cacheMatchesViewer, clearDeviceContentCaches (lib/device-cache.ts)
  - viewerKey, shouldClearDeviceCaches (lib/access-viewer.ts)
  - рабочий стол: приём по зрителю и номеру запроса, кэш по зрителю, 401 -> шлюз, интервалы 30/10 с, состояние documents
  - шлюз: очистка кэшей при закрытом решении, пропсы viewerKey / viewerLevel / onAccessLost
  - досье: реальный уровень, арабские цифры, закрытость только по withheld, полосы только из id, блок записей только при наличии
affects: [PORTIA-24-05, PORTIA-24-09, PORTIA-24-10, PORTIA-24-11]
requirements-completed: []
actuals:
  tokens: 9200
  tasks: 3
  commits: 3
plan_head_before: 7d4a0a2605babb3c3e54e750654828950372bcc5
plan_head_after: 33806f8e1f460ccf168e3d897848ac75f84fa714
tech-stack:
  added: []
  patterns: [accept by revision or viewer, answers ordered by request number, viewer-keyed device cache, clear caches on closed-not-allowed]
key-files:
  created:
    - lib/access-viewer.test.ts
    - lib/level-visitor.test.ts
  modified:
    - lib/content-sync.ts
    - lib/content-sync.test.ts
    - lib/device-cache.ts
    - lib/device-cache.test.ts
    - lib/access-viewer.ts
    - components/portia-desktop.tsx
    - components/portia-access-gate.tsx
    - components/portia-desktop-dossier.tsx
    - lib/phase20-hints-inventory.test.ts
key-decisions:
  - "Ключ зрителя: `editor` или `level-N` (N 1..5), иначе пустая строка; формат задан один раз в viewerKeyOf, viewerKey шлюза берёт его оттуда."
  - "Приём ответа: новее по ревизии ИЛИ другой зритель; порядок ответов по номеру запроса идёт до этой проверки (поздний старый ответ отбрасывается при любом ключе)."
  - "Кэш содержимого показывается только при точном совпадении ключа с решением шлюза; копия другого уровня или без ключа удаляется до показа. Кэш сотрудников не помечается (список не уровневый, Phase 25)."
  - "Интервалы D-23: посетитель 30 с, редактор 10 с (решение планировщика); самопланирующийся setTimeout читает право редактора на каждом шаге."
  - "Очистка кэшей при любом решении `closed && !allowed` (D-21) и при 401 `access-required` от /api/content; ветка 401 не пишется ни как сбой, ни как успешная копия."
patterns-established:
  - "Закрытая запись учёного определяется серверным признаком withheld; клиент уровни не сравнивает."
duration: 35min
completed: 2026-11-15
status: complete
---

# Phase 24 Plan 04: приём по зрителю, кэш устройства и записи учёных у посетителя Summary

Клиент теперь принимает копию содержимого другого зрителя при той же ревизии, не держит на устройстве копию чужого уровня, теряет рабочий стол и кэши при отзыве, а досье показывает реальный уровень на шкале 1-5 без пустого блока записей.

## Что сделано

**Задача 1, коммит `f932906`.** Чистые функции с тестами.
- `acceptFetchedContent(revision, knownRevision, savesAtSend, savesNow, viewerKey = "", knownViewerKey = "")`: `savesAtSend === savesNow && (revision > knownRevision || viewerKey !== knownViewerKey)`. Семь прежних тестов не менялись.
- `isNewerAnswer`, `viewerKeyOf`, `normalizeDocumentLinks` (только ключи `LEVELED_APP_IDS`, обе ссылки строки с протоколом https).
- `lib/device-cache.ts`: `CONTENT_CACHE_KEY`, `EMPLOYEES_CACHE_KEY`, `cacheMatchesViewer`, `clearDeviceContentCaches` (try/catch на каждое удаление).
- `lib/access-viewer.ts`: `viewerKey`, `shouldClearDeviceCaches`. Новый `lib/access-viewer.test.ts`.
- Тесты «LVL-09 ...», «EDGE LVL-09/idempotency», «EDGE LVL-09/concurrency», «LVL-05 ...», «D-21 ...».

**Задача 2, коммит `381eff8`.** Проводка.
- `PortiaDesktop({ initialContent, viewerKey, viewerLevel?, onAccessLost })`; refs `knownViewerKey`, `contentAnsweredSeq`, `viewerKeyRef`, `onAccessLostRef`; состояние `documents` (его читает план 24-10).
- `fetchContent`: 401 с телом `access-required` -> очистка кэшей и `onAccessLostRef.current?.()` без отметки сбоя; успешный ответ проходит `isNewerAnswer`, затем `acceptFetchedContent` с ключом зрителя; в записи кэша поля `viewer` и `documents`; вторая закреплённая запись кэша (в `saveContent`) несёт `viewer: knownViewerKey.current`.
- Чтение кэша: отдельная строка `cacheMatchesViewer(JSON.parse(cached), viewerKeyRef.current)` после закреплённой проверки источника.
- Опрос: самопланирующийся `setTimeout`, 30 с у посетителя и 10 с у редактора, только при видимой вкладке; эффект на смену пропа `viewerKey` запрашивает содержимое сразу.
- Шлюз: `shouldClearDeviceCaches(decision)` -> `clearDeviceContentCaches(...)` до `setView`; `PortiaDesktop` получает `viewerKey`, `viewerLevel`, `onAccessLost`. Экран «ДОСТУП ОТОЗВАН» Phase 23 не менялся.
- `lib/level-visitor.test.ts` (исходники): порядок проверок в `fetchContent`, ветка 401, интервалы, место проверки зрителя в чтении кэша, проводка шлюза.

**Задача 3, коммит `33806f8`.** Досье.
- Функция римских цифр и зашитое «II» удалены; плашка, подпись «УРОВЕНЬ N», путь документа, строка метаданных и текст отказа берут числа и `levelCopy`.
- Закрытость строки и документа: `!log.withheld`; `RedactedDocument({ id })` рисует только `generatedRedaction(id)` (текст записи не измеряется); блок «ЗАПИСИ УЧЁНЫХ» не рисуется при пустом списке, «ЗАПИСИ ОТСУТСТВУЮТ» удалено.
- Три вызова в рабочем столе (два `VirusRecord`, один `ScientistDocument`) получают `viewerLevel={shownViewerLevel(content)}`.
- `lib/phase20-hints-inventory.test.ts`: набор переименован в `replacedCopy`, досье добавлено (Phase 24, D-15).

## Проверка

- PASS: `node --experimental-strip-types --test --test-skip-pattern="matrix freshness: the real matrix commit" lib/*.test.ts` - 2026 тестов, 0 fail, 3 skipped. Тест «matrix freshness: the real matrix commit» пропущен по имени (ожидаемо красный до плана 24-11), PASS не засчитывается.
- PASS: `node node_modules/typescript/bin/tsc --noEmit` - 0 ошибок. ESLint (`components`, `lib`) - 0 ошибок, 15 предупреждений (в изменённых файлах новых нет: `LoadingState` и `<img>` были до плана).
- BLOCKED (не доказано, не PASS): живое понижение и отзыв в браузере (backstop S6, план 24-11), Postgres/RLS, авторизованные роли, физические устройства. Все проверки этого плана - чистые функции и чтение исходников.
- Не доказано сквозное D-12: признак `withheld` ставит серверная очистка плана 24-05. До неё сервер отдаёт записи учёных без `withheld` и с текстом, поэтому досье показывает их открытыми; это промежуточное состояние ветки внутри фазы. Здесь доказано только «строка закрыта тогда и только тогда, когда есть `withheld`, текст не рисуется».

## Требования

Ни одно не отмечено выполненным (REQUIREMENTS.md не менялся):
- LVL-05 уже Complete с плана 24-01; этот план добавляет сторону кэша устройства.
- LVL-06 (карточка сохраняется без записей) - серверная и редакторская часть в других планах; здесь только «пустого блока нет».
- LVL-07 - зависит от серверного `withheld` (24-05).
- LVL-09 - правила приёма и опрос готовы, но `reconcileSelection` подключается в 24-09/24-10 и живая проверка S6 в 24-11.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Литералы ключей кэша остались в `portia-desktop.tsx`**
- **Found during:** Задача 2, тест `STAB-DESK-07` (`lib/portia-desktop.test.ts`).
- **Issue:** тест закрепляет два литерала `portia-content-last-success-v1` / `portia-employees-last-success-v1` в исходнике рабочего стола; присвоение `const contentCacheStorageKey = CONTENT_CACHE_KEY` их убирало.
- **Fix:** литералы оставлены в `portia-desktop.tsx`, `lib/device-cache.ts` хранит те же значения для очистки; `lib/level-visitor.test.ts` проверяет, что значения совпадают. Закреплённый тест не менялся.
- **Files modified:** components/portia-desktop.tsx, lib/level-visitor.test.ts
- **Commit:** 381eff8

**2. [Мелкое отклонение от текста плана] Проп `viewerLevel` у `PortiaDesktop` принят, но не используется**
- Досье берёт уровень из `shownViewerLevel(content)` (как требует задача 3), поэтому проп `viewerLevel` объявлен в типе и передаётся шлюзом, но рабочий стол его не разбирает (иначе предупреждение линтера о неиспользуемой переменной). `documents` помечен `void documents` до плана 24-10.

## Known Stubs

- `documents` в `PortiaDesktop` заполняется, но пока нигде не читается (план 24-10 подключает окна документов). Намеренно, не влияет на цель этого плана.
- CSS `.scientist-log-empty` остался в `app/portia.css` без использования (по плану CSS не трогали).

## Threat Flags

Нет новой поверхности: плановые угрозы T-24-10 (кэш чужого уровня), T-24-11 (поздний ответ), T-24-12 (отозванный посетитель), T-24-13 (полосы из текста) закрыты кодом и тестами исходников; живое подтверждение в браузере остаётся BLOCKED.

## Self-Check: PASSED
