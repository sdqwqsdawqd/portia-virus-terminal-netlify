---
phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
plan: 03
subsystem: ui
tags: [decomposition, pure-move, dossier-viewer, server-agnostic, playwright-blocked]

requires:
  - phase: 17-01
    provides: phase17-move-parity tool, componentFamily() source tests
  - phase: 17-02
    provides: partFiles в lib/dossier-parts.test.ts, guard D-03
provides:
  - "components/portia-desktop-dossier.tsx: read-only просмотр досье (VirusRecord, DossierSection, MediaBlock, LoadingState, prioritizeImage, ScientistDocument) и общий рендер FormattedText"
  - "lib/dossier-parts.test.ts: guard D-03 покрывает и модуль просмотра"
affects: [17-04, phase-17.1]

actuals:
  tokens: 7600
  tasks: 2
  commits: 2
plan_head_before: 6c17b8b6e9f8292bd1217168babc02d10d4c4cb5
plan_head_after: 47085c54af021295ff7f9e59ae425049cf6b193a

tech-stack:
  added: []
  patterns:
    - "Seam-модуль components/portia-desktop-dossier.tsx входит в componentFamily() portia-desktop*"
    - "Перенос блоков скриптом по границам объявлений (в scratchpad, в репозиторий не добавлялся); корректность подтверждает только phase17-move-parity"

key-files:
  created:
    - components/portia-desktop-dossier.tsx
  modified:
    - components/portia-desktop.tsx
    - lib/dossier-parts.test.ts

key-decisions:
  - "Экспортированы ровно семь имён (FormattedText, VirusRecord, DossierSection, MediaBlock, LoadingState, prioritizeImage, ScientistDocument); documentBackground, embeddedMediaUrl, knownKlipyMedia, roman, classificationLevel, LoadingMedia, scientistDocument, RedactedDocument, generatedRedaction, ScientistRichText остались внутренними — desktop ими не пользуется"
  - "В desktop убраны только ставшие неиспользуемыми импорты (preconnect/preload, classificationOptions, ScientistLog); число lint-warnings осталось 18 как в эталоне"
  - "RowBadges остался в desktop по плану (строка списка вирусов)"

requirements-completed: [STAB-DESK-07]

coverage:
  - id: D1
    description: "Просмотр досье и FormattedText объявлены ровно в одном файле, desktop импортирует пять имён из модуля"
    requirement: STAB-DESK-07
    verification:
      - kind: other
        ref: "node scripts/phase17-move-parity.mjs --from components/portia-desktop.tsx --to components/portia-desktop-dossier.tsx (pure move: 101 lines до коммита; --ref HEAD~2 после коммитов: 172 строки, exit 0)"
        status: pass
      - kind: other
        ref: "grep: 7 export function в модуле, 0 перенесённых объявлений в desktop, 1 импорт из portia-desktop-dossier"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-03: модуль просмотра не знает про сервер"
    requirement: STAB-DESK-07
    verification:
      - kind: unit
        ref: "lib/dossier-parts.test.ts (partFiles содержит portia-desktop-dossier.tsx)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Семейные тесты рабочего стола: preconnect/preload и LoadingMedia loading=eager/fetchPriority=high сохранены, строки списка вирусов — опции listbox"
    requirement: STAB-DESK-07
    verification:
      - kind: unit
        ref: "lib/portia-desktop.test.ts через componentFamily(): «active remote media receives connection and fetch priority», «virus rows are options of the listbox»"
        status: pass
    human_judgment: false
  - id: D4
    description: "Полный локальный gate: npm test, tsc, lint, build, визуальный манифест, verify-promotion"
    verification:
      - kind: unit
        ref: "npm test 663 теста (662 pass, 1 skipped, 0 fail), tsc 0 ошибок, lint 0 errors / 18 warnings, build ok, манифест 37/37, verify-promotion 33 снимка"
        status: pass
    human_judgment: false
  - id: D5
    description: "Пиксельная parity окон application-virus-archive, application-information, application-guide, application-broadcasts"
    verification:
      - kind: e2e
        ref: "npm exec playwright -- test --list / tests/e2e/visual"
        status: unknown
    human_judgment: true
    rationale: "BLOCKED (ENV): phase15-e2e-preflight.mjs требует NEXT_PUBLIC_SUPABASE_ANON_KEY в окружении процесса. Исход совпадает с 17-PARITY-BASELINE.md (BLOCKED = BLOCKED), не pass."

duration: 15min
completed: 2026-11-01
status: complete
---

# Phase 17 Plan 03: Просмотр досье и FormattedText в отдельном модуле Summary

