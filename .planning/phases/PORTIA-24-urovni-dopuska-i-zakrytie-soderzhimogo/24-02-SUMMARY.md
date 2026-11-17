---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
plan: 02
subsystem: access
tags: [placeholder, redaction, css, selection-rule, access-levels]
requires:
  - phase: PORTIA-24-01
    provides: RedactedPlaceholder (форма row), mergePlaceholders, normalizeContentRedaction, requiredLevelOf, levelCopy
provides:
  - RedactedPlaceholder во всех пяти формах: row, index, tile, bar, block
  - размеченный блок CSS access-levels перед users-tab, хэш UI-01 прежний
  - reconcileSelection (D-20/D-22), flattenPlaceholders, simpleSlotChain, infoSlotChain, guideSlotChain
  - граничные тесты слияния и маркера, таблица requiredLevelOf (D-03), тесты исходников заглушки и CSS
affects: [PORTIA-24-07, PORTIA-24-09, PORTIA-24-10, PORTIA-24-11]
actuals:
  tokens: 8600
  tasks: 3
  commits: 3
plan_head_before: 3da0930cc6737ca11549698331ced170c85b57cd
plan_head_after: af055a3e3b6015f3bbfcffe3522b0f83f7a9f86a
tech-stack:
  added: []
  patterns: [one pure selection rule shared by every record window, CSS block cut out by markers before the pinned hash, source-level component tests]
key-files:
  created:
    - lib/level-placeholders.test.ts
    - lib/level-ui.test.ts
  modified:
    - lib/level-placeholders.ts
    - lib/access-levels.test.ts
    - components/portia-redacted.tsx
    - app/portia.css
    - lib/style-tokens.test.ts
key-decisions:
  - "reconcileSelection — одна чистая функция: открытая запись остаётся; потерянный slot, снова открытый, возвращает запись молча; иначе первый кандидат из [lostSlot, ...цепочка], найденный среди заглушек; иначе пусто. Результат несёт только slot и уровень заглушки, не прошлую запись (T-24-38)."
  - "Цепочки slot строятся по findInfo/findGuide: подраздел или карточка → [slot записи, slot родителя], у редактора (нет redaction) цепочка пустая."
  - "Текст заглушки лежит в одном span access-redacted-text (третья колонка сетки row/index), внутри два неразрывных сегмента."
  - "Класс span номера переименован в access-redacted-number: прежний access-redacted-index совпал бы с классом формы index."
requirements-completed: [LVL-02, LVL-04, LVL-09]
duration: 40min
completed: 2026-11-15
status: complete
---

# Phase 24 Plan 02: формы заглушки, блок CSS и правило выбора окна Summary

Заглушка «ЗАСЕКРЕЧЕНО · нужен допуск N» теперь есть во всех пяти формах (row, index, tile, bar, block), оформлена одним блоком CSS `access-levels` без правки существующих строк, а смена уровня в открытом окне описана одной чистой функцией `reconcileSelection` с тестами понижения, повышения, закрытого родителя и удаления.

## Что сделано

**Задача 1, коммит `747e31d`.**
- `reconcileSelection`, `flattenPlaceholders`, `simpleSlotChain`, `infoSlotChain`, `guideSlotChain` в `lib/level-placeholders.ts` (модуль без `node:`-импортов, импорты с `.ts`).
- `lib/level-placeholders.test.ts`: граничные случаи `mergePlaceholders` (позиции, `at` за концом, пустой список, две заглушки подряд), `normalizeContentRedaction` (мусорный маркер = level 1 с пустыми списками, узлы без slot или с нецелым `at` отброшены, мусорный `requiredLevel` = 5, ключи длиннее 240 отброшены), `isViewerShapedContent`, `shownViewerLevel`, правило выбора («D-20 …», «D-22 …», закрытый родитель, удаление), цепочки slot.
- `lib/access-levels.test.ts`: таблица `requiredLevelOf` (D-03). Все граничные тесты прошли против реализации 24-01 сразу; дефектов трассера не найдено, `lib/access-levels.ts` не менялся.

**Задача 2, коммит `93435bb`.**
- `components/portia-redacted.tsx`: `RedactedVariant = "row" | "index" | "tile" | "bar" | "block"`; `block` — `role="status"`, `tabIndex={-1}`, значок и заголовок `levelCopy.redacted(level)`, больше ничего; номер показывают только `row` и `index`; обработчиков, ссылок, `data-*`, `aria-expanded`, `aria-label` нет.
- `lib/level-ui.test.ts`: исходник компонента (пять форм, статичность, ровно пять пропсов, импорты только иконки и `levelCopy`), «EDGE LVL-04/encoding …» (строка посимвольно по кодам для уровней 1–5), T-24-05 (ни один `components/*.tsx` не импортирует `level-redact` или `content-response`).

