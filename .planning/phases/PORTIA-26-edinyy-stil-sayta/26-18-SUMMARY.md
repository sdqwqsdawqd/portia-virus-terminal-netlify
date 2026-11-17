---
phase: PORTIA-26-edinyy-stil-sayta
plan: 18
subsystem: ui
tags: [editor, section-tabs, drag-order, layout, d-21-registry, uat-gap-closure]
status: complete
gap_closure: true

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "UAT 2026-11-16 (26-UAT.md gaps 4, 5, 10), 26-07 (вкладки разделов в слоте nav), реестр D-21 в lib/format-launch.test.ts, 26-17"
provides:
  - "Вкладки разделов «Справочника» и «Информации» несут ручку перетаскивания OrderDragHandle, как подразделы; кнопки-стрелки порядка убраны"
  - "Активный раздел — в div.editor-section-single на всю ширину формы; форма «+ ДОБАВИТЬ РАЗДЕЛ» при открытии занимает целую строку панели"
  - "«ПЕРЕМЕСТИТЬ В КОРЗИНУ» — в верхней строке записи вируса (div.virus-editor-head) справа от вкладок досье"
  - "Три побайтные вставки PORTIA-26-G05, PORTIA-26-G04, PORTIA-26-G10 в реестр approvedEditorEdits с отрицательными проверками"
affects: [PORTIA-26 gap-closure 26-19, 26-20, PORTIA-27]

actuals:
  tokens: 10900
  tasks: 3
  commits: 6
plan_head_before: e2893a9387f73776515f567ac4af0852de1b4533
plan_head_after: d91d886a13d7cd058d8eefe92ef7b61536b9cdbe

tech-stack:
  added: []
  patterns:
    - "Правка защищённого components/portia-editor.tsx = побайтный replaceOnce в реестре D-21 + отрицательная проверка; фильтры старых отрицательных проверок исключают вставки G*, чьи якоря зависят от убранных вставок"
    - "Цвета ручки вкладки — вне блока ui-unify (тест UI-03: блок не задаёт color/background), геометрия — в блоке"

key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - lib/format-launch.test.ts
    - lib/editor-tab-layout.test.ts
    - app/portia.css

key-decisions:
  - "Gap 5: вкладка раздела — span.editor-section-tab[data-sort-index] прямо в nav, внутри ручка OrderDragHandle (без itemId/onMoveAcross) и прежняя кнопка вкладки; общий родитель nav даёт moveTo смену мест по passesTarget без правок OrderDragHandle."
  - "Gap 4: активный раздел в div.editor-section-single (grid-column: 1 / -1) вместо SectionColumns; --editor-card-width 340px и правило D-19 не тронуты, SectionColumns остался только у «Рекомендаций»."
  - "Открытая форма добавления: display: flex задан селектором .etab-nav .editor-section-create:not([hidden]) (а не просто .editor-section-create), иначе правило той же специфичности перебило бы .editor-section-create[hidden] и закрытая форма показалась бы."
  - "Gap 10: кнопка корзины получила margin-left: auto, чтобы на узком окне при переносе строки уходить под вкладки к правому краю, а не к левому."

requirements-completed: [UI-04, UI-06]

duration: 35 min
completed: 2026-11-17
---

# Phase PORTIA-26 Plan 18: Вкладки редактора — перетаскивание разделов, ширина раздела, кнопка корзины Summary

Вкладки разделов «Справочника» и «Информации» снова меняют порядок перетаскиванием (ручка `OrderDragHandle` у каждой вкладки), активный раздел занимает всю ширину формы вместо колонки 340px, а «ПЕРЕМЕСТИТЬ В КОРЗИНУ» стоит в верхней строке записи вируса; три правки защищённого `portia-editor.tsx` записаны в реестр D-21.

## Для владельца (текстом, без галерей)

