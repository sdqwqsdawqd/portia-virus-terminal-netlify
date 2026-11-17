---
phase: PORTIA-26-edinyy-stil-sayta
plan: 15
subsystem: ui
tags: [react, desktop, start-menu, global-search, uat-gap-closure]
status: complete
gap_closure: true

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "UAT 2026-11-16 (26-UAT.md Gaps 1 and 3) и сетка R1 развёрнутого поиска в app/portia.css"
provides:
  - "Меню «PORTIA» закрывается при клике мимо, уходе фокуса, потере фокуса окном и Escape"
  - "«Доступные записи» в развёрнутом «Глобальном поиске» показывают все записи индекса"
affects: [PORTIA-26 gap-closure 26-16..26-20, PORTIA-27]

actuals:
  tokens: 4200
  tasks: 2
  commits: 4
plan_head_before: 28fdbcee4434ba4bd35fe4d01259e457c6e2de5b
plan_head_after: a968f693306c2f31bff767906bec7f4d771cc7cf

tech-stack:
  added: []
  patterns:
    - "Чистое правило без DOM в lib/ + слушатели в эффекте компонента, под защитой исходного теста на парность add/removeEventListener"

key-files:
  created:
    - lib/start-menu.ts
    - lib/start-menu.test.ts
  modified:
    - components/portia-desktop.tsx
    - lib/search-index.ts
    - lib/search-index.test.ts
    - lib/portia-desktop.test.ts

key-decisions:
  - "Слушатели pointerdown и keydown меню «PORTIA» повешены в фазе захвата: Escape помечается handled раньше слушателя QuestToast, поэтому одно нажатие не закрывает и меню, и уведомление."
  - "Кнопка «PORTIA» считается «внутри» меню: её нажатие только переключает меню, а не закрывает и тут же открывает снова."
  - "Лимит «Доступных записей» — функция availableRecordsLimit(maximized) с единственной константой availableRecordsInWindow = 8, которую теперь использует и значение по умолчанию matchSearch."

requirements-completed: [UI-03, UI-06]

duration: 14 min
completed: 2026-11-17
---

# Phase PORTIA-26 Plan 15: Меню «PORTIA» и развёрнутый поиск Summary

Меню «PORTIA» закрывается как в настоящей ОС (клик мимо, уход фокуса, потеря фокуса окном, Escape с возвратом фокуса на кнопку), а развёрнутый «Глобальный поиск» показывает в «Доступных записях» все записи индекса вместо первых восьми.

## Для владельца (текстом, без галерей)

- Меню «PORTIA»: нажатие в любом месте вне меню и вне самой кнопки закрывает его. Переход табом на элемент вне меню, уход из окна браузера и Escape тоже закрывают меню; после Escape фокус возвращается на кнопку «PORTIA». Нажатие на саму кнопку по-прежнему открывает и закрывает меню. Если меню открыто с клавиатуры (Enter/Space на кнопке), фокус сразу переходит на первый пункт меню.
- Глобальный поиск развёрнут: «Доступные записи» — все записи сеткой до 4 колонок (сетка R1 уже была в CSS, CSS не менялся); в обычном окне по-прежнему 8 записей; запрос со словами показывает все совпадения, как раньше.
- Поведение в браузере (клик мимо, фокус, сетка на 1366/1920/2560) в этом плане не проверялось глазами: BLOCKED (ENV) до линии Playwright или Phase 27. Это не PASS.

## Accomplishments

- Трассер: `startMenuCloseReason(event)` в `lib/start-menu.ts` (outside / escape / null) -> эффект с зависимостью `[startOpen]` в `PortiaDesktop` (4 слушателя: `pointerdown` и `keydown` в захвате, `focusin` на `document`, `blur` на `window`, все снимаются в cleanup) -> `startButtonRef` / `startPanelRef`, перенос фокуса на первую кнопку меню при открытии с клавиатуры (`event.detail === 0`).
- `availableRecordsLimit(maximized)` и `availableRecordsInWindow` в `lib/search-index.ts`; `searchResults` в рабочем столе зависит от `windows.search.maximized`. Счётчик в `.global-search-summary` и роуминг по `data-result-index` читают `searchResults`, правок не потребовали; порядок клавиш Вверх/Вниз по DOM не менялся.
- Источник данных тот же `searchIndex` (после фильтра допуска Phase 24): новых источников нет (T-26-32).

