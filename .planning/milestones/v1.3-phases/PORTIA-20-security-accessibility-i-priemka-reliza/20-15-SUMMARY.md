---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 15
subsystem: release-reconciliation
tags: [D-70, D-68, D-69, D-12, release-gate, reconciliation, accepted-debts, STAB-REL-01, STAB-REL-02, STAB-REL-03, STAB-REL-07, STAB-REL-08, STAB-SEC-06, STAB-VIS-03]
requires:
  - phase: PORTIA-20
    provides: "20-14 журнал D-70 (ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT), 20-63 раннер с readEffectiveOwnerVerdict и протокол репетиции, 20-58 общий вердикт владельца (D-68), 20-31 черновик release notes"
provides:
  - "scripts/phase20-release-gate.mjs: releaseVerdict, phaseClosure, D70_VERDICT, D70_DEBT_LANES, режимы --verify-lineage, --verify-docs, --verify-reconciliation, --verify-independent"
  - "20-RELEASE-EVIDENCE.md: протокол полного прогона на итоговом release commit a05a6019e867 (итог BLOCKED, FAIL нет)"
  - "20-RECONCILIATION.md: lineage, приёмка на устройствах (принятый риск D-70), визуальная приёмка D-68, итог релиза, закрытие фазы, реестр принятых долгов (79 строк)"
  - "20-RELEASE-NOTES.md (status final), 20-RELEASE-SUMMARY.md (63 строки), 20-RELEASE-VERIFICATION.md (32 ID), 20-DEPLOYED-EVIDENCE.md (BLOCKED)"
affects: [milestone-closure]
key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RECONCILIATION.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RELEASE-SUMMARY.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RELEASE-VERIFICATION.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-DEPLOYED-EVIDENCE.md
  modified:
    - scripts/phase20-release-gate.mjs
    - lib/phase20-release-gate.test.ts
    - lib/phase20-release-notes.test.ts
    - lib/phase20-uat.test.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RELEASE-EVIDENCE.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RELEASE-NOTES.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
key-decisions:
  - "Итог релиза под D-70 — худший из итога раннера и PASS-WITH-OWNER-WAIVERS (releaseVerdict); на FRC раннер дал BLOCKED, итог релиза BLOCKED, простой PASS невозможен"
  - "Закрытие фазы «С ПРИНЯТЫМИ ДОЛГАМИ (D-70)» вычисляет phaseClosure: каждый BLOCKED-гейт FRC входит в D70_DEBT_LANES, нет FAIL, high и ошибок журнала, действующий вердикт accepted; это допуск закрытия с долгами, не PASS"
  - "21 требование Phase 20 без доказательства на FRC записаны Accepted debt (D-70) без галочки; Complete — только STAB-SEC-06 (новое) и прежние десять с доказательством; requirements.mark-complete не запускался"
  - "Открытые пункты Phase 18 и 19 записаны принятыми долгами по прочтению 20-CONTEXT.md D-70 (4); слова варианта 2 помечены как слова оркестратора"
status: complete
outcome: complete-blocked-env-d70-accepted-debts
release_verdict: BLOCKED
phase_closure: С ПРИНЯТЫМИ ДОЛГАМИ (D-70)
final_release_commit: a05a6019e867a39a42e2d33b9e4f176d281bc659
release_candidate_commit: f49aa00f2b9833f962fa3fa890117e98a4abf362
plan_head_before: 3efb53d859098f1329138bc067b8ee88399ba41e
plan_head_after: 284e504422d310c5448b448ba3676e596291eb12
commits: 18
requirements-completed: [STAB-SEC-06]
requirements-accepted-debt: [STAB-REL-01, STAB-REL-02, STAB-REL-03, STAB-REL-05, STAB-REL-06, STAB-REL-07, STAB-REL-08, STAB-A11Y-01, STAB-A11Y-02, STAB-A11Y-03, STAB-A11Y-04, STAB-MEDIA-07, STAB-SEC-03, STAB-VIS-01, STAB-VIS-02, STAB-VIS-03, STAB-VIS-04, STAB-EDIT-01, STAB-EDIT-02, STAB-EDIT-03, STAB-EDIT-04]
actuals:
  tokens: 58000
  tasks: 3
  commits: 18
---

# Phase 20 Plan 15: итоговая сверка релиза с принятым риском владельца (D-70) Summary

PLAN_BASE: 3efb53d859098f1329138bc067b8ee88399ba41e

