# 23 - Security matrix (Phase 22 carried forward)

Дата: 2026-11-14. Проверяемый commit: `12eecb108f3c24f5cc0b558a882ddbef09ec2522` (Phase 23 static RLS review round 2: closure ON by default and fail-closed gate; open critical/high 0).

Машинная проверка: `node --experimental-strip-types --test lib/security-matrix.test.ts` проверяет полноту маршрутов и миграций и отсутствие изменений охваченного кода после проверенного commit.

## Метод и границы

- Только статическое ревью SQL, RLS/RPC-контрактов и вызывающего TypeScript; два раунда `supabase-rls-reviewer`. Результат `SECURED` не относится к живой базе.
- Миграция Phase 22 нигде не применялась агентом. Живой Postgres, ACL/RLS реальных ролей, staging, production, конкуренция, Netlify и физические устройства остаются `BLOCKED` либо `ОЖИДАЕТ ВЛАДЕЛЬЦА` по `22-RLS-REVIEW.md`.
- Раунд 2 Phase 23 (23-11): только статическое чтение; `20261114000000` нигде не применялась, агент ни к какой базе не подключался. Ревьюера запустил оркестратор.
- Реальные `.env*` и секреты не читались; Supabase CLI и сетевые подключения не выполнялись.

## Охват файлов

Свежесть матрицы: `git diff --name-only <проверяемый commit> HEAD -- <пути ниже>` должен быть пуст. Изменение любого из этих путей требует повторного ревью и нового проверенного commit. Планировочные документы и контрактные тесты не входят в список.

- `app/api`
- `supabase/migrations`
- `proxy.ts`
- `next.config.ts`
- `lib/supabase`
- `lib/editor-access.ts`
- `lib/editor-outline.ts`
- `lib/portia-device-binding.ts`
- `lib/portia-promotion-api.ts`
- `lib/portia-promotion-reviewer.ts`
- `lib/image-upload.ts`
- `app/owner-login/actions.ts`
- `lib/nickname.ts`
- `lib/access-session.ts`
- `lib/access-gate.ts` (шлюз решает закрытый экран; любая его правка требует проверенного commit матрицы)
- `lib/access-store.ts`
- `lib/access-levels.ts`
- `lib/users-api.ts`
- `lib/users-model.ts`
- `lib/users-roster.ts`
- `lib/access-identity.ts`
- `lib/promotion-participant.ts`
- `lib/request-json.ts`

## Маршруты API (охват)

Каждый отслеживаемый `app/api/**/route.ts` имеет ровно одну строку. Первые 11 строк перенесены без изменений из архивной матрицы v1.3.

| Маршрут | Методы | Проверка прав | no-store | Находки | Последний коммит |
|---|---|---|---|---|---|
| `app/api/access/route.ts` | GET | `getUser()` + `getEditorAccess`; сбой auth или RPC даёт 503, не `canEdit:false` | да | — | `e0f89ef` |
| `app/api/access/editor-request/route.ts` | GET, POST | authenticated editor, own request token and auth.uid | yes | RLS23-02 | `465a1b9` |
| `app/api/access/request/route.ts` | POST | signed guest sheet request, current device | yes | RLS23-01 | `465a1b9` |
| `app/api/access/status/route.ts` | GET | current access device digest; editor first; missing closure function = closed (fail-closed, 23-09) | yes | RLS23-01, T-23-22 | `c2e6cf7` |
| `app/api/content/route.ts` | GET, PUT | PUT: `getEditorAccess`, закрытые разделы через `contentRefusal`; GET публичный (CDN-кэш) | PUT да; GET публичный кэш | SEC20-02, SEC20-05, SEC20-07, SEC20-09, SEC20-25 | `f93f894` |
| `app/api/editors/route.ts` | GET, POST, DELETE, PATCH | только владелец (`canManageEditors`) | да, кроме части 403/500 | SEC20-02, SEC20-05, SEC20-07 | `49555da` |
| `app/api/employees/editor/route.ts` | GET | `getEditorAccess`, вкладка `employees` открыта | да | SEC20-02 | `6f6b841` |
| `app/api/employees/route.ts` | GET, PATCH, POST, DELETE | GET публичный (CDN-кэш); изменения: `getEditorAccess` и вкладка `employees` | изменения да, кроме 403 | SEC20-02, SEC20-05, SEC20-07 | `6f6b841` |
| `app/api/promotion/banks/route.ts` | GET, POST | проверяющий (`requirePromotionReviewer`); превью и подтверждение сверяют токен версии банка | да | SEC20-23 | `97d7abb` |
| `app/api/promotion/requests/route.ts` | POST | approved current access request, current roster, signed secure submit | yes | RLS23-01..04 | `d42184e` |
| `app/api/promotion/reviewer/route.ts` | GET, POST | проверяющий; удаление запроса и сброс привязки только владелец | да | SEC20-03, SEC20-05 | `ad377c4` |
| `app/api/promotion/status/route.ts` | GET | approved current access request, secure status | yes | RLS23-02 | `d42184e` |
| `app/api/promotion/test/route.ts` | GET, POST | approved access, fresh roster/title, signed secure test RPCs | yes | RLS23-03..04 | `213d99b` |
| `app/api/uploads/route.ts` | POST | `getEditorAccess`; 503/403/413 до `request.formData()`, сверка magic bytes | да | SEC20-05, SEC20-08, SEC20-15 | `2bb0b38` |
| `app/api/users/route.ts` | GET, POST | `getEditorAccess` и открытая вкладка `users`; для `view=bulk`, массового одобрения и снятия паузы — владелец; каждый users RPC повторно проверяет `portia_can_edit_tab('users')` | да | RLS22-03, RLS22-04 | `28611bf` |

