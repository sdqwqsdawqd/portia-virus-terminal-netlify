---
phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
plan: 04
subsystem: ui
tags: [decomposition, pure-move, rich-text, format-panel, server-agnostic, playwright-blocked]

requires:
  - phase: 17-01
    provides: phase17-move-parity tool, componentFamily() source tests
  - phase: 17-02
    provides: partFiles в lib/dossier-parts.test.ts, guard D-03
  - phase: 17-03
    provides: последний писатель lib/dossier-parts.test.ts
provides:
  - "components/portia-editor-rich-text.tsx: ActiveFormatContext, FormattedTextarea, FloatingTextFormatPanel, replaceRichText, findFormatField, type FormatTarget, type EditorPreviewSurface"
  - "lib/dossier-parts.test.ts: guard D-03 покрывает и модуль форматирования"
affects: [phase-17.1]

actuals:
  tokens: 10500
  tasks: 2
  commits: 2
plan_head_before: b35acef7fc57e178d8dbb56cee8e62436c6f7f7c
plan_head_after: e8c2f2ad264cca91914c1f721ba72b65a51115c2

tech-stack:
  added: []
  patterns:
    - "Seam-модуль components/portia-editor-rich-text.tsx входит в componentFamily() portia-editor*"
    - "Перенос блоков скриптом по границам объявлений (в scratchpad, в репозиторий не добавлялся); корректность подтверждает только phase17-move-parity"

key-files:
  created:
    - components/portia-editor-rich-text.tsx
  modified:
    - components/portia-editor.tsx
    - lib/dossier-parts.test.ts

key-decisions:
  - "Экспортированы ровно семь имён (ActiveFormatContext, FormattedTextarea, FloatingTextFormatPanel, replaceRichText, findFormatField, type FormatTarget, type EditorPreviewSurface); nativeSurface, DisplayArea, rangeFromOffsets, restoreSelection, gestureCounter, addsFragment, палитры, nextBatch, formatPanelStorageKey, paintPanelOffset остались внутренними"
  - "В Task 1 nativeSurface, rangeFromOffsets, restoreSelection экспортировались временно (их ещё использовала панель в editor) и потеряли export в Task 2, как предписывал план"
  - "normalizePhraseLines и joinFormatTarget остались в editor (по плану); модуль не импортирует ничего из editor"

requirements-completed: [STAB-DESK-07]

coverage:
  - id: D1
    description: "Поле форматирования, панель и контекст объявлены ровно в одном файле; один createContext, Provider в PortiaEditor на том же объекте"
    requirement: STAB-DESK-07
    verification:
      - kind: other
        ref: "node scripts/phase17-move-parity.mjs --from components/portia-editor.tsx --to components/portia-editor-rich-text.tsx (pure move: 267 строк после Task 1; 302 строки до коммита Task 2; --ref HEAD~2 после коммитов: 569 строк, exit 0)"
        status: pass
      - kind: other
        ref: "grep: export const ActiveFormatContext = createContext ×1 в модуле, createContext< ×0 в editor, <ActiveFormatContext.Provider ×1 в editor, 4 export function (FormattedTextarea|FloatingTextFormatPanel|replaceRichText|findFormatField) в модуле, 0 перенесённых объявлений в editor, formatPanelStorageKey = portia-format-panel-v1 ×1 в модуле"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-03: модуль форматирования не знает про сервер"
    requirement: STAB-DESK-07
    verification:
      - kind: unit
        ref: "lib/dossier-parts.test.ts (partFiles содержит portia-editor-rich-text.tsx; guard не ослаблялся, срабатываний на перенесённом коде нет)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Семейные тесты: no turquoise literal in the components (hex-пресеты), editor imports rich-text-style once, STAB-DESK-07 pinned storage keys"
    requirement: STAB-DESK-07
    verification:
      - kind: unit
        ref: "npm test через componentFamily(): 663 теста (662 pass, 1 skipped, 0 fail)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Полный локальный gate: tsc, lint, build, визуальный манифест, verify-promotion"
    verification:
      - kind: unit
        ref: "tsc 0 ошибок, lint 0 errors / 18 warnings (как в эталоне), build ok, манифест 37/37, verify-promotion 33 снимка"
        status: pass
    human_judgment: false
  - id: D5
    description: "Пиксельная parity тела редактора и визуальной дорожки"
    verification:
      - kind: e2e
        ref: "npm exec playwright -- test --list / tests/e2e/visual"
        status: unknown
    human_judgment: true
    rationale: "BLOCKED (ENV): playwright.config.ts падает на phase15-e2e-preflight.mjs (нет NEXT_PUBLIC_SUPABASE_*; тело редактора в любом случае BLOCKED по ROLE). Исход совпадает с 17-PARITY-BASELINE.md (BLOCKED = BLOCKED), не pass."

duration: 20min
completed: 2026-11-01
status: complete
---

# Phase 17 Plan 04: Форматирование текста в отдельном модуле Summary