Релиз Phase 20 сведён на итоговом release commit (FRC) `a05a6019e867a39a42e2d33b9e4f176d281bc659`: полный прогон раннера дал итог BLOCKED без FAIL (12 из 17 гейтов PASS, пять полос среды BLOCKED), итог релиза по D-70 — BLOCKED (PASS невозможен), закрытие фазы — «С ПРИНЯТЫМИ ДОЛГАМИ (D-70)». Физическая приёмка заменена принятым риском владельца (его слова — дословно из 20-CONTEXT.md D-70), визуальная часть принята общим вердиктом D-68, 79 открытых пунктов записаны в реестр принятых долгов и ни один из них не PASS.

## Task 1: lineage под D-70 и полный прогон на FRC

- Условие (precondition): обе строки вердикта 20-UAT.md — `ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)`; порт 3100 свободен (0); `portia-release-*` в `git worktree list` нет.
- RED `e4e6110`: 136 тестов, 120 pass, 16 fail (нет `verifyLineage`, `releaseVerdict`, `phaseClosure`, `D70_*`).
- GREEN `a05a601` (= FRC): `releaseVerdict` (худший по VERDICT_RANK из итога раннера и PASS-WITH-OWNER-WAIVERS, неизвестный итог — FAIL), `phaseClosure`, `verifyD70Ledger` (слова владельца сверяются со строкой D-70 в 20-CONTEXT.md, ответ «2», запись решения с 40 hex, ни один шаг не PASS, вердикты устройств без commit), `verifyLineage` (RC = `release_commit` 20-63 и предок FRC; `productCodeChanges` от записи D-70 и от действующего вердикта до FRC; реестр эталонов на коммите 20-58; `matrixBlockers`; строки «Итог раннера на FRC», «Итог релиза» и «Закрытие фазы» сверяются с вычисленными). 136 тестов, 136 pass; tsc и eslint чистые.
- `99df918`: 20-RECONCILIATION.md с `final_release_commit`, `release_candidate_commit`, `plan_base`.
- Полный прогон (один, повторов нет): `node --experimental-strip-types scripts/phase20-release-gate.mjs --run --commit a05a6019e867a39a42e2d33b9e4f176d281bc659 --npm-cli "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"` на Node 22.13.1, npm 11.19.0 (из Node 24.21.0, исполняется Node 22.13.1; переносной npm не чинился), 2026-11-08T18:47:22Z - 18:55:26Z, артефакты `test-results/release-gate/a05a6019e867-20261108T184722771Z/`. Итог BLOCKED (exit 1 — данные протокола): node-version, tree-clean, npm-ci, unit (1683/0/9/0), typecheck, build, lint, audit-prod, audit-evidence, visual-manifest (49/0/0/0), ui-contract-offline (150/0/14 по проекту 14), visual-approved (21/0/54 по проекту 54) — PASS; e2e-full, visual-phase20 (32 пройдено, 2 пропущены — пара Promotion проверяющего), mutation-attest, e2e-mutation, staging-live — BLOCKED (ENV). Временная копия удалена раннером, порт 3100 свободен.
- `c615f4a`: 20-RELEASE-EVIDENCE.md — `renderEvidence` из receipt.json плюс перенесённые разделы протокола 20-63; числа T-20-31 (40 из 40) и D-43/D-44/D-37 (165 из 165) перепроверены в основной папке на FRC. `--verify-evidence` — exit 0.
- `b74e71d`: разделы «Lineage», «Приёмка на устройствах: принятый риск владельца (D-70)», «Визуальная приёмка (D-68)», «Итог релиза». `--verify-lineage` — exit 0.
- `PORTIA_REQUIRE_UAT=1 node --experimental-strip-types --test lib/phase20-uat.test.ts` — exit 1 (47 тестов, 46 pass, 1 fail, ошибки «is not acceptance»): строгий режим остаётся красным.

## Task 2: release notes, реестр принятых долгов, статусы требований

