---
phase: PORTIA-26-edinyy-stil-sayta
plan: 19
subsystem: ui
tags: [editor, level-picker, promotion-editor, sticky-bar, layout, uat-gap-closure]
status: complete
gap_closure: true

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "UAT 2026-11-16 (26-UAT.md gaps 6, 7), 26-18"
provides:
  - "LevelPicker: в закрытом виде одна маленькая кнопка «Видят все» / «Видят с допуска N» / «Видят только допуск 5»; пластины 1-5 (32px на ПК, 44px на телефоне) раскрываются в той же строке"
  - "levelCopy.pickerSummary: текст сводки «кому виден раздел»"
  - "Панель .etab-bar не сжимается в колоночном flex «Повышения»; редактор «Повышения» прокручивается при нехватке высоты"
affects: [PORTIA-26 gap-closure 26-20, PORTIA-27]

actuals:
  tokens: 4600
  tasks: 2
  commits: 4
plan_head_before: cd622a58f5d6d0a2288289320015d4cff67d67c3
plan_head_after: c7be5d11b5fd30a7c08d7b6196071fe97db94d73

tech-stack:
  added: []
  patterns:
    - "Сводка выбора строится из того же effective value (shown = max(requiredLevelOf(value), min)), что и отмеченная пластина"
    - "Обработчик ухода фокуса вынесен в функцию, чтобы открывающий тег fieldset остался однострочным (проверки WR-02 и D-16 читают его построчно)"

key-files:
  created: []
  modified:
    - lib/level-copy.ts
    - components/portia-level-picker.tsx
    - app/portia.css
    - lib/level-editor.test.ts
    - lib/editor-tab-layout.test.ts
    - tests/e2e/specs/access-levels.spec.ts

key-decisions:
  - "Gap 6: решения Phase 24 сохранены (один fieldset, legend первым, нативные радио, нет своего обработчика клавиш и tabIndex, единственный role=status — notice); подсказка «Не ниже раздела: N» остаётся вне скрытого блока и видна в закрытом виде."
  - "Gap 7: причина — flex-shrink в колоночном flex; .etab-bar { flex-shrink: 0 } и flex: none у прямых детей .promotion-editor (панель, сообщения, конфликт, панель инструментов, раскрывашка очистки); рабочее место flex: 1 1 0 не тронуто."

requirements-completed: [UI-03, UI-04]

duration: 25 min
completed: 2026-11-17
---

# Phase PORTIA-26 Plan 19: Компактный выбор допуска и панель «Повышения» Summary

Выбор уровня допуска стал маленькой кнопкой-сводкой «Видят с допуска N» с раскрываемыми пластинами 1-5 (32px), а липкая панель редактора «Повышения» больше не сжимается до 48px и не накладывается на фильтры и кнопку сброса привязки.

## Для владельца (текстом, без галерей)

- **Уровень допуска.** Вместо ряда крупных пластин 1-5 — одна маленькая кнопка по ширине надписи: «Видят все» (уровень 1), «Видят с допуска 3» (2-4) или «Видят только допуск 5». Нажатие показывает пластины 1-5 в той же строке (на ПК 32x32, на телефоне 44x44); выбор мышью или касанием закрывает их, выбор стрелками не закрывает; уход фокуса из группы тоже закрывает. Если раздел требует минимум, подсказка «Не ниже раздела: N» видна и при закрытых пластинах, а пластины ниже минимума недоступны. Поле занимает одну ячейку сетки формы, а не всю строку. Это один общий компонент, поэтому правка действует во всех формах редактора.
- **Повышение (редактор).** Строка «ЧЕРНОВИК · Есть несохранённые изменения» с ↶ / ОТМЕНИТЬ / СОХРАНИТЬ теперь отдельная строка панели и сдвигает вниз фильтры «ОБЫЧНОЕ ПОВЫШЕНИЕ / КВАЛИФИКАЦИЯ», поле «Точный ник для отзыва привязки» и «СБРОСИТЬ ПРИВЯЗКУ ПО НИКУ»; ничего не перекрывается. Если окна не хватает, редактор «Повышения» прокручивается, липкая панель остаётся сверху.
- Вид в браузере (кнопка, пластины, раскладка «Повышения») не снимался: BLOCKED (ENV). E2E-спека `access-levels.spec.ts` обновлена (перед замером пластины нажимается кнопка группы), но не запускалась: линия BLOCKED (ENV)/(DATA). Это не PASS.

