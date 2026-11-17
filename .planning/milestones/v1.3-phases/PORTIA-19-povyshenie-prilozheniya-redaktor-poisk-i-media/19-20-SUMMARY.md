---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 20
subsystem: staging-acceptance
tags: [promotion, supabase, staging, uat, receipts]
requires:
  - phase: 19-17
    provides: acceptance run v2 snapshot and guarded staging wrapper
  - phase: 19-19
    provides: code state for renewed server checks
provides:
  - owner decision and zero-residual teardown of mw0rbyf6_72424cdc
  - fresh staging live and Playwright receipts on commit 2dbc6bc
  - acceptance run v2 mw1loqa9_c9451c80 and physical UAT checklist
affects: [19-21, PORTIA-20, STAB-PROM-15]
actuals:
  tokens: 5243
  tasks: 3
  commits: 3
commits: 3
plan_head_before: a23c5b86547228e7f32a1e92bf857b3542090e81
plan_head_after: c04985b62e82685be802f4e305934ea90d7bf7b0
tech-stack:
  added: []
  patterns: [guarded staging mutation, per-device step-zero target proof]
key-files:
  created:
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/19-ACCEPTANCE-TEARDOWN-mw0rbyf6.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-19-20-staging-live-roles.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-19-20-staging-live-concurrency.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-19-20-playwright-mutation-run1.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-19-20-playwright-mutation-run2.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-19-20-playwright-mutation-run3.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-19-20-playwright-mutation-run4.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-19-20-playwright-mutation-run5.json
  modified:
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-PROMOTION-UAT.md
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/19-ACCEPTANCE-RUN.json
key-decisions:
  - "Qloxz, 2026-11-04: «Удалить этот run и создать новый v2 (рекомендуется)» for mw0rbyf6_72424cdc."
  - "Physical PC and phone UAT remains unverified; no STAB-PROM requirement is marked complete by this preparation."
patterns-established:
  - "Before device UAT, agent starts acceptance-serve and owner checks STAGING-BOUND, probe lookup, and reviewer login on each device."
requirements-completed: []
duration: 17min
completed: 2026-11-04
status: complete
---

# Phase 19 Plan 20: Повторная приёмка «Повышения» на staging

Владелец разрешил удалить старый run; guarded teardown оставил нулевой остаток, серверные проверки прошли на изолированном staging, а новый run v2 и чек-лист подготовлены для физической приёмки.

## Performance

- **Duration:** около 17 минут
- **Completed:** 2026-11-04
- **Tasks:** 3
- **Files changed:** 10

## Accomplishments

- Дословное решение владельца записано до удаления. `ATTESTED` показал refHash `01d085e7b9f0`; read-only остаток старого run был editors 2, authUsers 2, banks 4. `self-test-production-block` вернул `checked:1, blocked:1`.
- `acceptance-teardown mw0rbyf6_72424cdc` удалил только этот run. Повторный `acceptance-residual` и файл teardown показывают нули во всех девяти категориях.
- `npm run test:staging-live`: 770 passed, 0 fail, 0 cancelled, 0 skipped. `npm run test:e2e:mutation`: 70 passed. Все семь receipts имеют `PASS`, refHash `01d085e7b9f0`, commit `2dbc6bcac6775d153a16f01219ce1b3210e0e89a`, нулевой residual и PASS во всех suite; копии сверены по SHA-256.
- Единственный `acceptance-seed` создал v2 `mw1loqa9_c9451c80`: 13 ников, снимок preexisting, четыре банка. `acceptance-residual` нового run показывает banks 4, editors 2, authUsers 2, `legacyWindow:false`. `scan-evidence` по каталогу фазы: `findings:0`.
- Чек-лист требует `STAGING-BOUND`, probe lookup и reviewer login после clean reload на каждом устройстве. PC и phone получили отдельные ники, шаги 1–11 и F9–F12 имеют отдельные пустые поля; старые production-вердикты не перенесены.

## Task Commits

1. Task 1 — `2dbc6bc` — решение владельца и read-only остаток.
2. Task 2 — `df36b2a` — teardown и семь receipts.
3. Task 3 — `c04985b` — новый v2 и чек-лист.

## Evidence Files

- Live: `receipt-19-20-staging-live-roles.json`, `receipt-19-20-staging-live-concurrency.json`.
- Mutation: `receipt-19-20-playwright-mutation-run1.json` — `run5.json` (пять проектов Playwright, каждый PASS).
- Run: `19-ACCEPTANCE-TEARDOWN-mw0rbyf6.json` и `19-ACCEPTANCE-RUN.json`.

## Decisions Made

- Владелец Qloxz дословно выбрал «Удалить этот run и создать новый v2 (рекомендуется)». Удаление старого run было one-way и произведено только после записи решения.
- Приёмка по физическим устройствам остаётся открытой: пустые поля чек-листа не являются PASS. STAB-PROM-15 и другие требования, требующие UAT, не закрыты этой подготовкой.

## Deviations from Plan

None — plan executed as written under the recorded owner decision. Из соображений точности не отмечены завершёнными все 15 требований из frontmatter: план готовит приёмку, но не содержит её физического прохождения.

## Issues Encountered

- Локальный E2E сервер выводил предупреждение Netlify cache purge об отсутствии site ID. E2E завершился с 70 passed; предупреждение не связано с изменёнными файлами и не меняет статус receipts.

## Remaining Verification

- Агент должен запустить `acceptance-serve mw1loqa9_c9451c80 --https` и сообщить адрес только после `STAGING-BOUND`.
- Владелец проходит шаг 0 и затем 1–11, F9–F12 отдельно на PC и phone. До этого физические роли, устройства и UI остаются BLOCKED; прежний production-прогон их не подтверждает.

## Self-Check: PASSED

Все 10 созданных или изменённых файлов существуют; коммиты `2dbc6bc`, `df36b2a`, `c04985b` являются предками HEAD.

