---
phase: PORTIA-26-edinyy-stil-sayta
plan: 13
subsystem: ui
tags: [a11y, axe, wcag-2.5.3, contrast, accents, byte-guard]
status: complete

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "26-07 — реестр одобренных правок редактора (D-21) после вкладок разделов"
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "26-11 — предыдущий план волны"
provides:
  - "lib/card-toggle-name.ts: cardToggleName(open, label, title) — имя кнопки раскрытия карточки, содержащее видимый «{метка} {название}»"
  - "lib/ui-contrast.test.ts: контраст текста ≥4.5:1 на --bg/--panel для 4 пресетов и 11 «Своих» акцентов (D-20), охрана палитры пресетов"
  - "lib/format-launch.test.ts: вставка PORTIA-26-13 (applyCardToggleNameHunk) с отрицательной проверкой"
affects: [26-14, 27]

plan_head_before: 9e3aadada3281f33832ecf9e9d33b3b35bd0eacb
plan_head_after: bd422e9c768b4a140487c00fce887fd8dc665c40

actuals:
  tokens: 8300
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "доступное имя строится чистой функцией в lib/, русские строки живут там же; редактор только вызывает её (D-21, D-58)"
    - "тест контраста разбирает цвета и поверхности прямо из app/portia.css (формы oklch(L calc(C * var(--accent-chroma)) var(--accent-hue)), var(--teal), var(--teal-dim)) и считает их под каждым акцентом"

key-files:
  created:
    - lib/card-toggle-name.ts
    - lib/card-toggle-name.test.ts
    - lib/ui-contrast.test.ts
  modified:
    - components/portia-editor.tsx
    - lib/format-launch.test.ts
    - app/portia.css
    - tests/e2e/specs/editor-ui-contract.spec.ts

key-decisions:
  - "Имя кнопки раскрытия: «Развернуть/Свернуть раздел «{метка} {название}»», без названия — «{метка} Без названия»; начало «Развернуть раздел» сохранено для editor-journeys.spec.ts"
  - "Импорт cardToggleName встал сразу после импорта portia-editor-dossier: этот якорь одинаков во всех сочетаниях реестра, которые проверяет отрицательный тест (якорь по импорту tab-shell ломался в сочетаниях без 26-06b/26-07)"
  - ".eyebrow — var(--teal); подсказка и small — .658 (подсказка 11px); палитра пресетов, включая red, не менялась; минимум после правки — 4.58:1 (.eyebrow на --panel, пресет red)"
  - "Допуски axe сняты целиком: knownBeforeD62 = {}, knownBeforeD63 = { ...knownBeforeD62 }; механизм «узел за узлом» остаётся"

patterns-established:
  - "контракт контраста — исполняемый тест по CSS, а не измерение в браузере; PORTIA_CONTRAST_REPORT=1 печатает таблицу и на вердикт не влияет"

requirements-completed: [UI-10]

coverage:
  - id: D1
    description: "Трассер: имя .nested-editor-toggle содержит видимый текст в том же порядке; нынешнее правило воспроизводит несовпадение"
    requirement: UI-10
    verification:
      - kind: unit
        ref: "lib/card-toggle-name.test.ts#26-13 UI-10: the old rule loses the visible label «РАЗДЕЛ 01», the new name holds «РАЗДЕЛ 01 Вирусы»"
        status: pass
      - kind: unit
        ref: "lib/card-toggle-name.test.ts#26-13 UI-10: a card without a title (or with a blank one) is named «{label} Без названия», never empty"
        status: pass
      - kind: unit
        ref: "lib/card-toggle-name.test.ts#26-13 UI-10: CollapsibleCard names its toggle with cardToggleName and keeps a space between the label and the title"
        status: pass
    human_judgment: false
  - id: D2
    description: "Правка CollapsibleCard — побайтная вставка PORTIA-26-13; без неё файл отличается; повторно не применяется; набор русских строк равен образцу"
    requirement: UI-10
    verification:
      - kind: unit
        ref: "lib/format-launch.test.ts#D-64: the guard notices any other edit, a missing hunk, a changed text and an unreadable sample"
        status: pass
      - kind: unit
        ref: "lib/format-launch.test.ts#D-58: the set of Russian texts of the editor file equals the sample's after the approved edits"
        status: pass
    human_judgment: false
  - id: D3
    description: "Контраст ≥4.5:1 на --bg/--panel: --teal, .eyebrow, подсказка, small, .918, .658 для teal/ice/amber/red и 11 «Своих» акцентов; палитра пресетов не менялась"
    requirement: UI-10
    verification:
      - kind: unit
        ref: "lib/ui-contrast.test.ts#UI-10 D-20: every text under contract has at least 4.5:1 on --bg and --panel for every preset and custom accent"
        status: pass
      - kind: unit
        ref: "lib/ui-contrast.test.ts#UI-10 D-20: the preset palette is unchanged (contrast is never bought by a preset colour)"
        status: pass
      - kind: unit
        ref: "lib/ui-contrast.test.ts#UI-10: .eyebrow is --teal text, the hint is 11px; no .559/.525 text in the three fixed rules or in the families"
        status: pass
    human_judgment: false
  - id: D4
    description: "Линия axe (editor-ui-contract.spec.ts) после снятия допусков"
    requirement: UI-10
    verification: []
    human_judgment: true
    rationale: "Не запускалась — BLOCKED (ENV)/(DATA): нет preflight-окружения и источника данных. Не засчитано как пройденное (.planning/WINDOWS.md, запись 15, unrun-verify)"
  - id: D5
    description: "A11Y-SR-01: имя кнопки раскрытия читается скринридером"
    requirement: UI-10
    verification: []
    human_judgment: true
    rationale: "BLOCKED (DEVICE): нет устройства со скринридером. Не засчитано как пройденное (.planning/WINDOWS.md, запись 16, unrun-verify)"

