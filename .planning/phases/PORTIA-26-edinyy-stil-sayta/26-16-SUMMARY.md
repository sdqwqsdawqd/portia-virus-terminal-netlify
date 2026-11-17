---
phase: PORTIA-26-edinyy-stil-sayta
plan: 16
subsystem: ui
tags: [css, window-frame, dialog, uat-gap-closure]
status: complete
gap_closure: true

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "UAT 2026-11-16 (26-UAT.md Gaps 2 and 9), блок ui-unify в app/portia.css"
provides:
  - "Рамка окна — неинтерактивный слой .app-window::after; крестик закрытия доходит до внешнего края окна"
  - "Нативные диалоги .portia-dialog по центру экрана (margin: auto)"
affects: [PORTIA-26 gap-closure 26-17..26-20, PORTIA-27]

actuals:
  tokens: 3500
  tasks: 2
  commits: 4
plan_head_before: 71b31809809c7293c3516b49379ffd079775e73f
plan_head_after: 84f2cb4e1f138e723a64d550a7ec80f0c138dda1

tech-stack:
  added: []
  patterns:
    - "Рамка окна рисуется ::after-слоем с pointer-events: none, а не border самого окна"

key-files:
  created: []
  modified:
    - app/portia.css
    - lib/ui-unify.test.ts

key-decisions:
  - "Рамка окна перенесена с border .app-window на слой .app-window::after (z-index 11, pointer-events: none, без фона); border окна = 0, исходные правила в начале файла оставлены историей, блок ui-unify перекрывает их."
  - "Радиус слоя рамки задан как var(--radius-window), а не inherit: тест UI-02 допускает в border-radius только токены ролей; у всех окон (и на телефоне) радиус один."
  - "margin: auto у .portia-dialog вернул центрирование, которое сбрасывал preflight Tailwind 4; один общий класс охватывает все нативные диалоги, это защищено сканированием исходников компонентов."

requirements-completed: [UI-05, UI-03]

duration: 12 min
completed: 2026-11-17
---

# Phase PORTIA-26 Plan 16: Угол окна и диалоги по центру Summary

Рамка окна 1px переведена на неинтерактивный слой поверх окна, поэтому кнопка закрытия 46x46 занимает сам угол окна без мёртвой зоны, а нативные диалоги подтверждения (`.portia-dialog`) снова стоят по центру экрана благодаря `margin: auto`.

## Для владельца (текстом, без галерей)

- Крестик закрытия окна: рамка окна теперь нарисована поверх окна и не принимает нажатий. Крестик доходит до самого края окна сверху и справа; скругление окна 10px режет его по контуру окна. Цвета рамки (обычная и у активного окна), размер кнопок 46x46, порядок «―», «□», «×», отступ 8px у развёрнутого окна и радиус окна прежние. Рёбра ресайза сверху и справа работают, угол под кнопками неактивен.
- Побочный эффект: окно перестало иметь собственную рамку 1px, поэтому содержимое получило на 1px больше места с каждой стороны (рамка теперь рисуется поверх содержимого). Заметно только при пиксельном сравнении.
- Окна подтверждения («Закрыть редактор?», «Отменить несохранённые правки?» и другие диалоги, включая диалоги «Пользователей» и «Видимой части») теперь появляются по центру экрана, а не в левом верхнем углу.
- Положение крестика и диалога в браузере глазами не проверялось: BLOCKED (ENV) до линии Playwright или Phase 27. Это не PASS.

## Accomplishments

- Трассер (Task 1): тест «UI-05 (UAT 2026-11-16): the window frame is a non-interactive overlay, so the close button owns the corner» -> правила `.app-window { border: 0 }`, `.app-window::after`, `.app-window.is-active::after` в блоке `ui-unify`. Проверено grep-ом: других правил рамки (`border`, `border-width`, `border-color`) у `.app-window` и окон-наследников (`promotion-window`, `editor-window`, `is-modal-locked`, телефонные @media) нет, переносить нечего.
- Task 2: тест «UI-03 (UAT 2026-11-16): native confirm dialogs sit in the centre of the screen» -> `.portia-dialog { margin: auto }`. Сканирование `components/*.tsx` нашло 4 нативных `<dialog>` (ConfirmDialog, «Видимая часть», два диалога «Пользователей»), все несут класс `portia-dialog`; переименований не потребовалось.

