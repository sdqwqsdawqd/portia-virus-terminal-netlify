---
phase: PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische
plan: 06
subsystem: content
tags: [sec-03, seed-removal, empty-content, content-unavailable, wr-03, fail-closed]
status: complete

requires:
  - phase: PORTIA-25 plan 01
    provides: readContentRow / ServerReadError in GET, red-window gate
  - phase: PORTIA-25 plan 05
    provides: the seed lives in lib/testing/portia-content-fixture.ts, tests read it from there
provides:
  - "lib/portia-content.ts: emptyPortiaContent (all lists empty, formattedText {}) and assistantDefaults; the seed object and its clone function are deleted"
  - "lib/content-response.ts: contentUnavailable { error, code: content-unavailable }, contentReadable(row), fallback to the empty structure"
  - "GET /api/content: visitor without a readable row gets 503 contentUnavailable (no-store); editor gets 200 with the empty structure and revision 0; PUT baseline is emptyPortiaContent"
  - "components/portia-access-gate.tsx mounts the desktop with initialContent={emptyPortiaContent}; failureCopy.unavailable.heading is 'Данные временно недоступны'"
  - "shownViewerLevel(content, viewerLevel): marker, then gate level, then level 1 (WR-03 closed)"
affects: [25-08 (device cache bound to the person), 25-09 (build scan of .next for seed markers), 25-10 (supabase-rls-reviewer, red-window removal)]

actuals:
  tokens: 24000
  tasks: 2
  commits: 2
plan_head_before: 9dd05f8d9adb579b0831b6d428d56519b8c2f602
plan_head_after: 34a3485d1f63aca16a024b4d38ebbaa6e0cf6325
commits: 2

tech-stack:
  added: []
  patterns:
    - "Working code has no starting content: the empty structure is the only fallback; 'no data' for a visitor is a refusal (503 content-unavailable), never a seed"
    - "Assistant service phrases are a separate constant (assistantDefaults) so the normalizer needs no record-bearing object"
    - "Level shown on screen: marker of the copy, then the gate decision, then the lowest level"

key-files:
  created: []
  modified:
    - lib/portia-content.ts
    - lib/portia-content-normalize.ts
    - lib/content-response.ts
    - lib/content-response.test.ts
    - app/api/content/route.ts
    - components/portia-access-gate.tsx
    - lib/app-state.ts
    - lib/level-placeholders.ts
    - lib/level-placeholders.test.ts
    - components/portia-desktop.tsx
    - lib/level-ui.test.ts
    - lib/level-visitor.test.ts
    - lib/phase25-fixture-boundary.test.ts

key-decisions:
  - "Assumption A1 stands: assistant* phrases and timings are interface text and stay in assistantDefaults; the build-scan markers (plan 25-09) must not include them. Owner decision needed only if they count as content."
  - "A visitor whose row exists but does not normalize also gets 503 (contentReadable); an editor gets the empty structure in that case and saves by the row revision (baseRevision 0 inserts, otherwise update)."
  - "A failed server read and 'no data' share one body (contentUnavailable) so one text and one code mean 'no data'."
  - "The refusal line is failureCopy.unavailable.heading (shown by every desktop app on a 5xx without data); no new component."

requirements-completed: []  # SEC-03 is NOT checked off: source is clean, but the build scan of .next (25-09) and the browser run (25-10) have not proven the client bundle yet.

duration: about 20 min
completed: 2026-11-16

coverage:
  - id: D1
    description: "Seed and clone removed from the working module; emptyPortiaContent / assistantDefaults exported; normalizer falls back to assistantDefaults; normalizePortiaContent(emptyPortiaContent) is a structure and idempotent"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "lib/content-response.test.ts (EDGE SEC-03/empty; исходник PUT и шлюза)"
        status: pass
      - kind: unit
        ref: "lib/phase25-fixture-boundary.test.ts (production source declares no seed; the working module keeps the empty structure)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET: visitor with no readable row gets 503 content-unavailable with no-store before contentBodyFor; editor gets the empty structure, revision 0; PUT baseline uses emptyPortiaContent"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "lib/content-response.test.ts (D-22 contentReadable; EDGE SEC-03/null; исходник GET)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gate mounts the desktop with the empty structure; the visible line is 'Данные временно недоступны'. The real rendering in a browser is not shown here (browser is plan 25-10)"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "lib/content-response.test.ts (source pins of the gate and app-state)"
        status: pass
    human_judgment: true
    rationale: "Source pins only; how the empty desktop reads on screen is checked in the browser plan 25-10 (BLOCKED here)."
  - id: D4
    description: "WR-03: shownViewerLevel(content, viewerLevel) is marker, gate level, 1; all four desktop call sites pass viewerLevel"
    verification:
      - kind: unit
        ref: "lib/level-placeholders.test.ts (shownViewerLevel WR-03); lib/level-ui.test.ts D-15; lib/level-visitor.test.ts D-15"
        status: pass
    human_judgment: false

metrics:
  tasks: 2
  files: 13
---

