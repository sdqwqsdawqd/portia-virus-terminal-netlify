---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 10
subsystem: database
tags: [migration, access-closure, default-on, fingerprint, tdd, gap-closure]

requires:
  - phase: PORTIA-23
    provides: "23-09: шлюз fail-closed при отсутствующей функции закрытия"
provides:
  - "Forward-only миграция 20261114000000: закрытие сайта включено по умолчанию (default true, строка main ON, fallback функции true)"
  - "Закрепление sha256 новой миграции, офлайн-повтор alter column set default, эталон отпечатка с default true и новым телом функции"
  - "Осознанно обновлённые пины D-01 и контракт миграции в lib/access-closure.test.ts"
affects: [PORTIA-23-11, verify-work 23]

actuals:
  tokens: 5200
  tasks: 2
  commits: 3

plan_head_before: a50f8503fd4ff3e03c58c75e9a033c66878f4ca9
plan_head_after: 50668405ce7248e76eb05a06f204ce06e24722f4

tech-stack:
  added: []
  patterns:
    - "Повтор столбцов в офлайн-отпечатке: фундамент плюс поздние alter column ... set default по версиям; неизвестная форма alter column роняет тест"

key-files:
  created:
    - supabase/migrations/20261114000000_portia_access_closure_default_on.sql
  modified:
    - lib/portia-canonical-parity.test.ts
    - lib/portia-migration-fingerprint.test.ts
    - supabase/fingerprint/expected/portia.fingerprint.json
    - tests/e2e/fixtures/data/expected-authz.json
    - lib/access-closure.test.ts

key-decisions:
  - "Решение владельца 2026-11-14 п.3 (3a): закрытие ON по умолчанию; отменяет D-01 (Phase 21 D-05 в части OFF после применения). Владелец-only для переключения сохранён"
  - "Новая forward-only миграция, а не правка замороженного фундамента 20261109000000"
  - "Миграция нигде не применялась (D-72, решение владельца п.2)"

requirements-completed: [ACC-02]

coverage:
  - id: D1
    description: "Миграция включает закрытие по умолчанию: default true, строка main ON если нет или не переключалась владельцем, fallback функции true, права без изменений"
    requirement: ACC-02
    verification:
      - kind: unit
        ref: "lib/access-closure.test.ts#G-PORTIA-23-4 / owner 3a: 20261114000000 turns closure ON by default without overriding an owner toggle"
        status: pass
      - kind: unit
        ref: "lib/access-closure.test.ts#after all migrations portia_access_closure_enabled() is ON for a missing row and keeps its grants"
        status: pass
      - kind: unit
        ref: "lib/access-closure.test.ts#20261114000000 changes nothing else: one function, no journal, set_closure, submit, policy, table grant or transaction wrapper, and it reloads the PostgREST schema cache"
        status: pass
    human_judgment: false
  - id: D2
    description: "Офлайн-повтор миграций согласован с эталоном: default true у closure_enabled, новое тело функции, ACL прежний"
    requirement: ACC-02
    verification:
      - kind: unit
        ref: "lib/portia-migration-fingerprint.test.ts#golden columns: every declared column of the Phase 21 tables with type, not null, default and identity"
        status: pass
      - kind: unit
        ref: "lib/portia-migration-fingerprint.test.ts#every effective function matches its golden entry: body hash, secdef, volatility, config, return type and ACL"
        status: pass
    human_judgment: false
  - id: D3
    description: "Новая миграция закреплена, замороженные не менялись, список миграций expected-authz и права функции согласованы"
    verification:
      - kind: unit
        ref: "lib/portia-canonical-parity.test.ts#migrations are forward-only, pinned, ordered and carry no transaction wrapper"
        status: pass
      - kind: unit
        ref: "lib/phase16-expected-authz.test.ts (весь файл)"
        status: pass
      - kind: unit
        ref: "lib/portia-sql.test.ts (весь файл)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Применение миграции к базе, Postgres/RLS, роли, staging; отпечаток живой схемы; ревью supabase-rls-reviewer"
    verification: []
    human_judgment: true
    rationale: "Агент ничего не применяет (D-72); ревью новой миграции — 23-11 Task 1"

duration: 20min
completed: 2026-11-14
status: complete
---

# Phase PORTIA-23 Plan 10: Закрытие ON по умолчанию (новая миграция) Summary

