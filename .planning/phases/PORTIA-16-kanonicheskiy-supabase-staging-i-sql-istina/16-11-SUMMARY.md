---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 11
subsystem: database
tags: [staging, teardown, upgrade-ladder, fingerprint, owner-fixture]
requires: [16-06, 16-10]
provides:
  - wrapper subcommands teardown и upgrade-ladder, extractStep, asSingleStatement (scripts/phase16-staging.mjs, НЕ закоммичен)
  - evidence/fingerprint-after-teardown.json, fingerprint-upgrade-legacy.json, fingerprint-upgrade.json, fingerprint-final.json
  - evidence/16-UPGRADE-LADDER.md
affects: [16-12, 16-13, 16-14]
commits: 3
plan_head_before: 633a12872e2006c9b77ab1339f93a9a31ce35fc9
plan_head_after: 86790098f15f670714fb5f1afccc2bb24b47f9b3
estimate:
  tokens: 85000
actuals:
  tokens: 86000
  tasks: 3
  commits: 3
key-files:
  created:
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/16-UPGRADE-LADDER.md
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/fingerprint-after-teardown.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/fingerprint-upgrade-legacy.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/fingerprint-upgrade.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/fingerprint-final.json
  modified:
    - scripts/phase16-staging.mjs (не закоммичен)
    - lib/phase16-staging.test.ts (не закоммичен)
key-decisions:
  - "db query отправляет один prepared statement, поэтому скрипты ступеней (teardown, L0, phase12 STEP 2/2b, phase14) заворачиваются в один DO ... EXECUTE с отброшенными строками begin;/commit; верхнего уровня (одна транзакция); файлы supabase/*.sql не менялись."
  - "Переключатель teardown (portia.teardown_ok) ставится строкой set_config в начале того же EXECUTE: исходный файл portia_teardown.sql не менялся, при ручном запуске он по-прежнему падает."
  - "Мост-миграция не нужна: golden == U без правок SQL."
requirements-completed: [STAB-SEC-04, STAB-REL-04]
status: complete
---

# Phase 16 Plan 11: teardown, upgrade-ladder и равенство fresh/upgrade Summary

На изолированном проекте (refHash `01d085e7b9f0`, PG 17) teardown возвращает базу к pristine, ladder L0 -> phase12 STEP 2/2b -> phase14 -> canonical даёт fingerprint, равный golden, а финальная canonical-сборка снова равна golden.

## Что сделано

- **Задача 1 (tracer):** подкоманда `teardown`: Storage API (`emptyBucket`, `deleteBucket` для `portia-media`, отсутствие bucket не ошибка), затем `portia_teardown.sql` через `runCli`. Live: `teardown`, `fingerprint after-teardown`, comparator pristine vs after-teardown: exit 0. Коммит 63c5543.
- **Задача 2:** `extractStep` (та же логика, что `step()` в `lib/portia-sql.test.ts`), `upgrade-ladder` (owner-fixture через harness 16-06, ступени, `fingerprint upgrade-legacy`, `push`, `fingerprint upgrade`, удаление fixture в `finally`, остаток по маркеру 0). Live: ladder завершился `{"ladder":"done","ownerFixtureResidual":0}`; golden == U (exit 0). Коммит b13aac6.
- **Задача 3:** `teardown`, `push`, `fingerprint final`, golden == final (exit 0); `16-UPGRADE-LADDER.md`; `scan-evidence` по evidence: 0 findings. Коммит 8679009.

## Дельта golden vs U0 (для production-postflight 16-14)

Только два ключа: `functions` `public.portia_editor_is_approved(candidate_email text)` (legacy `search_path=public`, canonical `search_path=""`, тело и ACL те же) и `tables` `public.portia_promo_audit_events_id_seq` (legacy: anon/authenticated с SELECT/UPDATE/USAGE; canonical: только service_role, это D9). Подробности в `evidence/16-UPGRADE-LADDER.md`.

## Проверки

Wrapper-тесты 45/45 (новые: teardown, `extractStep` на реальном phase12, `asSingleStatement` на четырёх реальных SQL-файлах, ladder с фейками, отказ без target). `npm test` 824 tests, 821 pass, 0 fail, 3 skip; `npm exec tsc -- --noEmit` чисто; `npm run lint` 0 errors (18 прежних warnings); `git diff --stat` по замороженным файлам пуст; `scan-evidence` exit 0.

## Ожидает коммита владельцем (KNOWN LIMIT guard)

Guard блокирует любую Bash-команду с именем wrapper, кроме точной формы запуска, поэтому wrapper и его тест лежат в рабочем дереве без коммита. Выполнить владельцем:

```
git add scripts/phase16-staging.mjs lib/phase16-staging.test.ts
git commit -m "feat(16-11): wrapper subcommands teardown and upgrade-ladder"
```

Статус `complete` относится к остальным артефактам и живому доказательству; до этого коммита HEAD не содержит подкоманды, которыми сняты evidence.

## Отклонения от плана

1. **[Rule 3 - Blocking] `db query` принимает один оператор** ("cannot insert multiple commands into a prepared statement"): план предполагал исполнение файла как есть. Исправлено заворачиванием скрипта в один `DO ... EXECUTE` (см. решения); SQL-файлы не тронуты, поведение транзакций сохранено (всё в одной транзакции).
2. **Переключатель teardown** ставится `set_config` в том же операторе вместо отдельной команды (следствие п. 1).
3. **Owner-fixture входит под паролем один раз** (harness `provision` делает `signInWithPassword`); план говорил, что вход не нужен. Harness 16-06 не менялся.
4. **Повторный `teardown` перед ladder не выполнялся:** база уже была pristine после задачи 1 (равенство доказано comparator'ом).
5. **Ревью `supabase-rls-reviewer` не требуется:** `supabase/*.sql` не менялся; мост-миграции не было.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности вне threat_model (T-16-33..36: равенство pristine до ladder, `extractStep` с тестом на реальном файле, расхождений golden/U нет, owner-fixture удалён с проверкой остатка).

## Self-Check: PASSED (с оговоркой коммита wrapper)

Evidence-файлы существуют; коммиты 63c5543, b13aac6, 8679009 в истории.