# Phase 25 Plan 06: Seed removed from working code (SEC-03) Summary

Рабочий код больше не содержит стартовых записей: `lib/portia-content.ts` отдаёт пустую структуру `emptyPortiaContent` и служебные фразы помощника `assistantDefaults`; посетитель без данных получает 503 `content-unavailable`, редактор — пустую структуру, которую можно сохранить.

## Что сделано

**Task 1 (трассер, 1478867).** RED сначала: тесты в `lib/content-response.test.ts` упали на отсутствующих экспортах. Затем сид с МОРОК/АРАХНА/КАЛЛИСТО, `placeholderLogs` и функция клона удалены из `lib/portia-content.ts`; нормализатор берёт запасные значения из `assistantDefaults`; `contentBodyFor` без строки даёт нормализованную `emptyPortiaContent` (без маркера для редактора, с маркером и пустыми списками для посетителя, ревизия 0); GET отвечает посетителю без читаемой строки `contentUnavailable` со статусом 503 и `noStoreHeaders` раньше `contentBodyFor(`; ответ на `ServerReadError` — то же тело; PUT baseline — `emptyPortiaContent`; шлюз монтирует рабочий стол с `initialContent={emptyPortiaContent}`; заголовок отказа `unavailable` — «Данные временно недоступны».

**Task 2 (WR-03, 34a3485).** `shownViewerLevel(content, viewerLevel)` = маркер копии, затем уровень шлюза (только допустимое значение 1..5), затем `MIN_ACCESS_LEVEL`; в `components/portia-desktop.tsx` все четыре вызова передают `viewerLevel` (заголовок «База вирусов», `ScientistDocument`, `VirusRecord` в архиве, `VirusRecord` в корзине). Граничный тест расширен: в рабочих файлах нет прежних имён сида, `export const` с «seed/fixture» и импорта `lib/testing/`, а в `lib/portia-content.ts` нет названий трёх записей.

## Проверка

- Red-window gate (`node --experimental-strip-types --test --test-skip-pattern=... lib/*.test.ts`): 2186 тестов, 2183 pass, 0 fail, 3 skipped (два пропуска матрицы по плану; третий пропуск прежний, не из этого плана).
- `node node_modules/typescript/bin/tsc --noEmit`: 0 ошибок.
- ESLint (`node node_modules/eslint/bin/eslint.js --ignore-pattern dist --ignore-pattern .next .`): 0 errors, 17 warnings (прежние, в файлах вне плана).
- Acceptance Task 1: `emptyPortiaContent` 1, `assistantDefaults` 1, прежних имён сида в рабочем коде 0, `initialContent={emptyPortiaContent}` 1, `content-unavailable` в `lib/content-response.ts` 1, «Данные временно недоступны» в `lib/app-state.ts` 1: PASS.
- Acceptance Task 2: `shownViewerLevel(content, viewerLevel)` 4 вызова, `shownViewerLevel(content)` 0, `MIN_ACCESS_LEVEL` в `lib/level-placeholders.ts` 3: PASS.

## Статус доказательств

- Сборка и скан `.next` на маркеры: не выполнялись, план 25-09. Клиентский чанк не доказан чистым.
- Браузер, авторизованные роли, Postgres/RLS, staging/production: BLOCKED, план 25-10 и владелец.
- schema push: BLOCKED, шаг владельца. План не меняет `supabase/*.sql`, RLS, RPC и политики хранилища; `supabase-rls-reviewer` для него не нужен (план 25-10 запускает его по фазе).

## Deviations from Plan

Автоправок по Rules 1-4 нет. Мелкие отклонения исполнения:

- RED и GREEN каждой задачи закоммичены одним коммитом (как требует план: один коммит на задачу, явные пути).
- Комментарий в `lib/portia-content.ts` сначала назвал путь фикстуры и сломал граничный тест 25-05 (он ищет этот путь в рабочих файлах); формулировка исправлена до коммита.
- Переменная `module` в новом тесте переименована в `contentModule` (правило Next `no-assign-module-variable`).
- npm на временном Node не использован: tsc, eslint и тесты запускались напрямую (Node 22.13.1 на PATH).

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Known Stubs

None. Пустые массивы в `emptyPortiaContent` намеренны (D-16, D-22); данные приходят из базы.

## Вопросы владельцу

- A1: фразы и подсказки помощника (`assistantDefaults`) считаются служебным текстом интерфейса и остаются в рабочем коде. Если владелец сочтёт их содержимым, нужно отдельное решение.
- A-25-05 (из заметок фазы): должны ли реальные записи покинуть и тестовую фикстуру, не решено; содержимое `lib/testing/portia-content-fixture.ts` не менялось.

## Threat Flags

None. Новых сетевых точек, путей авторизации или схем нет; ответ 503 не раскрывает причину (T-25-22, T-25-23 закрыты в исходниках; T-25-24 принят).

## Self-Check: PASSED

- Файлы на диске: все 13 изменённых файлов присутствуют.
- Коммиты в ветке: 1478867, 34a3485.