- **Разделы (Справочник и Информация).** У каждой вкладки раздела слева ручка ≡, как у подразделов: зажать и тянуть влево/вправо по строке вкладок (вкладки меняются местами при пересечении середины соседней); с клавиатуры — стрелки вверх/вниз на ручке; одно перетаскивание — один шаг отмены. Кнопки ← → убраны. Текущий раздел по-прежнему подсвечен, прокручивается в видимую часть; пустой заголовок читается «Без названия». Ручка 24px на ПК и размер касания на телефоне.
- **Ширина раздела.** Раздел «Справочника» и «Информации» занимает всю ширину вкладки: он больше не стоит в одной колонке сетки по 340px. Подразделы и карточки внутри идут строками на всю ширину раздела. Сетки из нескольких карточек («Сводка», «Рекомендации») не менялись, ширина карточки 340px прежняя.
- **«+ ДОБАВИТЬ РАЗДЕЛ».** Открытая форма занимает целую строку панели: поле «Заголовок раздела» растёт до 640px, «Создать раздел» и «Отмена» рядом по ширине надписи; вкладки разделов при этом переносятся ниже. Закрытая форма — как раньше.
- **База вирусов.** «ПЕРЕМЕСТИТЬ В КОРЗИНУ» — справа в верхней строке записи, рядом с вкладками досье (было: внизу слева под описанием). На узком окне строка переносится, кнопка уходит под вкладки к правому краю. Подтверждение переноса прежнее.
- Пиксельный вид, перетаскивание указателем и касанием в браузере не снимались: BLOCKED (ENV), линия Playwright `editor-ui-contract` / Phase 27. Это не PASS.

## Accomplishments

- Task 1 (трасcер, gap 5): тест «UAT 2026-11-16 gap 5 …» -> `SectionTabs` с `OrderDragHandle` -> вставка PORTIA-26-G05 в реестр -> CSS ручки (общее правило вкладок задело бы и ручку, поэтому селектор `.editor-section-tabs nav .order-drag-handle` сильнее, цвета ручки — вне блока `ui-unify`) -> исходные тесты. Трассер проверен насквозь, расширение разрешено.
- Task 2 (gap 4): обёртка `.editor-section-single` у обоих списков (4 `replaceOnce`: открытие и закрытие каждого), правила открытой формы добавления в `.etab-nav`, `width: auto` у `.etab-nav .editor-section-create`; PORTIA-26-G04 в реестре.
- Task 3 (gap 10): `div.virus-editor-head` с `DossierTabs` и той же кнопкой, нижняя кнопка удалена; PORTIA-26-G10 в реестре (надпись переносится, набор русских строк D-58 тот же).

## Task Commits

1. Task 1 RED `f0d7f41` — `test(26-18)`: оба целевых теста упали на запланированных утверждениях (ручка и стрелки), RED валиден.
2. Task 1 GREEN `7bfee14` — `feat(26-18)`: `SectionTabs`, G05, CSS ручки; 181/181 в целевом наборе.
3. Task 2 RED `b650169` — `test(26-18)`: 4 падения (перенацеленные A2 guide/info, два новых теста gap 4).
4. Task 2 GREEN `15b146a` — `feat(26-18)`: `.editor-section-single`, G04, CSS; 217/217.
5. Task 3 RED `6580623` — `test(26-18)`: тест gap 10 упал (нет `virus-editor-head`).
6. Task 3 GREEN `d91d886` — `feat(26-18)`: `virus-editor-head`, G10, CSS.

Классификатор `gsd_run check tdd-red-evidence` не запускался (проектный guard блокирует вызов шима); RED проверен по реальному выводу TAP и семантически: тесты выполнились и упали по нужной причине, не по загрузке или синтаксису.

## Verification