## Task Commits

1. Task 1 RED `b8893cc` — `test(26-16)`. Цель: «UI-05 (UAT 2026-11-16): the window frame is a non-interactive overlay…». Итог: `# tests 40 # pass 39 # fail 1`; упал именно целевой тест на утверждении «the window box itself has no border» (ожидалось `0`, получено `1px solid var(--line-bright)`). Семантическая оценка: тест выполнился и упал на запланированном утверждении по нужной причине (не загрузка, не синтаксис, не посторонний тест) — RED валиден.
2. Task 1 GREEN `da86b26` — `feat(26-16)`: правила рамки-слоя; `ui-unify`, `style-tokens`, `accent-theme`, `window-open`: 103/103.
3. Task 2 RED `cd27430` — `test(26-16)`. Целевой тест упал на `lastDeclaration(".portia-dialog", "margin")` (ожидалось `auto`, получено `undefined`); `# tests 41 # pass 40 # fail 1`. Семантическая оценка: падает на запланированном утверждении — RED валиден.
4. Task 2 GREEN `84f2cb4` — `feat(26-16)`: `.portia-dialog { margin: auto }`, сканирование диалогов игнорирует комментарии.

Классификатор `gsd_run check tdd-red-evidence` не запускался (командная оболочка проекта блокирует вызов шима); RED проверен по реальному выводу TAP и семантически, как описано выше.

## Verification

- `node --experimental-strip-types --test lib/*.test.ts` (Node 22.13.1 эталонная): `# tests 2370 # pass 2367 # fail 0 # skipped 3` (3 пропущенных были и до плана).
- `node node_modules/typescript/bin/tsc --noEmit`: без ошибок.
- `node node_modules/eslint/bin/eslint.js app lib components`: 0 ошибок, 15 предупреждений (все прежние).
- Acceptance: `.app-window::after` в `app/portia.css` присутствует; `UAT 2026-11-16` в `lib/ui-unify.test.ts` — 2 теста; прежние тесты UI-05 и UI-06 / D-03, а также «ui-unify block is the last block» зелёные без правок.
- Владельческие пути из CLAUDE.md не менялись и не стейджились; стейдж только по явным путям.
- Браузерное поведение (положение крестика, центр диалога): BLOCKED (ENV), не PASS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `border-radius: inherit` нарушал тест UI-02**
- **Found during:** Task 1 (GREEN)
- **Issue:** план требовал `border-radius: inherit` у `.app-window::after`; `lib/style-tokens.test.ts` («every border-radius is a role token») допускает только токены ролей, 0 или их композиции и упал.
- **Fix:** слою рамки задан `border-radius: var(--radius-window)` (у всех окон этот же радиус, в том числе на телефоне); утверждение в тесте 26-16 изменено с `inherit` на `var(--radius-window)`. Прежние тесты не ослаблялись.
- **Files modified:** app/portia.css, lib/ui-unify.test.ts
- **Commit:** da86b26

**2. [Rule 1 - Bug] Сканирование `<dialog` ловило комментарий**
- **Found during:** Task 2 (GREEN)
- **Issue:** в `portia-image-framing.tsx` строка комментария содержит `<dialog>`; сканирование приняло её за элемент без класса.
- **Fix:** перед сканированием из исходника убираются блочные и строчные комментарии.
- **Files modified:** lib/ui-unify.test.ts
- **Commit:** 84f2cb4

**Итого:** 2 (оба Rule 1). Влияние на результат плана нет.

## Known Stubs

None.

## Threat Flags

None. Правка только CSS: слой рамки `pointer-events: none` и без фона (T-26-35), путь закрытия окна не менялся, окно редактора с несохранённым по-прежнему спрашивает `ConfirmDialog` (T-26-34).

## Issues Encountered

- Project guard блокирует команды, где в одном вызове встречаются подстановки переменных окружения рядом с git-вызовами шима; такие команды разнесены на простые.

## TDD Gate Compliance

RED (`test(26-16)`) -> GREEN (`feat(26-16)`) присутствуют для обеих задач (b8893cc -> da86b26, cd27430 -> 84f2cb4), REFACTOR не потребовался.

## Self-Check: PASSED

- FOUND: app/portia.css, lib/ui-unify.test.ts
- FOUND commits: b8893cc, da86b26, cd27430, 84f2cb4
