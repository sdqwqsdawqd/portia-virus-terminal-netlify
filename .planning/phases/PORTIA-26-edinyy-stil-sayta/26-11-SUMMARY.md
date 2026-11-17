---
phase: PORTIA-26-edinyy-stil-sayta
plan: 11
subsystem: ui
tags: [desktop, shortcuts, tablet, placement, resize-observer, drag, keyboard, css, line-clamp]
status: complete

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "26-10 — телефонная «Информация» (шаг 5 по D-11, вторая половина — ярлыки 521–900px)"
  - phase: PORTIA-19
    provides: "clampShortcutPosition, препятствия ассистент/кнопка формата, Alt+стрелки (WCAG 2.5.7), тесты покоя ярлыка D-17"
provides:
  - "lib/shortcut-layout.ts: shortcutCell(size), shortcutDropArea(area), placeShortcuts(ids, area, cell, gap, saved?, inset = 8, reserveBottom = 56) → { positions, contentHeight }, shortcutCellMetrics"
  - "components/portia-desktop-shortcuts.tsx: useShortcutPlacement(ref, ids, iconSize, saved) (matchMedia 521–900 + ResizeObserver + useLayoutEffect), placedShortcut(placement, id), desktopShortcutOrder, проп placed у DesktopIcon"
  - "на 521–900px ярлыки двигаются мышью/пером и Alt+стрелками; позиция пишется в прежний ключ portia-desktop-shortcuts-v3"
  - "подпись ярлыка .desktop-icon-label: 2 строки, затем многоточие (только 521–900px)"
affects: [26-13, 26-14, 27]

plan_head_before: b36e0ee72ea57d560d9fc57c5588f915f8bdfd7c
plan_head_after: 1e4befc38b44dcc8184754fcf5145095af8d458f

actuals:
  tokens: 8900
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "раскладка по ширине экрана — чистая функция в lib/ + хук измерения (useSyncExternalStore(matchMedia) + ResizeObserver в useLayoutEffect), результат в CSS-переменные --shortcut-left/top"
    - "измеряемая область не зависит от собственного роста: .desktop-icons имеет естественную высоту calc(100svh - 82px), а рост контента задаёт min-height у .workspace через --shortcut-content-height"
    - "сохранённые позиции расставляются первыми и удерживаются clampShortcutPosition (уже расставленные — препятствия), остальные текут по свободным ячейкам колонками"

key-files:
  created: []
  modified:
    - lib/shortcut-layout.ts
    - lib/shortcut-layout.test.ts
    - components/portia-desktop-shortcuts.tsx
    - components/portia-desktop.tsx
    - app/portia.css
    - lib/portia-desktop.test.ts

key-decisions:
  - "Высота области для расстановки — естественная высота рабочей области (.desktop-icons: height calc(100svh - 82px)), а не высота выросшего .workspace: иначе после поворота/расширения экрана колонки оставались бы «длинными» навсегда (обратная связь роста)"
  - "Сохранённые позиции ставятся раньше автоматических: отпущенный ярлык остаётся там, где его отпустили, а остальные обтекают его по свободным ячейкам; при перетаскивании соседние ярлыки уступают место сразу"
  - "Перетаскивание и Alt+стрелки на 521–900 удерживают ярлык той же ячейкой и областью, что и расстановка (dropBounds → shortcutDropArea), поэтому следующая расстановка не сдвигает отпущенный ярлык; на ПК прежние размеры ярлыка и рабочей области"
  - "Ячейка учитывает две строки подписи: compact 80×90, обычный 94×104, крупный 110×119 (рамка 2 + отступы + знак + зазор 6 + 2 × размер шрифта × 1.25); тест сверяет числа с CSS"
  - "Порядок колонок — порядок defaultShortcutLayout (Поиск, База вирусов, Трансляции, Информация, Сотрудники, Настройки, Справочник, Повышение, Устав, Лист, Корзина); «Корзина» на этой ширине идёт последней в колонках, а не в правом верхнем углу"
  - "Подпись с многоточием (.desktop-icon-label, -webkit-line-clamp: 2) действует только на 521–900px — подписи ПК не тронуты"
  - "При открытом окне (mobile-app-open) рабочая область держит естественную высоту — рост по ярлыкам не добавляет пустой прокрутки под окном"

patterns-established:
  - "useLayoutEffect для расстановки по измерению: первый кадр на новой ширине уже с расставленными ярлыками, без мигания ПК-раскладки"

requirements-completed: [UI-09]

