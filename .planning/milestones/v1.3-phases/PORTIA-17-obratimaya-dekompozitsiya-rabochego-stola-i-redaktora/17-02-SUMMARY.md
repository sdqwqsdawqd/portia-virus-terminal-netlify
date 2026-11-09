---
phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
plan: 02
subsystem: ui
tags: [decomposition, pure-move, dossier-editor, server-agnostic, playwright-blocked]

requires:
  - phase: 17-01
    provides: phase17-move-parity tool, componentFamily() source tests, makeId in lib/editor-items.ts
provides:
  - "components/portia-editor-dossier.tsx: восемь server-agnostic частей редактора досье для PortiaEditor и Phase 17.1"
  - "lib/dossier-parts.test.ts: guard D-03 (нет fetch, /api/, Supabase, ревизий) и тест ImageEditorField без onUpload"
affects: [17-03, 17-04, phase-17.1]

actuals:
  tokens: 6700
  tasks: 2
  commits: 2
plan_head_before: 908e416f13a837d773cad07afa43aa437679b344
plan_head_after: ef6912d0f770daa8c40a05ea29a6985d94cb8d30

tech-stack:
  added: []
  patterns:
    - "Seam-модуль components/portia-editor-dossier.tsx подпадает под componentFamily() portia-editor*"
    - "Список файлов частей 17.1 в lib/dossier-parts.test.ts (partFiles): следующие планы дописывают одну строку"

key-files:
  created:
    - components/portia-editor-dossier.tsx
    - lib/dossier-parts.test.ts
  modified:
    - components/portia-editor.tsx

key-decisions:
  - "Перенос сделан скриптом по границам объявлений с сохранением CRLF; parity-инструмент подтвердил чистый перенос (320 строк)"
  - "Из редактора убраны только импорты, ставшие неиспользуемыми (classificationOptions, dossierTabs, isLocalMediaPath); число lint-warnings осталось 18 как в эталоне"
  - "Список мутаций не получил перетаскивание: у мутаций сегодня нет OrderDragHandle, это UX-правка вне Phase 17"

requirements-completed: [STAB-DESK-07]

coverage:
  - id: D1
    description: "Восемь частей досье объявлены ровно в одном файле, редактор импортирует их из модуля"
    requirement: STAB-DESK-07
    verification:
      - kind: other
        ref: "node scripts/phase17-move-parity.mjs --from components/portia-editor.tsx --to components/portia-editor-dossier.tsx (pure move: 320 lines, exit 0; после коммита с --ref HEAD~1 тот же результат)"
        status: pass
      - kind: other
        ref: "grep: 8 export function в модуле, 0 объявлений в редакторе"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-03: модуль не знает про сервер; ImageEditorField без onUpload не рендерит зону загрузки"
    requirement: STAB-DESK-07
    verification:
      - kind: unit
        ref: "lib/dossier-parts.test.ts (2 теста)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Полный локальный gate: npm test, tsc, lint, build, визуальный манифест, verify-promotion"
    verification:
      - kind: unit
        ref: "npm test 663 теста (662 pass, 1 skipped), tsc 0 ошибок, lint 0 errors / 18 warnings, build ok, манифест 37/37, verify-promotion 33 снимка"
        status: pass
    human_judgment: false
  - id: D4
    description: "Пиксельная parity визуальной дорожки и тело редактора в браузере"
    verification:
      - kind: e2e
        ref: "npm exec playwright -- test --list / tests/e2e/visual"
        status: unknown
    human_judgment: true
    rationale: "BLOCKED (ENV): preflight требует NEXT_PUBLIC_SUPABASE_URL/ANON_KEY в окружении процесса. Тело редактора дополнительно BLOCKED (ROLE). Не pass."

duration: 20min
completed: 2026-11-01
status: complete
---

# Phase 17 Plan 02: Части редактора досье в отдельном модуле Summary

**Восемь частей редактора досье (ClassificationField, ImageEditorField, OrderDragHandle, DossierTabs, Field, EditorGroup, ConfirmDialog, ArchivedVirusEditor) перенесены байт-в-байт в `components/portia-editor-dossier.tsx`; инструмент переноса подтверждает чистый перенос, а граница D-03 закреплена тестом.**

## Performance

