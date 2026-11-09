---
phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
plan: 06
subsystem: ui
tags: [decomposition, pure-move, seam-modules, stab-desk-07, stab-desk-01, playwright-blocked]

requires:
  - phase: 17-05
    provides: lib/window-open.ts (WindowState, OpenOrigin, originOf) и структурные тесты по componentFamily
provides:
  - "components/portia-desktop-window.tsx: type AppId, appMeta, minimumWindowSize, AppWindow (внутри windowMinimums, resizeEdges)"
  - "components/portia-desktop-shortcuts.tsx: DesktopIcon, StartPanelButton, type DesktopShortcutId, type ShortcutPosition (внутри раскладка ярлыков, useShortcutAnimation, DraggableDesktopIcon)"
affects: [17-07, phase-17.1, phase-18]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: fa47435dbd8cdaf45b19f4d9ca2f83e8e9d901c2
plan_head_after: cb2792e1dcea2d37bacfe30452e86c235dea3959

tech-stack:
  added: []
  patterns:
    - "Перенос скриптом по границам фрагментов (строки не перепечатывались), затем phase17-move-parity.mjs как доказательство байт-в-байт"
    - "Модули-seam не импортируют portia-desktop.tsx: window -> lib/*, shortcuts -> window + lib/window-open"

key-files:
  created:
    - components/portia-desktop-window.tsx
    - components/portia-desktop-shortcuts.tsx
  modified:
    - components/portia-desktop.tsx

key-decisions:
  - "Из portia-desktop.tsx удалены только неиспользуемые после переноса импорты (dragGeometry, resizeGeometry, ResizeEdge, PortiaIconName), чтобы число предупреждений lint осталось 18 как в эталоне"
  - "Props и места вызова AppWindow, DesktopIcon, StartPanelButton не менялись; shortcutPositionsStorageKey и загрузка/сохранение позиций остались в PortiaDesktop"

requirements-completed: []

coverage:
  - id: D1
    description: "STAB-DESK-07: рамка окна и реестр app id перенесены без изменений"
    requirement: STAB-DESK-07
    verification:
      - kind: unit
        ref: "node scripts/phase17-move-parity.mjs --from components/portia-desktop.tsx --to components/portia-desktop-window.tsx: pure move, 155 lines, exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "STAB-DESK-07: ярлыки рабочего стола и кнопки start panel перенесены без изменений"
    requirement: STAB-DESK-07
    verification:
      - kind: unit
        ref: "phase17-move-parity.mjs --to components/portia-desktop-shortcuts.tsx: pure move, 160 lines, exit 0 (до коммита и с --ref HEAD~1 после)"
        status: pass
    human_judgment: false
  - id: D3
    description: "STAB-DESK-01 в коде: структурные тесты 17-05 и тесты STAB-DESK-07 проходят после переноса"
    requirement: STAB-DESK-01
    verification:
      - kind: unit
        ref: "Node 22.13.1: npm test 680 тестов (679 pass, 1 skipped, 0 fail), в т.ч. lib/window-open.test.ts без правки маркеров"
        status: pass
    human_judgment: false
  - id: D4
    description: "Типы, lint, сборка, манифест"
    verification:
      - kind: unit
        ref: "tsc 0 ошибок; lint 0 errors / 18 warnings (как в эталоне); npm run build ok; phase15-visual-manifest.test.ts 37/37; --verify-promotion: 33 снимка, байты совпали"
        status: pass
    human_judgment: false
  - id: D5
    description: "Браузер: window-reopen e2e, playwright --list, визуальная дорожка против 17-PARITY-BASELINE.md"
    requirement: STAB-DESK-01
    verification:
      - kind: e2e
        ref: "playwright test --list / tests/e2e/specs/window-reopen.spec.ts --project=chromium-desktop / tests/e2e/visual --update-snapshots=none"
        status: unknown
    human_judgment: true
    rationale: "BLOCKED (ENV): phase15-e2e-preflight.mjs visitor -> [PORTIA_E2E_PREFLIGHT:missing-environment] Check: NEXT_PUBLIC_SUPABASE_ANON_KEY. Исход тот же, что в 17-05 и 17-PARITY-BASELINE.md (BLOCKED = BLOCKED); это не pass. .env.local не читался, ключи не задавались. git status по tests/e2e/visual/__screenshots__ пуст."

duration: 15min
completed: 2026-11-01
status: complete
---

# Phase 17 Plan 06: Рамка окна и ярлыки в отдельных модулях Summary

**`AppWindow` с реестром `AppId`/`appMeta`/`minimumWindowSize` и ярлыки рабочего стола (`DesktopIcon`, `StartPanelButton`, раскладка, анимация) вынесены в `portia-desktop-window.tsx` и `portia-desktop-shortcuts.tsx` чистым переносом (155 и 160 строк, инструмент parity выходит 0); браузерная проверка остаётся BLOCKED (ENV).**

