# 16-FINGERPRINT-CALIBRATION: калибровка fingerprint на живом PG (план 16-10)

Дата: 2026-11-01. Commit базы: 922ffd8 (изменения плана 16-10 на момент прогона не закоммичены, см. SUMMARY). Node: 22.13.1. Supabase CLI (repo-pinned, `node_modules`): 2.122.0. PG major: 17. Цель: изолированный проект, refHash `01d085e7b9f0` (`attest` в начале: ATTESTED). Все мутирующие шаги шли только через wrapper `scripts/phase16-staging.mjs`; production не затрагивался.

## Последовательность

| Шаг | Команда wrapper | Результат |
|-----|-----------------|-----------|
| 1 | `cli-help db push`, `cli-help db query` | флаги подтверждены: неинтерактивность — глобальный `--yes`; read-only флага у `db query` нет; формат — `-o json` |
| 2 | `fingerprint pristine` (1-й запуск) | exit 1: `function acldefault(text, oid) does not exist` — A11, исправлено (см. ниже) |
| 3 | `fingerprint pristine` | OK, `evidence/fingerprint-pristine.json` |
| 4 | `push` | `20261101000000_portia_baseline.sql` применён без ошибок |
| 5 | `fingerprint fresh-calibration` | OK, `evidence/fingerprint-fresh-calibration.json` (состояние до D9) |
| 6 | `fingerprint fresh-calibration-2` | побайтно равен шагу 5 (comparator exit 0) |
| 7 | `push` | `20261101000100_portia_explicit_grants.sql` применена |
| 8 | `fingerprint fresh-calibration-3`, `fingerprint fresh` | равны друг другу (exit 0); `fresh` = финальный канон |

Журнал миграций после шага 7 (`migration list`): `20261101000000` и `20261101000100` — Local = Remote.

## Исправления SQL fingerprint (A11)

`acldefault(...)` принимает тип `"char"`, а литералы/CASE выводились как `text`. Во всех трёх вызовах добавлено приведение `::"char"` (relations/sequences, functions, namespaces). Других правок SQL не потребовалось; все 24 статических теста fingerprint зелёные.

## Детерминизм

Два подряд снятых fingerprint на одном состоянии (`fresh-calibration` и `-2`; `fresh-calibration-3` и `fresh`) равны после canonicalize: `phase16-fingerprint-compare.mjs` exit 0, diff пустой. Нестабильных полей нет.

## Inventory (golden = `fingerprint-fresh.json`)

| Секция | Ключей | Пояснение |
|--------|--------|-----------|
| tables | 23 | 20 таблиц `public.portia_*` + 1 sequence (`portia_promo_audit_events_id_seq`) + `storage.buckets`, `storage.objects` — ожидаемые 20 таблиц совпадают |
| functions | 36 | 35 функций `public.portia_*` (совпадает с ожидаемыми 35) + `public.rls_auto_enable()` (Supabase, присутствует и в pristine; в сводку не входит) |
| policies | 18 | совпадает |
| bucket | 1 | `portia-media`, public, лимит 4194304, mime gif/jpeg/png/webp |
| cron | present=true, visible=true | job `portia-promo-cleanup`, `17 3 * * *`, active, `command_is_expected=true` |
| extensions | pg_cron, pgcrypto, uuid-ossp, plpgsql присутствуют; pg_net нет | `pg_cron` включился из baseline (A7 подтверждено) |
| columns / constraints / indexes | 151 / 120 / 34 | — |
| roles / schemas / default_acls | 4 / 2 / 6 | — |

Pristine (до миграций): tables 2 (storage), functions 1 (`rls_auto_enable`), policies 0, bucket 0, `cron.present=false`.

## Решение D9: миграция НУЖНА (создана `20261101000100_portia_explicit_grants.sql`)

Измерено по ACL `fingerprint-fresh-calibration.json` (до D9). Привилегированная роль Supabase API (в fingerprint это `service_role`) на этом проекте уже имела все права на таблицы, sequence и EXECUTE на функции PORTIA: этот проект ещё получает legacy default privileges (в `default_acls` у `postgres` и `supabase_admin` по `r/S/f` перечислены anon/authenticated/service_role). Но найден второй триггер D9: sequence `public.portia_promo_audit_events_id_seq` унаследовал от default privileges права для anon и authenticated:

```
до D9:   anon:SELECT, anon:UPDATE, anon:USAGE, authenticated:SELECT, authenticated:UPDATE, authenticated:USAGE, service_role:SELECT, service_role:UPDATE, service_role:USAGE
после D9: service_role:SELECT, service_role:UPDATE, service_role:USAGE
```

Baseline отзывает только права на таблицу, не на sequence. Миграция: (1) явные `grant all` привилегированной роли на таблицы и sequences `public.portia_*` и `grant execute` на функции `public.portia_*` (чтобы проект, собранный только из миграций, не зависел от default privileges после изменения Supabase от 2026-10-30; паритет с production и нужный fixtures harness и `portia_promo_cleanup` в 16-09); (2) `revoke all` на sequences PORTIA у public, anon, authenticated. Ничего сверх baseline anon/authenticated не выдаётся. Идемпотентна (DO-цикл по каталогу, имена через `format('%I')`).

Единственная разница между `fresh-calibration` и `fresh`: ACL ключа `tables: public.portia_promo_audit_events_id_seq` (comparator diff = ровно этот ключ). Остальное не изменилось.

Ожидаемая дельта с production для 16-14: в production sequence `portia_promo_audit_events_id_seq` (legacy default privileges) почти наверняка сохраняет SELECT/UPDATE/USAGE у anon/authenticated; после принятия canonical-миграций эти права исчезнут (безопасное сужение: identity-колонка не требует USAGE от вставляющей роли, а вставка в таблицу у anon/authenticated отозвана). Остаточное наблюдение (не PORTIA, не меняется): у `public.rls_auto_enable()` есть `PUBLIC:EXECUTE` — функция Supabase, вне канона.

## Ревью D9

Агент `supabase-rls-reviewer` из исполнителя запустить нельзя (инструмента запуска агентов нет). Выполнено самостоятельное ревью по чек-листу: (a) над-выдача — anon/authenticated ничего не получают, только отзыв на sequences; (b) полнота — таблицы (`r`), sequences (`S`), функции (`prokind = 'f'`) схемы `public` с префиксом `portia_`; (c) влияние на production — только сужение прав на sequence; (d) `search_path`-устойчивость — имена схемы заданы явно. Находок critical/high нет. Нужен запуск `supabase-rls-reviewer` оркестратором/владельцем (помечено в SUMMARY).

## Ответы на допущения RESEARCH

| ID | Ответ |
|----|-------|
| A3 (CLI сам оборачивает транзакцию) | подтверждено: baseline без `begin;/commit;` применился одной миграцией |
| A4 (default privileges 30.10.2026) | на этом проекте default privileges ещё legacy (admin-роль права имеет); разрыв по sequences anon/authenticated найден и закрыт D9; явные grants делают канон независимым от default privileges |
| A6 (машинный вывод `db query`) | подтверждено: `-o json`; формат разбирает `extractFingerprint` без правок |
| A7 (`create extension pg_cron` из SQL) | подтверждено: `pg_cron` включился baseline'ом, cron job создан |
| A8 (`insert into storage.buckets` в миграции) | подтверждено: bucket `portia-media` создан |
| A11 (fingerprint SQL на живом PG) | исполнен; единственная правка — `acldefault(...::"char", ...)` |
| A12 (pooler session mode для `db push`) | подтверждено: `push` и `db query` прошли через `PORTIA_STAGING_DB_URL` на порту 5432 (значение не печаталось) |

Примечание: у `db query` нет read-only режима CLI; read-only свойство fingerprint SQL доказывается статически (`lib/phase16-fingerprint.test.ts`: один SELECT, без DDL/DML), а исполнение шло под ролью по умолчанию.

## scan-evidence

`scan-evidence` по каталогу evidence и по `supabase/fingerprint/expected`: см. итоговый запуск в SUMMARY (exit 0, 0 findings на момент записи golden).
