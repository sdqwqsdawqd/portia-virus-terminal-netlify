# 16-11: журнал teardown и upgrade-ladder на изолированном проекте

- Дата: 2026-11-01. Цель: изолированный проект, refHash `01d085e7b9f0`, PG 17 (значения env не записаны).
- Commit репозитория на момент прогона: `b13aac6` плюс неснятые с рабочего дерева правки `scripts/phase16-staging.mjs` и `lib/phase16-staging.test.ts` (подкоманды `teardown`, `upgrade-ladder`; коммит владельцем, см. SUMMARY).
- `attest`: ATTESTED перед прогоном.

## Итог

| Проверка | Сравнение | Результат |
|----------|-----------|-----------|
| pristine == after-teardown | `fingerprint-pristine.json` vs `fingerprint-after-teardown.json` | PASS (exit 0, diff пуст) |
| golden == U | `supabase/fingerprint/expected/portia.fingerprint.json` vs `fingerprint-upgrade.json` | PASS (exit 0, diff пуст) |
| golden == final | golden vs `fingerprint-final.json` | PASS (exit 0, diff пуст) |
| golden vs U0 | golden vs `fingerprint-upgrade-legacy.json` | ожидаемая дельта, 2 ключа (ниже), exit 1 |
| остаток owner-fixture | auth users с маркером запуска после ladder | PASS (0) |
| bucket `portia-media` после teardown | inventory `bucket` в after-teardown | PASS (0) |
| журнал миграций после teardown | повторный `push` применил обе миграции заново (не «up to date») | PASS |

## Последовательность команд (только wrapper, без значений env)

1. `attest`
2. `teardown` (Storage API: emptyBucket, deleteBucket `portia-media`; затем `supabase/teardown/portia_teardown.sql` одним DO-оператором с переключателем сессии)
3. `fingerprint after-teardown`; comparator pristine vs after-teardown: exit 0
4. `upgrade-ladder`: owner-fixture (D4, маркер запуска) -> L0 `L0_pre_phase12_portia_setup.sql` -> phase12 STEP 2 -> STEP 2b -> `phase14_apply.sql` -> `fingerprint upgrade-legacy` (U0) -> `push` (baseline + explicit grants) -> `fingerprint upgrade` (U) -> удаление owner-fixture, остаток 0. Вывод: `{"ladder":"done","ownerFixtureResidual":0}`
5. comparator golden vs U: exit 0; golden vs U0: exit 1 (дельта ниже)
6. `teardown`, `push`, `fingerprint final`; comparator golden vs final: exit 0
7. `scan-evidence` по каталогу evidence (результат ниже)

Каждая SQL-ступень идёт через `db query -f` из временного каталога вне репозитория: CLI отправляет один prepared statement, поэтому скрипт заворачивается в `DO ... EXECUTE` с отброшенными строками `begin;`/`commit;` верхнего уровня (одна транзакция). Содержимое файлов `supabase/*.sql` не менялось.

## Дельта golden vs U0: что canonical добавляет к legacy-цепочке

Inventory совпадает (20 таблиц + sequence + 2 storage = 23, 36 функций, 18 policies, 151 колонка, 120 constraints, 34 индекса, bucket, cron). Расхождений в двух ключах:

| Секция | Ключ | Legacy U0 | Canonical (golden = U) | Объяснение |
|--------|------|-----------|------------------------|------------|
| functions | `public.portia_editor_is_approved(candidate_email text)` | `config: search_path=public` | `config: search_path=""` | Baseline пересоздаёт функцию с пустым search_path (закрытие search_path hijack); тело то же (`src_sha256` равен), ACL тот же. Ожидается и на production в 16-14. |
| tables | `public.portia_promo_audit_events_id_seq` | acl: anon и authenticated имеют SELECT/UPDATE/USAGE, плюс service_role | acl: только service_role SELECT/UPDATE/USAGE | D9: миграция явных grants отзывает права на sequences PORTIA у public/anon/authenticated (16-10). Безопасно: identity не требует USAGE у этих ролей. |

Вывод для production-postflight 16-14: после применения canonical migrations ожидается ровно эта дельта относительно legacy-базы; всё остальное в legacy-цепочке уже совпадает с canonical.

## Мост-миграции

Не понадобились: golden == U без правок. Замороженные файлы (`portia_setup.sql`, `phase12_apply.sql`, `phase14_apply.sql`, `upgrade-fixtures`, baseline) не менялись; ревью `supabase-rls-reviewer` не требуется (SQL в `supabase/` не менялся).

## Не доказано этим журналом

Production, роли с аутентификацией через PostgREST и RLS-поведение остаются за 16-12 и 16-14; этот журнал доказывает только равенство структурных fingerprints на изолированной базе.