**Forward-only миграция 20261114000000 делает закрытие сайта включённым по умолчанию (default true, строка main ON без перекрытия выбора владельца, fallback функции true), закреплена sha256, подтверждена офлайн-повтором и эталоном отпечатка; замороженный фундамент не тронут, красное окно ровно на три известных теста матрицы.**

## Решение: новая миграция, а не правка фундамента

Решение владельца 2026-11-14 п.3 (3a) отменяет D-01 (флаг закрытия по умолчанию выключен). Реализовано новым файлом, потому что:

1. Файл 20261109000000 заморожен планом 21-07: его sha256 закреплён «this pin must not be re-pinned» и сверяется с записью 21-MIGRATION-APPLY.md. Правка сломала бы закрепление, запись Phase 21 и ревью трёх раундов RLS21.
2. Правило проекта: изменение схемы после заморозки только новой миграцией с новой версией.
3. По D-72 ни одна база эти миграции не получала, поэтому новая миграция ничего не перекрывает у живых данных; у владельца она идёт последним шагом того же применения (порядок пишет 23-11).
4. Ревью supabase-rls-reviewer охватывает один маленький файл, а не весь фундамент.

## Что сделано

- **Миграция** `supabase/migrations/20261114000000_portia_access_closure_default_on.sql`. Хэши:
  - sha256 LF-нормализованного файла: `44c07e2f76baccf06017852fdf50843bae6fc005d889715cc898b4fbdc4c47b4`
  - sha256 нового тела `portia_access_closure_enabled()` (текст между `as $$` и `$$;`): `020b70abe480605583b673f0c8038ff329b3b5ff287ec037299f41ec94bd8f63` (было `35e46e0f…a9010f`)
- **Операторы, по порядку:**
  - (a) `alter table public.portia_access_settings alter column closure_enabled set default true;`
  - (b) `insert into public.portia_access_settings (id, closure_enabled) values ('main', true)` / `on conflict (id) do nothing;`
  - (c) `update public.portia_access_settings` / `set closure_enabled = true, updated_at = now()` / `where id = 'main' and updated_by is null and closure_enabled is distinct from true;` (выбор владельца через `portia_access_set_closure` помечает `updated_by`, повторный запуск его не переключает)
  - (d) `create or replace function public.portia_access_closure_enabled()` с теми же заголовками (returns boolean, language sql, stable, security definer, set search_path = ''), тело с `coalesce(..., true)`
  - (e) `revoke all ... from public, anon, authenticated;`, `grant execute ... to anon, authenticated;`, `grant execute ... to service_role;` (права прежние)
  - (f) `notify pgrst, 'reload schema';` последней строкой. Без begin/commit.
- **Закрепление** в `lib/portia-canonical-parity.test.ts`: новая строка с комментарием «закреплена 23-10, заморожена 23-11 после ревью»; прежние строки не менялись.
- **Повтор** в `lib/portia-migration-fingerprint.test.ts`: после разбора таблиц фундамента применяются `alter table public.portia_access_* alter column ... set default ...;` из более поздних миграций по версиям; неизвестная форма alter column и неизвестная колонка вызывают `assert.fail`.
- **Эталон** `supabase/fingerprint/expected/portia.fingerprint.json`: `closure_enabled.default = "true"`, новый `src_sha256` у `public.portia_access_closure_enabled()`; ACL, secdef, volatility, config не менялись. `scripts/phase23-sync-evidence.mjs` не запускался, значения правились вручную.
- **expected-authz.json:** новая миграция в списке, добавлено предложение в `generated_from`; ячейки прав не менялись.
- **lib/access-closure.test.ts:** два теста фундамента переименованы (утверждения о замороженном тексте сохранены), добавлены три теста: операторы ON, последнее определение функции ON с прежними правами, «ничего лишнего». Хелпер `grantedRoles` получил необязательный второй параметр с текстом. Тест-скан продуктового кода не менялся: четыре символа backspace на месте.

## TDD (RED / GREEN)

- **Task 1 RED** (`eec042f`): повтор `set default` в тесте отпечатка и default `"true"` в эталоне без миграции. Падает ровно один тест, «golden columns: …» (`default: 'true'` против `'false'`), на нужном утверждении; ошибок загрузки нет. Классификатор `gsd_run check tdd-red-evidence` не запускался, TAP проверен вручную.
- **Task 1 GREEN** (`bf029ff`): миграция, закрепление, хэш тела, expected-authz. Девять целевых файлов: 116 тестов, 116 pass, 0 fail.
- **Task 2** (`5066840`): тесты-контракты прошли сразу (миграция уже есть, код продукта не меняется).