- RED `d684210`: 147 тестов, 136 pass, 11 fail. GREEN `1bfc999`: `verifyDocs` (реестр: четыре допустимых статуса, нет PASS/Complete, минимальный набор D-70 (3), открытые требования Phase 15/18/19, gap и behavior_unverified из 18/19-VERIFICATION, CR-01, BLOCKED (DATA), BLOCKED-гейты протокола, production-миграции, todo; release notes: `status: final`, `release_commit` = FRC, раздел D-70 и его первое предложение; строки Phase 15/18/19 REQUIREMENTS.md против `plan_base`; строка STAB-VIS-03 / D-39). 147 тестов, 147 pass.
- Документы отдельными коммитами: `ec49e0b` (release notes final, раздел «Приёмка владельцем без UAT (D-70)», обновлённое «Не доказано»), `418d54a` (реестр, строка STAB-VIS-03 / D-39 по D-48, финальный review STAB-REL-08 как проверка агента), `d16b775` (REQUIREMENTS.md), `f7e8b6b` (ROADMAP.md: строка D-70 и описание 20-15).
- Реестр «Принятые долги (D-70)»: 79 строк — «Принятый долг (D-70)» 69 (21 требование Phase 20; 14 требований Phase 18 и 17 требований Phase 19, не Complete; 3 gap и 3 behavior_unverified 18-VERIFICATION; 4 gap 19-VERIFICATION; CR-01; ячейки BLOCKED (DATA); 5 полос среды FRC), «ОЖИДАЕТ ВЛАДЕЛЬЦА» 3 (D-36(б) production 20261104000000, D-47 production 20261104000100, 20261106000000), «Отложено владельцем» 3 (todo `2026-11-08-template-builder-framing-dialog`, `2026-11-07-desktop-visual-overhaul`, `2026-11-07-nick-access-request`), «Вне D-70: решает владелец» 4 (Phase 15: STAB-BASE-02, 03, 04, 06). Слова варианта 2 о Phase 18/19 помечены как слова оркестратора и «прочтение 20-CONTEXT.md D-70 (4)».
- REQUIREMENTS.md: `Accepted debt (D-70)` и снятая галочка у 21 требования Phase 20 (STAB-REL-01, 02, 03, 05, 06, 07, 08; STAB-A11Y-01..04; STAB-MEDIA-07; STAB-SEC-03; STAB-VIS-01..04; STAB-EDIT-01..04); STAB-SEC-06 — Complete (release notes final, `--verify-docs`); прежние Complete Phase 20 (SEC-02, SEC-05, TMPL-01, SEARCH-05..07, CLASS-01..04) не менялись; строки Phase 15/18/19 не менялись (diff к PLAN_BASE: 0 изменённых строк); `requirements.mark-complete` не запускался.
- `node --experimental-strip-types --test lib/phase20-release-notes.test.ts lib/phase20-requirements-ledger.test.ts lib/phase20-release-gate.test.ts` — 194 теста, 194 pass; `--verify-docs` — exit 0.

## Task 3: сверка SUMMARY, release verification, deployed evidence

- RED `2a8d4d7`: 162 теста, 147 pass, 15 fail. GREEN `37083eb`: `listPlans` (список 20-NN-PLAN.md из файлов, нижняя граница 58 против пустого glob; сейчас 63), `verifyReconciliation` (SUMMARY всех планов кроме 20-15 — сейчас 62, status complete, commit в каждом; строка crosswalk на каждый план; 20-14 — вердикт D-70; 20-15 — пометка «SUMMARY создаётся после гейта»; строка release verification на каждый ID Phase 20 и согласованность с REQUIREMENTS.md; одинаковая строка «Итог релиза», не PASS, в трёх документах; deployed evidence — метаданные или явный BLOCKED; файлы после FRC только из разрешённого списка; включает `verifyLineage` и `verifyDocs`), `verifyIndependent` (20-15-SUMMARY.md, 20-VERIFICATION.md, SUMMARY всех 63 планов, FRC / verdict / closure сверяются с reconciliation и строкой 20-15, `requirements-completed` без долгов).
- `160a8a3`: 20-RELEASE-SUMMARY.md (63 строки, каждый SUMMARY — предок FRC), 20-RELEASE-VERIFICATION.md (32 ID: 11 PASS, 21 «Принятый долг (D-70)»), 20-DEPLOYED-EVIDENCE.md (BLOCKED: доверенных метаданных Netlify deploy нет, опубликованный сайт не запрашивался, D-14). `--verify-reconciliation` — exit 0.

## Верификация

| Проверка | Результат |
|---|---|
| `--verify-evidence` | exit 0 |
| `--verify-lineage` | exit 0 |
| `--verify-docs` | exit 0 |
| `--verify-reconciliation` | exit 0 |
| `--verify-independent` | не запускалась: нужен независимый 20-VERIFICATION.md и этот SUMMARY (после гейта) |
| `PORTIA_REQUIRE_UAT=1` (lib/phase20-uat.test.ts) | exit 1 (красный, как требуется) |
| `node --experimental-strip-types --test lib/*.test.ts` (Node 22.13.1, основная папка) | 1719 тестов, 1716 pass, 0 fail, 3 skipped |
| `node node_modules/typescript/bin/tsc --noEmit` | без ошибок |
| eslint `scripts lib` | 0 ошибок, 1 предупреждение (не из этого плана) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] lib/phase20-release-notes.test.ts закреплял черновик**
- **Found during:** Task 2 (verify)
- **Issue:** тест реальных release notes требовал `status: draft` и `release_commit: ОЖИДАЕТ 20-15`; финализация, которую требует план, делала его красным. Файл не входит в разрешённые после FRC пути плана.
- **Fix:** утверждение заменено на `status: final` и `release_commit` = `final_release_commit` из 20-RECONCILIATION.md; путь добавлен в `POST_FRC_PATHS` раннера (фикстура обновлена), в reconciliation и в протокол записано, какие тесты менялись после FRC (только тесты, код продукта не менялся).
- **Commits:** ec49e0b, ec45387, 284e504