## Миграции (охват)

Каждый отслеживаемый SQL в `supabase/migrations` имеет ровно одну строку. Первые семь строк перенесены без изменений из матрицы Phase 21. Старые записи о staging — исторические результаты соответствующих фаз, не новые проверки Phase 22.

| Миграция | Назначение | RLS / grants | Ревью supabase-rls-reviewer | Staging | Production |
|---|---|---|---|---|---|
| `supabase/migrations/20261101000000_portia_baseline.sql` | Канонический SQL: таблицы, RPC, политики, storage | Все `security definer` со `search_path=''`, `revoke ... from public`, явные grants, RLS таблиц и storage; находки SEC20-01, SEC20-03, SEC20-04, SEC20-08, SEC20-09, SEC20-10 | Phase 16 (находки MEDIUM/LOW перенесены в эту матрицу) | PASS: receipts Phase 16 (`receipt-roles.json`, `receipt-concurrency.json`) | Применена владельцем в Phase 16; postflight `16-PRODUCTION-POSTFLIGHT.md` |
| `supabase/migrations/20261101000100_portia_explicit_grants.sql` | Явные grants для привилегированной роли, лишение последовательностей прав anon и authenticated | Сужает права (least privilege), расширяет только привилегированную роль API | Phase 16 | PASS: receipts Phase 16 | Применена владельцем в Phase 16; postflight, совпадает с golden (SEC20-11) |
| `supabase/migrations/20261101000200_portia_drop_legacy_promo_overloads.sql` | Удаляет две устаревшие перегрузки `portia_promo_confirm_assignment(uuid, jsonb)` и `portia_promo_confirm_test(uuid, jsonb, text)`, которые обходили проверки банка и версии | Убирает пути обхода; прав не добавляет | Phase 16 | PASS: `receipt-roles-postdrop.json`, `receipt-concurrency-postdrop.json` | Применена владельцем в Phase 16; postflight `16-PRODUCTION-POSTFLIGHT.md` |
| `supabase/migrations/20261104000000_portia_rename_virus_classes.sql` | Переименование девяти значений классов вирусов в `portia_content` (`viruses`, `recycledViruses`), `revision + 1` у изменённых строк | RLS, grants и политики не затрагивает (вердикт агента: PASS-WITH-NOTES, статический); находка SEC20-22 | supabase-rls-reviewer через оркестратора, 20-21: PASS-WITH-NOTES, без high | PASS по фикстуре на изолированном staging (`20-CLASS-MIGRATION-EVIDENCE.md`); строки `main` на staging не было, поведение на реальном контенте не доказано (LIMITATION) | ОЖИДАЕТ ВЛАДЕЛЬЦА |
| `supabase/migrations/20261104000100_portia_editor_notes.sql` | Таблица `portia_editor_notes` для заметок редактора (D-41/D-47), недоступная anon | RLS включена; anon и authenticated лишены прав, затем authenticated получает select, insert и update по столбцам; три политики по `portia_can_edit_tab(tab)`; delete нет; находки SEC20-18..SEC20-21 | supabase-rls-reviewer через оркестратора, 20-24: PASS-WITH-NOTES, без high; LOW-1..3 и MEDIUM-4 приняты владельцем без исправлений | PASS на изолированном staging 2026-11-05 (`20-EDITOR-NOTES-EVIDENCE.md`); таблицу удаляет `20261106000000` | ОЖИДАЕТ ВЛАДЕЛЬЦА (вместе с `20261106000000`, итог — таблицы нет) |
| `supabase/migrations/20261106000000_portia_drop_editor_notes.sql` | Удаление таблицы `portia_editor_notes`: владелец убрал заметки редактора (20-33), маршрут `/api/content/notes` удалён | `drop table if exists`: уходят таблица, её три политики и grants; `portia_can_edit_tab` и другие таблицы не затрагиваются; закрывает SEC20-18..SEC20-21 | supabase-rls-reviewer, 20-33: PASS-WITH-NOTES, без high и medium (статическое чтение; дроп на живой базе не выполнялся); применять только вместе с `20261104000100`, никогда одну create-миграцию | Не применена: ОЖИДАЕТ ВЛАДЕЛЬЦА | ОЖИДАЕТ ВЛАДЕЛЬЦА |
| `supabase/migrations/20261109000000_portia_access_foundation.sql` | Фундамент доступа: люди, заявки, уровни 1-5, журнал решений только на добавление, флаг закрытия (в этом файле OFF; ON по умолчанию с 20261114000000), серверная подпись заявок, revoke `portia_promo_register_attempt` (SEC-06) и `portia_promo_bind_device` (RLS21-02) | Четыре таблицы только через RPC (RLS включён, политик нет, всё отозвано у public, anon, authenticated); 12 определяемых функций со `search_path ''`, revoke перед каждым grant; `submit`, `resolve` и `closure_enabled` (одна булева) доступны anon, остальные только вошедшим или привилегированной роли; триггеры журнала на update/delete и на truncate; секрет подписи в закрытой таблице, значения в миграции нет | supabase-rls-reviewer через оркестратора, три раунда (`70fe43d`, `9f9dad2`, `10b5e98`): итог «без блокирующих замечаний»; находки RLS21-01..16 | BLOCKED (ENV): не применялась, живого прогона на изолированном staging нет | ОЖИДАЕТ ВЛАДЕЛЬЦА |
| `supabase/migrations/20261110000000_portia_users_tab.sql` | Список заявок и людей, история 5 событий, кандидаты массового одобрения, удержание последних 20 записей журнала | `security definer` read RPC с `search_path=''`, revoke-before-grant; маска email для не-владельца; owner-only bulk candidates; bounded prune D-07, запрет обычного UPDATE/DELETE/TRUNCATE | `supabase-rls-reviewer`, два раунда: RLS22-01..05 исправлены, итог `SECURED` статически на `9f2778c` | BLOCKED (ENV): не применялась, нет прогона на изолированном staging | ОЖИДАЕТ ВЛАДЕЛЬЦА |
| `supabase/migrations/20261112000000_portia_access_decision_mark.sql` | Свежая отметка таблицы при одиночном одобрении: ответ об успешном решении содержит ключ ника из строки заявки | `portia_access_decide` сохраняет DB users-tab gate и target guard; ключ есть только в ответе успешного approve, route не передаёт ключ клиенту; revoke-before-grant | `supabase-rls-reviewer`, раунд 3 на `89235be`: `SECURED` статически | BLOCKED (ENV): не применялась, нет прогона на изолированном staging | ОЖИДАЕТ ВЛАДЕЛЬЦА |
| `supabase/migrations/20261113000000_portia_access_promotion.sql` | approved sheet identity and signed promotion RPCs | legacy participant grants revoked; secure wrappers | reviewer 2026-11-13, 0046f80; open critical/high 0 | BLOCKED isolated target unavailable | BLOCKED no production mutation |
| `supabase/migrations/20261114000000_portia_access_closure_default_on.sql` | закрытие включено по умолчанию (решение владельца 2026-11-14, 3a; отменяет D-01): default true, строка main ON, если владелец её не переключал; closure_enabled() при отсутствии строки — true | права closure_enabled повторены без изменений (anon, authenticated, и привилегированная роль API), revoke перед grant; таблица настроек закрыта, set_closure не меняется, журнал не пишется; notify pgrst в конце | supabase-rls-reviewer, раунд 2 на 12eecb1: открытых critical/high 0 | BLOCKED (ENV): не применялась | ОЖИДАЕТ ВЛАДЕЛЬЦА (применяет владелец по 23-MIGRATION-APPLY.md) |

