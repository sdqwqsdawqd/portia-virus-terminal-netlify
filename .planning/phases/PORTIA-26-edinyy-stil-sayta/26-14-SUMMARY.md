---
phase: PORTIA-26-edinyy-stil-sayta
plan: 14
subsystem: ui
tags: [regressions, window-clamp, shortcut-motion, will-change, phase-gate, owner-report]
status: complete

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "26-12 — знаки классификации по рисунку владельца"
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "26-13 — находки axe и контраст на всех акцентах"
provides:
  - "lib/window-geometry.test.ts: зеркальный тест клэмпа окна (UI-11a) — drag ±Δ, resize e/w, fit, 4 области, 2 размера окна"
  - "lib/phase26-regressions.test.ts: последний кадр анимаций ярлыка = покой, will-change без переключения (UI-11b)"
  - "26-REGRESSIONS.md: исходы пп. 9 и 10 todo 2026-10-28 — NOT REPRODUCED (код не менялся) и BLOCKED (DEVICE)"
  - "26-VISUAL-REPORT.md: текстовый отчёт владельцу по экранам фазы, допущения, история снимков v1.3, «Не проверено»"
affects: [27]

plan_head_before: 66ada8e6763f22824f30bb3861b7d6c702802232
plan_head_after: 673eb14d304d786bcca3c443d37875e5ffcdbdbb

actuals:
  tokens: 7200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "регрессия сначала проверяется тестом на текущем коде; код меняется только при красном тесте (UI-SPEC «verify on current code first»)"
    - "исходный тест последнего кадра анимации разбирает @keyframes и правила покоя прямо из app/portia.css; таймер снятия класса сверяется с длительностью анимации в компоненте"

key-files:
  created:
    - lib/phase26-regressions.test.ts
    - .planning/phases/PORTIA-26-edinyy-stil-sayta/26-REGRESSIONS.md
    - .planning/phases/PORTIA-26-edinyy-stil-sayta/26-VISUAL-REPORT.md
  modified:
    - lib/window-geometry.test.ts

key-decisions:
  - "UI-11a (п. 9, клэмп окна): зеркальный тест зелёный на текущем коде — NOT REPRODUCED, lib/window-geometry.ts не менялся; устройство и DPR 1.25 — BLOCKED (DEVICE), Phase 27"
  - "UI-11b (п. 10, конец анимации ярлыка): тест зелёный на текущем CSS — NOT REPRODUCED, app/portia.css не менялся; резкость на DPR 1.25 и телефоне — BLOCKED (DEVICE), Phase 27"
  - "will-change: оставлено решение Phase 19 (D-17) — постоянный у частей знаков, объявлен в правиле покоя; у контейнера .desktop-icon его нет ни в покое, ни при is-dragging/is-dropping (противоречие UI-SPEC «только во время анимации» записано владельцу)"
  - "Двойной масштаб при перетаскивании (transform: scale(1.035) у .is-dragging + scale: 1.035 из shortcut-pickup, ≈1.071 в «Включены») скачка не даёт и к п. 10 не относится — записан владельцу как замечание, не правился"

patterns-established:
  - "отчёт фазы владельцу — один текстовый файл по экранам (D-10) с разделом «Не проверено», без галерей и хэшей"

requirements-completed: [UI-11]

coverage:
  - id: D1
    description: "Трассер UI-11a: отступ окна слева и справа одинаков (8px) для drag ±Δ, resize e/w и fit с зеркальных стартов, в т.ч. дробные границы"
    requirement: UI-11
    verification:
      - kind: unit
        ref: "lib/window-geometry.test.ts#mirrored start (Phase 26 UI-11a): left and right insets are equal for drag, resize and fit"
        status: pass
    human_judgment: false
  - id: D2
    description: "UI-11b: конец анимаций ярлыка совпадает с покоем, will-change не переключается"
    requirement: UI-11
    verification:
      - kind: unit
        ref: "lib/phase26-regressions.test.ts#UI-11b: shortcut-drop ends on the resting frame, and shortcut-pickup hands over to shortcut-drop without a jump"
        status: pass
      - kind: unit
        ref: "lib/phase26-regressions.test.ts#UI-11b: every shortcut symbol animation ends on its resting frame (scale, translate, rotate, transform)"
        status: pass
      - kind: unit
        ref: "lib/phase26-regressions.test.ts#UI-11b: the resting shortcut container has no scale, translate, rotate, transform or will-change"
        status: pass
      - kind: unit
        ref: "lib/phase26-regressions.test.ts#UI-11b: will-change on the container never follows is-dragging / is-dropping (no toggle, no residual will-change: transform)"
        status: pass
      - kind: unit
        ref: "lib/phase26-regressions.test.ts#UI-11b: symbol will-change is constant — declared in the resting rule, never in a rule with the animation class (Phase 19, D-17)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Поведение на устройстве: клэмп окна при DPR 1.25, резкость ярлыка в конце анимации на ПК 125% и телефоне"
    requirement: UI-11
    human_judgment: true
    rationale: "BLOCKED (DEVICE) до Phase 27: исходные тесты проверяют формулы и CSS, не растр на устройстве"
  - id: D4
    description: "Шлюз фазы: юнит-тесты, tsc, eslint, сборка, манифест снимков и --verify-promotion"
    verification:
      - kind: command
        ref: "node --experimental-strip-types --test lib/*.test.ts (2354 tests, 0 fail, 3 skipped live suites)"
        status: pass
      - kind: command
        ref: "node node_modules/typescript/bin/tsc --noEmit"
        status: pass
      - kind: command
        ref: "node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next (0 errors, 17 warnings)"
        status: pass
      - kind: command
        ref: "node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts (49 tests, 0 fail)"
        status: pass
      - kind: command
        ref: "node scripts/phase15-visual-manifest.mjs --verify-promotion (Verified 65 exact owner-approved snapshot bytes; 18 non-approved rows excluded.)"
        status: pass
    human_judgment: false
  - id: D5
    description: "26-VISUAL-REPORT.md — понятность и полнота отчёта для владельца"
    human_judgment: true
    rationale: "Оценивает владелец; механически проверено только наличие разделов «Не проверено», BLOCKED (DEVICE) и отсутствие слова PASS"

