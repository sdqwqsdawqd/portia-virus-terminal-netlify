---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 14
subsystem: uat-ledger
tags: [D-70, owner-accepted-risk, uat-ledger, STAB-REL-05, STAB-REL-06, STAB-REL-07, STAB-REL-08, STAB-A11Y-01, STAB-A11Y-02, STAB-A11Y-03, STAB-A11Y-04]
requires:
  - phase: PORTIA-20
    provides: "20-27 журнал и валидатор, 20-58 вердикт владельца (D-68), 20-63 протокол репетиции на f49aa00f2b98 (итог BLOCKED), запись D-70 в 20-CONTEXT.md (03e890a)"
provides:
  - "lib/phase20-uat.test.ts: статусы НЕ ПРОВЕРЕНО (D-70) и вердикт ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70), проверка раздела D-70 (слова владельца сверяются с константой и с 20-CONTEXT.md), запрет маскировки BLOCKED и PASS рядом с D-70, строгий режим отвергает статусы D-70 как `not acceptance`; 47 тестов"
  - "20-UAT.md: раздел «D-70: принятие риска владельцем без UAT» со словами владельца дословно, правило 12, 80 шагов `НЕ ПРОВЕРЕНО (D-70)`, 4 шага BLOCKED, два вердикта D-70"
affects: [20-15]
key-files:
  modified:
    - lib/phase20-uat.test.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UAT.md
    - .planning/ROADMAP.md
key-decisions:
  - "D-70 в журнале — отказ владельца от приёмки, а не приёмка: ни один шаг и ни один вердикт не PASS, у шагов D-70 нет устройства, commit, даты и скриншота, вердикт D-70 не несёт commit"
  - "Шаг с BLOCKED prerequisite остаётся BLOCKED того же вида (MEDIA-01 через P19-GAP-15 — BLOCKED (DATA), PROMO-03 через REVIEWER-ROLE — BLOCKED (ENV)); статус D-70 у prerequisites допустим только у STAGING-FREE и REVIEWER-ROLE"
  - "Строгий режим PORTIA_REQUIRE_UAT=1 остаётся красным: каждый шаг, prerequisite и вердикт со статусом D-70 даёт ошибку `not acceptance`"
status: complete
outcome: owner-accepted-risk-d70
release_candidate_commit: f49aa00f2b9833f962fa3fa890117e98a4abf362
plan_head_before: 08075912a2b50d68c7a36e518143156219dbae61
plan_head_after: 483df1f1507ca3c6f27b321a08c2747428eae1f6
commits: 5
requirements-completed: []
requirements-accepted-debt: [STAB-REL-05, STAB-REL-06, STAB-REL-07, STAB-REL-08, STAB-A11Y-01, STAB-A11Y-02, STAB-A11Y-03, STAB-A11Y-04]
actuals:
  tokens: 34200
  tasks: 2
  commits: 5
---

# Phase 20 Plan 14: журнал приёмки по D-70 (принятый риск владельца) Summary

Решение владельца D-70 записано в `20-UAT.md` его словами: пошаговая физическая приёмка PC и phone не проводилась, итог 20-14 — `ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)` на обоих устройствах, никогда не PASS. Валидатор `lib/phase20-uat.test.ts` отличает это от приёмки (47 тестов, 47 pass), строгий режим `PORTIA_REQUIRE_UAT=1` остаётся красным (46 pass, 1 fail, ошибки `not acceptance`).

PLAN_BASE: 08075912a2b50d68c7a36e518143156219dbae61

## Что записано в журнал

Строки вердикта 20-UAT.md:

```
Вердикт PC: ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)
Вердикт phone: ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)
```