## Находки Phase 22

Раунд 1: три medium и два low. Исправлены в `28611bf`; раунд 2 на `9f2778c` новых находок не обнаружил. Живые проверки остаются `BLOCKED`.

| ID | Severity | Статус |
|---|---|---|
| RLS22-01 | medium | fixed `28611bf` — двузначный self-guard |
| RLS22-02 | medium | fixed `28611bf` — маска для ровно одного `@` |
| RLS22-03 | medium | fixed `28611bf` — строгий JSON MIME и лимит тела |
| RLS22-04 | low | fixed `28611bf` — исходная длина и ASCII в поиске |
| RLS22-05 | low | fixed `28611bf` — advisory lock в prune-trigger |


## Phase 23 security findings

| ID | Severity | Status | Evidence |
|---|---|---|---|
| RLS23-01 | high | fixed | Signed submit/test proof and legacy grant revocation, reviewed at 0046f80. |
| RLS23-02 | medium | fixed | Authenticated non-editor gate aligned with SQL at 6db7d24. |
| RLS23-03 | medium | fixed | Stale-title start/current blocked before legacy RPCs at 213d99b. |
| RLS23-04 | medium | release-ledger | Test-action HMAC does not bind all payload fields; server-only signature, five-minute window. |
| RLS23-05 | low | accepted | Manual re-run of 20261114000000 can flip an OFF set outside set_closure; warning in 23-MIGRATION-APPLY.md; round 2 at 12eecb1. |
| RLS23-06 | low | fixed | Authz fixture source line updated at d675d73. |

## Phase 23 environment

| Lane | Verdict | Reason |
|---|---|---|
| Static SQL and caller review | PASS-local | supabase-rls-reviewer at 12eecb1 (round 2) and 0046f80 (23-07), no open critical/high. |
| Isolated migration push and direct roles | BLOCKED | No explicitly isolated test project. |
| Postgres/RLS and concurrency | BLOCKED | Migration not applied to isolated database. |
| Staging, production and physical devices | BLOCKED | No Phase 23 deployment or device proof. |
