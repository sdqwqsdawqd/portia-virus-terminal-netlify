---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 12
subsystem: testing
tags: [staging, live-suite, rls, rpc, storage, concurrency, receipts]
requires: [16-08, 16-09, 16-11]
provides:
  - зелёный npm run test:staging-live на изолированной цели (770/770, без skip)
  - evidence/receipt-roles.json, evidence/receipt-concurrency.json (PASS, residual 0)
  - evidence/16-LIVE-RUN.md (раздел DB live suites; Browser и Production postflight PENDING)
affects: [16-13, 16-14]
commits: 2
plan_head_before: 51928de41fb2c047c56627fe3596ae139f93310f
plan_head_after: dfe56975a4543b6d7bcc1c986671af623a00f56e
estimate:
  tokens: 80000
actuals:
  tokens: 14000
  tasks: 3
  commits: 2
key-files:
  created:
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/receipt-roles.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/receipt-concurrency.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/16-LIVE-RUN.md
  modified:
    - lib/portia-staging-live.test.ts
    - tests/e2e/fixtures/data/expected-authz.json
key-decisions:
  - "Платформенная функция public.rls_auto_enable() (event trigger Supabase) исключена из сравнения golden с матрицей, но закреплена по имени: любая новая чужая функция роняет catalog-тест."
  - "Для anon и outsider ожидание insert-oversize/insert-bad-mime изменено с rls-deny на http-413/http-415 с цитатой baseline 1639/1640: лимиты бакета проверяются Storage API до insert-политики (1655)."
  - "N=6, R=10 не поднимались: все 80 конкурентных раундов прошли; перекрытие запросов тест напрямую не измеряет."
requirements-completed: []
status: complete
---

# Phase 16 Plan 12: live-прогон ролей, RLS, RPC, Storage, revoke и конкурентных раундов Summary

На изолированной цели (refHash `01d085e7b9f0`, PG 17) `npm run test:staging-live` проходит целиком (770 tests, 0 fail, 0 skip), residual == 0 по всем категориям, два редактированных PASS-receipt лежат в evidence.

## Что сделано

- **Задача 1 (tracer):** `attest` = ATTESTED, `npm run test:staging-live:tracer` PASS с первого раза (A2 подтверждён), `scan-evidence test-results/staging`: 0 findings. Кода не менялось, отдельного коммита нет.
- **Задача 2:** первый полный прогон: 765 PASS, 5 FAIL (классификация ниже); конкурентные раунды и существующий live-тест Повышения зелёные с первого раза. После правок два полных прогона подряд 770/770, второй на HEAD `e2c93fe` (чтобы `commit` в receipts совпал с HEAD). Коммит `e2c93fe`.
- **Задача 3:** receipts скопированы без изменений, `16-LIVE-RUN.md` с разделом DB, `scan-evidence` по evidence: 0 findings. Коммит `dfe5697`.

## Таблица классификации

| Тест | Наблюдение | Класс | Действие |
|------|-----------|-------|----------|
| catalog: golden fingerprint function set equals the matrix | в golden есть `public.rls_auto_enable()`, строки матрицы нет | (a) дефект теста | сравнение только по `public.portia_*`, внешняя функция закреплена по имени (в golden она одна) |
| anon / outsider storage insert-oversize | ожидали rls-deny, получили http-413 | (b) ошибка вывода | baseline 1639 (`file_size_limit`): лимит бакета проверяется до политики 1655; ячейки = http-413, `verify_live` снят |
| anon / outsider storage insert-bad-mime | ожидали rls-deny, получили http-415 | (b) ошибка вывода | baseline 1640 (`allowed_mime_types`); ячейки = http-415, `verify_live` снят |

Класс (c): не найдено. Миграций не добавлялось, `supabase/*.sql` и golden не менялись, `supabase-rls-reviewer` не требуется. Простой insert для anon и outsider остаётся rls-deny, ассерты не ослаблялись (строгое равенство), риски D-11 и SEC-M1 не затрагивались.

## Проверки

Live: 770/770 (Promotion 5, single-winner 5, concurrency 8 гонок x N=6 x R=10, classifier 4, role matrix 748: функции 216, таблицы 491, Storage 36, catalog, tracer, 3 revoke). `npm test` 824 tests, 821 pass, 0 fail, 3 skip; `npm exec tsc -- --noEmit` чисто; `npm run lint` 0 errors (18 прежних warnings); `scan-evidence` exit 0.

## Статус требований

Table/RPC/Storage/revoke часть STAB-SEC-01 доказана живым прогоном, но полный текст требования включает UI (16-13), поэтому STAB-SEC-01 остаётся Pending. STAB-REL-04 и STAB-SEC-04 тоже Pending (production postflight 16-14). В REQUIREMENTS.md ничего не отмечено.

## Отклонения от плана

1. **[Rule 1 - Bug] Catalog-тест не учитывал платформенную функцию** (см. таблицу, класс a).
2. **[Rule 1 - Bug] Ожидания Storage для anon/outsider** (класс b, с SQL-цитатой).
3. Дополнительный полный прогон на новом HEAD, чтобы `commit` в receipts == HEAD (план этого не требовал явно).
4. Ограничение A9: тест не измеряет перекрытие HTTP-запросов (нет тайминга и индекса победителя), поэтому поднятие N/R не обосновано и не делалось. При желании усилить доказательство нужен отдельный план с инструментированием.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности вне threat_model (T-16-37..39: расхождения классифицированы без ослабления ассертов, residual 0, `assertRedacted` и `scan-evidence` чисты).

## Self-Check: PASSED

Файлы: receipt-roles.json, receipt-concurrency.json, 16-LIVE-RUN.md существуют; коммиты `e2c93fe` и `dfe5697` в истории.