**Задача 3, коммит `af055a3`.**
- `app/portia.css`: блок `/* access-levels:start … */` … `/* access-levels:end */` вставлен между `}` медиа-запроса 430px и `/* users-tab:start`, 24 добавленных строки, 0 удалённых. Внутри нет `border-radius`, `@keyframes`, `animation`, `transition`, `--muted`, hex-цветов и `:hover`.
- `lib/style-tokens.test.ts`: `stripMarkedBlocks` знает блок `access`; в тесте UI-01 запреты проверяются и для него, плюс «блок один» и «стоит перед users-tab». `PRE_PHASE_PORTIA_CSS_SHA256` не менялся (`2e4f25b4…ef45`), тест UI-01 зелёный.
- `lib/level-ui.test.ts`: «S2 long-text», «S1 populated», «S1 overflow», «D-09 статична», блок один и стили заглушки только внутри него.

## Проверка

- PASS: `node --experimental-strip-types --test --test-skip-pattern="matrix freshness: the real matrix commit" lib/*.test.ts` — 1981 тест, 0 fail, 3 skipped (базовая линия после 24-01: 1944/0/3). Тест «matrix freshness: the real matrix commit» пропущен по имени, красный до плана 24-11, не засчитан как PASS.
- PASS: `node node_modules/typescript/bin/tsc --noEmit` — 0 ошибок. ESLint по репозиторию (`node node_modules/eslint/bin/eslint.js .`) — 0 ошибок, 17 предупреждений (те же, ни одного в файлах плана).
- PASS: проверка мутацией — `onClick` на корневом элементе заглушки роняет тест исходника (1 fail), после возврата 0 fail.
- BLOCKED (не доказано, не PASS): вид заглушки в браузере, фактическое отсутствие горизонтального скролла на 320/390/900px (S1 overflow backstop), перенос строки на 320px, физические устройства — план 24-11. Тесты CSS проверяют текст правил, а не отрисовку.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Совпадение имён классов `access-redacted-index`**
- **Found during:** Task 3
- **Issue:** трассер 24-01 дал span номера класс `access-redacted-index`, а у формы `index` корневой элемент получает тот же класс через `access-redacted-${variant}`; правила сетки формы упали бы на span номера.
- **Fix:** span номера переименован в `access-redacted-number`.
- **Files modified:** components/portia-redacted.tsx
- **Commit:** af055a3

**2. [Rule 1 - Bug] Текст заглушки в трёх свободных элементах сетки**
- **Found during:** Task 2
- **Issue:** у формы row сетка `30px auto 1fr` (номер, значок, текст), а слово, « · » и «нужен допуск N» были тремя отдельными элементами сетки.
- **Fix:** текст обёрнут в один `span.access-redacted-text`; внутри по-прежнему два неразрывных сегмента.
- **Files modified:** components/portia-redacted.tsx
- **Commit:** 93435bb

### Отклонения по форме

- `npm exec tsc` и `npm run lint` не запускаются (npm под временным Node 22.13.1 не находит `node-gyp`/модули), типы и ESLint запущены прямым вызовом `node node_modules/...` (как в 24-01).
- Порядок TDD: `reconcileSelection` и её помощники написаны до тестов; красная стадия отдельным коммитом не зафиксирована (план оговаривает «тесты сначала»). Тесты поведение покрывают целиком и прошли; мутация проверена только для компонента.
- Форма row без номера (`index` не передан) оставляет значок в колонке 30px; все места использования (список вирусов, корзина) номер передают, так что отдельное правило не введено.

## Known Stubs

Заглушек данных нет. Формы `index`, `tile`, `bar`, `block` и `reconcileSelection` пока нигде не подключены — это работа планов 24-09 и 24-10 (поверхности «Информация», «Справочник», «Устав», окна записей и проводка правила выбора). Записи в `.planning/WINDOWS.md` не добавлялись.

## Threat Flags

Новой сетевой поверхности и новых границ доверия нет. Митигации плана: T-24-36 (пропсы только level/variant/index/listItem/className, тест исходника), T-24-37 (нет обработчиков, ссылок, Tab, hover — тесты исходника и CSS), T-24-38 (результат `reconcileSelection` несёт только slot и уровень заглушки, тест).

## Self-Check: PASSED

- FOUND: lib/level-placeholders.test.ts, lib/level-ui.test.ts, lib/level-placeholders.ts, components/portia-redacted.tsx, app/portia.css, lib/style-tokens.test.ts, lib/access-levels.test.ts
- FOUND commits: 747e31d, 93435bb, af055a3 (`git rev-list --count` от базы = 3)
- `grep -n "access-levels:start|access-levels:end" app/portia.css` — по одной строке (2510, 2533), `users-tab:start` на 2534.