## Команды и результаты (Node v22.13.1, прямая форма)

- RED: `node --experimental-strip-types --test lib/portia-migration-fingerprint.test.ts` — 11 тестов, 10 pass, 1 fail (ожидаемо).
- Девять файлов Task 1 (`portia-canonical-parity`, `portia-migration-fingerprint`, `phase16-expected-authz`, `portia-sql`, `access-closure`, `access-foundation`, `access-rls-round2`, `access-requests`, `access-decisions`) — код 0, 116 тестов, 116 pass, 0 fail.
- `node --experimental-strip-types --test lib/access-closure.test.ts` — код 0, 12 тестов (база 9), 0 fail; backspace-проверка: «scan regex intact».
- Весь набор `node --experimental-strip-types --test --test-reporter=tap lib/*.test.ts` — код 1 (ожидаемо), 1922 теста, 1916 pass, 3 fail, 3 skipped (база 23-09: 1919 / 1916 / 0 / 3; +3 новых теста).
- Шлюз red-window после Task 1 и после Task 2: `red-window ok: 3 expected failures`.
- `node node_modules/typescript/bin/tsc --noEmit` — код 0.
- `git diff --name-only a50f8503fd4ff3e03c58c75e9a033c66878f4ca9 HEAD -- supabase/migrations` — только `supabase/migrations/20261114000000_portia_access_closure_default_on.sql`. Удалений файлов в коммитах нет.

## Красное окно (до 23-11 Task 2)

Коммит миграции делает устаревшей матрицу 23-SECURITY-MATRIX.md (проверяемый commit 0046f80 предшествует изменению supabase/migrations; строки новой миграции в матрице нет). Падают ровно три теста, всё остальное зелёное:

1. `Phase 23 matrix covers each tracked route and migration exactly once; all live lanes stay blocked` (lib/phase23-evidence.test.ts)
2. `migration coverage: the real matrix has exactly one row per tracked supabase migration` (lib/security-matrix.test.ts)
3. `matrix freshness: the real matrix commit is an ancestor of HEAD and no covered file changed after it` (lib/security-matrix.test.ts)

23-SECURITY-MATRIX.md, 23-RLS-REVIEW.md и записи применения не тронуты; матрицу обновляет 23-11 после ревью.

## Угрозы

- T-23-27 (default/main/fallback ON): снято тестами (a), (b) и повтором отпечатка.
- T-23-28 (повторный запуск перекрывает выбор владельца): update только при `updated_by is null`, insert `on conflict do nothing`, тест (a) запрещает присваивание `updated_by` и `closure_enabled = false`.
- T-23-29 (права функции): revoke перед grant, тот же набор ролей; `portia-sql`, `phase16-expected-authz`, эталон ACL зелёные. Ревью supabase-rls-reviewer — 23-11 Task 1.
- T-23-30 (переключение не журналируется): принято, Phase 21 D-07.
- T-23-31 (API содержимого при закрытии ON): передано в Phase 25; закрытие скрывает только рабочий стол.

## BLOCKED и ожидания (не PASS)

- Применение миграции к любой базе, живой Postgres/RLS, роли, staging: BLOCKED (ENV, D-72, решение владельца п.2).
- Production: ОЖИДАЕТ ВЛАДЕЛЬЦА.
- Отпечаток живой схемы: значения default и тела функций выведены офлайн, снятие на живой схеме BLOCKED до отпечатка владельцем.
- Ревью supabase-rls-reviewer новой миграции: ещё не выполнено (23-11 Task 1), не PASS.
- Инструкция владельцу по применению: 23-11 Task 3.

## Отклонения от плана

Нет, план выполнен как написан. Правил 1-4 не применялось.

## Known Stubs

Нет.

## Threat Flags

Нет новой сетевой поверхности вне регистра T-23-27..T-23-31.

## Commits

- `eec042f` test(23-10): повтор alter column set default, эталон default true (RED)
- `bf029ff` feat(23-10): закрытие ON по умолчанию новой миграцией
- `5066840` test(23-10): осознанные пины D-01 и контракт миграции ON

## Self-Check: PASSED