coverage:
  - id: D1
    description: "Трассер: placeShortcuts на 521×600, 600×700, 768×900, 900×600, 521×400 × compact/default/large — нет пересечений, каждый ярлык в [8, ширина − 8], верх ≥ 8, низ ≤ contentHeight − 56; колонки сверху вниз; при нехватке ширины растёт contentHeight; аргументы не мутируются"
    requirement: UI-09
    verification:
      - kind: unit
        ref: "lib/shortcut-layout.test.ts#UI-09 placeShortcuts: at 521/600/768/900px and every icon size no shortcut overlaps another, a side, the top or the taskbar reserve"
        status: pass
      - kind: unit
        ref: "lib/shortcut-layout.test.ts#UI-09 placeShortcuts: columns fill from the top-left corner downwards, the next column starts when one is full"
        status: pass
      - kind: unit
        ref: "lib/shortcut-layout.test.ts#UI-09 placeShortcuts: when the width runs out the content grows downwards instead of cutting a shortcut off"
        status: pass
      - kind: unit
        ref: "lib/shortcut-layout.test.ts#UI-09 placeShortcuts never mutates its arguments"
        status: pass
    human_judgment: false
  - id: D2
    description: "shortcutCell: ячейка по режиму с местом на 2 строки подписи; числа совпадают с правилом 521–900px и базовым .desktop-icon"
    requirement: UI-09
    verification:
      - kind: unit
        ref: "lib/shortcut-layout.test.ts#UI-09 shortcutCell: the cell holds the icon of each size plus two label lines"
        status: pass
      - kind: unit
        ref: "lib/shortcut-layout.test.ts#UI-09 shortcutCell numbers are the ones the 521–900px stylesheet draws"
        status: pass
    human_judgment: false
  - id: D3
    description: "Хук и подключение: useShortcutPlacement с ResizeObserver и matchMedia 521–900, ref на nav.desktop-icons, placed у 11 ярлыков, --shortcut-content-height на .workspace; ключ хранения не тронут"
    requirement: UI-09
    verification:
      - kind: unit
        ref: "lib/portia-desktop.test.ts#UI-09 tracer: useShortcutPlacement measures .desktop-icons with a ResizeObserver at 521–900px and places through placeShortcuts"
        status: pass
    human_judgment: false
  - id: D4
    description: "CSS 521–900: нет right/bottom-якорей ПК и overflow у .workspace, min-height по контенту, резерв 56px, touch-action: pan-y pinch-zoom; ни одно правило html/body не блокирует прокрутку; ≤520px inset: auto !important без изменений"
    requirement: UI-09
    verification:
      - kind: unit
        ref: "lib/portia-desktop.test.ts#UI-09: the 521–900px rule no longer pins shortcuts by right/bottom, does not clip the workspace and lets a finger scroll from a shortcut"
        status: pass
      - kind: unit
        ref: "lib/portia-desktop.test.ts#UI-09: no stylesheet rule puts overflow: hidden or touch-action on html/body, and no script locks the page scroll"
        status: pass
    human_judgment: false
  - id: D5
    description: "Перетаскивание и Alt+стрелки на 521–900 (порог 520px), удержание той же ячейкой и областью, отпущенный ярлык не сдвигается следующей расстановкой, сохранённая позиция вне области возвращается внутрь"
    requirement: UI-09
    verification:
      - kind: unit
        ref: "lib/portia-desktop.test.ts#UI-09: at 521–900px drag and Alt+Arrow work again; only the ≤520px grid stays without free drag"
        status: pass
      - kind: unit
        ref: "lib/shortcut-layout.test.ts#UI-09: a drop at 521–900px lands where placeShortcuts keeps it — the next placement does not move the released shortcut"
        status: pass
      - kind: unit
        ref: "lib/shortcut-layout.test.ts#UI-09 placeShortcuts: a saved position outside the area is held inside and off the shortcuts already placed"
        status: pass
      - kind: unit
        ref: "lib/shortcut-layout.test.ts#DraggableDesktopIcon starts the cycle first, gates free drag at 520px (UI-09), clamps through the pure function and opens immediately"
        status: pass
    human_judgment: false
  - id: D6
    description: "Подпись ярлыка на 521–900: перенос в ширине иконки, 2 строки, многоточие"
    requirement: UI-09
    verification:
      - kind: unit
        ref: "lib/portia-desktop.test.ts#UI-09: at 521–900px a shortcut label wraps inside the icon width, two lines at most, then an ellipsis"
        status: pass
    human_judgment: false
  - id: D7
    description: "Вид и поведение в браузере и на устройстве: подписи целиком на 521/600/768/900px × три размера, перетаскивание пальцем/мышью, прокрутка страницы с ярлыка"
    requirement: UI-09
    verification: []
    human_judgment: true
    rationale: "Расчёт проверен юнит-тестом функции; рендер в браузере не запускался — BLOCKED (ENV), физический планшет/телефон — BLOCKED (DEVICE) до Phase 27. Не засчитано как пройденное (записано в .planning/WINDOWS.md как unrun-verify)"