**2. [Rule 1 - Bug] lib/phase20-uat.test.ts требовал, чтобы 20-RELEASE-EVIDENCE.md был протоколом release candidate**
- **Found during:** финальный полный прогон unit в основной папке
- **Issue:** тест «the release commit of the ledger is the release commit of the 20-63 protocol» искал в протоколе commit RC; протокол по плану теперь на FRC.
- **Fix:** протокол сверяется с `final_release_commit` 20-RECONCILIATION.md; `release_candidate_commit` журнала по-прежнему равен `release_commit` 20-63-SUMMARY.md. Путь добавлен в `POST_FRC_PATHS`.
- **Commit:** 3e822b2

**3. [Rule 1 - Bug] `verifyDocs` брал цитату владельца из списка изменений, а не из раздела вердикта**
- **Found during:** подготовка 20-RECONCILIATION.md на реальных файлах
- **Issue:** первая строка `> ` в 20-58-SUMMARY.md — список изменений, показанный владельцу, а не его слова.
- **Fix:** цитата читается из раздела «Вердикт владельца»; добавлен регрессионный тест (163 теста).
- **Commit:** 5174d33

**4. [Rule 2 - Critical] Статусы требований за пределами минимального набора D-70 (3)**
- Правило плана применено ко всем Phase 20 без доказательства на FRC: кроме восьми обязательных ID в долг записаны STAB-REL-01, 02, 03, STAB-MEDIA-07, STAB-SEC-03, STAB-VIS-01..04, STAB-EDIT-01..04 (недостающее доказательство — шаги НЕ ПРОВЕРЕНО (D-70), BLOCKED (DATA) или полосы D70_DEBT_LANES). Complete оставлены только прежние десять и STAB-SEC-06.

### Прочее

- При сборке раннера первая вставка кода дала неверный файл из-за спецсимвола `$` в строке замены; файл `scripts/phase20-release-gate.mjs` (только мой неотправленный правленый вариант) возвращён `git checkout -- <файл>` и вставка повторена без ошибки.
- Матрица безопасности написана на `ddbf427`; после него изменено 31 файл продукта (без `*.test.*`). Повторный глубокий обзор безопасности в 20-15 не проводился — это записано в 20-RELEASE-NOTES.md, «Не доказано».

## Auth gates

Не возникали. Production, Supabase и staging не затрагивались; файлы `.env*` не читались.

## Known Stubs

Нет заглушек в созданных файлах.

## Threat Flags

Нет новой поверхности: изменены раннер проверки, тесты и документы. Митигации модели угроз: T-20-15 (lineage, `productCodeChanges`, полный прогон и `--verify-evidence` на FRC), T-20-138 (вердикт только через `readEffectiveOwnerVerdict`), T-20-153 (`releaseVerdict`, одна строка «Итог релиза» в трёх документах), T-20-154 (`requirements.mark-complete` не запускался, `--verify-docs` отвергает Complete у долга), T-20-155 (`phaseClosure`), T-20-SC (новые пакеты не устанавливались).

## Осталось после плана

- Независимый GSD verifier создаёт `20-VERIFICATION.md`; после него `node --experimental-strip-types scripts/phase20-release-gate.mjs --verify-independent` должен дать exit 0 (закрытие фазы требует этого).
- Действия владельца, не выполняемые агентом: применить или не применять миграции production `20261104000000`, `20261104000100`, `20261106000000` (ОЖИДАЕТ ВЛАДЕЛЬЦА); решение по todo; если когда-либо потребуется настоящая приёмка — отдельный вердикт владельца.

## Self-Check: PASSED

- Созданные файлы существуют: 20-RECONCILIATION.md, 20-RELEASE-SUMMARY.md, 20-RELEASE-VERIFICATION.md, 20-DEPLOYED-EVIDENCE.md, 20-15-SUMMARY.md.
- Commit FRC `a05a6019e867` и коммиты плана входят в историю ветки (`git merge-base --is-ancestor`).
- `--verify-evidence`, `--verify-lineage`, `--verify-docs`, `--verify-reconciliation` — exit 0 на HEAD `284e504`.
