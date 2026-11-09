---
phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
plan: 05
subsystem: ui
tags: [window-open, pure-functions, tdd, stab-desk-01, source-tests, playwright-blocked]

requires:
  - phase: 17-01
    provides: componentFamily() source tests
  - phase: 17-04
    provides: parity-gate по одному в рабочем дереве
provides:
  - "lib/window-open.ts: OpenOrigin, WindowState, originOf, windowAppears, visibleWindowCount, openedWindow, exitedWindow"
  - "lib/window-open.test.ts: 17 тестов (поведение функций + структура точек входа по семейству рабочего стола)"
  - "tests/e2e/specs/window-reopen.spec.ts: [STAB-DESK-01] one app id keeps one window from every entry point"
  - "17-WINDOW-REOPEN.md: инвентаризация D-06 по 12 приложениям"
affects: [phase-17.1, phase-18]

actuals:
  tokens: 7300
  tasks: 3
  commits: 5
plan_head_before: 7d721faae4341413f798f101b301e461bcb52b14
plan_head_after: 76a5d7a6dc7fd4dd7ababc36ee7a59e3891e57e1

tech-stack:
  added: []
  patterns:
    - "Решение openApp/finishExit вынесено в чистые функции lib/window-open.ts; updater остаётся блочным и без побочных эффектов"
    - "Структурные тесты по componentFamily('portia-desktop') с assert на единственность найденного фрагмента (не проходят на пустом совпадении)"

key-files:
  created:
    - lib/window-open.ts
    - lib/window-open.test.ts
    - tests/e2e/specs/window-reopen.spec.ts
    - .planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-WINDOW-REOPEN.md
  modified:
    - components/portia-desktop.tsx
    - .planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-FOUND-BUGS.md

key-decisions:
  - "openedWindow принимает origin как OpenOrigin | undefined и create как () => WindowGeometry | undefined, потому что нынешний openApp и createWindowGeometry именно так и работают (телефон: геометрии нет)"
  - "originOf перенесён в lib/window-open.ts без изменения тела (стрелочная функция, как была)"
  - "Странность (accentPickerOpen/accentDraft переживают закрытие Настроек) только записана в 17-FOUND-BUGS.md, поведение не менялось (D-08)"

requirements-completed: [STAB-DESK-01, STAB-DESK-07]

coverage:
  - id: D1
    description: "D-04: открытие окна описано чистыми функциями; openApp/finishExit используют их, поведение как на эталоне"
    requirement: STAB-DESK-01
    verification:
      - kind: unit
        ref: "lib/window-open.test.ts: 17 pass, 0 fail (закрытое, свёрнутое, closing/minimizing, видимое за другими, большая геометрия, visibleWindowCount, неизменяемость, exitedWindow, originOf)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-05: уже видимое окно только выходит вперёд, origin не меняется"
    requirement: STAB-DESK-01
    verification:
      - kind: unit
        ref: "lib/window-open.test.ts: a visible window behind others only keeps its origin"
        status: pass
    human_judgment: false
  - id: D3
    description: "Одна поверхность AppWindow на app id и единственный путь открытия через openApp; защита квалификации первой инструкцией openApp и focusApp"
    requirement: STAB-DESK-01
    verification:
      - kind: unit
        ref: "lib/window-open.test.ts (структурные тесты по componentFamily): openApp один раз, 11 ярлыков с onOpen={openApp}, 5 start panel, 7 вызовов openApp в openSearchResult, taskbar, ровно один литерал open: true (updateQualificationLock), 11 AppWindow; мутационная проверка: onOpen={() => {}} у одного ярлыка роняет тест, откат вернул 17 pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-06: поведение закрытия и повторного открытия 12 приложений записано и закреплено"
    requirement: STAB-DESK-01
    verification:
      - kind: unit
        ref: "17-WINDOW-REOPEN.md (12 строк); lib/window-open.test.ts: состояние 'сохраняется' объявлено useState в PortiaDesktop, 'сбрасывается' (zoom, ctrlHeld, frameLoading) вне него"
        status: pass
    human_judgment: false
  - id: D5
    description: "Браузерное доказательство для ярлыка, start panel, taskbar и search"
    requirement: STAB-DESK-01
    verification:
      - kind: e2e
        ref: "npm exec playwright -- test tests/e2e/specs/window-reopen.spec.ts --project=chromium-desktop --retries=0"
        status: unknown
    human_judgment: true
    rationale: "BLOCKED (ENV): playwright.config.ts падает на phase15-e2e-preflight.mjs ([PORTIA_E2E_PREFLIGHT:missing-environment] Check: NEXT_PUBLIC_SUPABASE_ANON_KEY). Спек написан, tsc и lint его принимают, но ни разу не выполнялся; это не pass."
  - id: D6
    description: "Полный локальный gate"
    verification:
      - kind: unit
        ref: "Node 22.13.1: npm test 680 тестов (679 pass, 1 skipped, 0 fail); tsc 0 ошибок; lint 0 errors / 18 warnings (как в эталоне); build ok; манифест 37/37; --verify-promotion: 33 снимка"
        status: pass
    human_judgment: false
  - id: D7
    description: "Визуальная дорожка и playwright --list против 17-PARITY-BASELINE.md"
    verification:
      - kind: e2e
        ref: "npm exec playwright -- test --list / tests/e2e/visual --retries=0 --update-snapshots=none"
        status: unknown
    human_judgment: true
    rationale: "BLOCKED (ENV): тот же preflight; исход идентичен эталону (BLOCKED = BLOCKED), не pass. git status по tests/e2e/visual/__screenshots__ пуст."

