---
phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal
plan: 06
subsystem: database-security-review
tags: [supabase, rls, rpc, hmac, review, postgres, access-foundation]

requires:
  - phase: PORTIA-21 (plans 21-01..21-05)
    provides: миграция 20261109000000_portia_access_foundation.sql, серверные модули доступа, матрица ролей, золотой отпечаток
provides:
  - "21-RLS-REVIEW.md: три раунда supabase-rls-reviewer, находки RLS21-01..16, список BLOCKED, итоговый проверенный commit"
  - "Серверная подпись заявок (HMAC-SHA256) и глобальный лимит 20 в минуту в portia_access_submit_request"
  - "Закрытый revoke portia_promo_bind_device (D-10 расширен владельцем)"
  - "Журнал людей защищён от TRUNCATE, grant сужен до select, insert"
affects: [21-07, PORTIA-23, PORTIA-25]

actuals:
  tokens: 48000
  tasks: 2
  commits: 11

plan_head_before: 70fe43d225d77e6c732f66868a6aa6d2abc288be
plan_head_after: 52b004b21589ebb7dcdf0d54c5601ddfc5f79d93

tech-stack:
  added: []
  patterns:
    - "подпись над (origin, nickname, token_hash, ip_bucket, issued_at) общим секретом из закрытой таблицы, fail closed"
    - "порядок в определяемой функции: формат -> подпись -> блокировки -> чтение"
    - "офлайн-тест статически закрепляет, что живой харнесс читает expected_response"

key-files:
  created:
    - .planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-RLS-REVIEW.md
    - lib/access-ip-bucket.test.ts
    - lib/access-rls-round2.test.ts
  modified:
    - supabase/migrations/20261109000000_portia_access_foundation.sql
    - lib/access-session.ts
    - lib/access-store.ts
    - lib/portia-staging-live.test.ts
    - tests/e2e/fixtures/data/expected-authz.json
    - supabase/fingerprint/expected/portia.fingerprint.json
    - lib/portia-canonical-parity.test.ts

key-decisions:
  - "Владелец 1а (2026-11-09): подпись заявки подаёт сервер сайта, БД проверяет HMAC по секрету из закрытой таблицы"
  - "Владелец 2а (2026-11-09): D-10 расширен, portia_promo_bind_device отозван у public, anon, authenticated"
  - "RLS21-05, RLS21-06, RLS21-12 приняты с причиной; RLS21-14 отложен (устаревшие скрипты закреплены хешами)"
  - "RLS21-16 принят и перенесён в Фазу 23"

requirements-completed: [USR-05, SEC-06]

coverage:
  - id: D1
    description: "Обязательное ревью supabase-rls-reviewer слоя БД Фазы 21: три раунда, итог без блокирующих замечаний, итоговый проверенный commit записан"
    requirement: SEC-06
    verification:
      - kind: other
        ref: "node-проверка из Task 2 плана: печатает 10b5e98e80947062dc80e8bc20a12fb9692375c4 и завершается с кодом 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Исправления high/medium/low по итогам раундов с обновлёнными артефактами согласованности (хеш миграции, матрица, золотой отпечаток, контрактные тесты)"
    requirement: USR-05
    verification:
      - kind: unit
        ref: "lib/access-foundation.test.ts lib/access-rls-round2.test.ts lib/access-ip-bucket.test.ts lib/phase16-expected-authz.test.ts lib/portia-migration-fingerprint.test.ts lib/portia-canonical-parity.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Поведение на живом Postgres/RLS/Auth (ACL, конкурентность, pgcrypto, подпись, Netlify-заголовок)"
    verification: []
    human_judgment: true
    rationale: "Требует живой изолированной базы и платформы; ревьюер статический, всё остаётся BLOCKED и нигде не записано как пройденное"

duration: 33min
completed: 2026-11-09
status: complete
---

# Phase 21 Plan 06: Ревью supabase-rls-reviewer Summary

**Три раунда обязательного статического ревью БД-слоя доступа: HMAC-подпись заявок с проверкой в БД и глобальным лимитом, revoke bind_device, защита журнала от TRUNCATE, канонизация IPv6 для bucket; итог «без блокирующих» на commit 10b5e98e80947062dc80e8bc20a12fb9692375c4; всё живое остаётся BLOCKED.**

## Performance