## Performance

- **Duration:** около 15 мин
- **Completed:** 2026-11-01
- **Tasks:** 2 (Task 1 tracer, Task 2 auto)
- **Files modified:** 3 (2 созданы, 1 изменён)
- **PLAN_START:** `fa47435dbd8cdaf45b19f4d9ca2f83e8e9d901c2`
- `components/portia-desktop.tsx`: 2099 -> 1754 строк.

## Accomplishments

- Tracer (Task 1): фрагменты `type AppId`, `appMeta`, `windowMinimums` с комментарием, `minimumWindowSize`, `resizeEdges`, `AppWindow` вырезаны скриптом по границам текста и записаны в новый модуль с `export` на AppId, appMeta, minimumWindowSize, AppWindow. Перед Task 2 прогнан весь `<verify>` задачи (parity, тесты, tsc, lint): всё зелёное, модуль не импортирует `portia-desktop`.
- Task 2: ярлыки (`DesktopShortcutId`, `ShortcutPosition`, `ShortcutLayoutStyle`, `defaultShortcutLayout`, `shortcutLayout`, `savedShortcutLayout`, `DesktopIcon`, `shortcutAnimationMs`, `useShortcutAnimation`, `StartPanelButton`, `DraggableDesktopIcon`) в исходном порядке (константа раньше функции, как в оригинале). Экспортированы DesktopIcon, StartPanelButton и два типа. Ключ `portia-desktop-shortcuts-v3` и вся загрузка/сохранение позиций остались в `PortiaDesktop`; JSX `<AppWindow>`, `<DesktopIcon>`, `<StartPanelButton>` не тронуты.
- Структурные тесты 17-05 (`lib/window-open.test.ts`) читают `componentFamily("portia-desktop")` и остались зелёными без правок маркеров.

## Task Commits

1. **Task 1:** `d647dcb` (refactor) - AppWindow и реестр app id в portia-desktop-window
2. **Task 2:** `cb2792e` (refactor) - ярлыки в portia-desktop-shortcuts

**Plan metadata:** коммит docs (SUMMARY, STATE, ROADMAP) следует за этим файлом.

## Files Created/Modified

- `components/portia-desktop-window.tsx` - рамка окна PORTIA OS и реестр app id (155 перенесённых строк)
- `components/portia-desktop-shortcuts.tsx` - ярлыки и кнопки start panel (160 перенесённых строк)
- `components/portia-desktop.tsx` - удалён перенесённый код, два импорта, убраны четыре ставших лишними импорта

## Decisions Made

- Неиспользуемые после переноса импорты в `portia-desktop.tsx` удалены, иначе lint поднялся бы с 18 до 21 предупреждения; поведение они не меняют.
- Остальные решения совпадают с планом: интерфейсы и места вызова не менялись, новых generic-оболочек нет.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **window-reopen.spec.ts, `playwright test --list` и визуальная дорожка BLOCKED (ENV)**: `phase15-e2e-preflight.mjs visitor` падает на `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Исход совпадает с 17-05 и эталоном (BLOCKED = BLOCKED), браузерно STAB-DESK-01/07 в этом плане НЕ доказаны; доказательство - parity-инструмент, тесты семейства и сборка. Снимки `tests/e2e/visual/__screenshots__` не менялись.
- Все команды выполнены на reference Node 22.13.1.
- Рабочее дерево на старте содержало `.planning/milestone.lock`, `.planning/state.json` и неотслеживаемые владельческие пути; не трогались и не коммитились.
- Новых багов по ходу не замечено, 17-FOUND-BUGS.md не менялся.

## Known Stubs

None.

## Threat Flags

None. T-17-12: перенос байт-в-байт сохраняет скрытие краёв ресайза и кнопок при `locked` (parity exit 0; `lib/portia-qualification-ui.test.ts` проходит). T-17-SC: пакетов не устанавливалось, package.json и package-lock.json не менялись.

## User Setup Required

None. Чтобы e2e и визуальная дорожка перестали быть BLOCKED, нужно preflight-окружение (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` разрешённого проекта).

## Next Phase Readiness

- `portia-desktop.tsx` стал на 345 строк меньше; AppId/appMeta/minimumWindowSize доступны остальным seam-модулям из `@/components/portia-desktop-window`.
- Риск: нет браузерного сравнения снимков; при первой возможности прогнать `tests/e2e/visual` и `window-reopen.spec.ts`.

## Self-Check: PASSED

Файлы `components/portia-desktop-window.tsx`, `components/portia-desktop-shortcuts.tsx` существуют; коммиты `d647dcb`, `cb2792e` в истории HEAD; `commits: 2` измерено от `plan_head_before`.

---
*Phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora*
*Completed: 2026-11-01*
