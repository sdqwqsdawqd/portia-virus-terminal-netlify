---
phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
plan: 01
subsystem: testing
tags: [node-test, parity-gate, decomposition, source-tests, playwright-blocked]

requires:
  - phase: 15-baseline
    provides: visual manifest, --verify-promotion, Playwright visual lane
provides:
  - "scripts/phase17-move-parity.mjs: доказательство, что increment является чистым переносом строк"
  - "lib/component-source.ts: componentFamily(), source-тесты читают семейство файлов"
  - "тест STAB-DESK-07: закреплены app ids, storage keys, /api/-адреса и границы импортов семейств"
  - "makeId в lib/editor-items.ts"
  - "17-PARITY-BASELINE.md: эталон gate до нарезки"
affects: [17-02, 17-03, 17-04, 17-05, phase-17.1]

actuals:
  tokens: 6100
  tasks: 2
  commits: 2
plan_head_before: 55f51d60d60362da55b28dd8010156d2260cdf85
plan_head_after: 70cbcd553b957e379986518190b86150448f28a9

tech-stack:
  added: []
  patterns:
    - "Чистый перенос доказывается мультимножеством строк (before минус after источника против прироста целей), а не визуально"
    - "Seam-модули называются components/portia-desktop-<seam>.tsx / portia-editor-<seam>.tsx, иначе выпадают из семейства (ловит тест границ импортов)"

key-files:
  created:
    - scripts/phase17-move-parity.mjs
    - lib/phase17-move-parity.test.ts
    - lib/component-source.ts
    - .planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-PARITY-BASELINE.md
    - .planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-FOUND-BUGS.md
  modified:
    - lib/editor-items.ts
    - components/portia-editor.tsx
    - lib/portia-desktop.test.ts
    - lib/accent-theme.test.ts

key-decisions:
  - "Эталон визуальной дорожки: BLOCKED (ENV), не pass; окружение и .env* не трогались"
  - "TEST-02 переписан без ослабления: не больше одного импорта rich-text-style на файл семейства и хотя бы один на всё семейство"
  - "Самопроверка семейства оформлена отдельным тестом, поэтому число тестов выросло на 3, а не на 2"

patterns-established:
  - "moveProblems возвращает массив строк problem:, пустой массив означает чистый перенос"
  - "Запуск инструмента до коммита задачи сравнивает HEAD с рабочим деревом; после коммита нужен --ref HEAD~1"

requirements-completed: [STAB-DESK-07]

coverage:
  - id: D1
    description: "Инструмент phase17-move-parity ловит любую изменённую, добавленную или потерянную строку и принимает чистый перенос"
    requirement: STAB-DESK-07
    verification:
      - kind: unit
        ref: "lib/phase17-move-parity.test.ts (8 тестов)"
        status: pass
    human_judgment: false
  - id: D2
    description: "makeId перенесён из components/portia-editor.tsx в lib/editor-items.ts без изменения тела"
    requirement: STAB-DESK-07
    verification:
      - kind: other
        ref: "node scripts/phase17-move-parity.mjs --from components/portia-editor.tsx --to lib/editor-items.ts (pure move: 1 lines, exit 0)"
        status: pass
      - kind: other
        ref: "npm run build, npm exec tsc -- --noEmit, npm run lint (0 errors)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Source-тесты читают семейство файлов; закреплены app ids, storage keys, /api/-адреса и границы импортов"
    requirement: STAB-DESK-07
    verification:
      - kind: unit
        ref: "lib/portia-desktop.test.ts#STAB-DESK-07: app ids, storage keys and API endpoints stay as pinned"
        status: pass
      - kind: unit
        ref: "lib/portia-desktop.test.ts#component families import only their own seams and the known shared components"
        status: pass
    human_judgment: false
  - id: D4
    description: "Пиксельная parity визуальной дорожки до и после плана"
    verification:
      - kind: e2e
        ref: "npm exec playwright -- test tests/e2e/visual --retries=0 --update-snapshots=none"
        status: unknown
    human_judgment: true
    rationale: "Дорожка BLOCKED (ENV): preflight требует NEXT_PUBLIC_SUPABASE_URL/ANON_KEY в окружении процесса, которых у исполнителя нет. Не pass."

duration: 25min
completed: 2026-11-01
status: complete
---

# Phase 17 Plan 01: Эталон parity и инструмент чистого переноса Summary

**Скрипт `phase17-move-parity.mjs` доказывает, что increment является чистым переносом строк; source-тесты читают семейство `portia-desktop*/portia-editor*`; app ids, storage keys и /api/-адреса закреплены тестом; `makeId` перенесён в `lib/editor-items.ts` как первый доказанный перенос.**

## Performance

- **Duration:** около 25 мин
- **Completed:** 2026-11-01T03:00Z
- **Tasks:** 2
- **Files modified:** 9 (5 создано, 4 изменено)

## Accomplishments