- **Duration:** около 33 минут по времени коммитов (14:25-14:57 +05:00), плюс завершение раунда 3 в этой сессии
- **Completed:** 2026-11-09
- **Tasks:** 2
- **Files modified:** 16 (по `git diff --stat` от `70fe43d`)

## Accomplishments

- Раунд 1 нашёл два high (RLS21-01 обход подписи через прямой вызов anon, RLS21-02 доступный anon `bind_device`), два medium (RLS21-03 TRUNCATE журнала, RLS21-04 `coalesce` account_id) и три low; high и medium закрыты исправлениями, low исправлены или приняты с причиной.
- Раунд 2 (код раунда 1) нашёл один medium (RLS21-08 bucket IPv6 по тексту адреса) и пять low (RLS21-09..14); medium и low 09, 10, 11, 13 исправлены, RLS21-12 принят, RLS21-14 отложен.
- Раунд 3 на commit `10b5e98e80947062dc80e8bc20a12fb9692375c4`: вердикт «без блокирующих»; два новых low: RLS21-15 исправлен (6098b81), RLS21-16 принят и перенесён в Фазу 23.
- Каждый фикс-коммит несёт своё согласование: миграция, закреплённый хеш, ячейки и строки `expected-authz.json`, золотой отпечаток, контрактные тесты (писались до исправления и падали по нужной причине; тесты не ослаблялись).

## Task Commits

1. **Task 1: раунд 1 ревью** - `431c8e0` (docs)
2. **Task 2: цикл исправлений и перепроверки** (раунды 1-3):
   - `9c25ab7` fix RLS21-02 (revoke `portia_promo_bind_device`)
   - `9d26a31` fix RLS21-03, RLS21-04 (truncate-триггер, `grant select, insert`, свежая связь аккаунта)
   - `ff78fcc` fix RLS21-01, RLS21-07 (серверная подпись HMAC, лимит 20 в минуту, валидные ники проб)
   - `9f9dad2` docs: решения раунда 1
   - `ce54d8c` docs: находки раунда 2
   - `1d6da55` fix RLS21-08 (`accessIpGroup`/`accessIpBucket`: канонизация IPv6, группа /48)
   - `1fcbe6b` fix RLS21-09, RLS21-10, RLS21-11, RLS21-13 (drop старой перегрузки, сужение прав на последовательности, `expected_response`, шаг владельца со страховкой длины)
   - `10b5e98` docs: решения раунда 2, переносы в Фазу 23
   - `6098b81` fix RLS21-15 (живой харнесс сравнивает `expected_response`)
   - `52b004b` docs: раунд 3, RLS21-15/16, итоговый проверенный commit и вердикт

**Plan metadata:** отдельный коммит с этим SUMMARY (следует за `52b004b`; `plan_head_after` в шапке измерен до него).

## Files Created/Modified

- `.planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-RLS-REVIEW.md` - три раунда, находки RLS21-01..16, BLOCKED, итоговый commit и вердикт
- `supabase/migrations/20261109000000_portia_access_foundation.sql` - подпись заявок, таблица секретов, лимит в минуту, truncate-триггер, сужение прав, revoke `bind_device`, drop старой перегрузки
- `lib/access-session.ts` - `signAccessSubmit`, `accessSubmitMessage`, `accessSubmitSecret`, `accessIpGroup`, `accessIpBucket`
- `lib/access-store.ts` - `submitAccessRequest` подписывает сам
- `lib/access-ip-bucket.test.ts`, `lib/access-rls-round2.test.ts` - новые контрактные тесты
- `lib/portia-staging-live.test.ts` - сравнение тела ответа с `expected_response` в живом прогоне и офлайн-тест RLS21-15
- `tests/e2e/fixtures/data/expected-authz.json`, `supabase/fingerprint/expected/portia.fingerprint.json`, `lib/portia-canonical-parity.test.ts` - перепривязанные артефакты согласованности
- `.env.example` - имя `PORTIA_ACCESS_SUBMIT_SECRET` с пустым значением

## Decisions Made