**FormattedTextarea, FloatingTextFormatPanel и общий ActiveFormatContext перенесены байт-в-байт в `components/portia-editor-rich-text.tsx`; контекст создаётся одним `createContext`, перенос подтверждён инструментом parity (569 строк), граница D-03 закреплена тестом.**

## Performance

- **Duration:** около 20 мин
- **Completed:** 2026-11-01
- **Tasks:** 2
- **Files modified:** 3 (1 создан, 2 изменены)

## Accomplishments

- Tracer (Task 1): типы `FormatTarget`, `EditorPreviewSurface`, `DisplayArea`, `nativeSurface`, `ActiveFormatContext`, `gestureCounter`/`addsFragment` (используются только внутри FormattedTextarea, подтверждено grep), `replaceRichText` и selection/DOM-helpers (`rgba`, `renderRichTextEditor`, `editorPlainText`, `rootRanges`, `selectionOffsets`, `pinCaretUnderPointer`, `rangeFromOffsets`, `restoreSelection`) и `FormattedTextarea`; parity 267 строк, весь gate зелёный.
- Task 2: `textColorPalette`, `baseInk`, `backgroundColorPalette`, `nextBatch`, `findFormatField`, `FloatingTextFormatPanel`, `formatPanelStorageKey`, `paintPanelOffset` в исходном относительном порядке; `createPortal` и Provider остались в PortiaEditor; импорт `@/lib/rich-text-style` в editor сокращён до `compactRuns, expandStyles` (одна строка, TEST-02 выполнен).
- Ключ `portia-format-panel-v1` переехал вместе с `formatPanelStorageKey`; разбор позиции по-прежнему через `parsePanelOffset`/`clampPanelOffset` без изменений (T-17-09). Построение DOM поля не менялось (T-17-08). package.json и package-lock.json не менялись (T-17-SC).
- **Части для Phase 17.1 готовы:** `components/portia-editor-dossier.tsx`, `components/portia-desktop-dossier.tsx`, `components/portia-editor-rich-text.tsx` (D-07).

## Task Commits

1. **Task 1: ActiveFormatContext и FormattedTextarea в модуль форматирования** - `abf03d6` (refactor)
2. **Task 2: FloatingTextFormatPanel и палитры в модуль; guard D-03** - `e8c2f2a` (refactor)

**Plan metadata:** коммит docs (SUMMARY, STATE, ROADMAP) следует за этим файлом.

## Files Created/Modified

- `components/portia-editor-rich-text.tsx` - `"use client"`, семь экспортов, импорты react / react-dom / custom-color-picker / format-fragments / editor-history / editor-items / portia-content / rich-text-style / panel-position
- `components/portia-editor.tsx` - перенесённые объявления удалены, один импорт из `@/components/portia-editor-rich-text`, убраны неиспользуемые импорты
- `lib/dossier-parts.test.ts` - `partFiles` дополнен `portia-editor-rich-text.tsx`; комментарий над списком уточнён

## Decisions Made

- Перенос выполнен одноразовым скриптом в scratchpad по границам объявлений; корректность доказана parity-инструментом, а не скриптом.
- Экспортируется минимум; временные экспорты Task 1 сняты в Task 2.

## Deviations from Plan

None - plan executed exactly as written.

(Мелочь: устаревший комментарий над `partFiles` («17-03 and 17-04 append one line each») заменён на «each extraction plan appends one line»; поведение теста не менялось.)

## Issues Encountered

- **Визуальная дорожка и `playwright test --list` BLOCKED (ENV)**: `playwright.config.ts` падает на `phase15-e2e-preflight.mjs visitor` (проверка Node 22.13.x, окружение Supabase отсутствует). Исход идентичен эталону 17-PARITY-BASELINE.md и НЕ является пиксельным доказательством. `.env.local` не читался, ключи не задавались. Тело редактора в любом случае BLOCKED (ROLE).
- Тесты прогонялись на машинной Node 24 (reference Node 22.13.1 не использовалась); результаты совпадают с эталоном.
- Рабочее дерево на старте содержало `.planning/milestone.lock`, `.planning/state.json` и неотслеживаемые владельческие пути; не трогались и не коммитились.

## Known Stubs

None.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required. Чтобы визуальная дорожка перестала быть BLOCKED, нужно дать preflight-окружение (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` разрешённого проекта).

## Next Phase Readiness

- Набор частей для Phase 17.1 завершён (досье-редактор, просмотр досье, форматирование).
- Риск: пиксельной parity нет (BLOCKED ENV/ROLE); доказательство — механический чистый перенос, source-тесты, tsc, lint, build и байты утверждённых снимков (`--verify-promotion`).

## Self-Check: PASSED

Файлы `components/portia-editor-rich-text.tsx`, `components/portia-editor.tsx`, `lib/dossier-parts.test.ts` существуют; коммиты `abf03d6` и `e8c2f2a` в истории HEAD; `commits: 2` измерено от `plan_head_before`.

---
*Phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora*
*Completed: 2026-11-01*
