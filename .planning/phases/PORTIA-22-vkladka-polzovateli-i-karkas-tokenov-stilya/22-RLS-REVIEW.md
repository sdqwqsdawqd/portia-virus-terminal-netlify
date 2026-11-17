# Phase 22: ревью supabase-rls-reviewer

Обязательное статическое ревью DB-facing слоя фазы 22 (`security_block_on: high`). Ревьюер только читал SQL, RLS/RPC-контракты, серверные вызывающие модули и parity-артефакты: SQL и Supabase не запускались, `.env*` не читались, миграция нигде не применялась. Всё, что требует живого Postgres, реальных ролей, конкурентного прогона или staging, остаётся `BLOCKED` и не записано как пройденное.

Проверяемая миграция: `supabase/migrations/20261110000000_portia_users_tab.sql`.

## Раунд 1

- **Проверяемый commit:** `8c9dc371925ee39ea7554040dbed70ad16ac20e8`
- **Ревьюер:** `supabase-rls-reviewer`, статическое чтение.
- **Scope:** миграции Phase 22 и Phase 21 foundation; baseline owner/editor helpers; `lib/access-store.ts`, `lib/users-api.ts`, `lib/users-model.ts`, `lib/users-roster.ts`, `app/api/users/route.ts`, `proxy.ts`; SQL/API-контракты; `expected-authz.json`, canonical parity и golden fingerprint.
- **Закреплённые решения:** 22 D-01..D-12; 21 D-02, D-04, D-06; D-07 в редакции Phase 22. Ни одно решение или правило БД не ослаблялось.

### Находки

| ID | Severity | Файл:строка | Злоупотребление | Исправление | Статус |
|----|----------|-------------|-----------------|-------------|--------|
| RLS22-01 | medium | `supabase/migrations/20261110000000_portia_users_tab.sql:121-132`; `lib/users-model.ts:171-174` | У active-person с `account_id IS NULL` выражение `p.account_id = auth.uid()` даёт SQL `NULL`; `canSetLevel` и `canRevoke` становятся `null`, строгий парсер отвечает 502 и делает список недоступным редакторам. DB guard не обходится, но UI-флаги не зеркалят его в двузначной логике. | Сделать self-guard двузначным через `coalesce(..., false)` и закрепить контрактом. | fixed in 28611bfda4965c648d7a04074904d86a40305800 |
| RLS22-02 | medium | `supabase/migrations/20261110000000_portia_users_tab.sql:18-25` | Маска делит адрес по первому `@`; для значения с несколькими `@` часть local может уйти non-owner как «domain», нарушая D-05. Без `@` результат `null`, local длиной 1–2 маскируется безопасно. | Разрешать ровно один `@`, иначе возвращать `null`; добавить multiple-`@` контракт. | fixed in 28611bfda4965c648d7a04074904d86a40305800 |
| RLS22-03 | medium | `lib/users-api.ts:113-118`; `app/api/users/route.ts:23-29` | `includes("application/json")` принимает `text/plain;x=application/json`, поэтому POST не является JSON-only; до auth-check анонимное тело целиком буферизуется через `request.text()`. | Проверять MIME essence строго, ограничить тело до полного чтения и не отдавать вызывающему детали ошибок. | fixed in 28611bfda4965c648d7a04074904d86a40305800 |
| RLS22-04 | low | `lib/users-api.ts:126-127`; `supabase/migrations/20261110000000_portia_users_tab.sql:55,61` | Валидация после Unicode lowercase позволяет некоторым не-ASCII символам превратиться в ASCII; прямой RPC также сначала обрабатывает неограниченный текст. Wildcard-обхода нет: поиск использует `strpos`. | Валидировать исходный trimmed input до lowercase и ограничить исходную длину в route и SQL. | fixed in 28611bfda4965c648d7a04074904d86a40305800 |
| RLS22-05 | low | `supabase/migrations/20261110000000_portia_users_tab.sql:280-295`; `supabase/migrations/20261109000000_portia_access_foundation.sql:177` | Обычные decision RPC уже сериализуются advisory-lock по nickname. Два прямых конкурентных `service_role` INSERT могут не увидеть вставку друг друга и временно оставить 21 строку, потому что prune-trigger сам lock не берёт. API-роли не имеют этого пути. | Взять тот же per-nickname advisory transaction lock внутри prune-trigger. | fixed in 28611bfda4965c648d7a04074904d86a40305800 |

### Проверенные статические границы