- frontmatter: `status: accepted-risk-d70`, `release_candidate_commit: f49aa00f2b9833f962fa3fa890117e98a4abf362` (release commit 20-63).
- Раздел «D-70: принятие риска владельцем без UAT»: дата 2026-11-08; слова владельца дословно «Можно ли сразу перейти к след фазе? ведь меня все устраивает»; ответ владельца «2»; текст варианта 2 дословно из 20-CONTEXT.md D-70 с пометкой «слова оркестратора, не владельца»; запись решения — 20-CONTEXT.md D-70, commit 03e890a0135ff20f02b4ab68fe39642fff84c39f; release commit; «Код продукта после записи D-70: НЕ ИЗМЕНЁН». Агент слов от имени владельца не добавлял; сверка с 20-CONTEXT.md выполняется тестом.
- Шаги: PC — 39 `НЕ ПРОВЕРЕНО (D-70)`, 1 BLOCKED (ENV) (PROMO-03), 1 BLOCKED (DATA) (MEDIA-01); phone — 41 `НЕ ПРОВЕРЕНО (D-70)`, 1 BLOCKED (ENV) (PROMO-03), 1 BLOCKED (DATA) (MEDIA-01). Всего 80 шагов D-70 и 4 BLOCKED. PASS и ОЖИДАЕТ среди шагов нет; у шагов D-70 устройство, commit, дата и скриншот — «-».
- Prerequisites: P19-GAP-15..22 без изменений (D-34; STAB-PROM-15, CR-01 и BLOCKED (DATA) фазы 19 не объявлены PASS); OWNER-MIG-D36 и OWNER-MIG-NOTES — «ОЖИДАЕТ ВЛАДЕЛЬЦА» (D-70 (5), D-36(б), D-47); STAGING-FREE — `НЕ ПРОВЕРЕНО (D-70)`; REVIEWER-ROLE — BLOCKED (ENV) (пара Promotion проверяющего в «Открытых блокерах» протокола 20-63); VISUAL-APPROVED — PASS 2026-11-08 по действующему вердикту `readEffectiveOwnerVerdict` (accepted, звеньев нет, `ownerVerdict.commit` реестра равен `owner_verdict_commit`, код продукта не менялся); RELEASE-GATE — BLOCKED (ENV) (итог протокола 20-63 без усиления: e2e-full, visual-phase20, mutation-attest, e2e-mutation, staging-live).
- Правила журнала: в правило 3 добавлен статус D-70, в правило 8 — вердикт D-70, новое правило 12; прежние правила не удалялись. Раздел D-15 — «не требуется».

## Task 1: запись D-70 сквозь журнал (tracer)

- Precondition выполнено: `release_commit` 20-63-SUMMARY.md = commit протокола `20-RELEASE-EVIDENCE.md` (`f49aa00f2b98…`); `git diff --name-only 03e890a… f49aa00… -- app components public lib` без `*.test.*` пуст (на HEAD тоже пуст; от 0c2a59d1d1a7 до HEAD пуст).
- RED `a4144ca`: фикстуры `pendingLedger` и `waivedLedger`, 12 новых тестов; два теста о незаполненном журнале переведены на `pendingLedger(ledger)`. Прогон на валидаторе без D-70: `# tests 42`, `# pass 31`, `# fail 11` (30 прежних проходят).
- GREEN `24ae20b`: константы `D70_STEP_STATUS`, `D70_VERDICT`, `D70_OWNER_WORDS`, `d70WaivablePrerequisites`, `D70_HEADING`; раздел `d70` в `sectionOf`/`parseUat`; правила в `validatePrerequisites`, `validateSteps`, `validateVerdicts` и новая `validateD70`; в журнале — раздел D-70 и первый шаг INFO-PC-01. Прогон: `# tests 42`, `# pass 42`, `# fail 0`.
- Трассер (verify 1 и 2): обычный режим зелёный (exit 0, 42/42), `PORTIA_REQUIRE_UAT=1` — exit 1 с `not acceptance`. Расширять журнал разрешено, `⚡ Tracer verified end-to-end — expanding`.

## Task 2: весь журнал по D-70

- RED `e206d14`: пять тестов «committed ledger» (оба вердикта D-70, нет PASS/ОЖИДАЕТ, BLOCKED ровно там, где prerequisite BLOCKED, RELEASE-GATE повторяет итог протокола, release commit журнала = release commit 20-63). Прогон на журнале после Task 1: `# tests 47`, `# pass 44`, `# fail 3`.
- GREEN `7a48156`: журнал заполнен. Прогон: `# tests 47`, `# pass 47`, `# fail 0`.
- ROADMAP `483df1f`: описание строки 20-14 заменено по плану; отметку `[ ]` ставит workflow.

## Проверки

| Проверка | Результат |
|---|---|
| `node --experimental-strip-types --test lib/phase20-uat.test.ts` (Node 22.13.1) | `# tests 47`, `# pass 47`, `# fail 0` (было 30/30 на ревизии плана) |
| `PORTIA_REQUIRE_UAT=1 …` | exit 1; `# pass 46`, `# fail 1`; 168 вхождений `not acceptance` в выводе |
| `node node_modules/typescript/bin/tsc --noEmit` | exit 0 |
| `node node_modules/eslint/bin/eslint.js lib/phase20-uat.test.ts` | exit 0, без замечаний |
| acceptance_criteria Task 1 | раздел D-70: 1; слова владельца в журнале 1 и в тесте 1; `ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)` в тесте 2, `НЕ ПРОВЕРЕНО (D-70)` 4; RED раньше GREEN (`a4144ca` < `24ae20b`) |
| acceptance_criteria Task 2 | строк вердикта D-70: 2; `\| ОЖИДАЕТ \|`: 0; `release_candidate_commit` = RC: 1; `status: accepted-risk-d70`: 1; `журнал приёмки по D-70` в ROADMAP: 1; `requirements-completed: []` |
| инвариант REQUIREMENTS.md | отмеченных `STAB-REL-05..08` и `STAB-A11Y-01..04`: 0 |
| код продукта после 03e890a | `git diff --name-only 03e890a… HEAD -- app components public lib` без `*.test.*`: пусто |

