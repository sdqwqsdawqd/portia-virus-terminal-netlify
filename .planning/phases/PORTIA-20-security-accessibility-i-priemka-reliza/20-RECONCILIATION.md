---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
artifact: release-reconciliation
status: in-progress
final_release_commit: a05a6019e867a39a42e2d33b9e4f176d281bc659
release_candidate_commit: f49aa00f2b9833f962fa3fa890117e98a4abf362
plan_base: 3efb53d859098f1329138bc067b8ee88399ba41e
---

# 20-RECONCILIATION: сверка релиза Phase 20 (D-70)

Документ плана 20-15. Он сводит технические гейты итогового release commit (FRC), общий визуальный вердикт владельца (D-68), принятый риск владельца вместо физической приёмки (D-70) и реестр принятых долгов. Агент ничего не усиливает: итог релиза вычислен раннером (`releaseVerdict`, `phaseClosure`) и проверяется `--verify-lineage`, `--verify-docs`, `--verify-reconciliation`.

## Lineage

| Звено | Commit | Источник |
|---|---|---|
| Release candidate (20-63) | `f49aa00f2b9833f962fa3fa890117e98a4abf362` | 20-63-SUMMARY.md, поле `release_commit`; 20-UAT.md, `release_candidate_commit` |
| Запись решения D-70 | `03e890a0135ff20f02b4ab68fe39642fff84c39f` | 20-CONTEXT.md D-70; 20-UAT.md, «Запись решения» |
| Действующий вердикт владельца (D-68) | `0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1` | 20-58-SUMMARY.md (`owner_verdict_commit`); звеньев `owner_verdict_renews` нет, `readEffectiveOwnerVerdict` возвращает вердикт 20-58 |
| Итоговый release commit (FRC) | `a05a6019e867a39a42e2d33b9e4f176d281bc659` | GREEN-коммит `--verify-lineage` плана 20-15 |
| PLAN_BASE | `3efb53d859098f1329138bc067b8ee88399ba41e` | HEAD в начале плана 20-15 |

Код продукта (`app`, `components`, `public`, `lib` без `*.test.*`): от записи D-70 `03e890a0135f` до FRC — НЕ ИЗМЕНЁН; от действующего вердикта `0c2a59d1d1a7` до FRC — НЕ ИЗМЕНЁН (проверяет `--verify-lineage` через `productCodeChanges`; ошибка git — ошибка, не «без изменений»).

D-15: не применяется — приёмки на устройствах нет (D-70), commit устройств нет, ветка «исправлен только phone-дефект» не нужна.

После FRC менялись только `.planning/**`, `scripts/phase20-release-gate.mjs` и `lib/phase20-release-gate.test.ts` (режимы проверки этого плана); это проверяет `--verify-reconciliation`.

## Приёмка на устройствах: принятый риск владельца (D-70)

Дата: 2026-11-08. Слова владельца (дословно): «Можно ли сразу перейти к след фазе? ведь меня все устраивает». Ответ владельца на варианты (дословно): «2». Итог: ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70). Источник: 20-CONTEXT.md D-70; журнал — 20-UAT.md, раздел «D-70: принятие риска владельцем без UAT».

Это принятый риск владельца, а не PASS и не физическая приёмка: шаги PC и phone не проходились, у них статус «НЕ ПРОВЕРЕНО (D-70)» или BLOCKED прежнего вида (ENV, DATA); вердикты PC и phone commit не имеют; ни один шаг и ни один вердикт не PASS. Прочтения оркестратора из D-70 ((1)-(5): шаги не проходятся, 20-62 и 20-63 доводятся до конца, 20-15 сводит релиз с пометкой «принятый риск владельца», открытые пункты Phase 18 и 19 уходят в принятые долги, миграции production остаются у владельца) — прочтения оркестратора, не слова владельца.

PORTIA_REQUIRE_UAT=1: красный. Проверка: `PORTIA_REQUIRE_UAT=1 node --experimental-strip-types --test lib/phase20-uat.test.ts` на Node 22.13.1 — exit 1, 47 тестов, 46 pass, 1 fail; каждый шаг и оба вердикта отвергнуты ошибкой «is not acceptance».

## Визуальная приёмка (D-68)

Действующий вердикт владельца читает функция раннера `readEffectiveOwnerVerdict`; звеньев цепочки нет, источник — 20-58-SUMMARY.md. Дата: 2026-11-08; `owner_verdict`: accepted; `owner_verdict_commit`: 0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1; источник: 20-58-SUMMARY.md. Дословно (без правки орфографии): «а) чтобы шаблон был почти индетичен как дата базы вирусов, Б) да В)да. принято».

Эталоны 20-12: реестр tests/e2e/visual/phase20-baselines.json, 60 строк, `ownerVerdict.commit` = 0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1 (равен `owner_verdict_commit` 20-58-SUMMARY.md). Эталоны сняты на фиксированных данных стартового контента (D-68, 20-12), не на реальных данных. Код продукта после вердикта владельца до FRC: НЕ ИЗМЕНЁН. Построчная таблица 20-VISUAL-APPROVAL.md — только история до 2026-11-08 и источником итогового статуса не служит.

## Итог релиза

Итог раннера на FRC: BLOCKED
Итог релиза: BLOCKED
Закрытие фазы: С ПРИНЯТЫМИ ДОЛГАМИ (D-70)

Полный прогон раннера на FRC `a05a6019e867a39a42e2d33b9e4f176d281bc659` (Node 22.13.1, `--npm-cli`, npm 11.19.0): 12 из 17 гейтов PASS, 5 BLOCKED (ENV), FAIL нет. Итог релиза по D-70 — худший из итога раннера и PASS-WITH-OWNER-WAIVERS, поэтому простой PASS невозможен; закрытие фазы «С ПРИНЯТЫМИ ДОЛГАМИ (D-70)» — не PASS, а допуск закрытия с долгами: оно допустимо, потому что нет неразрешённого high (D-12), нет FAIL-гейта без принятого waiver, действующий визуальный вердикт accepted, журнал D-70 верен, и каждый BLOCKED-гейт — полоса среды D-70, внесённая в реестр.

| Гейт | Статус | Причина | Полоса D-70 |
|---|---|---|---|
| e2e-full | BLOCKED (ENV) | missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY, PORTIA_PROMOTION_DEVICE_SECRET | да |
| visual-phase20 | BLOCKED (ENV) | 2 test(s) skipped as BLOCKED | да |
| mutation-attest | BLOCKED (ENV) | missing environment variable(s): PORTIA_E2E_MUTATION_CONFIRM, PORTIA_E2E_TARGET_ENVIRONMENT, PORTIA_E2E_TARGET_ID, PORTIA_E2E_SUPABASE_URL, PORTIA_E2E_PRODUCTION_PROJECT_IDS, PORTIA_E2E_ISOLATED_PROJECT_IDS | да |
| e2e-mutation | BLOCKED (ENV) | missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY, PORTIA_PROMOTION_DEVICE_SECRET, PORTIA_E2E_MUTATION_CONFIRM, PORTIA_E2E_TARGET_ENVIRONMENT, PORTIA_E2E_TARGET_ID, PORTIA_E2E_SUPABASE_URL, PORTIA_E2E_PRODUCTION_PROJECT_IDS, PORTIA_E2E_ISOLATED_PROJECT_IDS | да |
| staging-live | BLOCKED (ENV) | mutation-attest is BLOCKED | да |
