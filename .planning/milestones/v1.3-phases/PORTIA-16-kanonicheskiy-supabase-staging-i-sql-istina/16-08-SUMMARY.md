---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 08
subsystem: testing
tags: [supabase, rls, rpc, storage, authz-matrix, revoke, live-suite]
requires: [16-06]
provides:
  - tests/e2e/fixtures/data/expected-authz.json (matrix role x surface, schema portia-expected-authz-v1)
  - lib/phase16-expected-authz.test.ts (12 offline tests)
  - lib/portia-staging-live.test.ts (live role/RLS/RPC/Storage suite, 3 revoke tests; skip outside the live script)
affects: [16-10, 16-12, 16-13]
actuals:
  tokens: 44800
  tasks: 2
  commits: 2
plan_head_before: 2b9dc5b2dc96a5469466e1f9f54f979ac8d29aaf
plan_head_after: a47dc8ba4ac0abceaf70566fa57b0242e9597860
commits: 2
tech-stack:
  added: []
  patterns: ["matrix derived from SQL text, cells carry file:line sources checked against the line content", "placeholder templates ({prefix}, {role}, {token}...) listed in the matrix itself", "classifier separates 42501 from rls-deny by message"]
key-files:
  created:
    - tests/e2e/fixtures/data/expected-authz.json
    - lib/phase16-expected-authz.test.ts
    - lib/portia-staging-live.test.ts
  modified: []
key-decisions:
  - "Outcomes come from grant/revoke/policy/raise lines of the baseline, not from observed behavior. Research sketched outsider on reviewer RPCs as 42501; the SQL grants execute to authenticated, so the matrix says forbidden (and owner-required for delete_request)."
  - "D-11 (editor-restricted writes portia_content) and SEC-M1 (anon portia_editor_is_approved) are the outcomes accepted:D-11 and accepted:SEC-M1, with an accepted[] register and an offline test that rejects any other use."
  - "42501 versus rls-deny is decided by the message (row-level security), because Postgres uses 42501 for both a missing grant and a violated WITH CHECK."
  - "Storage cells whose behavior the SQL does not prove (non-writer status codes, 413/415, remove without policy) carry verify_live:true; 16-12 confirms or classifies them."
  - "Under the live script a refusing guard registers a test named `tracer guard: ...` that assert.fail()s, so the tracer name filter cannot turn a blocked run into an empty pass."
requirements-completed: [STAB-SEC-01, STAB-REL-04]
status: complete
---

# Phase 16 Plan 08: Матрица ролей и live role-suite Summary

Каталожная матрица «роль x поверхность» (6 ролей, 35 функций, 20 таблиц, 6 операций Storage; 744 ячейки, у каждой источник `файл:строка` baseline), offline-тест полноты против baseline и live role-suite с тремя revoke-тестами на уже выданных JWT. Живой запуск не выполнялся: он принадлежит плану 16-12.

## Commits
- 147d6e9 test(16-08): матрица ожиданий и offline-тест полноты (задача 1)
- a47dc8b test(16-08): live role/RLS/RPC/Storage suite и revoke-тесты (задача 2; в тот же коммит вошла правка матрицы, см. отклонения)

## Что сделано
- `expected-authz.json`: роли anon, outsider, editor-full, editor-restricted, promo-reviewer, owner; для каждой функции инертные аргументы с плейсхолдерами, `creates_rows` (bind_device, register_attempt, submit_request, reset_device), ожидаемые возвращаемые значения предикатов, вариант `force` для `release_request`; таблицы с seed/probe-шаблонами; 16 promo-таблиц везде `42501`; колоночный grant `portia_editors`/`portia_manual_employees` проверяется операцией `update-other-column`; Storage: read, insert, insert-oversize (4 MiB + 1), insert-bad-mime, update (upsert), delete.
- Распределение исходов: 459 x 42501, 177 x allow, 49 x forbidden, 5 x owner-required, 6 x P0001 (функция дошла до тела и отвергла инертные аргументы), 17 x rls-deny, 20 x rls-empty, 2 x accepted:D-11, 1 x accepted:SEC-M1, 8 x http-413/415; 30 ячеек помечены `verify_live`.
- Offline-тест (12 проверок): множество функций (имя + identity-аргументы) и таблиц равно baseline, новый RPC без решения роняет тест (проверено синтетическим случаем); каждый исход из словаря; источник существует, не пустая строка и не комментарий, для 42501 это grant/revoke, для forbidden/owner-required строка с этим `raise`; ячейки функций и таблиц согласованы с текстом grant/revoke (нет grant -> 42501, есть -> не 42501); promo-таблицы: RLS включён, revoke есть, grant и policy нет; ACCEPTED-ячейки только D-11/SEC-M1; аргументы инертны (uuid = inert UUID, ключи namespaced); Storage совпадает с bucket и политиками.
- `lib/portia-staging-live.test.ts`: вне `test:staging-live*` один skip; классификатор покрыт 4 unit-подтестами, которые работают и вне live; под live при отказе guard падает `tracer guard: ...`; подтест `tracer: anon portia_content select` единственный со словом tracer (проверяется статически); сверка golden fingerprint с матрицей (падает, если файла нет); подтест на каждую ячейку `<role> function|table|storage ...`; revoke 1 (удалена строка `portia_editors`), revoke 2 (снят `promo`), revoke 3 (удалён auth user) на той же сессии без повторного входа; `after`: удаление собственных строк `portia_manual_employees`, `run.cleanup()`, residual, редактированный receipt (`roles` или `roles-tracer`).