## Требования

`requirements-completed: []`. Шаг `requirements.mark-complete` workflow пропущен намеренно (план 20-14, D-70, T-20-152): STAB-REL-05, STAB-REL-06, STAB-REL-07, STAB-REL-08, STAB-A11Y-01, STAB-A11Y-02, STAB-A11Y-03, STAB-A11Y-04 этим планом не отмечаются выполненными. `REQUIREMENTS.md` не менялся. Они записаны как `requirements-accepted-debt`; статус «принятый долг (D-70)» в REQUIREMENTS.md ставит 20-15.

## Deviations from Plan

**1. [Rule 3 - Blocking] Константы D-70 добавлены уже в RED-коммит**
- **Found during:** Task 1, шаг RED.
- **Issue:** фикстуры и тесты ссылаются на `D70_STEP_STATUS`, `D70_VERDICT`, `D70_OWNER_WORDS`, `d70WaivablePrerequisites`; план относит объявление констант к GREEN.
- **Fix:** строковые константы объявлены в RED-коммите, но не подключены к валидатору (`stepStatuses` без D-70). RED падает по требуемой причине: валидатор не знает D-70 (11 fail).
- **Commit:** `a4144ca`.

**2. [Rule 2 - Missing critical functionality] Строже плана: дата и заметка у prerequisite D-70, и отдельные ошибки по устройству/дате/скриншоту шага**
- **Found during:** Task 1, GREEN.
- **Issue:** план требует «без устройства, commit, даты и скриншота» и заметку «D-70»; отдельной ошибки на каждое поле в плане нет.
- **Fix:** по одной ошибке на поле (device, commit, date, screenshot, note), та же проверка даты и заметки для STAGING-FREE и REVIEWER-ROLE.
- **Commit:** `24ae20b`.

**3. [Process] Пять тестов реального журнала вместо одного**
- План называет один тест «the committed ledger records the D-70 owner waiver»; добавлены ещё четыре проверки того же журнала (release commit 20-63, BLOCKED ровно там, где prerequisite BLOCKED, RELEASE-GATE не сильнее итога протокола, журнал нигде не называет D-70 приёмкой). Две из них проходили в RED после Task 1 (release commit, формулировка), три падали.
- **Commit:** `e206d14`.

**4. [Attribution] Строка Co-Authored-By**
- В запросе оркестратора указано `Claude Opus 5.5`; по правилу атрибуции среды коммиты этого плана подписаны `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (исполнитель — Sonnet 5.5). Прежние коммиты репозитория подписаны Opus 5.5. Если нужна единая подпись, правится при слиянии или `commit --amend` оркестратором.

**Total deviations:** 4 (1 Rule 3, 1 Rule 2, 2 process notes). **Impact:** на содержание журнала и на вердикты не влияют.

## Known Stubs

Нет. Ни один шаг не имитирует проверку: непроверенные шаги названы `НЕ ПРОВЕРЕНО (D-70)`.

## Threat Flags

Нет новых поверхностей: изменены тест, журнал планирования и строка ROADMAP; production, Supabase, staging, файлы окружения и браузер не использовались.

## Ограничения (честно)

- VISUAL-APPROVED — PASS (по вердикту владельца D-68 и доказательствам протокола 20-63, как требует план); это не физическая приёмка и не PASS шага. Строка не относится к допустимым статусам D-70 (`d70WaivablePrerequisites`) и отказом владельца не менялась.
- RELEASE-GATE — BLOCKED (ENV): итог релиза не PASS; чистого прогона на release commit нет, 20-15 сводит с пометкой «принятый риск владельца (D-70)» и не усиливает итог.
- Миграции production (OWNER-MIG-D36, OWNER-MIG-NOTES) — «ОЖИДАЕТ ВЛАДЕЛЬЦА»; PW-07 и PW-10 — waivers владельца по протоколу 20-63.
- Строгий режим `PORTIA_REQUIRE_UAT=1` остаётся красным; это ожидаемо и проверяется тестом.

## Self-Check: PASSED

- Файлы: `lib/phase20-uat.test.ts`, `20-UAT.md`, `.planning/ROADMAP.md` изменены и закоммичены; `20-14-SUMMARY.md` создан.
- Коммиты в истории: `a4144ca`, `24ae20b`, `e206d14`, `7a48156`, `483df1f` (`git merge-base --is-ancestor` для каждого — да).
- `git rev-list --count 08075912…..HEAD` на момент записи SUMMARY: 5.
