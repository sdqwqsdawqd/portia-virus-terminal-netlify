---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 06
subsystem: acceptance-evidence
tags: [promotion, staging, live-receipts, playwright, owner-uat, incident, stab-prom]
requires:
  - phase: 19-03
    provides: guarded wrapper (acceptance-seed/shift/residual/teardown), staging roster
  - phase: 19-04
    provides: participant promotion UI
  - phase: 19-05
    provides: reviewer promotion UI
provides:
  - evidence/19-ACCEPTANCE-RUN.json (run mvz5fqgv_c40b449b on isolated staging)
  - staging live and Playwright mutation receipts on phase commit (770 live pass, 70 Playwright pass, residual 0)
  - 19-PROMOTION-EVIDENCE.md matrix STAB-PROM-01..14 (server parts PASS, UI parts not confirmed on staging)
  - 19-PROMOTION-UAT.md with owner verdicts, date-shift journal, defect and incident log
  - fix 4d2a3e9 (sheet column E = availability date)
affects: [19-07 teardown, 19-14, Phase 20 security]
status: complete
actuals:
  tokens: 70000
  tasks: 3
  commits: 7
plan_head_before: 1f2d1b698117194afb0e0245701a7d7530ac05c5
plan_head_after: 4d2a3e934de41f4fd9e6db45120085d141b2e851
tech-stack:
  added: []
  patterns:
    - "Server-side proof by live receipts with residual 0; UI proof only by owner UAT on the same environment"
key-files:
  created:
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/19-ACCEPTANCE-RUN.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-staging-live-roles.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-staging-live-concurrency.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/receipt-playwright-run1.json
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-PROMOTION-EVIDENCE.md
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-PROMOTION-UAT.md
  modified:
    - lib/portia-promotion.ts
key-decisions:
  - "Sheet column E in the promotion roster is the availability date; no rank cooldown is added on top (defect 1, 4d2a3e9)."
  - "Owner variant 2: accept without re-running steps 1-9 on staging. Recorded as acceptance under deviation; it does NOT close STAB-PROM-15."
requirements-completed: []
---

# Phase 19 Plan 06: живая приёмка «Повышения» Summary

**Серверная часть «Повышения» доказана на изолированном staging (770 live pass, 70 Playwright pass, residual 0), а UI-часть принята владельцем только по прогону на production, поэтому STAB-PROM-15 остаётся открытым.**

## Итог

План выполнен с принятием владельцем под отклонением (deviation). Автоматические части (Task 1 и Task 2) прошли полностью. Task 3 (owner UAT) завершён вердиктом владельца «вариант 2»: принять без повторного прохождения шагов 1–9 на staging. Это решение записано честно и gate STAB-PROM-15 не закрывает.

| Task | Результат | Коммит |
|------|-----------|--------|
| 1 seed | run `mvz5fqgv_c40b449b` засеян на staging (refHash `01d085e7b9f0`), scan-evidence 0 находок | `0269edc`, проверка `6611603` |
| 2 live и Playwright, матрица | `test:staging-live` 770/770 pass; `test:e2e:mutation` 70 pass; residual 0; матрица STAB-PROM-01..14 | `9d63202` |
| 3 owner UAT | чек-лист подготовлен; вердикт владельца вариант 2 | `dd0dc46`, итоговый docs-коммит этого плана |
| дефект 1 | столбец E листа = дата доступности | `4d2a3e9` |

## Доказательства

- Серверные границы (RPC inventory, RLS, role matrix, admission-гонки, claim, answer CAS, heartbeat-vs-expire, cleanup-vs-admission, direct denial `/api/promotion/reviewer`) доказаны receipts на staging: PASS, residual 0.
- Staging UI-подтверждение: только шаг 10 (editor без `promo`, direct denial): PASS владельца.
- Шаги 2–8 чек-листа (PC и phone) владелец прошёл на production, а не на staging; в матрице они «не подтверждено на staging (вердикт владельца по production-прогону, вариант 2)». Шаги 1, 9, 11 на staging не проводились; шаг 9 (cleanup) не проводился нигде.
- Финальный read-only residual staging: promo 0, editors 2, storage 0, content 0, authUsers 2, banks 4, buckets 0, attempts 0, answers 0. Лог staging-сервера: submit-ов нет.