- Решения владельца 2026-11-09 («1а 2а»): 1а - сервер сайта подписывает заявки, БД проверяет HMAC по секрету из закрытой таблицы, нет секрета - нейтральный отказ `unauthorized` (fail closed); 2а - D-10 расширен, `portia_promo_bind_device(text, text, text)` отозван у public, anon, authenticated.
- По умолчанию: исправить RLS21-03, RLS21-04, RLS21-07; принять RLS21-05, RLS21-06 с причиной.
- RLS21-14 (устаревшие `supabase/portia_setup.sql`, `supabase/phase14_apply.sql`) не правятся: закреплены хешами в `lib/portia-canonical-parity.test.ts`; действующая схема строится из `supabase/migrations/`. Не разворачивать эти скрипты вместо миграций.

## Шаг владельца при применении (для записи применения в 21-07)

После применения миграции и до приёма заявок:

1. Сгенерировать случайное значение секрета, 32 символа и больше.
2. Вставить его в базу со страховкой длины (вставка с `select 'submit', v from (select '<значение>'::text as v) t where length(v) >= 32 on conflict (name) do update ...`; ожидаемый результат `INSERT 0 1`, при `INSERT 0 0` значение короче 32 символов и ничего не сохранено). Точный текст оператора в шапке миграции (блок OWNER STEP).
3. Выполнять через `psql`, а не сохранённым запросом в Supabase SQL Editor, чтобы текст со значением не остался в истории и сохранённых запросах Dashboard.
4. Положить то же значение в серверную переменную Netlify `PORTIA_ACCESS_SUBMIT_SECRET`.
5. Пока секрета нет, каждая заявка получает `unauthorized` (так задумано).

## Переносится в Фазу 23 (требования, не выполнены здесь)

1. Перед вызовом `portia_access_submit_request` маршрут применяет проверку человека (например Turnstile) или второй грубый лимит (/16 IPv4, /32 IPv6) (RLS21-08).
2. Каждый ответ `unauthorized` маршрут пишет в журнал тревог (RLS21-13).
3. Реальный формат `x-nf-client-connection-ip` на Netlify (IPv6, mapped) проверить на стенде.
4. Маршрут доступа читает только `x-nf-client-connection-ip`; при отсутствии заголовка или группе `unknown` отвечает нейтральной сервисной ошибкой и пишет тревогу, общий bucket не используется (RLS21-16). Остаточная блокировка соседей в общем пуле (CGNAT, мобильный /48) снимается человеческой проверкой Фазы 23.

## BLOCKED (нужен живой Postgres/Auth/платформа, никогда не PASS)

- Фактические ACL после применения (включая default privileges и `portia_access_journal_id_seq`) против золотого отпечатка.
- Срабатывание truncate-триггера и поведение TRUNCATE для привилегированной роли; `TRUNCATE ... CASCADE` и `session_replication_role` для роли postgres в Supabase.
- Конкурентность: точность лимитов и лимита 20 в минуту под advisory-замками, отсутствие взаимных блокировок, два одновременных approve.
- Выполнение изменяющих функций PostgREST в read-write транзакции и `resolve` (stable) через GET.
- Ячейки матрицы ролей на реальных строках `portia_editors`.
- Настройки Supabase Auth, от которых зависит `portia_is_owner`.
- Promotion после revoke `register_attempt` и `bind_device` (живые контракты).
- pgcrypto в схеме `extensions`: `extensions.hmac` и `extensions.digest` при `search_path = ''`; побайтовое совпадение HMAC из Node и в БД.
- Запись секрета владельцем, отказ `unauthorized` без секрета, расхождение часов сервера и БД.
- Настройки логов (`log_statement`, `auto_explain`, `pgaudit`) относительно секрета.
- Netlify перезаписывает присланный клиентом `x-nf-client-connection-ip` и ставит его на каждый запрос функции; реальный формат IPv6.
- Живой прогон проверяет `expected_response` (код есть, прогон не выполнялся).
- Текст вставки секрета не остаётся в истории и сохранённых запросах Supabase SQL Editor.
- Отсутствие старой перегрузки `portia_access_submit_request(text, text, text, text)` на тестовом проекте и успех `drop function if exists` без зависимых объектов.

Миграция нигде не применена. Postgres/RLS, роли с аутентификацией, staging/production остаются BLOCKED.

## Результаты проверок