- Эталон gate записан до первой правки (HEAD `55f51d6`, Node 22.13.1): `npm test` 650 тестов (649 pass, 1 skipped), tsc, lint (0 errors, 18 warnings), build, 37 тестов визуального манифеста и `--verify-promotion` (33 байт-точных снимка) зелёные.
- Инструмент чистого переноса: `codeLines`/`moveProblems` и CLI `--from/--to/--ref`; 8 node:test. До переноса даёт `problem: nothing moved` (exit 1), после: `pure move: 1 lines components/portia-editor.tsx -> lib/editor-items.ts` (exit 0), лишний неизменённый `--to` не мешает.
- `componentFamily()` и переписанные source-тесты: регулярки и пороги не менялись, TEST-02 стал строже по структуре (по файлу и по семейству). Исключение hex-пресетов в `accent-theme.test.ts` расширено на `/\/portia-editor(-[a-z0-9-]+)?\.tsx$/`.
- STAB-DESK-07: тест закрепляет 12 AppId, 7 + 1 storage keys и счётчики /api/-адресов (значения сняты с HEAD тем же regex и совпали с плановыми); тест границ импортов запрещает статический импорт `portia-editor*` из семейства рабочего стола.

## Task Commits

1. **Task 1: Эталон parity-gate, инструмент чистого переноса и перенос makeId** - `c2f9040` (feat; tdd: RED подтверждён `ERR_MODULE_NOT_FOUND`, затем GREEN 8/8, один коммит по плану)
2. **Task 2: Source-тесты читают семейства файлов; закрепление STAB-DESK-07** - `70cbcd5` (test)

**Plan metadata:** коммит docs (SUMMARY, STATE, ROADMAP) следует за этим файлом.

## Files Created/Modified

- `scripts/phase17-move-parity.mjs` - codeLines/moveProblems + CLI, читает только переданные пути и git-объекты
- `lib/phase17-move-parity.test.ts` - 8 тестов по списку `<behavior>`
- `lib/component-source.ts` - `componentFamily(main)`
- `lib/editor-items.ts` - `export const makeId`
- `components/portia-editor.tsx` - удалена локальная `makeId`, добавлена в импорт из `@/lib/editor-items`
- `lib/portia-desktop.test.ts`, `lib/accent-theme.test.ts` - чтение семейств, новые тесты
- `17-PARITY-BASELINE.md`, `17-FOUND-BUGS.md` - эталон и журнал багов (D-08), журнал пуст

## Decisions Made

- Визуальная дорожка в эталоне записана как BLOCKED (ENV) по ячейкам тест x проект. Ключи не подставлялись, окружение не менялось.
- Самопроверка «семейство начинается с главного файла» сделана тестом, а не top-level assert: +3 теста вместо +2. Чтобы не нарушить критерий `grep -c 'readFileSync(new URL("../components/portia-editor.tsx"'` = 0, путь собирается через `mainFile(name)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `moveProblems` возвращает массив, а не объект**
- **Found during:** Task 1 (первый вариант скрипта)
- **Issue:** черновик возвращал `{ problems, moved }`, тесты и контракт плана требуют массив (`[]` для чистого переноса).
- **Fix:** функция возвращает массив; число перенесённых строк для CLI считается отдельно.
- **Files modified:** scripts/phase17-move-parity.mjs
- **Verification:** 8/8 тестов, CLI выводит `pure move: 1 lines ...`
- **Committed in:** c2f9040

---

**Total deviations:** 1 auto-fixed (Rule 1, до коммита). **Impact:** нулевой, правка внутри незакоммиченного черновика.

## Issues Encountered

- **Визуальная дорожка и `playwright test --list` BLOCKED (ENV).** `playwright.config.ts` вызывает `phase15-e2e-preflight.mjs visitor`, который печатает `[PORTIA_E2E_PREFLIGHT:missing-environment] Check: NEXT_PUBLIC_SUPABASE_ANON_KEY`. Node 22.13.1 был подключён, причина именно отсутствие env в процессе (значения только в `.env.local`, который нельзя читать). Ни один тест не запускался, исход одинаков до и после плана; `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст. Критерий «исход совпадает с таблицей эталона построчно» выполнен тривиально (BLOCKED = BLOCKED) и НЕ является пиксельным доказательством. Все BLOCKED-строки остаются BLOCKED.
- Рабочее дерево на старте уже содержало изменения `.planning/STATE.md`, `.planning/milestone.lock`, `.planning/state.json`; `milestone.lock` не трогался и не коммитился.

## Known Stubs

None.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required. Чтобы визуальная дорожка стала не-BLOCKED, владельцу нужно дать preflight-окружение (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` для разрешённого проекта) в среде запуска.

## Next Phase Readiness

- Готов `17-02`: общий `makeId` позволяет переносить `OrderDragHandle` и `nextBatch` независимо; каждый перенос проверять `node scripts/phase17-move-parity.mjs --from <main> --to <seam>` до коммита (после коммита с `--ref HEAD~1`).
- Seam-модули обязаны называться `portia-desktop-<seam>.tsx` / `portia-editor-<seam>.tsx`.
- Риск: визуальной parity нет (BLOCKED), редактор владельца виден только через source-тесты и механическое доказательство переноса.

## Self-Check: PASSED

Файлы из key-files существуют, коммиты `c2f9040` и `70cbcd5` в истории HEAD, `commits: 2` измерено от `plan_head_before`. Wallpaper, `app/portia.css`, `package.json`, `package-lock.json` не изменены (`git diff --name-only 55f51d6..HEAD` по этим путям пуст).

---
*Phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora*
*Completed: 2026-11-01*