duration: ≈12 мин
completed: 2026-11-16
---

# Phase 26 Plan 14: Регрессии рабочего стола, шлюз фазы и отчёт владельцу Summary

**Обе регрессии 2026-10-28 проверены тестами на текущем коде и не воспроизводятся (клэмп окна симметричен 8px; обе анимации ярлыка и 33 анимации знаков кончаются ровно на покое, `will-change` не переключается). Код сайта не менялся; локальный шлюз фазы зелёный; владельцу написан текстовый отчёт по экранам с честным списком непроверенного.**

## Performance

- **Duration:** ≈12 мин
- **Started:** 2026-11-16T17:00Z (примерно, после коммита 26-13 в 17:02Z)
- **Completed:** 2026-11-16T17:15Z
- **Tasks:** 3
- **Files:** 4 (1 изменён, 3 созданы)
- **Node:** 22.13.1 (эталонная, была на PATH)

## Accomplishments

- Трассер UI-11a: зеркальный тест клэмпа окна для областей 1366×768, 1920×1080, 1536×864 и 1535.2×763.2 (DPR 1.25), окон 680×320 и 900×600; drag на ±1/±50/±5000, resize восточного/западного края, fit. Сразу зелёный → NOT REPRODUCED.
- UI-11b: `lib/phase26-regressions.test.ts` (5 тестов) — покой контейнера `.desktop-icon` (16 правил) без transform/will-change; `shortcut-drop` 100% = покой; `shortcut-pickup` 100% = `shortcut-drop` 0%; таймер `is-dropping` (180 мс) не короче анимации (180 мс); 33 анимации знаков кончаются на покое; `will-change` знаков только в правилах покоя. Сразу зелёный → NOT REPRODUCED.
- `26-REGRESSIONS.md`: таблица исходов, решение по `will-change`, замечание о двойном масштабе при перетаскивании.
- Шлюз фазы на Node 22.13.1 — все пять команд плана зелёные, плюс `next build` собрался.
- `26-VISUAL-REPORT.md`: по экранам (общие элементы, рабочий стол, ярлыки 521–900, окна, развёрнутое окно, 11 вкладок редактора, карточка заявки, вход, «Информация» на телефоне, иконки), правило одной переделки, допущения A1–A10 и планов, история снимков v1.3, регрессии, проверено локально, «Не проверено».

## Рабочие заметки (дословные итоги)

- Task 1, на текущем коде: `node --experimental-strip-types --test lib/window-geometry.test.ts lib/window-open.test.ts` → `# tests 43` `# pass 43` `# fail 0` (новый тест — `ok 23 - mirrored start (Phase 26 UI-11a)…`).
- Task 2, на текущем CSS: `node --experimental-strip-types --test lib/phase26-regressions.test.ts lib/portia-desktop.test.ts` → `# tests 88` `# pass 88` `# fail 0`.
- Шлюз:
  - `node --experimental-strip-types --test lib/*.test.ts` → `# tests 2354` `# suites 47` `# pass 2351` `# fail 0` `# skipped 3` (пропущены живые наборы: Promotion live DB, staging live concurrency, staging live role matrix — запускаются только вручную).
  - `node node_modules/typescript/bin/tsc --noEmit` → выход 0, ошибок нет.
  - `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` → `✖ 17 problems (0 errors, 17 warnings)`, выход 0; предупреждения в файлах, которых план не касался.
  - `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` → `# tests 49` `# pass 49` `# fail 0`.
  - `node scripts/phase15-visual-manifest.mjs --verify-promotion` → `Verified 65 exact owner-approved snapshot bytes; 18 non-approved rows excluded.` Режим `--verify` не запускался.
  - `node node_modules/next/dist/bin/next build` → выход 0, `✓ Compiled successfully in 6.6s`. `.env*` агент не читал и не печатал (Next читает сам).

## Task Commits