- `anon` не имеет EXECUTE на `portia_access_list`, `portia_access_history`, `portia_access_bulk_candidates` и внутренних helpers.
- Signed-in non-editor и editor с закрытой вкладкой `users` останавливаются DB-проверкой `portia_can_edit_tab('users')`; route дополнительно проверяет `openTabs`. Живой пример роли с `closed_tabs=['users']` отсутствует и остаётся `BLOCKED`.
- Full email выдаётся только при `portia_is_owner()`; list/history маскируют actor, history возвращает whitelist details. Исключение для некорректного multiple-`@` значения записано как RLS22-02.
- Bulk owner-only на route и SQL-границах; каждый bulk POST заново читает roster без кэша, заново получает pending sheet-candidate и затем вызывает обычный `decide`, который под lock ещё раз проверяет pending.
- API-роли не имеют DELETE/UPDATE/TRUNCATE журнала; append-only trigger закрывает UPDATE/TRUNCATE и удаление newest-20. Остатки table-owner/superuser и вытеснение старого decision двадцатью событиями приняты владельцем.
- Новые и переопределённые функции используют `search_path = ''`, revoke-before-grant и явные ACL; restated grant для `portia_access_journal_append_only` присутствует.

### BLOCKED

- Фактические ACL/default privileges, владельцы функций, RLS и PostgREST-ответы для реальных ролей.
- Живой вызов с `closed_tabs=['users']`.
- Точное поведение PostgreSQL lowercase/collation для Unicode.
- Конкурентный retention-прогон и строгий предел 20.
- Невозможность multiple-`@` email в реальном Supabase Auth.
- Netlify body limits, cookie/CORS/CSRF-поведение и staging.

**Вердикт раунда 1:** без блокирующих (`critical/high = 0`); открыты три medium и два low, которые переходят в fix-and-rereview loop.

## Раунд 2

- **Проверяемый commit:** `9f2778c49f63ef44925170bcf07df8e98baf842e`.
- **Ревьюер:** `supabase-rls-reviewer`, повторное статическое ревью.
- **Scope:** миграция Phase 22, объекты Phase 21 foundation и baseline helpers, `lib/access-store.ts`, `lib/users-api.ts`, `lib/users-model.ts`, `lib/users-roster.ts`, `app/api/users/route.ts`, `proxy.ts`, SQL/API-контракты, `expected-authz.json`, canonical parity и golden fingerprint. Дополнительно проверены изменения `28611bf` по RLS22-01..05 и `9f2778c` по одиночному одобрению, включая `components/portia-users-tab.tsx` и компонентные контракты.
- **Результат:** RLS22-01..05 исправлены; новых находок Phase 22 нет. У одиночного одобрения удалена зависимость от roster как дополнительного источника решения: решение по заявке остаётся за серверной проверкой и DB guard. Закреплённые решения 22 D-01..D-12 и 21 D-02/D-04/D-06/D-07 не ослаблены.

### Находки раунда 2

| ID | Severity | Файл:строка | Злоупотребление | Исправление | Статус |
|----|----------|-------------|-----------------|-------------|--------|

Новых находок Phase 22 нет.

### BLOCKED

Всё перечисленное в раунде 1 остаётся `BLOCKED`: живой Postgres/RLS и ACL реальных ролей, поведение `closed_tabs`, конкурентный retention-прогон, фактическое поведение collation/Auth и staging/Netlify. Статическое ревью не превращает эти пункты в PASS. Ранее принятый baseline `SEC-M1` остаётся отдельным принятым риском и не является новой находкой Phase 22.

**Вердикт раунда 2:** `SECURED` для статического scope Phase 22; новых `critical/high` или иных находок Phase 22 нет.

## Раунд 3 — исправление SC2

Повторно статически проверен commit `89235bef68cddb2ca2473377c47e687a143a4f87`: новая forward-only миграция `20261112000000_portia_access_decision_mark.sql`, `lib/access-store.ts`, `lib/users-api.ts` и маршрут. `nicknameKey` берётся из решённой заявки после SQL-проверок роли и цели, не принимается из запроса и не возвращается в HTTP. Результат одиночного одобрения пересчитывает отметку по свежему roster (TTL 0). Новых находок Phase 22 нет; вердикт `SECURED` для статического scope. Ранее принятый SEC-M1 baseline остаётся открытым вне этого исправления. Живые Postgres/ACL/RLS и staging остаются `BLOCKED`.

Итоговый проверенный commit: `89235bef68cddb2ca2473377c47e687a143a4f87`

Вердикт: без блокирующих замечаний