## Accomplishments

- Task 1 (трассер, gap 6): тест «UAT 2026-11-16 gap 6» (RED) -> `levelCopy.pickerSummary` -> `LevelPicker` (состояние `open`, `button.access-level-toggle` с `aria-expanded`/`aria-controls`, `hidden` у пластин, закрытие по указателю и по уходу фокуса) -> CSS блока `access-levels` -> e2e-спека без мёртвых локаторов. Трассер проверен насквозь (весь `lib/*.test.ts` зелёный), расширение разрешено.
- Task 2 (gap 7): тест «UAT 2026-11-16 gap 7» (RED, `flex-shrink` не объявлен) -> `.etab-bar { flex-shrink: 0 }`, `flex: none` у прямых детей `.promotion-editor`, `.promotion-editor { overflow-y: auto }`.

## Task Commits

1. Task 1 RED `8b8ba5c` — `test(26-19)`: тест gap 6 и перенацеленные пластины 32px; 2 падения.
2. Task 1 GREEN `b2778f6` — `feat(26-19)`: сводка, кнопка, CSS, e2e-спека; 105/105 в целевом наборе.
3. Task 2 RED `b950397` — `test(26-19)`: `undefined !== '0'` на `flex-shrink` у `.etab-bar`.
4. Task 2 GREEN `c7be5d1` — `feat(26-19)`: CSS панели «Повышения»; полный набор зелёный.

Классификатор `gsd_run check tdd-red-evidence` не запускался (проектный guard блокирует шим); RED проверен по реальному выводу TAP: тесты выполнились и упали на целевых утверждениях.

## Verification

- `node --experimental-strip-types --test lib/*.test.ts` (Node по умолчанию на PATH): `# tests 2378 # pass 2375 # fail 0 # skipped 3` (3 пропущенных были и до плана).
- `node node_modules/typescript/bin/tsc --noEmit`: без ошибок. ESLint по репозиторию: 0 ошибок, 17 предупреждений в прежних файлах.
- Acceptance Task 1: `pickerSummary` в `lib/level-copy.ts` — 1; `levelCopy.pickerSummary(shown)` в компоненте — 1; `access-level-toggle` в e2e-спеке — 1; `UAT 2026-11-16 gap 6` в `lib/level-editor.test.ts` — 2.
- Acceptance Task 2: `UAT 2026-11-16 gap 7` в `lib/editor-tab-layout.test.ts` — 1; `flex-shrink: 0` у `.etab-bar` объявлен; тесты WR-01 и «sticky and floating editor layers» зелёные.
- Владельческие пути из CLAUDE.md не менялись и не стейджились; стейдж только по явным путям (`.planning/state.json` и `.planning/milestone.lock` были изменены до плана).
- Раскладка в браузере и e2e-линия: BLOCKED (ENV)/(DATA), не PASS.

## Deviations from Plan

None - plan executed exactly as written. (Мелкая подгонка без смены намерения: открывающий тег `fieldset` оставлен однострочным, а `onBlur` вынесен в функцию `closeOnLeave`, потому что тесты WR-02/D-16 читают тег построчно; в CSS свойства `.access-level-toggle` расположены в порядке, который проверяет новый тест.)

## Known Stubs

None.

## Deferred Issues

None. Замечание: `app/portia-promotion-editor.css` уже задаёт `.promotion-editor { overflow-y: auto }`, правило в `app/portia.css` его дублирует по требованию плана и теста; реальной причиной gap 7 был `flex-shrink`.

## Threat Flags

None. T-26-41: сводка строится из `shown`, `onChange`, `disabled={level < min}` и значения радио не менялись, тест gap 6 это проверяет. T-26-42: `overflow-y: auto` вместо обрезки.

## TDD Gate Compliance

RED (`test(26-19)`) -> GREEN (`feat(26-19)`) присутствуют для обеих задач (8b8ba5c -> b2778f6, b950397 -> c7be5d1), REFACTOR не потребовался.

## Self-Check: PASSED

- FOUND: lib/level-copy.ts, components/portia-level-picker.tsx, app/portia.css, lib/level-editor.test.ts, lib/editor-tab-layout.test.ts, tests/e2e/specs/access-levels.spec.ts
- FOUND commits: 8b8ba5c, b2778f6, b950397, c7be5d1