duration: 7 min
completed: 2026-11-16
---

# Phase 26 Plan 13: Находки axe и контраст на всех акцентах Summary

**Кнопка раскрытия карточки редактора теперь называется так же, как написана («Развернуть раздел «РАЗДЕЛ 01 Вирусы»»), через чистую функцию `cardToggleName` и побайтную вставку `PORTIA-26-13`; `.eyebrow` стал текстом `var(--teal)`, подсказки и подписи `small` — `.658` (подсказка 11px); новый тест `lib/ui-contrast.test.ts` держит контраст ≥4.5:1 на `--bg`/`--panel` для 4 пресетов и 11 «Своих» акцентов, палитра пресетов не тронута.**

## Performance

- **Duration:** ~7 мин
- **Started:** 2026-11-16T16:53:34Z
- **Completed:** 2026-11-16T17:01Z
- **Tasks:** 2
- **Files modified:** 7 (3 новых)

## Accomplishments

- `lib/card-toggle-name.ts`: `cardToggleName(open, label, title?)` с комментарием «UI-10, WCAG 2.5.3: имя содержит видимый текст в том же порядке»; строки «Развернуть», «Свернуть», «раздел», «Без названия» лежат здесь. Название обрезается по краям, пустое или из пробелов становится «Без названия».
- `components/portia-editor.tsx` (`CollapsibleCard`): импорт функции, `aria-label={cardToggleName(open, label, title)}`, удалён `const name = title || label;`, между `</strong>` и названием `{" "}`. Шеврон `aria-hidden`, `aria-expanded`/`aria-controls` не тронуты.
- `lib/format-launch.test.ts`: `applyCardToggleNameHunk` (id `PORTIA-26-13`) — три побайтные замены; пункт 11 в шапке реестра; отрицательные проверки «без вставки — отличие» и «дважды не применяется». `SAMPLE_COMMIT` не перебазирован.
- `app/portia.css`: `.eyebrow` `var(--teal-dim)` → `var(--teal)`; `.formatted-text-field-hint` `.525`/10px → `oklch(.658 calc(.026 * var(--accent-chroma)) var(--accent-hue))`/11px; `.editor-record-list small` `.559` → тот же `.658`. Блоки пресетов и блок ui-unify не менялись.
- `lib/ui-contrast.test.ts`: 6 текстов × 2 поверхности × 15 акцентов = 180 пар; цвета читаются из CSS; охрана `.eyebrow`, 11px, отсутствия `.559`/`.525` в трёх правилах и во всех правилах, чьи селекторы входят в семейства ui-unify; закреплена палитра пресетов и поверхности `--bg`/`--panel`.
- `tests/e2e/specs/editor-ui-contract.spec.ts`: `knownBeforeD62 = {}` (сняты `label-content-name-mismatch` и `eyebrow`), `knownBeforeD63 = { ...knownBeforeD62 }` (сняты подсказка и `<small title=`). Логика фильтра «узел за узлом» не менялась. Спека не запускалась.

## Task Commits