- **Duration:** около 20 мин
- **Completed:** 2026-11-01
- **Tasks:** 2
- **Files modified:** 3 (2 создано, 1 изменён)

## Accomplishments

- Tracer (Task 1): модуль с одним ClassificationField, импорт в редактор, guard D-03; parity 22 строки, весь gate зелёный.
- Task 2: перенесены `ImagePlacement`, `mediaUrlFromText`, `dragHandoff` + `OrderDragHandle`, `ArchivedVirusEditor`, `DossierTabs`, `ConfirmAction` + `ConfirmDialog`, `EditorGroup`, `Field`, `ImageEditorField` в исходном относительном порядке. Экспортированы ровно восемь имён; `mediaUrlFromText`, `ImagePlacement`, `ConfirmAction`, `dragHandoff` остаются внутренними.
- `node scripts/phase17-move-parity.mjs --from components/portia-editor.tsx --to components/portia-editor-dossier.tsx` даёт `pure move: 320 lines` (exit 0), в том числе после коммита с `--ref HEAD~1`.
- Тест «the ≡ handle keeps no tooltip (D-18)» и тесты семейства проходят, читая `portia-editor-dossier.tsx` через `componentFamily()`.
- Модуль не содержит fetch, `/api/`, Supabase, ревизий и серверных lib-импортов (T-17-04); `referrerPolicy`/`loading` предпросмотра сохранены переносом (T-17-05); package.json и package-lock.json не менялись (T-17-SC).

## Task Commits

1. **Task 1: Модуль частей досье с ClassificationField и guard D-03** - `52ece89` (refactor)
2. **Task 2: Перенос остальных частей досье и parity-gate** - `ef6912d` (refactor)

**Plan metadata:** коммит docs (SUMMARY, STATE, ROADMAP) следует за этим файлом.

## Files Created/Modified

- `components/portia-editor-dossier.tsx` - `"use client"`, восемь экспортов, импорты react-хуков и lib
- `components/portia-editor.tsx` - объявления удалены, один импорт из `@/components/portia-editor-dossier`, убраны три неиспользуемых импорта
- `lib/dossier-parts.test.ts` - «17.1 parts stay server-agnostic (D-03)», «ImageEditorField works without onUpload (D-03)»

## Decisions Made

- Перенос выполнен одноразовым скриптом (в scratchpad, в репозиторий не добавлялся) по границам объявлений, с сохранением CRLF файла редактора; корректность подтверждена не скриптом, а parity-инструментом.
- Мутации остаются без перетаскивания (см. D-02 в плане): UX-правки не делались.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Визуальная дорожка и `playwright test --list` BLOCKED (ENV)**: `phase15-e2e-preflight.mjs visitor` печатает `[PORTIA_E2E_PREFLIGHT:missing-environment] Check: NEXT_PUBLIC_SUPABASE_ANON_KEY`. Исход идентичен эталону 17-PARITY-BASELINE.md (BLOCKED = BLOCKED) и НЕ является пиксельным доказательством. `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст. `.env.local` не читался.
- Тело редактора визуально остаётся BLOCKED (ROLE): авторизованная роль редактора недоступна; его parity доказана только механически инструментом переноса.
- Рабочее дерево на старте содержало `.planning/milestone.lock`, `.planning/state.json` и неотслеживаемые владельческие пути; не трогались и не коммитились.

## Known Stubs

None.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required. Чтобы визуальная дорожка перестала быть BLOCKED, нужно дать preflight-окружение (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` разрешённого проекта) в среде запуска.

## Next Phase Readiness

- Для Phase 17.1 готовы части досье; планы 17-03 и 17-04 дописывают свои файлы в `partFiles` теста D-03.
- Риск: пиксельной parity нет (BLOCKED ENV), редактор доказан только source-тестами и механическим доказательством переноса.

## Self-Check: PASSED

Файлы `components/portia-editor-dossier.tsx`, `lib/dossier-parts.test.ts`, `components/portia-editor.tsx` существуют; коммиты `52ece89` и `ef6912d` в истории HEAD; `commits: 2` измерено от `plan_head_before`; `git diff --name-only 908e416..HEAD` перечисляет только три файла из files_modified.

---
*Phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora*
*Completed: 2026-11-01*