duration: 9 min
completed: 2026-11-16
---

# Phase 26 Plan 11: Ярлыки на 521–900px — одно правило расстановки с JS, перетаскивание и подпись в 2 строки Summary

**На ширине 521–900px ярлыки больше не прибиты к ПК-координатам внутри обрезанной рабочей области: их расставляет чистая функция `placeShortcuts` колонками сверху вниз с учётом размера ярлыка и двух строк подписи, рабочая область растёт и прокручивается страницей, ярлыки снова двигаются мышью и Alt+стрелками, а длинная подпись переносится в 2 строки с многоточием.**

## Performance

- **Duration:** ~9 мин
- **Started:** 2026-11-16T12:46:14Z
- **Completed:** 2026-11-16T12:55:19Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `lib/shortcut-layout.ts`: `shortcutCellMetrics` (ширина, min-height, отступ по вертикали, знак, шрифт для compact/default/large — те же числа, что в CSS), `shortcutCell(size)` («standard» из настроек = default), `shortcutDropArea(area)` (область без резерва таскбара), `placeShortcuts(...)`: сохранённые позиции — первыми через `clampShortcutPosition` с уже занятыми прямоугольниками; остальные — по свободным ячейкам колонка за колонкой от (8, 8) с шагом ячейка + 8px; если ячеек не хватает — колонки удлиняются и `contentHeight` растёт; `contentHeight ≥ area.height`.
- `components/portia-desktop-shortcuts.tsx`: `useShortcutPlacement` — `useSyncExternalStore(matchMedia("(min-width: 521px) and (max-width: 900px)"))`, `useLayoutEffect` с `ResizeObserver` на `nav.desktop-icons`, пропуск измерения, когда nav скрыт открытым окном, сравнение результата, чтобы не перерисовывать без изменений; `null` на ПК и ≤520px. `placedShortcut`, `desktopShortcutOrder`, `placedShortcutLayout` (px без CSS-клэмпа). Стиль ярлыка: `placed ? placedShortcutLayout(...) : position ? savedShortcutLayout(...) : defaultShortcutLayout[...]` — ПК-ветки как были.
- Обработчики: порог раннего выхода `max-width: 520px` в `handlePointerDown` и `handleKeyDown` с комментарием «≤520px — сетка телефона без свободного перетаскивания; 521–900 — то же правило, что и ПК, с расстановкой JS»; `dropBounds` — на 521–900 ячейка и `shortcutDropArea` расстановки, на ПК прежние `offsetWidth/Height` и `clientWidth/Height`; препятствия (ассистент, кнопка формата) и объявление «Ярлык «…» перемещён» — без изменений.
- `components/portia-desktop.tsx`: `desktopIconsRef` на `<nav className="desktop-icons">`, вызов хука с `desktopSettings.iconSize` и `shortcutPositions`, `placed={placedShortcut(shortcutPlacement, "…")}` у всех 11 ярлыков, `--shortcut-content-height` на `.workspace`. Ключ `portia-desktop-shortcuts-v3`, загрузка и сохранение — без изменений.
- `app/portia.css`, правило `@media (min-width: 521px) and (max-width: 900px)`: `.workspace` — `min-height: max(calc(100svh - 82px), var(--shortcut-content-height, 0px)); padding: 0 0 56px` (без `overflow: hidden`), при открытом окне — естественная высота; `.desktop-icons` — `inset: 0 0 auto; height: calc(100svh - 82px)`; `.desktop-icon` — `left/top` из переменных, `right: auto; bottom: auto`, `touch-action: pan-y pinch-zoom`; размеры по режимам не тронуты; новая `.desktop-icon-label { display: -webkit-box; max-width: 100%; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }`. Подпись в разметке получила класс `desktop-icon-label`.

## Task Commits

1. **Task 1 RED: тесты правила расстановки** — `f05e7b4` (test)
2. **Task 1 GREEN: трассер — placeShortcuts, useShortcutPlacement, CSS 521–900** — `abea84e` (feat)
3. **Task 2 RED: тесты перетаскивания, Alt+стрелок и подписи** — `886d593` (test)
4. **Task 2 GREEN: порог 520px, dropBounds, подпись в 2 строки** — `1e4befc` (feat)

## Files Created/Modified