1. **Task 1 RED: тест имени и запись реестра** — `5a7583e` (test)
2. **Task 1 GREEN: трассер — имя кнопки раскрытия, вставка, допуск axe снят** — `14e9160` (feat)
3. **Task 2 RED: тест контраста на всех акцентах** — `51fc08d` (test)
4. **Task 2 GREEN: цвета `.eyebrow`, подсказки, `small`; допуски axe сняты** — `bd422e9` (feat)

## Files Created/Modified

- `lib/card-toggle-name.ts` — новая чистая функция имени.
- `lib/card-toggle-name.test.ts` — воспроизведение находки, точные имена, «Без названия», source-контракт `CollapsibleCard`.
- `lib/ui-contrast.test.ts` — контракт контраста D-20.
- `components/portia-editor.tsx` — `CollapsibleCard` (вставка `PORTIA-26-13`).
- `lib/format-launch.test.ts` — вставка в реестр D-64.
- `app/portia.css` — три цвета, размер подсказки.
- `tests/e2e/specs/editor-ui-contract.spec.ts` — допуски axe.

## TDD

План типа `execute`, обе задачи `tdd="true"`; RED и GREEN отдельными коммитами.

- **Task 1 RED** (`5a7583e`): чтобы тест падал на утверждении, а не на импорте, в RED-коммит вошёл `lib/card-toggle-name.ts` с нынешним правилом `title || label`, вынесенным без изменений. Целевой тест «26-13 UI-10: the old rule loses the visible label…» упал на утверждении «the name holds the visible text in the same order» (`false !== true`); воспроизведение старого правила внутри него прошло. Классификатор: `RED_EVIDENCE_OK` (target_test_failed, 5 тестов, 5 fail). Семантическая оценка: цель выполнилась и упала на запланированной проверке имени. В том же коммите D-64/D-58 в `format-launch.test.ts` упали: реестр уже ждал вставку, редактор ещё не был правлен.
- **Task 1 GREEN** (`14e9160`): verify задачи (card-toggle-name, format-launch, editor-tab-layout, portia-desktop, phase20-hints-inventory) — 137/0, строки «may differ from the sample only by the approved edits» нет; tsc без ошибок; ESLint 0 ошибок (3 старых предупреждения `<img>` в редакторе).
- **Tracer gate:** авто-режим выключен, `human_verify_mode` — end-of-phase, `<verify>` трассера только автоматический; повторный прогон — 0 fail; расширение продолжено.
- **Task 2 RED** (`51fc08d`): целевой тест «UI-10 D-20: every text under contract has at least 4.5:1…» упал списком пар ниже порога (например `.eyebrow on --panel, red: 2.73:1`, `.formatted-text-field-hint on --panel, teal: 3.39:1`); охранный тест упал на `.eyebrow` = `var(--teal-dim)`. `RED_EVIDENCE_OK` (4 теста, 2 fail). Тесты чтения CSS и палитры пресетов были зелёными сразу — это охрана текущего состояния.
- **Task 2 GREEN** (`bd422e9`): verify задачи (ui-contrast, accent-theme, ui-unify, style-tokens) — 86/0; `lib/accent-theme.test.ts` без правок зелёный.

## Decisions Made

См. `key-decisions` во frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Якорь импорта во вставке PORTIA-26-13**
- **Found during:** Task 1 (RED)
- **Issue:** вставка сначала ставила импорт после строки `import { EditorActionBar, EditorEmptyDetail, EditorTabBody } … tab-shell`. Отрицательный тест D-64 собирает образец без части правок 26-06b/26-07, и там эта строка другая — `replaceOnce` падал с «exactly one approved anchor».
- **Fix:** якорь — строка импорта `portia-editor-dossier` (одинакова во всех сочетаниях); в редакторе импорт `cardToggleName` стоит сразу после неё, перед импортом tab-shell.
- **Files modified:** lib/format-launch.test.ts, components/portia-editor.tsx
- **Commit:** 5a7583e, 14e9160

**2. [Уточнение] RED Task 1 с функцией-образцом в `lib/card-toggle-name.ts`**
- План описывает функцию-образец нынешнего правила внутри теста. Она там есть (`legacyName`). Но если бы `lib/card-toggle-name.ts` не существовал, RED упал бы на импорте, а это по правилам TDD не RED. Поэтому в RED-коммит вошёл файл с нынешним правилом без изменений; GREEN заменил его правильной функцией.