- `node --experimental-strip-types --test lib/*.test.ts` (Node 22.13.1): `# tests 2376 # pass 2373 # fail 0 # skipped 3` (3 пропущенных были и до плана).
- `node node_modules/typescript/bin/tsc --noEmit`: без ошибок. ESLint по репозиторию: 0 ошибок (17 предупреждений в прежних файлах, не из этого плана).
- Acceptance: `PORTIA-26-G05` в `lib/format-launch.test.ts` — 5; `className="editor-section-tab"` — 1; `Переместить раздел левее` в редакторе — 0; `className="editor-section-single"` — 2 строки (Информация, Справочник); `SectionColumns items={draft.guideSections}` — 0 и `...infoSections` — 0; `PORTIA-26-G04` — 6; `--editor-card-width: 340px` в CSS — 1; `className="virus-editor-head"` — 1; `PORTIA-26-G10` — 5; `SAMPLE_COMMIT = "449c756…"` — 1 (не перебазирован).
- Владельческие пути из CLAUDE.md не менялись и не стейджились; стейдж только по явным путям (`.planning/state.json` и `.planning/milestone.lock` были изменены до плана, не затронуты).
- Перетаскивание указателем/касанием и ширина раздела на экране: BLOCKED (ENV), не PASS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Открытая форма перебила бы `hidden`**
- **Found during:** Task 2 (проектирование CSS)
- **Issue:** план просит `display: flex` у `.etab-nav .editor-section-create` (0,2,0), но `.editor-section-create[hidden] { display: none }` тоже 0,2,0 и стоит раньше: закрытая форма стала бы видимой.
- **Fix:** `display/flex-wrap/align-items/gap` заданы селектором `.etab-nav .editor-section-create:not([hidden])`; `width: auto` и `white-space: normal` остались у `.etab-nav .editor-section-create`. Тест проверяет оба селектора и то, что `[hidden]` остаётся `display: none`.
- **Files modified:** app/portia.css, lib/editor-tab-layout.test.ts
- **Commit:** 15b146a

**2. [Rule 1 - Bug] Цвета ручки вне блока ui-unify**
- **Found during:** Task 1
- **Issue:** тест UI-03 запрещает блоку `ui-unify` задавать `color`/`background`; цвета ручки во вкладке (иначе их перебило бы общее правило кнопок вкладки) нельзя было положить в блок.
- **Fix:** цвета и рамка ручки — рядом с цветами вкладок (общий раздел), геометрия — в блоке; тест D-13a читает оба правила одним селектором.
- **Commit:** 7bfee14

**3. [Rule 1 - Bug] Комментарий в CSS ломал тест D-15**
- **Found during:** Task 2
- **Issue:** тест считает вхождения `--editor-card-width:` в CSS (должно быть одно); мой комментарий содержал эту подстроку.
- **Fix:** комментарий переформулирован без подстроки.
- **Commit:** 15b146a

**Total deviations:** 3 auto-fixed (3 Rule 1). **Impact:** нет влияния на объём плана; все три — в рамках файлов плана.

## Known Stubs

None.

## Deferred Issues

- E2E-спеки `tests/e2e/specs/editor-layout.spec.ts`, `editor-ui-contract.spec.ts`, `tests/e2e/visual/phase20.spec.ts`, `tests/e2e/visual-candidates/phase20-editor-images.spec.ts` находят карточку раздела по `.editor-section-column > .nested-editor-card` / `.editor-section-columns [data-sort-index]`. Для «Информации» и «Справочника» после этого плана карточка стоит в `.editor-section-single` (часть спеков устарела уже после 26-07: в сетке только активный раздел). Вне файлов плана и линия Playwright недоступна (BLOCKED ENV): селекторы нужно обновить в Phase 27 вместе с запуском линии. Вкладка «Рекомендации» продолжает использовать `SectionColumns`.

## Threat Flags

None. Новых сетевых путей, прав или границ доверия нет. T-26-38: три вставки в реестре с отрицательными проверками, `SAMPLE_COMMIT` не менялся, D-58 зелёный. T-26-39: `dangerouslySetInnerHTML` в срезе `SectionTabs` нет, заголовок идёт пропсом. T-26-40: обработчик кнопки корзины прежний (`setDialog("recycle")`), тест проверяет его.

## Issues Encountered

- Проектный guard заблокировал составную команду с `$(…)`-подстановками и чтением ledger; разнесено на простые вызовы.
- Правки через Python в heredoc теряют вдвое обратные слэши (`\\n` -> перевод строки); строки с `\n` собраны через `chr(92)`.

## TDD Gate Compliance

RED (`test(26-18)`) -> GREEN (`feat(26-18)`) присутствуют для всех трёх задач (f0d7f41 -> 7bfee14, b650169 -> 15b146a, 6580623 -> d91d886), REFACTOR не потребовался.

## Self-Check: PASSED

- FOUND: components/portia-editor.tsx, lib/format-launch.test.ts, lib/editor-tab-layout.test.ts, app/portia.css
- FOUND commits: f0d7f41, 7bfee14, b650169, 15b146a, 6580623, d91d886
