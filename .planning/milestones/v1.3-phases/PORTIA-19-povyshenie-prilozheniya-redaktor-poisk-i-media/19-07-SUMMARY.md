---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 07
subsystem: acceptance-teardown
tags: [promotion, staging, teardown, d-04, owner-decision, stab-prom]
requires:
  - phase: 19-06
    provides: run mvz5fqgv_c40b449b на изолированном staging, вердикты владельца
  - phase: 19-03
    provides: guarded wrapper (acceptance-residual, acceptance-teardown)
provides:
  - evidence/19-ACCEPTANCE-TEARDOWN.json (before, deleted, residual = 0)
  - раздел «Teardown» в 19-PROMOTION-UAT.md (до удаления и решение владельца)
  - строка teardown в 19-PROMOTION-EVIDENCE.md
affects: [19-14, Phase 20]
status: complete
actuals:
  tokens: 25000
  tasks: 3
  commits: 3
plan_head_before: 64cfa706aa2febd46ca0c79b57d00a7d32ac97df
plan_head_after: 215656bba2c82fc202068e8957fbee4acb3ab3a8
tech-stack:
  added: []
  patterns:
    - "One-way teardown только после отдельного решения владельца; read-only residual до удаления и после"
key-files:
  created:
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/19-ACCEPTANCE-TEARDOWN.json
  modified:
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-PROMOTION-UAT.md
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-PROMOTION-EVIDENCE.md
key-decisions:
  - "Владелец ответил «удалить» (2026-11-03) и тем самым отменил прежнее решение держать 19-07 (teardown не запускать)."
  - "Teardown закрывает D-04, но не STAB-PROM-15: живая приёмка на staging остаётся долгом (19-14 / Phase 20)."
requirements-completed: []
---

# Phase 19 Plan 07: teardown данных приёмки Summary

**Временные данные run `mvz5fqgv_c40b449b` удалены с изолированного staging (2 editors, 2 authUsers, 4 банка), остаток по всем 9 счётчикам равен 0, а STAB-PROM-15 остаётся открытым.**

## Итог

| Task | Результат | Коммит |
|------|-----------|--------|
| 1 read-only residual | счётчики перед удалением записаны в 19-PROMOTION-UAT.md | `57932d1` |
| 2 решение владельца | «Решение teardown: удалить» (дословно «удалить», 2026-11-03) | `cd42551` |
| 3 teardown и доказательство нуля | attest = ATTESTED (refHash `01d085e7b9f0`); `acceptance-teardown`; `acceptance-residual` все 0; scan-evidence 0 находок; evidence и строка в EVIDENCE | `215656b` |

## Доказательства

- `evidence/19-ACCEPTANCE-TEARDOWN.json`: `before` {editors 2, authUsers 2, banks 4, остальное 0}; `deleted` {run: editors 2, authUsers 2; banks 4}; `residual` все 0 (`Object.values(...).every(v => v === 0)` печатает true); `errors` пусто.
- Повторный read-only `acceptance-residual` после teardown: promo, editors, storage, content, authUsers, banks, buckets, attempts, answers = 0.
- Записи без маркера run и вне окна run не затрагивались: счётчики `before` совпадают с объёмом `deleted`, лишних удалений нет.
- scan-evidence по каталогу фазы: `{"files_with_findings":0,"findings":0}`.
- Локальный временный каталог `portia-acceptance-mvz5fqgv_c40b449b` (roster.json, credentials.json) удалён после нулевого остатка (T-19-18).

## Статус требований

- STAB-PROM-15: BLOCKED / открыт. Teardown (D-04) закрыт, но полный сквозной прогон на staging не выполнен (шаги 2–8 шли на production, шаги 1, 9, 11 на staging не проводились). Не отмечен как выполненный в REQUIREMENTS.md.
- STAB-PROM-13: не отмечен. Серверная часть (гонка cleanup-vs-admission) подтверждена в 19-06, но UAT-шаг 9 (очистка, три результата, подсказка) нигде не проводился; одного teardown-receipt для закрытия требования недостаточно.

## Deviations from Plan

Решение по Task 2 получено от владельца после первоначального отказа запускать teardown («не надо запускать»); владелец явно изменил его ответом «удалить». Остальное выполнено как в плане. Seed, сдвиги дат и live-тесты не запускались.

## Known Stubs

Нет.

## Threat Flags

Нет новых поверхностей (изменены только документы и evidence-файл).

## Self-Check: PASSED

- evidence/19-ACCEPTANCE-TEARDOWN.json существует; коммиты `57932d1`, `cd42551`, `215656b` присутствуют в истории.