1. **Task 1: трассер — зеркальный клэмп окна (UI-11a)** — `1908c01` (test)
2. **Task 2: последний кадр анимаций ярлыка = покой (UI-11b)** — `e4b31d9` (test)
3. **Task 3: шлюз фазы и `26-VISUAL-REPORT.md`** — `673eb14` (docs)

Коммитов `feat`/`fix` нет: оба пункта NOT REPRODUCED, по плану код не менялся.

## Files Created/Modified

- `lib/window-geometry.test.ts` — добавлен тест «mirrored start (Phase 26 UI-11a)».
- `lib/phase26-regressions.test.ts` — новый, 5 тестов UI-11b.
- `.planning/phases/PORTIA-26-edinyy-stil-sayta/26-REGRESSIONS.md` — исходы пп. 9, 10.
- `.planning/phases/PORTIA-26-edinyy-stil-sayta/26-VISUAL-REPORT.md` — отчёт владельцу.
- `.planning/WINDOWS.md` — две записи `unrun-verify` (устройство для пп. 9 и 10), коммитятся с метаданными плана.

`lib/window-geometry.ts` и `app/portia.css` не менялись.

## Decisions Made

См. `key-decisions`. Главное: исход регрессий фиксирует тест, а не ожидание; оба теста зелёные на текущем коде, поэтому правок кода нет. `will-change` — по Phase 19 (постоянный у частей знаков, у контейнера нет).

## Deviations from Plan

None - plan executed exactly as written.

Уточнения без отклонения:
- Тест `shortcut-pickup` сверяет его последний кадр не с покоем, а с первым кадром `shortcut-drop`: последний кадр подъёма — это состояние перетаскивания, а не покой; покою должен равняться конец `shortcut-drop` (он и сверяется). Дополнительно проверен таймер снятия `is-dropping` против длительности анимации.
- Сборка Next запущена (план разрешал, если агенту не нужно читать `.env*`) и собралась.

**Total deviations:** 0. **Impact:** нет.

## Issues Encountered

- Слово PASS в документах фазы: в созданных этим планом `26-REGRESSIONS.md` и `26-VISUAL-REPORT.md` — 0. В более ранних документах фазы оно есть только как отрицание или мета-упоминание (`26-01-SUMMARY.md`: «красный результат там — ожидаемый дрейф, не PASS»; `26-02-SUMMARY.md`: «`grep -cw PASS` = 0»; планы, UI-SPEC, RESEARCH — формулировки запретов). Ни одно не заявляет пройденную проверку; чужие документы не правились.
- Замечание о двойном масштабе при перетаскивании — вне п. 10, не исправлялось (см. `26-REGRESSIONS.md`).

## Known Stubs

Нет.

## Threat Flags

Нет: новых сетевых точек, путей авторизации, доступа к файлам и схем план не добавлял. T-26-29 (нет PASS, исходы только по тесту или BLOCKED), T-26-30 (только `--verify-promotion`), T-26-31 (`.env*` не читались) соблюдены.

## Для владельца

Две жалобы от 28 октября проверены на текущем коде.

1. **Окно у левого и правого края.** Тест двигал и растягивал окна разных размеров на экранах 1366, 1536, 1920 точек и на дробной ширине, как при масштабе Windows 125%. Отступ от края везде одинаковый, 8 точек слева и справа. Жалоба на текущем коде не воспроизводится, код не менялся.
2. **Ярлык прыгает в конце анимации.** Проверены подъём и отпускание ярлыка и все 33 анимации значков. Последний кадр каждой совпадает с обычным видом: тот же размер, то же место, без поворота. Ускорение отрисовки (`will-change`) не включается и не выключается в конце анимации, поэтому резкость меняться не должна. Жалоба на текущем коде не воспроизводится, код не менялся.

Одно замечание. Когда ярлык тащат при анимациях «Включены», он увеличен примерно в 1.07 раза: два одинаковых увеличения по 1.035 срабатывают одновременно. При «Уменьшены» и «Выключены» увеличение 1.035. Скачка это не даёт. Если при перетаскивании ярлык кажется слишком крупным, это отдельная правка в одну строку.

Отчёт по всей фазе лежит в `26-VISUAL-REPORT.md`. Там по каждому экрану написано, что изменилось и какими значениями, перечислены допущения, принятые без вас, и то, что не проверялось. Локальные проверки прошли: 2354 юнит-теста без падений, типы, линтер, сборка, байты старых снимков. На настоящих ПК (в том числе с масштабом 125%) и телефоне ничего не проверялось. Это BLOCKED до Phase 27, пройденным не считается.

## Next Phase Readiness

Последний план фазы 26. Phase complete, ready for next step: проверка фазы оркестратором; затем Phase 27 (приёмка на устройствах: DPR 1.25, телефон, скринридер, axe/e2e при наличии окружения и данных).

## Self-Check: PASSED

Файлы на месте (4/4), коммиты 1908c01, e4b31d9, 673eb14 в истории; критерии приёмки трёх задач выполнены; `lib/window-geometry.ts` и `app/portia.css` не изменены.