- `lib/shortcut-layout.ts` — ячейка, область сброса и правило расстановки.
- `lib/shortcut-layout.test.ts` — 8 новых тестов UI-09; старый тест обработчиков переведён с порога 900px на 520px.
- `components/portia-desktop-shortcuts.tsx` — хук, `placed`, `dropBounds`, порог 520px, класс подписи.
- `components/portia-desktop.tsx` — ref, хук, `placed` у ярлыков, переменная высоты на `.workspace`.
- `app/portia.css` — правило 521–900px и подпись.
- `lib/portia-desktop.test.ts` — 5 source-тестов UI-09.

## TDD

План типа `execute`, у обеих задач `tdd="true"`; RED и GREEN — отдельными коммитами.

- **Task 1 RED** (`f05e7b4`): 6 из 16 в `lib/shortcut-layout.test.ts` (целевой «…no shortcut overlaps…» падает на утверждении «lib/shortcut-layout.ts exports placeShortcuts»; тесты вызывают функции через namespace-импорт, поэтому это провал утверждения, а не ошибка загрузки), 2 из 81 в `lib/portia-desktop.test.ts` (нет хука, правило 521–900 с `overflow: hidden`). Классификатор: `RED_EVIDENCE_OK` (target_test_failed) для обоих файлов. Семантическая оценка: цель выполнилась и упала на запланированном утверждении. Тест сверки чисел CSS и тест «html/body не блокируют прокрутку» были зелёными сразу — это охранные тесты текущего состояния, не RED-цели.
- **Task 1 GREEN** (`abea84e`): verify (shortcut-layout + portia-desktop + ui-unify) 136/0, tsc без ошибок.
- **Tracer gate:** авто-режим выключен, `human_verify_mode` — end-of-phase, `<verify>` трассера только автоматический; повторный прогон после коммита — 0 fail; расширение продолжено.
- **Task 2 RED** (`886d593`): 3 падения — целевой «drag and Alt+Arrow work again» (утверждение «handlePointerDown gates at 520px»), подпись, переведённый старый тест обработчиков; `RED_EVIDENCE_OK`. Юнит стабильности сброса был зелёным сразу: правило «сохранённые — первыми» из Task 1 уже давало это поведение; тест закрепляет его.
- **Task 2 GREEN** (`1e4befc`): verify 106/0, полный набор 2332 pass / 0 fail.

## Decisions Made

См. `key-decisions` во frontmatter. Главное: измеряемая высота не растёт вместе с контентом (нет залипания длинных колонок после поворота), сохранённые позиции главнее автоматических, сброс и расстановка используют одну и ту же ячейку и область.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Обратная связь «измерение → рост → измерение»**
- **Found during:** Task 1
- **Issue:** если мерить `.desktop-icons` при `inset: 0`, а `min-height` ставить на `.workspace`, то выросшая область становится новой «высотой экрана» и колонки после расширения/поворота уже не укорачиваются.
- **Fix:** `.desktop-icons` на 521–900 получает естественную высоту `calc(100svh - 82px)` (`inset: 0 0 auto`), рост идёт только через `--shortcut-content-height` на `.workspace`.
- **Files modified:** app/portia.css
- **Commit:** abea84e

**2. [Rule 1 - Bug] Пустая прокрутка под открытым окном**
- **Found during:** Task 1
- **Issue:** при открытом окне на 521–900 ярлыки скрыты, но рабочая область держала бы высоту по ярлыкам.
- **Fix:** `.workspace.mobile-app-open { min-height: calc(100svh - 82px); }` в правиле 521–900.
- **Files modified:** app/portia.css
- **Commit:** abea84e

**3. [Rule 1 - Bug] Сброс и расстановка мерили ярлык по-разному**
- **Found during:** Task 2
- **Issue:** перетаскивание удерживало ярлык по его фактической высоте и по всей высоте `.workspace` (включая резерв 56px), а расстановка — по ячейке с местом на 2 строки и без резерва; отпущенный ярлык мог «подпрыгнуть» на следующей расстановке.
- **Fix:** `dropBounds` — на 521–900 `placed.cell` и `shortcutDropArea(placed.area)`; тест стабильности.
- **Files modified:** components/portia-desktop-shortcuts.tsx, lib/shortcut-layout.ts
- **Commit:** abea84e, 1e4befc

### Отличия от буквы плана