## Task Commits

1. Task 1 RED `68ce425` — `test(26-15)`: 6 тестов, красные на утверждениях (стаб `startMenuCloseReason` никогда не закрывает); итог `# tests 6 # pass 0 # fail 6`.
2. Task 1 GREEN `ee3c03f` — `feat(26-15)`: правило, эффект, ref-ы, фокус с клавиатуры; `start-menu.test.ts` + `portia-desktop.test.ts`: 89/89.
3. Task 2 RED `e59e46c` — `test(26-15)`: `availableRecordsLimit(true)` ожидалось `Infinity`, получено `8`; красные 2 теста (новый и перенацеленная проверка вызова в `portia-desktop.test.ts`), `# tests 105 # pass 103 # fail 2`.
4. Task 2 GREEN `a968f69` — `feat(26-15)`: лимит и подключение.

TDD-ограничение: до GREEN в RED-коммитах лежат стабы экспортов, иначе ESM-импорт несуществующего имени даёт ошибку загрузки файла (INVALID_RED), а не провал утверждения.

## Verification

- `node --experimental-strip-types --test lib/*.test.ts` (Node 22.13.1 эталонная): `# tests 2368 # pass 2365 # fail 0 # skipped 3` (3 пропущенных уже были до плана).
- `node node_modules/typescript/bin/tsc --noEmit`: без ошибок.
- `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next`: 0 ошибок, 17 предупреждений (все существовавшие: `no-img-element`, неиспользуемый `LoadingState`).
- Acceptance: `export function startMenuCloseReason` 1, `startMenuCloseReason(` 1, `ref={startPanelRef}` 1, `export function availableRecordsLimit` 1, `availableRecordsLimit(windows.search.maximized)` 1, `UAT 2026-11-16` в `search-index.test.ts` 1.
- Владельческие пути из CLAUDE.md не менялись и не стейджились; стейдж только по явным путям.
- Браузерное поведение: BLOCKED (ENV), не PASS.
- Node: использована эталонная 22.13.1 (`/tmp/portia-node-v22.13.1/...`), она уже была в PATH.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Keydown и pointerdown меню в фазе захвата**
- **Found during:** Task 1
- **Issue:** план указывал обычные слушатели `keydown` на `document`; слушатель Escape у `QuestToast` регистрируется раньше и сработал бы первым, закрыв заодно и уведомление (угроза T-26-33).
- **Fix:** `keydown` (как и `pointerdown`) добавлен с `{ capture: true }` и снимается с тем же флагом; `preventDefault()` на Escape вызывается до слушателя уведомления.
- **Files modified:** components/portia-desktop.tsx
- **Commit:** ee3c03f

**2. [Rule 3 - Blocking] Стабы в RED-коммитах**
- **Found during:** Task 1 и Task 2 (RED)
- **Issue:** тест, импортирующий отсутствующий экспорт, падает при загрузке модуля, что не является допустимым RED (#3770).
- **Fix:** RED-коммиты содержат стабы `startMenuCloseReason` (всегда `null`) и `availableRecordsLimit` (всегда 8), чтобы тесты падали на утверждениях.
- **Commits:** 68ce425, e59e46c

**Итого:** 2 (1 Rule 2, 1 Rule 3). Влияние: на объём и результат плана нет; число коммитов 4 вместо 2 из-за двух циклов RED/GREEN.

## Known Stubs

None. (Стабы RED-коммитов заменены в GREEN-коммитах.)

## Threat Flags

None. Новых сетевых путей, источников данных или границ доверия нет; слушатели только читают цель события.

## Issues Encountered

- Project guard заблокировал первую команду коммита из-за `echo $VAR` в составной команде; команды разнесены, без `echo $`.
- Проверка «не оставляю ли незакоммиченное»: `git rev-list --count` = 4, незакоммиченных изменений кода нет.

## TDD Gate Compliance

RED (`test(26-15)`) -> GREEN (`feat(26-15)`) присутствуют для обеих задач, REFACTOR не потребовался.

## Self-Check: PASSED

- FOUND: lib/start-menu.ts, lib/start-menu.test.ts, components/portia-desktop.tsx, lib/search-index.ts, lib/search-index.test.ts, lib/portia-desktop.test.ts
- FOUND commits: 68ce425, ee3c03f, e59e46c, a968f69