## Deviations from Plan

### Отклонение: принятие без staging-прохождения шагов 1–9 (вариант 2 владельца)

План требовал один сквозной прогон на изолированном staging на физическом PC, затем phone, и закрывал gate только полным прогоном без unresolved failures. Владелец, зная, что шаги 2–8 шли на production, выбрал принять без повтора на staging. Записано в `19-PROMOTION-UAT.md` (вердикты PC и phone) и в `19-PROMOTION-EVIDENCE.md`. Последствие: STAB-PROM-15 не выполнен по существу и остаётся Pending.

### Инцидент: прогон владельца шёл на production (не вина агентов)

**Обнаружено:** 2026-11-03 по `acceptance-residual` = 0 на staging при заявленных мутациях.
**Причина:** dev-сервер владельца читал `.env.local` с production Supabase `production-проект (ref начинается на wqiy…)` (он входит в `PORTIA_E2E_PRODUCTION_PROJECT_IDS`); переменные staging были только в процессе агента. Владелец входил своим реальным аккаунтом и использовал живую Google-таблицу.
**Влияние:** шаги 2–8 изменили production (заявки и привязки живых ников, claim, банки шага 4, итоги шагов 5–7, штрафы). Очистка шага 9 не запускалась.
**Агенты:** production не трогали; attest, residual и shift выполнялись только на staging `изолированный staging (refHash 01d085e7b9f0)`.
**Статус:** открыт. Оценка и возможная правка изменений на production: решение владельца (мы не вмешивались).

### Auto-fixed Issues

**1. [Rule 1 - Bug] Столбец E живой таблицы трактовался как дата повышения**
- **Found during:** Task 3, шаг 6 (владелец, PC)
- **Issue:** ник `fihhgg2`: лист «Стажер / 3 дн. / 06.11.2026», сайт «Следующая заявка будет доступна 09.11.2026 в 2:00». Код прибавлял cooldown звания к столбцу E, а в листе E уже дата окончания анти-спидрана.
- **Fix:** столбец E = дата доступности, cooldown не прибавляется; ростер run: `p-cooldown` E `2026-11-01` → `2026-11-08`.
- **Files modified:** `lib/portia-promotion.ts` и тесты
- **Commit:** `4d2a3e9`
- **Повтор шага 6:** PASS владельца, но на production, для staging не зачтён.

### Журнал сдвигов дат

Единственный сдвиг: `acceptance-shift … cleanup` на staging, 2026-11-03T09:01:57Z, `updated: 0`. Занесён в `19-PROMOTION-UAT.md`.

## Перенесённый долг

1. **STAB-PROM-15: живая приёмка на staging** (шаги 1–9, 11 на изолированном проекте на PC и phone, включая cleanup) переносится в 19-14 / Phase 20.
2. **Production после инцидента:** оценка и возможная правка изменений шагов 2–8 на `production-проект (ref начинается на wqiy…)`: решение владельца.
3. **Наблюдение для Phase 20 (security):** RPC `register_attempt` выдан роли `anon`, но вызывающего кода у него нет. Требует решения (отозвать grant или подтвердить назначение).
4. **Для 19-07:** teardown run `mvz5fqgv_c40b449b` теперь разрешён принятием владельца; этим планом НЕ выполнялся. Нулевой остаток после teardown должен учесть, что приёмка на staging в итоге не использовалась для шагов 2–9.
5. Установки владельца: `.env.local` указывает на production; для будущих прогонов владельца среда должна явно задаваться staging (подготовка п.1 в UAT).

## Known Stubs

None. Файлы плана — evidence-документы и манифест.

## Threat Flags

None. Новой сетевой поверхности план не добавил; инцидент production описан выше как нарушение T-19-14 владельцем в среде вне wrapper (агенты T-19-14 соблюли: attest и self-test-production-block перед seed).

## Self-Check: PASSED

Файлы evidence и коммиты `0269edc`, `6611603`, `9d63202`, `dd0dc46`, `4d2a3e9` присутствуют в истории; scan-evidence по каталогу фазы 0 находок на момент прогона.