- Список проверок Task 2 плана (access-foundation, access-levels, access-decisions, access-requests, access-closure, phase16-expected-authz, portia-migration-fingerprint, portia-canonical-parity, portia-sql, portia-promotion-*): 287 тестов, 286 пройдено, 0 красных, 1 пропущен. Вторая часть (итоговый commit и вердикт): код 0, печатает `10b5e98e80947062dc80e8bc20a12fb9692375c4`.
- Полный набор `node --experimental-strip-types --test lib/*.test.ts` (Node 22.13.1): 1818 тестов, 1813 пройдено, 2 красных, 3 пропущено. Красные - ожидаемое окно `lib/security-matrix.test.ts` («migration coverage: the real matrix has exactly one row per tracked supabase migration», «matrix freshness: the real matrix commit is an ancestor of HEAD and no covered file changed after it»), закрываются в 21-07.
- `git merge-base --is-ancestor 10b5e98e80947062dc80e8bc20a12fb9692375c4 HEAD`: код 0.
- `git log --format=%H 10b5e98e80947062dc80e8bc20a12fb9692375c4..HEAD -- supabase/migrations lib/access-store.ts lib/access-session.ts lib/nickname.ts lib/access-levels.ts`: пусто (проверенный код после ревью не менялся).
- `tsc --noEmit` и eslint по `lib/portia-staging-live.test.ts`: без замечаний.

## Deviations from Plan

### Process deviations

**1. [Process] Раунды ревью запускал оркестратор, а не исполнитель**
- **Found during:** Task 1 и Task 2
- **Issue:** план предписывает исполнителю запускать подагента `supabase-rls-reviewer`; исполнитель не может запускать агентов.
- **Fix:** три раунда запустил оркестратор на указанных commit (`70fe43d`, `9f9dad2`, `10b5e98`), результаты записаны в `21-RLS-REVIEW.md`; исполнитель применил исправления и записал статусы.
- **Files modified:** `21-RLS-REVIEW.md`
- **Commits:** `431c8e0`, `9f9dad2`, `ce54d8c`, `10b5e98`, `52b004b`

**2. [Rule 4 - Decision] Два решения владельца вместо автоматического исправления**
- **Found during:** раунд 1
- **Issue:** RLS21-01 требовал нового механизма доверия (подпись и секрет), RLS21-02 расширял D-10 (Promotion без изменений, кроме revoke).
- **Fix:** оркестратор получил решения владельца 1а и 2а (2026-11-09); исправления реализованы по ним.
- **Commits:** `ff78fcc`, `9c25ab7`

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] RLS21-15: живой прогон не проверял тело ответа**
- **Found during:** раунд 3
- **Issue:** `expected_response` читал только офлайн-тест; на стенде функция, вернувшая `created` вместо `unauthorized`, прошла бы ячейку `allow`.
- **Fix:** `expectResponse` в живом прогоне (`assert.deepEqual(data, fn.expected_response)` для ролей с ячейкой `allow`) и офлайн-тест, статически закрепляющий это; миграция и серверные модули не тронуты.
- **Files modified:** `lib/portia-staging-live.test.ts`
- **Commit:** `6098b81`

**Итого отклонений:** 1 процессное, 1 решение владельца, 1 авто-исправление. Влияние: ревью-цикл выполнен в полном объёме, проверенный код после ревью не менялся.

## Issues Encountered

- Проектный guard блокирует Bash с некоторыми переменными в тексте команды; перезапуск без них прошёл (обходов не было).

## Known Stubs

None. Заглушек в изменённых файлах нет.

## Threat Flags

None: новых поверхностей сверх уже ревьюированных (маршрут доступа появится в Фазе 23 со своими требованиями выше).

## Next Phase Readiness

- 21-07 может записывать применение миграции и итоговый проверенный commit `10b5e98e80947062dc80e8bc20a12fb9692375c4`, а также закрывать красное окно `lib/security-matrix.test.ts`.
- Перед приёмом заявок владелец выполняет шаг с секретом (см. выше).

## Self-Check: PASSED

- `21-RLS-REVIEW.md`, `lib/access-ip-bucket.test.ts`, `lib/access-rls-round2.test.ts`, `lib/portia-staging-live.test.ts`: файлы существуют.
- Коммиты `431c8e0`, `9c25ab7`, `9d26a31`, `ff78fcc`, `9f9dad2`, `ce54d8c`, `1d6da55`, `1fcbe6b`, `10b5e98`, `6098b81`, `52b004b`: предки HEAD.
- Измеренный счёт коммитов (`git rev-list --count 70fe43d..52b004b`) равен 11.
- Два красных теста полного набора - только документированные подтесты `lib/security-matrix.test.ts`.
