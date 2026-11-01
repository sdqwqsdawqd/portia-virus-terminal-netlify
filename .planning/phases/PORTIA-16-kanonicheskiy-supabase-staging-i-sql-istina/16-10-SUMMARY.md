---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 10
subsystem: database
tags: [staging, fingerprint, grants, supabase-cli, golden]
requires: [16-01, 16-02, 16-03, 16-07]
provides:
  - wrapper subcommands cli-help, push, fingerprint (scripts/phase16-staging.mjs, НЕ закоммичены, см. Блокер)
  - supabase/migrations/20261101000100_portia_explicit_grants.sql (D9)
  - supabase/fingerprint/expected/portia.fingerprint.json (golden)
  - evidence/16-FINGERPRINT-CALIBRATION.md, fingerprint-pristine.json, fingerprint-fresh.json
affects: [16-11, 16-12, 16-13, 16-14]
commits: 2
plan_head_before: 922ffd8df01bc9b25c3d34b994ca2cdf23a0beba
plan_head_after: 83dc49038299d5c16ef982b9f2e21e30c1605f44
estimate:
  tokens: 90000
actuals:
  tokens: 40000
  tasks: 3
  commits: 2
key-files:
  created:
    - supabase/migrations/20261101000100_portia_explicit_grants.sql
    - supabase/fingerprint/expected/portia.fingerprint.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/16-FINGERPRINT-CALIBRATION.md
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/fingerprint-pristine.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/fingerprint-fresh-calibration.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/fingerprint-fresh.json
  modified:
    - supabase/fingerprint/portia_schema_fingerprint.sql
    - lib/portia-canonical-parity.test.ts
    - scripts/phase16-staging.mjs (не закоммичен)
    - lib/phase16-staging.test.ts (не закоммичен)
key-decisions:
  - "D9: миграция явных grants нужна. Привилегированная роль уже имела права (проект ещё на legacy default privileges), но sequence portia_promo_audit_events_id_seq наследовал SELECT/UPDATE/USAGE у anon и authenticated; миграция даёт явные grants админ-роли и отзывает права на sequences у public/anon/authenticated."
  - "У db query нет read-only режима CLI: read-only fingerprint SQL доказывается статически (один SELECT), исполнение под ролью по умолчанию."
  - "Golden = fresh-fingerprint после D9; промежуточные fresh-calibration-2/-3 удалены (детерминизм зафиксирован в 16-FINGERPRINT-CALIBRATION.md), pre-D9 fingerprint оставлен как доказательство разрыва."
requirements-completed: [STAB-SEC-04]
status: partial
---

# Phase 16 Plan 10: Fingerprint на живом PG, D9 и golden Summary

Свежий изолированный проект (refHash `01d085e7b9f0`, PG 17) построен только из `supabase/migrations/` через wrapper; fingerprint исполнен и детерминирован; разрыв по sequences закрыт явными grants (D9); golden записан и равен fresh.

## Что сделано

- **Задача 1 (tracer):** подкоманды wrapper `cli-help`, `push` (`db push --yes`, затем `migration list`, только с `--db-url` из target), `fingerprint <label>` (`db query -f ... -o json`, canonicalize, запись `evidence/fingerprint-<label>.json`; пустой/неразборный вывод -> ошибка, файл не создаётся). 4 новых unit-теста с фейковым spawn (точные argv, нет `link/reset/--linked`, отказ без target). Live: `attest` ATTESTED, `fingerprint pristine`, `push` (baseline применён без ошибок: A3, A7, A8 подтверждены), `fingerprint fresh-calibration`.
- **Задача 2:** детерминизм (два подряд снятых fingerprint равны, comparator exit 0); inventory совпал (20 таблиц + 1 sequence + 2 storage, 35 функций PORTIA + `rls_auto_enable` Supabase, 18 policies, bucket `portia-media`, cron job `portia-promo-cleanup`, `pg_cron`). Правка A11: `acldefault(...)` требует `"char"`, добавлено `::"char"` в трёх местах. D9: см. решение ниже. Миграция применена `push`, хеш закреплён в `migrationHashes`.
- **Задача 3:** golden = `fingerprint-fresh.json`, `compare golden fresh` exit 0, `scan-evidence` по evidence и `supabase/fingerprint/expected`: exit 0, 0 findings. Журнал калибровки с ответами на A3/A4/A6/A7/A8/A11/A12.

## Решение D9

Данные (ACL до D9): админ-роль уже имела все права на таблицы PORTIA, sequence и EXECUTE на функции, но anon и authenticated имели SELECT/UPDATE/USAGE на `portia_promo_audit_events_id_seq`. Миграция `20261101000100_portia_explicit_grants.sql` (forward-only, идемпотентная): явные grants админ-роли и `revoke all` на sequences PORTIA у public/anon/authenticated; anon/authenticated ничего сверх baseline не получают. Разница fresh до/после D9 — ровно ключ ACL этого sequence. Ожидаемая дельта с production для 16-14: сужение прав anon/authenticated на этот sequence (безопасно: identity не требует USAGE, права на таблицу у них отозваны).

## Результаты проверок

`npm test` 812 pass / 0 fail / 3 skip; `npm exec tsc -- --noEmit` чисто; `npm run lint` 0 errors (прочие warnings прежние); `compare golden fresh` exit 0; `scan-evidence` exit 0.

## Блокер: не закоммичены scripts/phase16-staging.mjs и lib/phase16-staging.test.ts

Проектный guard при загруженных ключах блокирует любую Bash-команду, упоминающую `phase16-staging.mjs`, кроме точной формы `node --experimental-strip-types scripts/phase16-staging.mjs <cmd>`, поэтому `git add scripts/phase16-staging.mjs` невозможен (обход guard запрещён; `git add -u` тоже запрещён). Изменения лежат в рабочем дереве, тесты зелёные (36/36). Тест-файл тоже не закоммичен, чтобы HEAD не содержал тест без реализации. Нужно: в сессии без ключей (или владельцем) выполнить `git add scripts/phase16-staging.mjs lib/phase16-staging.test.ts` и закоммитить как `feat(16-10): wrapper subcommands cli-help, push and fingerprint`. До этого `commits: 2` относится к остальным артефактам плана.

## Отклонения от плана

1. **[Rule 3 - Blocking] Не закоммичен wrapper** (см. Блокер).
2. **[Rule 1 - Bug] fingerprint SQL падал на живом PG** (`acldefault(text, oid)`): исправлено приведением к `"char"` (ожидаемая A11-калибровка); добавлен неиспользуемый `fs` в `runCli` убран (lint).
3. **Ревью `supabase-rls-reviewer` не запущено:** у исполнителя нет инструмента запуска агентов; выполнено самостоятельное ревью (над-выдача, полнота, влияние на production, search_path), находок critical/high нет, итог записан в 16-FINGERPRINT-CALIBRATION.md. Нужен запуск `supabase-rls-reviewer` на `20261101000100_portia_explicit_grants.sql` оркестратором.
4. **Read-only режим CLI отсутствует** у `db query` (план предполагал его): компенсируется статическим доказательством read-only (24 теста fingerprint).
5. Передан `--yes` как флаг неинтерактивного подтверждения (найден через `cli-help db push`).

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности вне threat_model (T-16-29..32 учтены: grants только админ-роли и отзыв на sequences; golden с fresh после pristine с проверкой детерминизма; redact и scan-evidence; push только на аттестованный target).

## Self-Check: PASSED (с оговоркой Блокера)

Файлы миграции, golden, три fingerprint JSON и 16-FINGERPRINT-CALIBRATION.md существуют; коммиты cba878c и 83dc490 в истории.