## Верификация (Node 22.13.1)
- `node --experimental-strip-types --test lib/phase16-expected-authz.test.ts`: 12 pass, 0 fail. RED наблюдался: до создания матрицы файл падал с ENOENT.
- `node --experimental-strip-types --test lib/portia-staging-live.test.ts` вне live: 4 pass, 1 skipped (live-подтесты не регистрируются, мутаций нет).
- `npm test`: 804 tests, 802 pass, 0 fail, 2 skipped (один skip старый, один новый).
- `npm exec tsc -- --noEmit`: чисто. `npm run lint`: 0 errors, 18 warnings (те же, что до плана; в новых файлах предупреждений нет).
- Проверен механизм `--test-name-pattern=tracer`: хуки `before`/`after` suite выполняются, когда совпадает вложенный подтест.

## Отклонения от плана

**1. [Rule 1 - Bug] Матрица дополнена probe-колонкой для promo-таблиц (коммит a47dc8b).** В первом коммите update/insert по promo-таблицам должны были идти с пустым телом; PostgREST может принять пустой PATCH как no-op и не дойти до проверки прав, и ячейка `42501` не доказывалась бы. Добавлены `pk_kind` и `probes` с реальной колонкой из baseline (offline-тест проверяет, что колонка существует). Правка JSON вошла в коммит задачи 2.

**2. [Process] Матрица создаётся генератором, которого нет в репозитории.** JSON собран одноразовым скриптом из текста baseline (номера строк находились поиском), скрипт лежал во временной папке и не коммитился: источник истины — сам JSON и offline-тест, который перепроверяет каждую ячейку против SQL. Пересоздать матрицу после изменения baseline придётся вручную или новым скриптом.

**3. [Scope] `reset_device` помечен `creates_rows: true`** (пишет audit-событие владельцу), хотя план называл только три функции; offline-тест фиксирует четыре.

Иначе как запланировано.

## BLOCKED / не доказано
- Живой запуск не выполнялся (план 16-12); план 16-07 приостановлен (attest вернул BLOCKED), реальных проверок против цели нет. Всё ниже BLOCKED до 16-12:
  - 30 ячеек `verify_live` (статусы Storage для не-писателей, 413/415, `remove` без политики, `answer_question`/`current_test` на инертных аргументах).
  - Совпадение формата ключей `sections.functions` golden fingerprint (`public.name(identity args)`) с ключами матрицы: golden появится в 16-10; сравнение с фактическим выводом `pg_get_function_identity_arguments` не проверено.
  - Ветка отказа guard (`tracer guard`) и вся live-часть (before/after, провижининг, revoke) выполнены только статически (tsc, lint): запуск live-ветки здесь опасен, потому что ключи staging загружены в окружение процесса.
  - Поведение supabase-js для `update().select()`, `remove`, `getUser` после удаления пользователя и JWT, живущего после `deleteUser`, не проверено.
  - Права admin-клиента на таблицы PORTIA (D9, план 16-10).
- Секции `api` в матрице нет (её добавляет 16-13).
- `portia_manual_employees`: id нельзя снабдить префиксом, поэтому suite сам удаляет свои строки (admin, по точным id); harness 16-06 эту таблицу не чистит.

## Изменения SQL
Нет: `supabase/*.sql`, RLS, RPC и storage-политики не менялись. Запуск `supabase-rls-reviewer` по этому плану не требуется.

## Known Stubs
None.

## Threat Flags
None. Новых endpoints и путей доступа нет; admin-ключ используется только в fixtures, revoke и проверке остатка.

## Self-Check: PASSED
- tests/e2e/fixtures/data/expected-authz.json, lib/phase16-expected-authz.test.ts, lib/portia-staging-live.test.ts существуют; коммиты 147d6e9 и a47dc8b достижимы из HEAD.
