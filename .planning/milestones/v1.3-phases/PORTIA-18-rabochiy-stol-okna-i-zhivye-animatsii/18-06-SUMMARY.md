---
phase: 18-rabochiy-stol-okna-i-zhivye-animatsii
plan: 06
subsystem: editor-layout-phone
tags: [editor, columns, drag-sort, phone, vivian, css]
requires: [18-01, 18-02, 18-04, 18-05]
provides:
  - "--editor-card-width: 340px (одна переменная, 18-MOTION-APPROVAL п. 5) и .editor-card-columns: auto-fill колонки фиксированной ширины, только min-width: 901px"
  - "Формы «Информация», «Справочник», «Сводка» несут editor-card-columns; «Рекомендации» и «Доступ» остаются одной колонкой"
  - "lib/sort-order.ts: Box, passesTarget(own, target, pointer, forward) — перестановка в порядке чтения"
  - "OrderDragHandle.moveTo решает через passesTarget; FLIP сдвигает строку по обеим осям (translate(dx, dy)), только в «Включены»"
  - "Phone: .workspace.mobile-app-open ~ .desktop-assistant { display: none } — вариант A п. 8 реализован в этом плане"
affects: [18-07]
tech-stack:
  added: []
  patterns: ["чистая функция решения для drag-сортировки с node:test", "структурные тесты CSS/исходников через readFileSync + componentFamily"]
key-files:
  created:
    - lib/sort-order.ts
    - lib/sort-order.test.ts
  modified:
    - app/portia.css
    - components/portia-editor.tsx
    - components/portia-editor-dossier.tsx
    - lib/portia-desktop.test.ts
    - tests/e2e/specs/desktop-windows.spec.ts
key-decisions:
  - "Правила .editor-card-columns стоят сразу после .flat-editor-form в отдельном @media (min-width: 901px): та же специфичность, поэтому порядок решает каскад (в десктопном блоке выше базовое правило перебило бы их)"
  - "passesTarget: ряд определяется по |top - top| < 1; граница середины включена (>= вперёд, <= назад), как было в прежнем вертикальном правиле"
  - "Вариант A п. 8 — только CSS-скрытие (сиблинг .workspace → .desktop-assistant); размеры Вивьян и таскбар не менялись"
requirements-completed: []
requirements-pending: [STAB-DESK-02, STAB-DESK-04, STAB-MOTION-08, STAB-MEDIA-06]
duration: not measured
completed: 2026-11-02
status: complete
actuals:
  tokens: 4400
  tasks: 3
  commits: 3
plan_head_before: 3586fc4cd4dd078f3812cc1aa8f3df60f9c460f0
plan_head_after: 80aee3483fed36ff58bb3f06ca8df7d4442d0161
---

# Phase 18 Plan 06: Колонки форм редактора и Вивьян на phone Summary

Карточки-формы редактора держат 340px и добавляют колонки при расширении окна, drag-сортировка в колонках решает по порядку чтения (чистая `passesTarget` с тестами), а на phone открытое окно больше не перекрывается Вивьян (она скрыта, вариант A).

## Задачи

| Задача | Коммит | Результат |
|--------|--------|-----------|
| 1 (tracer) | 95ac193 | `--editor-card-width: 340px`, `.editor-card-columns` (grid auto-fill, `align-items: start`, не-карточки на весь ряд, без верхнего margin у соседних карточек), класс на форме «Сводка»; тест был красным до кода |
| 2 | e3b4c68 | `lib/sort-order.ts` + 5 тестов; `moveTo` через `passesTarget`; FLIP по `offsetLeft`/`offsetTop`; класс на формах «Информация» и «Справочник»; структурный тест dossier |
| 3 | 80aee34 | Правило скрытия Вивьян в `@media (max-width: 900px)`; unit-тест; e2e `[STAB-DESK-04] Vivian never covers an open window on phone` |

## Пункты 18-MOTION-APPROVAL

- П. 5 (340px, одна переменная): выполнен. `--editor-card-width` объявлена один раз (тест считает вхождения).
- П. 8 (phone: Вивьян скрыта при открытом окне, вариант A): **выполнен в этом плане** (Задача 3), а не оставлен открытым. Вивьян возвращается при сворачивании окна (e2e проверяет).

## Верификация (Node 22.13.1)

