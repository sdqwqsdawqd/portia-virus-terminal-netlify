---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 63
subsystem: release-gate
tags: [D-69, G6, release-rehearsal, STAB-REL-01, STAB-REL-02, STAB-REL-03]
requires:
  - phase: PORTIA-20
    provides: "20-13 репетиция FAIL (D-69), 20-59 явный npm и правило пропусков, 20-60 G1, 20-61 G2, 20-62 G3, 20-58 вердикт владельца"
provides:
  - "scripts/phase20-release-gate.mjs: readEffectiveOwnerVerdict (цепочка owner_verdict_renews), единый источник вердикта для визуальной приёмки и --verify-evidence"
  - "lib/phase20-release-gate.test.ts: 120 тестов (было 108)"
  - "20-RELEASE-EVIDENCE.md: протокол репетиции на f49aa00f2b98, итог BLOCKED, --verify-evidence проходит"
affects: [20-14, 20-15]
key-files:
  modified:
    - scripts/phase20-release-gate.mjs
    - lib/phase20-release-gate.test.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RELEASE-EVIDENCE.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/deferred-items.md
key-decisions:
  - "Действующий вердикт владельца читает одна функция: 20-58-SUMMARY.md плюс звенья owner_verdict_renews в SUMMARY планов после 58; первое неверное звено останавливает цепочку (ОЖИДАЕТ ВЛАДЕЛЬЦА, итог не выше BLOCKED); эталоны остаются за коммитом 20-58"
  - "Репетиция повторена одним полным прогоном на f49aa00f2b98: FAIL продукта, UI-контракта и эталонов нет, итог BLOCKED из-за полос среды"
status: complete
outcome: complete-blocked-env
verdict: BLOCKED
release_commit: f49aa00f2b9833f962fa3fa890117e98a4abf362
plan_head_before: 03e890a0135ff20f02b4ab68fe39642fff84c39f
plan_head_after: d873e2e392a5365504c4bafd7a238b1181492c6b
commits: 7
actuals:
  tokens: 18600
  tasks: 2
  commits: 7
---

# Phase 20 Plan 63: повтор релизной репетиции на новом release commit (G6) Summary

PLAN_BASE: 03e890a0135ff20f02b4ab68fe39642fff84c39f

Полная репетиция раннера на release commit `f49aa00f2b9833f962fa3fa890117e98a4abf362` даёт итог BLOCKED: десять технических гейтов, `ui-contract-offline` и `visual-approved` — PASS, остальные пять строк (`e2e-full`, `visual-phase20`, `mutation-attest`, `e2e-mutation`, `staging-live`) — BLOCKED (ENV), FAIL нет. Пункты FAIL репетиции 20-13 (G1-G5) закрыты доказательствами гейтов. Протокол `20-RELEASE-EVIDENCE.md` собран `renderEvidence` из `receipt.json` и проходит `--verify-evidence`. Код продукта после вердикта владельца 0c2a59d1d1a7 не менялся (раннер: «НЕ ИЗМЕНЁН»).

## Task 1: функция действующего вердикта и release commit

- Условие (verify 1): файлов продукта (`app components public lib`, без `*.test.*`), изменённых после 0c2a59d1d1a7, на PLAN_BASE: 0. Звеньев `owner_verdict_renews` в SUMMARY фазы нет (`grep -l '^owner_verdict_renews:'` пусто), поэтому результат функции равен вердикту 20-58-SUMMARY.md, а протокол совпадает по форме с 20-13.
- RED `87a6a6c`: `node --experimental-strip-types --test lib/phase20-release-gate.test.ts` — 120 тестов, 108 pass, 12 fail (нет `readEffectiveOwnerVerdict`).
- GREEN `5b9cce4`: `readEffectiveOwnerVerdict(deps, root)` и её использование в `computeVisualRows` и `verifyEvidenceMode`; 120 из 120.
- Правила звена: `owner_verdict_renews` равен коммиту предыдущего звена, `owner_verdict_commit` — 40 hex, существует в репозитории и потомок предыдущего (`git merge-base --is-ancestor`), дата ГГГГ-ММ-ДД не раньше предыдущей, звенья по номеру плана больше 58; цепочка останавливается на первом неверном звене, вердикт при этом «ОЖИДАЕТ ВЛАДЕЛЬЦА» с причиной «цепочка вердиктов нарушена: <файл>», итог не выше BLOCKED. Звено `fixes-requested` — «ИСПРАВИТЬ (владелец) <дата>», итог FAIL. «Эталоны 20-12» сверяются с коммитом 20-58. Фикстуры: нет звеньев, одно звено, два звена и порядок, чужой коммит, не-потомок, нет `renews`, нет даты, короткий коммит, коммита нет в репозитории, дата раньше, тот же коммит, пустой вердикт, `fixes-requested`, реальный git-репозиторий, `--verify-evidence` с звеном и со сломанной цепочкой, тест исходника. Агент звено не пишет (тест исходника).
- Release commit: `f49aa00f2b9833f962fa3fa890117e98a4abf362`. Первый кандидат `5b9cce4` отвергнут: быстрый прогон (`5b9cce438b14-20261108T181153338Z`) дал typecheck FAIL (TS2531 в тесте цепочки, который не проверял tsc в основной папке до коммита); исправлено `f49aa00`.
- Быстрый прогон шести гейтов на RC (`test-results/release-gate/f49aa00f2b98-20261108T181407602Z`): node-version, tree-clean, npm-ci, unit, typecheck, visual-manifest — PASS; в `gates.md` строка `npm: 11.19.0 (--npm-cli C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js)`.

