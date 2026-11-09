---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 21
subsystem: promotion-staging-uat
tags: [promotion, staging, owner-uat]
requires:
  - phase: 19-20
    provides: isolated run v2 and staging receipts
provides:
  - STAGING-BOUND proof and owner PC/phone verdicts for steps 0-11 and F9-F12
  - updated UAT and requirement evidence with explicit shift-receipt gap
affects: [19-22, STAB-PROM-15]
requirements-completed: [STAB-PROM-03, STAB-PROM-05, STAB-PROM-06, STAB-PROM-09, STAB-PROM-10, STAB-PROM-11]
completed: 2026-11-04
status: complete-with-evidence-gaps
---

# 19-21: Повторная приёмка «Повышения»

Guarded `acceptance-serve` для run `mw1loqa9_c9451c80` напечатал `STAGING-BOUND` с refHash `01d085e7b9f0`, `serverBound=true` и `clientBound=true` до передачи адресов. PC и LAN `/owner-login` отвечали 200. Владелец ответил «19-21 pass», затем подтвердил «Да, всё пройдено на PC и телефоне» на вопрос о физическом шаге 0, шагах 1–11 и F9–F12 на этом staging run без FAIL.

Вердикт владельца внесён отдельно для PC и phone в `19-PROMOTION-UAT.md`; F9–F12 обновлены в `19-APPS-UAT.md`, тесты 12 и 13 — в `19-UAT.md`. Матрица требований добавлена в `19-PROMOTION-EVIDENCE.md`. Сервер `acceptance-serve` остановлен; порт 3000 свободен. `scan-evidence` вернул `{"files_with_findings":0,"findings":0}`.

## Ограничения доказательств

- Владелец подтвердил общий PASS по всем названным шагам, но не передал отдельные наблюдения по каждому шагу.
- В журнале повторного прогона нет вызовов `acceptance-shift` для `deadline`, `retake`, `cooldown`, `penalty`, `cleanup`. Даты, результаты `updated` и проверки границ не восстановлены задним числом. Соответствующие требования оставлены Pending, несмотря на общий вердикт владельца.
- Удаление строки Google-таблицы не проверялось на staging; STAB-PROM-01 Pending. Для STAB-PROM-14 нет отдельных наблюдений missing RPC, DB и sheet outage; он Pending.
- STAB-PROM-15 ожидает решение владельца и teardown по 19-22; полный gate не закрыт этим планом.

## Остаток временного run

Read-only `acceptance-residual` перед решением 19-22: `promo=5, editors=2, storage=0, content=0, authUsers=2, banks=4, buckets=2, attempts=1, answers=5`, `legacyWindow=false`. Данные пока сохранены. Seed повторно не выполнялся.