- `npm test`: 879 тестов, 876 pass, 0 fail, 3 skipped (ранее существовавшие). `tsc --noEmit`: чисто. `npm run lint`: 0 errors, 18 warnings (ранее существовавшие). `npm run build`: успешно.
- `lib/sort-order.test.ts`: 5 тестов (один ряд вперёд/назад, разные ряды, ряды разной высоты, субпиксельный top), 0 fail.
- Visual manifest test: 37 pass, 0 fail; `--verify-promotion`: «Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.» (`--verify` не запускался).
- `playwright test --list`: 220 tests in 13 files; тест `[STAB-DESK-04] Vivian never covers an open window on phone` присутствует.
- `desktop-windows.spec.ts` на chromium-phone и webkit-phone, `--retries=0`: **4 passed, 4 skipped** (оба phone-теста прошли на обоих проектах; PC-тесты пропущены на phone-проектах). Preflight `visitor`.
- `git diff --name-only 3586fc4..HEAD -- tests/e2e/visual .planning/phases/PORTIA-15-baseline`: пусто.
- Побочное: порт 3000 был занят чужим процессом (node PID 4280), поэтому штатный `webServer` Playwright не стартовал («already used»). Прогон шёл против собственной сборки на порту 3100 (`PORTIA_E2E_BASE_URL`), собранной и запущенной с `PORTIA_E2E_ALLOW_HTTP=1` (без него WebKit апгрейдит запросы до https и desktop не рисуется). Чужой процесс не трогал; моя сборка в `.next` теперь с этим флагом (артефакт игнорируется git, следующий `npm run build` перезапишет).

## Deviations from Plan

**1. [Rule 3 - Blocking] Playwright webServer не стартовал из-за занятого порта 3000**
- **Found during:** Task 3 verify
- **Issue:** `http://127.0.0.1:3000 is already used`; `reuseExistingServer: false`.
- **Fix:** собственный `next start` на 3100 + `PORTIA_E2E_BASE_URL`; процесс на 3000 не останавливался (не мой).
- **Files modified:** нет.

Прочее: план выполнен как написан. Автоправок CSS-дефектов phone не потребовалось: 18-04 дефектов не записал («CSS-дефектов phone этот прогон не выявил»), прогон phone-теста 18-04 по-прежнему зелёный. Duration не измерялась.

## Не проверено / BLOCKED

- Редактор в браузере (раскладка в колонки, перенос длинных значений в карточке 340px, отсутствие page-level overflow, drag-сортировка по двум осям, FLIP): нужны аутентифицированная роль редактора и data source — **BLOCKED**, не pass. Покрыто unit-тестами (`passesTarget`, структурные тесты CSS/исходников) и сборкой/типами/линтом. Истина про «E8 long-text» (visual regression, `verification: backstop`) не проверена.
- Живое drag-поведение `moveTo` (hit-testing через `elementsFromPoint` по колонкам, поведение `moveAcross` в сетке) в браузере не запускалось; `moveAcross` и правило «кандидаты — строки того же родителя» не изменялись (структурный тест фиксирует строку `if (!row) { moveAcross(...) }`).
- Phone: виртуальная клавиатура и физическое устройство — BLOCKED (физический phone). Эмуляция chromium-phone/webkit-phone проверила только скрытие/возврат Вивьян и контракт 18-04.
- E2E-тест Вивьян не проверяет отдельно «последнее поле окна» (вариант B не выбран); при варианте A достаточно, что `.desktop-assistant` скрыта.

## Requirements

**Pending, не отмечены** (`requirements mark-complete` не вызывался):
- STAB-DESK-02: часть текста (reflow редактора без обрезки в браузере, visual regression) не проверена — BLOCKED выше.
- STAB-DESK-04: часть текста (клавиатура, физический phone) не проверена.
- STAB-MOTION-08 и STAB-MEDIA-06: Pending до 18-07.

## Known Stubs

None.

## Threat Flags

None. T-18-10 закрыт: решение вынесено в `passesTarget` с тестами; кандидаты по-прежнему ограничены строками того же родителя; `moveAcross` и `data-sort-group` не менялись. T-18-SC: установок пакетов нет.

## Self-Check: PASSED

- Файлы существуют: lib/sort-order.ts, lib/sort-order.test.ts, app/portia.css, components/portia-editor.tsx, components/portia-editor-dossier.tsx, lib/portia-desktop.test.ts, tests/e2e/specs/desktop-windows.spec.ts.
- Коммиты 95ac193, e3b4c68, 80aee34 в истории; `git rev-list --count 3586fc4..HEAD` = 3 до коммита SUMMARY.