**Total deviations:** 1 auto-fixed (Rule 3) и 1 уточнение порядка RED. **Impact:** на объём не влияет; все файлы из списка плана.

## Issues Encountered

- `npm test` в этой среде не работает (node-gyp); тесты запускались напрямую `node --experimental-strip-types --test …`.
- Вне контракта D-20 осталось правило `.taskbar-app.minimized` с текстом `.559`: это не семейство ui-unify и не поверхность `--bg`/`--panel` (панель задач). Не трогал; если нужно, это отдельная правка.

## Known Stubs

Нет.

## Threat Flags

Нет новых поверхностей. T-26-27: `cardToggleName` возвращает строку, React экранирует атрибут; тест проверяет, что разметка в названии остаётся текстом. T-26-28: линия axe и скринридер записаны BLOCKED, допуски сняты только для четырёх исправленных узлов.

## Verification

- `node --experimental-strip-types --test lib/*.test.ts` — 2348 тестов, 2345 pass, **0 fail**, 3 skipped (прежние opt-in live-наборы).
- Повторный и параллельный прогон `lib/ui-contrast.test.ts` — одинаковый вердикт (4/0); тест читает только файлы репозитория.
- `node node_modules/typescript/bin/tsc --noEmit` — без ошибок.
- ESLint по изменённым файлам — 0 ошибок (3 старых предупреждения `<img>` в `components/portia-editor.tsx`).
- Acceptance: `export function cardToggleName` — 1; `cardToggleName(open, label, title)` в редакторе — 1; `applyCardToggleNameHunk` — 4; `label-content-name-mismatch` в спеке — 0; `^\.eyebrow \{…color: var(--teal);` — 1; `deriveAccentTokens` в тесте контраста — 4; `formatted-text-field-hint` в спеке — 0.
- **BLOCKED (не пройдено):** линия axe `editor-ui-contract.spec.ts` — BLOCKED (ENV)/(DATA); A11Y-SR-01 (скринридер) — BLOCKED (DEVICE). Записано в `.planning/WINDOWS.md` (записи 15 и 16, unrun-verify).

## Для владельца

Что изменилось на сайте:

1. **Кнопка раскрытия карточки в редакторе.** Раньше программа чтения с экрана называла её только по названию раздела («Развернуть раздел «Вирусы»»), а на кнопке написано «РАЗДЕЛ 01 Вирусы». Теперь имя совпадает с надписью: «Развернуть раздел «РАЗДЕЛ 01 Вирусы»». Если у карточки нет названия, будет «… «РАЗДЕЛ 01 Без названия»». Между меткой и названием теперь есть пробел, так что и голосом, и при копировании они не слипаются. Внешне кнопка не изменилась.

2. **Тексты стали ярче.** Контраст считался на фоне страницы и на фоне панели. Здесь худшее значение из двух, норма 4.5:1:
   - малые заголовки над разделами (например «УПРАВЛЕНИЕ СОДЕРЖИМЫМ»; стали цвета акцента): бирюзовый 4.18 → 7.49, ледяной 5.67 → 9.66, янтарный 4.24 → 7.59, красный 2.73 → 4.58;
   - подсказки под полями (ещё и крупнее, 11px вместо 10px): бирюзовый 3.39 → 5.81, ледяной 3.38 → 5.79, янтарный 3.33 → 5.74, красный 3.31 → 5.72;
   - мелкие подписи в списках записей («База вирусов», «Корзина», «Сотрудники»): бирюзовый 3.91 → 5.81, ледяной 3.89 → 5.79, янтарный 3.85 → 5.74, красный 3.83 → 5.72.
   
   Цвета самих тем, в том числе красной, не менялись. Для «Своего» цвета проверены 11 вариантов: шесть ярких оттенков по кругу, приглушённые, серый, почти белый. Худший из них — 4.75 у чисто красного.

3. **Что не проверено.** Автоматическую проверку доступности в браузере (axe) не запускали: нет проверочного окружения и данных. Скринридер на устройстве тоже не проверяли. Оба пункта записаны как BLOCKED и пройденными не считаются. Исключения для этих четырёх мест из проверки axe убраны. Если что-то осталось, следующий прогон axe это покажет.

## Self-Check: PASSED

- Файлы: lib/card-toggle-name.ts, lib/card-toggle-name.test.ts, lib/ui-contrast.test.ts, 26-13-SUMMARY.md — на месте.
- Коммиты 5a7583e, 14e9160, 51fc08d, bd422e9 — в истории HEAD.