duration: 35min
completed: 2026-11-01
status: complete
---

# Phase 17 Plan 05: Контракт «одно приложение — одно окно» Summary

**Решения openApp и finishExit вынесены в чистые функции `lib/window-open.ts` (`openedWindow`, `exitedWindow`, `windowAppears`, `visibleWindowCount`), поведение прежнее; точки входа и владение состоянием при закрытии закреплены 17 тестами и таблицей по 12 приложениям, а браузерный сценарий написан, но заблокирован окружением.**

## Performance

- **Duration:** около 35 мин
- **Completed:** 2026-11-01
- **Tasks:** 3 (Task 1 tracer, Task 2 и Task 3 auto)
- **Files modified:** 6 (4 созданы, 2 изменены)
- **PLAN_START:** `7d721faae4341413f798f101b301e461bcb52b14`

## Accomplishments

- Tracer (Task 1): `OpenOrigin`/`WindowState` перенесены в `lib/window-open.ts`; `openApp` считает bounce через `windowAppears(windows[appId])`, а updater блочный: `visibleWindowCount(state)` и `openedWindow(...)`. Первая инструкция `openApp` и `focusApp` (`qualificationLocked`) не тронута, отмена `exitTimers`, `focusApp`, `setStartOpen(false)` и ветка «Сводки» без изменений. После tracer прогнан весь `<verify>` (тесты, tsc, lint) до расширения.
- Task 2: `originOf` и `exitedWindow` в модуле, `finishExit` стал `setWindows((state) => ({ ...state, [appId]: exitedWindow(state[appId], kind) }))`, комментарий над ним остался. `17-WINDOW-REOPEN.md` содержит общий механизм и ровно 12 строк по приложениям (точки входа, свернуть → открыть, что сохраняется, что сбрасывается) плюс особые случаи (диалог несохранённых правок редактора, запрет открывать чужие окна при квалификации, подпись прочитанного в «Сводке»).
- Структурные тесты читают `componentFamily("portia-desktop")` и каждый раз проверяют, что фрагмент найден ровно один раз, поэтому не проходят на пустом совпадении и переживут перенос AppWindow и ярлыков в 17-06.
- Мутационная проверка из acceptance: замена `onOpen={openApp}` у ярлыка корзины роняет тест (`# fail 1`), откат возвращает `# pass 17`.
- e2e-спек `window-reopen.spec.ts` использует только существующие DOM hooks (aria-label окон и кнопок, `data-taskbar-app`, `.start-panel`, `.global-result`, `is-active`); в продуктовый код атрибуты не добавлялись.

## Task Commits