- Хук возвращает `{ positions, contentHeight, area, cell } | null` (план: `{ positions, contentHeight } | null`) — область и ячейка нужны обработчикам сброса.
- Добавлены `shortcutDropArea`, `shortcutCellMetrics`, `placedShortcut`, `desktopShortcutOrder` — вспомогательные экспорты к трём артефактам плана.
- Проверка «у правила 521–900 нет `overflow: hidden`» из Task 1 сужена в Task 2 до правил `.workspace`: многоточию подписи `overflow: hidden` нужен, и он стоит на подписи, а не на рабочей области.
- Подпись получила класс `desktop-icon-label` (вместо селектора по позиции span).

**Total deviations:** 3 auto-fixed (3 × Rule 1). **Impact:** без расширения объёма; всё внутри файлов плана.

## Issues Encountered

- `npm test` в этой среде не работает (node-gyp), тесты запускались напрямую `node --experimental-strip-types --test lib/*.test.ts`.
- Автоматическая расстановка не обходит ассистента и кнопку формата (они `position: fixed`); на очень низком альбомном экране крайняя правая колонка может оказаться под ассистентом. Так было и раньше; при сбросе ярлыка препятствия по-прежнему учитываются.

## Known Stubs

Нет.

## Threat Flags

Нет новых поверхностей. T-26-23: любая сохранённая позиция проходит `clampShortcutPosition` внутри области (юнит «saved position outside the area»), нечисловые значения по-прежнему отбрасывает разбор при загрузке, ключ и формат не менялись. T-26-24: `overflow: hidden` снят, `contentHeight` даёт прокрутку, юнит исключает обрезку и наложения на четырёх ширинах × трёх размерах.

## Verification

- `node --experimental-strip-types --test lib/*.test.ts` — 2335 тестов, 2332 pass, 0 fail.
- `node node_modules/typescript/bin/tsc --noEmit` — без ошибок.
- ESLint изменённых файлов — 0 ошибок (6 прежних предупреждений в portia-desktop.tsx: `LoadingState` и `no-img-element`).
- Acceptance: `export function placeShortcuts` — 1; `useShortcutPlacement` в portia-desktop.tsx — 2; `ResizeObserver` в shortcuts — 2; `max-width: 520px` в shortcuts — 2; `-webkit-line-clamp: 2` в CSS — 4.
- Тесты покоя ярлыка (D-17) и анимации — зелёные без изменений.
- **BLOCKED (не пройдено):** рендер в браузере на 521/600/768/900px, перетаскивание пальцем, прокрутка с ярлыка, подписи на устройстве — BLOCKED (ENV)/(DEVICE) до Phase 27; записано в `.planning/WINDOWS.md` (unrun-verify).

## Для владельца

Экран «Рабочий стол» на ширине 521–900px (планшет, узкое окно браузера). ПК (от 901px) и телефон (до 520px) не менялись.

- Раньше ярлыки на этой ширине стояли по координатам ПК, а рабочая область обрезалась: нижние ярлыки («Устав», «Лист») могли уйти под край, крупные подписи наезжали, двигать ярлыки было нельзя.
- Теперь ярлыки встают колонками от левого верхнего угла: первая колонка сверху вниз — Поиск, База вирусов, Трансляции, Информация, Сотрудники…; когда колонка доходит до низа (над таскбаром остаётся 56px), начинается следующая. «Корзина» идёт последней в колонках, а не в правом верхнем углу, как на ПК.
- Место под ярлык учитывает выбранный размер (компактный, стандартный, крупный) и две строки подписи, поэтому ярлыки и подписи не налезают друг на друга и на таскбар.
- Если ширины не хватает (узкий и низкий экран, крупные ярлыки), рабочий стол становится длиннее и прокручивается обычной прокруткой страницы. Прокрутку можно начинать пальцем прямо с ярлыка.
- Ярлыки снова можно перетаскивать мышью или пером и двигать Alt+стрелками. Пальцем перетаскивание начинается горизонтальным движением (вертикальное — прокрутка). Перемещённый ярлык остаётся там, где его отпустили, остальные уступают ему место. Позиция сохраняется туда же, где и на ПК, — перенесённый на планшете ярлык будет на этом месте и на ПК (с прежним удержанием в пределах экрана).
- Длинная подпись переносится в пределах ширины ярлыка, максимум 2 строки, дальше многоточие.

Проверить вид на настоящем планшете/телефоне и в браузере пока нельзя (нет устройства и проверочного окружения) — это отложено до фазы 27 и не засчитано как пройденное.

## Self-Check: PASSED

- Файлы: lib/shortcut-layout.ts, lib/shortcut-layout.test.ts, components/portia-desktop-shortcuts.tsx, components/portia-desktop.tsx, app/portia.css, lib/portia-desktop.test.ts, 26-11-SUMMARY.md — на месте.
- Коммиты f05e7b4, abea84e, 886d593, 1e4befc — в истории HEAD.