**Карточка досье (VirusRecord, DossierSection, MediaBlock, LoadingState), записи учёных и общий рендер FormattedText перенесены байт-в-байт в `components/portia-desktop-dossier.tsx`; инструмент переноса подтверждает чистый перенос, граница D-03 закреплена тестом.**

## Performance

- **Duration:** около 15 мин
- **Completed:** 2026-11-01
- **Tasks:** 2
- **Files modified:** 3 (1 создан, 2 изменены)

## Accomplishments

- Tracer (Task 1): `knownKlipyMedia`, `embeddedMediaUrl`, `documentBackground`, `FormattedText` в новом модуле, desktop импортирует `FormattedText`; parity 71 строка, весь gate зелёный.
- Task 2: перенесены `roman`, `classificationLevel`, `prioritizeImage`, `VirusRecord`, `ScientistDocument`, `scientistDocument`, `RedactedDocument`, `generatedRedaction`, `ScientistRichText`, `LoadingMedia`, `DossierSection`, `LoadingState`, `MediaBlock` в исходном относительном порядке; `roman` и `classificationLevel` в desktop других пользователей не имели, копий нет.
- `node scripts/phase17-move-parity.mjs --from components/portia-desktop.tsx --to components/portia-desktop-dossier.tsx` даёт `pure move: 101 lines` до коммита и `172 lines` (`--ref HEAD~2`) после, exit 0. Порядок полей карточки, `log.lockedLevel <= 2`, вид `RedactedDocument` и порядок разделов 01-06 не менялись.
- Модуль не содержит fetch, `/api/`, Supabase и ревизий (T-17-07); FormattedText по-прежнему рендерит React-узлы без `dangerouslySetInnerHTML`, `embeddedMediaUrl` принимает только https (T-17-06); package.json и package-lock.json не менялись (T-17-SC).
- Вне плана не тронуты: `components/portia-wallpaper.tsx`, `components/portia-wallpaper-spider.tsx` (`git diff --name-only 6c17b8b..HEAD` перечисляет ровно три файла плана).

## Task Commits

1. **Task 1: FormattedText в модуле просмотра досье** - `17fe02c` (refactor)
2. **Task 2: Карточка досье, медиа и записи учёных в модуль; guard D-03** - `47085c5` (refactor)

**Plan metadata:** коммит docs (SUMMARY, STATE, ROADMAP) следует за этим файлом.

## Files Created/Modified

- `components/portia-desktop-dossier.tsx` - `"use client"`, семь экспортов, импорты react / react-dom / portia-content / portia-icons
- `components/portia-desktop.tsx` - перенесённые объявления удалены, один импорт из `@/components/portia-desktop-dossier`, убраны неиспользуемые импорты
- `lib/dossier-parts.test.ts` - `partFiles` дополнен `portia-desktop-dossier.tsx`

## Decisions Made

- Перенос выполнен одноразовым скриптом в scratchpad по границам объявлений; корректность доказана parity-инструментом, а не скриптом.
- Экспортируется минимум (семь имён из плана); `documentBackground` экспортировался бы только если бы desktop им пользовался — это не так.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Визуальная дорожка и `playwright test --list` BLOCKED (ENV)**: `phase15-e2e-preflight.mjs visitor` печатает `[PORTIA_E2E_PREFLIGHT:missing-environment] Check: NEXT_PUBLIC_SUPABASE_ANON_KEY`, `playwright.config.ts` падает на preflight. Исход идентичен эталону 17-PARITY-BASELINE.md и НЕ является пиксельным доказательством для application-virus-archive / information / guide / broadcasts. `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст. `.env.local` не читался, ключи не задавались.
- Рабочее дерево на старте содержало `.planning/milestone.lock`, `.planning/state.json` и неотслеживаемые владельческие пути; не трогались и не коммитились.

## Known Stubs

None.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required. Чтобы визуальная дорожка перестала быть BLOCKED, нужно дать preflight-окружение (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` разрешённого проекта) в среде запуска.

## Next Phase Readiness

- Для Phase 17.1 готовы карточка досье и FormattedText; план 17-04 дописывает свою строку в `partFiles`.
- Риск: пиксельной parity нет (BLOCKED ENV); доказательство — механический чистый перенос, source-тесты, tsc, lint, build и байты утверждённых снимков (`--verify-promotion`).

## Self-Check: PASSED

Файлы `components/portia-desktop-dossier.tsx`, `components/portia-desktop.tsx`, `lib/dossier-parts.test.ts` существуют; коммиты `17fe02c` и `47085c5` в истории HEAD; `commits: 2` измерено от `plan_head_before`.

---
*Phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora*
*Completed: 2026-11-01*