## Task 2: полная репетиция и протокол

Один полный прогон (повторов нет): `node --experimental-strip-types scripts/phase20-release-gate.mjs --run --commit f49aa00f2b9833f962fa3fa890117e98a4abf362 --npm-cli "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`, 2026-11-08 18:15:24Z - 18:23:37Z, Node раннера 22.13.1. Каталог артефактов: `test-results/release-gate/f49aa00f2b98-20261108T181524984Z`. Копия `portia-release-f49aa00f2b98-20261108T181524984Z` создана и удалена раннером, порт 3100 свободен.

### Таблица гейтов (RC f49aa00f2b98)

| Gate | Режим данных | Результат | Счётчики (passed/failed/skipped/flaky) |
|---|---|---|---|
| node-version, tree-clean | - | PASS | - |
| npm-ci | - | PASS (npm 11.19.0 через `--npm-cli`) | - |
| unit | - | PASS | 1650/0/9/0 |
| typecheck, build, lint | - | PASS | - |
| audit-prod | - | PASS (found 0 vulnerabilities) | - |
| audit-evidence | - | PASS | - |
| visual-manifest | - | PASS | 49/0/0/0 |
| e2e-full | цель | BLOCKED (ENV): нет цели с публичными значениями | - |
| ui-contract-offline | offline D-68 | PASS | 150/0/14/0 (по проекту 14) |
| visual-approved | offline D-68 | PASS | 21/0/54/0 (по проекту 54) |
| visual-phase20 | offline D-68 | BLOCKED (ENV): reviewer-пара Promotion, 2 теста пропущены | 32/0/2/0 |
| mutation-attest, e2e-mutation, staging-live | staging | BLOCKED (ENV): нет аттестованного isolated staging | - |

Итог раннера: BLOCKED (причины: пять строк BLOCKED (ENV); PW-07 и PW-10 приняты владельцем ранее). Визуальная приёмка D-68, вычислено раннером: «Общий вердикт» ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-08 (запись 20-58), «Эталоны 20-12» 60 строк реестра (56 в 20-13), «Код продукта» НЕ ИЗМЕНЁН.

Сбой завершения Firefox не проявился: 0 из 3 запусков с `firefox-desktop`; это среда, не PASS.

### Перепроверка перенесённых чисел (основная папка, Node 22.13.1, на RC)

- T-20-31: `lib/editor-outline.test.ts` — 40 тестов, 40 pass.
- D-43/D-44/D-37: unit-файлы `portia-desktop`, `search-index`, `search-recommendations`, `virus-classes`, `portia-content-normalize` — 165 тестов, 165 pass.
- D-39/D-45: «class icons» и «spider at rest» пройдены на chromium-desktop и chromium-phone в visual-phase20 этого прогона.
- D-33 — по 20-SECURITY-MATRIX.md без изменений; D-36(б) production и D-47 production остаются «ОЖИДАЕТ ВЛАДЕЛЬЦА».

### Закрытие пунктов 20-13 (G1-G6)

| Пункт | План | Результат в этом прогоне |
|---|---|---|
| G1: событие `about:srcdoc` в ui-contract-offline | 20-60 (a6a77ae, 7c06c4d, 3e27b1e, abdc4c4) | закрыт: ui-contract-offline PASS 150/0/14 |
| G2: эталон `phone-webkit--webkit-phone` | 20-61 (4f96258, b58051c, d901593) | закрыт: visual-approved PASS 21/0/54, webkit-phone пройден |
| G3: кадры движения Вивьян | 20-62 (cf36225, cc3f13e, dee25d5, 7a36547) | закрыт: visual-approved PASS 21/0/54 |
| G4: пропуски по проекту | 20-59 (094aec2, 85c2484) | закрыт: правило уровня гейта, счётчики «(по проекту N)» |
| G5: явный и записанный npm | 20-59 (ed665e2, 5944ed5) | закрыт: строка `npm: 11.19.0 (--npm-cli …)` в протоколе |
| G6: повтор репетиции на новом release commit | 20-63 | выполнен: протокол на f49aa00f2b98, итог BLOCKED (полосы среды), FAIL нет |

### Сравнение с 20-13 (c11adf6, FAIL)

- Стало PASS: `ui-contract-offline` (было FAIL 139/11/14), `visual-approved` (было FAIL 19/2/54), `unit` теперь 1650/0/9, npm-ci без обёртки, с записанным npm.
- Остаётся BLOCKED (ENV), как в 20-13: `e2e-full`, `visual-phase20` (reviewer-пара), `mutation-attest`, `e2e-mutation`, `staging-live`. Причины среды и внешние решения, не код.
- Итог изменился с FAIL на BLOCKED: красных гейтов нет.