1. **Task 1 RED:** `fe3ade8` (test) - контракт openedWindow
2. **Task 1 GREEN:** `df2f1df` (feat) - openApp открывает окно через openedWindow
3. **Task 2 RED:** `337208f` (test) - exitedWindow, originOf, структура точек входа
4. **Task 2 GREEN:** `0913e37` (feat) - exitedWindow/originOf в модуле, инвентаризация D-06
5. **Task 3:** `76a5d7a` (test) - e2e-спек STAB-DESK-01

**Plan metadata:** коммит docs (SUMMARY, STATE, ROADMAP) следует за этим файлом.

## Files Created/Modified

- `lib/window-open.ts` - чистый контракт открытия/закрытия окна, одно место для типов окна
- `lib/window-open.test.ts` - 17 тестов: поведение функций и структура рабочего стола
- `components/portia-desktop.tsx` - локальные типы и `originOf` удалены, `openApp`/`finishExit` на функциях модуля (-24 строки)
- `tests/e2e/specs/window-reopen.spec.ts` - сценарий (а)-(г) из плана
- `.planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-WINDOW-REOPEN.md` - инвентаризация D-06
- `.planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-FOUND-BUGS.md` - одна строка (D-08)

## Decisions Made

- Сигнатура `openedWindow(state, origin, bounds, minimum, create)` принимает `origin: OpenOrigin | undefined` и `create` с возвратом `WindowGeometry | undefined`, чтобы сохранить поведение для start panel/search (origin нет) и телефона (геометрии нет).
- Запись о `accentPickerOpen` вынесена в 17-FOUND-BUGS.md как наблюдение по коду, без правки (D-08).

## Deviations from Plan

None - plan executed exactly as written.

Единственное отличие исполнения, названное в плане: `workspaceBounds()` теперь читается при каждом открытии окна, а не только когда есть запомненная геометрия. Это чтение layout (`getBoundingClientRect` у `.workspace`) без видимого эффекта и без записи.

## Issues Encountered

- **window-reopen.spec.ts, `playwright test --list` и визуальная дорожка BLOCKED (ENV)**: `playwright.config.ts` падает на `phase15-e2e-preflight.mjs visitor` (`[PORTIA_E2E_PREFLIGHT:missing-environment] Check: NEXT_PUBLIC_SUPABASE_ANON_KEY`). `.env.local` не читался, ключи не задавались. Спек ни разу не исполнялся, поэтому STAB-DESK-01 в браузере НЕ доказан; доказательство сейчас только чистые функции и структурные тесты. Исход визуальной дорожки совпадает с 17-PARITY-BASELINE.md (BLOCKED = BLOCKED); `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст.
- Селекторы спека (`getByRole("button", { name: /Глобальный поиск/ })` в `.start-panel`, результат «ПРИЛОЖЕНИЕ» с фильтром «Настройки») подобраны по чтению кода и не проверены в браузере; при первом прогоне их может потребоваться уточнить.
- Тесты и сборка этого плана выполнены на reference Node 22.13.1.
- Рабочее дерево на старте содержало `.planning/milestone.lock`, `.planning/state.json` и неотслеживаемые владельческие пути; не трогались и не коммитились.

## Known Stubs

None.

## Threat Flags

None. T-17-10 (qualification guard) закреплён структурным тестом; T-17-11 (`exitTimers`) не менялся; установок пакетов нет, package.json и package-lock.json не менялись (T-17-SC).

## User Setup Required

None - no external service configuration required. Чтобы e2e-спек и визуальная дорожка перестали быть BLOCKED, нужно дать preflight-окружение (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` разрешённого проекта).

## Next Phase Readiness

- 17-06 может переносить AppWindow и ярлыки: структурные тесты читают семейство `portia-desktop*`, а не один файл.
- Риск: браузерной проверки нет (BLOCKED ENV); при первой возможности запустить `window-reopen.spec.ts` на chromium-desktop и, если сценарий упадёт, сначала проверить селекторы, затем поведение.

## Self-Check: PASSED

Файлы `lib/window-open.ts`, `lib/window-open.test.ts`, `tests/e2e/specs/window-reopen.spec.ts`, `17-WINDOW-REOPEN.md` существуют; коммиты `fe3ade8`, `df2f1df`, `337208f`, `0913e37`, `76a5d7a` в истории HEAD; `commits: 5` измерено от `plan_head_before`.

---
*Phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora*
*Completed: 2026-11-01*