### Готов ли релиз к 20-14 (по протоколу)

По протоколу: технические гейты, доступные офлайн, зелёные; итог не PASS, потому что пять строк среды BLOCKED (ENV), и PASS в протоколе не записан. 20-14 может сверяться с release commit `f49aa00f2b9833f962fa3fa890117e98a4abf362`. Физическая приёмка этим планом не проверялась и не засчитана; её исход (решение владельца D-70) записывается в 20-14 и PASS гейтов не заменяет.

## Проверки

| Проверка | Результат |
|---|---|
| `node --experimental-strip-types --test lib/*.test.ts` (основная папка, Node 22.13.1) | 1659 tests, 1656 pass, 0 fail, 3 skipped |
| `lib/phase20-release-gate.test.ts` | 120 pass, 0 fail |
| `tsc --noEmit` (прямой вызов typescript) | exit 0 |
| eslint | 0 errors, 17 warnings (как было) |
| `node scripts/phase15-visual-manifest.mjs --verify-promotion` | exit 0: 65 точных одобренных снимков, 18 исключено |
| `--verify-evidence` | release evidence verified, exit 0 |
| `git diff --stat 03e890a HEAD -- tests/e2e/visual app components public lib` | только `lib/phase20-release-gate.test.ts` (+258) |
| `git worktree list` без `portia-release-`, порт 3100 | свободен |

## Commits

| Задача | Commit | Subject |
|---|---|---|
| 1 RED | 87a6a6c | RED for the renewed owner verdict chain (D-68, D-69) |
| 1 GREEN | 5b9cce4 | effective owner verdict chain in the release gate (D-68, D-69) |
| 1 docs | c41c268 | запись release commit (черновик SUMMARY) |
| 1 fix | f49aa00 | типизация теста цепочки; **release commit** |
| 1 docs | 59da1e1 | release commit сдвинут на f49aa00 (черновик SUMMARY) |
| 2 | e1a3aeb | протокол репетиции на f49aa00f2b98 (итог BLOCKED) |
| 2 docs | d873e2e | deferred-items после репетиции |

`commits: 7` измерено `git rev-list --count 03e890a..HEAD` на d873e2e (до коммита этого SUMMARY).

## Deviations from Plan

**1. [Rule 1 - Bug] Тесты цепочки не проходили typecheck на чистой копии.**
- **Found during:** Task 1, быстрый прогон шести гейтов на `5b9cce4`.
- **Issue:** `readEffectiveOwnerVerdict` возвращает объект или null; в тестах `.chainError` без проверки на null — TS2531 (я не запустил tsc перед GREEN; npm переносного Node неисправен, прямой вызов typescript работает).
- **Fix:** помощник `effectiveOf` проверяет, что 20-58 читается, и возвращает ненулевое значение. Release commit сдвинут на `f49aa00`; первый кандидат и его артефакты (`5b9cce438b14-20261108T181153338Z`) в протокол не входят, названы в «Запуск и среда».
- **Files modified:** lib/phase20-release-gate.test.ts
- **Commit:** f49aa00

**2. [Форма] Протокол собран скриптом из scratchpad** (`renderEvidence` из `receipt.json` плюс перенесённые строки D-33 и «Решения D-35..D-45» из прежнего протокола 46d9704 с перепроверенными числами T-20-31, D-43/D-44/D-37, D-39/D-45 и приложение; дословная цитата владельца берётся скриптом из 20-58-SUMMARY.md). Статусы, commit, режимы данных, `npm:`, «Визуальная приёмка владельца (D-68)» и «Код продукта» вычислил раннер.

**3. [Форма] Комментарий к `readEffectiveOwnerVerdict` длиннее двух строк** (описание аргументов и правил цепочки в блоке JSDoc); смысл D-68 и D-69 в нём есть.

**Total deviations:** 3 (1 Rule 1, 2 по форме). **Impact:** без влияния на гейты, эталоны и код продукта.

## Authentication gates

None.

## Known Stubs

None. Офлайн-результаты помечены «offline D-68» и не названы доказательством реальных данных.

## Threat Flags

None. T-20-148 закрыта (протокол из receipt через `renderEvidence`, `--verify-evidence` проходит, один полный прогон без скрытых повторов); T-20-149 закрыта (звено принимается только с `owner_verdict_renews`, потомком и датой; фикстуры на каждое правило; эталоны за 20-58; агент звено не пишет); T-20-SC: новые пакеты не устанавливались, `npm ci` раннера во временной копии по lockfile.

## Self-Check: PASSED

- Коммиты 87a6a6c, 5b9cce4, f49aa00, e1a3aeb, d873e2e — предки HEAD.
- `20-RELEASE-EVIDENCE.md` привязан к RC (`Commit:` равен `release_commit`), строка `npm:` и `24.21.0` присутствуют, раздел «Закрытие пунктов репетиции 20-13 (D-69)» один, `--verify-evidence` exit 0.
- Порт 3100 свободен, копий `portia-release-` нет, эталоны, продукт, 20-14 и 20-15 этим планом не менялись.
