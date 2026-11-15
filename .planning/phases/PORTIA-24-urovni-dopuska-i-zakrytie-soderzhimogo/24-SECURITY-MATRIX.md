# 24 - Security matrix (Phase 23 carried forward)

Дата: 2026-11-15. Проверяемый commit: `a9847aaf6f0fd869670d0b83fd78b3b48c56e54f` (Phase 24 static RLS review round 2: per-viewer content and level redaction; open critical/high 0).

Машинная проверка: `node --experimental-strip-types --test lib/security-matrix.test.ts` проверяет полноту маршрутов и миграций и отсутствие изменений охваченного кода после проверенного commit.

## Метод и границы

- Только статическое ревью SQL, RLS/RPC-контрактов и вызывающего TypeScript; раунды `supabase-rls-reviewer` (в Phase 24: 24-11, два раунда). Результат не относится к живой базе.
- Phase 24 не добавляет миграций (решение D-07: миграция не понадобилась); таблица «Миграции (охват)» ниже перенесена из матрицы Phase 23 без изменений. Миграции Phase 22 и 23 нигде не применялись агентом. Живой Postgres, ACL/RLS реальных ролей, staging, production, конкуренция, Netlify и физические устройства остаются `BLOCKED` либо `ОЖИДАЕТ ВЛАДЕЛЬЦА`.
- Раунд 1 Phase 24 (на `f331dff2c9570365626201caeb0552164c2f91be`): одна medium и шесть low, исправлены в `e24dadf`, `2cabb1b`, `043d33c`, `78514fd`. Раунд 2 (на `a9847aaf6f0fd869670d0b83fd78b3b48c56e54f`) подтвердил исправления; открытых critical, high и medium нет. Оба раунда ревьюера запустил оркестратор; у ревьюера раунда 2 не было shell, построчный diff `f331dff..a9847aa` выполнил оркестратор (изменились `app/api/content/route.ts`, `lib/content-save.ts`, `lib/level-redact.ts`, `proxy.ts`; в `proxy.ts` только комментарий, `matcher` прежний).
- С раунда 3 Phase 23 (`7cb8702`) охваченные пути менялись так: `app/api/content/route.ts`, `lib/access-levels.ts`, `lib/access-viewer.ts`, `lib/content-response.ts`, `lib/content-save.ts`, `lib/embedded-documents.ts`, `lib/level-hierarchy.ts`, `lib/level-placeholders.ts`, `lib/level-redact.ts` (всё Phase 24) и комментарий в `proxy.ts`; всё это прочитал ревьюер.
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
- `lib/access-request-reply.ts` (тревога unauthorized и карта статусов маршрута заявки)
- `lib/access-levels.ts`
- `lib/users-api.ts`
- `lib/users-model.ts`
- `lib/users-roster.ts`
- `lib/access-identity.ts`
- `lib/promotion-participant.ts`
- `lib/request-json.ts`
- `lib/level-redact.ts` (очистка содержимого по уровню зрителя; Phase 24)
- `lib/content-response.ts` (ответ GET по зрителю, ключ slot, адрес документа; Phase 24)
- `lib/content-save.ts` (отказ копии зрителя и подъём иерархии на PUT; Phase 24)
- `lib/access-viewer.ts` (зритель из решения шлюза; Phase 24)
- `lib/level-placeholders.ts` (маркер копии зрителя и заглушки; Phase 24)
- `lib/level-hierarchy.ts` (эффективный уровень детей раздела; Phase 24)
- `lib/embedded-documents.ts` (адреса встроенных документов, «Устав»; Phase 24)

## Маршруты API (охват)

Каждый отслеживаемый `app/api/**/route.ts` имеет ровно одну строку. Строки, кроме `app/api/content/route.ts`, перенесены без изменений из матрицы Phase 23.

| Маршрут | Методы | Проверка прав | no-store | Находки | Последний коммит |
|---|---|---|---|---|---|
| `app/api/access/route.ts` | GET | `getUser()` + `getEditorAccess`; сбой auth или RPC даёт 503, не `canEdit:false` | да | — | `e0f89ef` |
| `app/api/access/editor-request/route.ts` | GET, POST | authenticated editor, own request token and auth.uid | yes | RLS23-02 | `465a1b9` |
| `app/api/access/request/route.ts` | POST | signed guest sheet request, current device; every unauthorized reply logs one constant alert line (no secret, signature, nickname, token hash or IP bucket), reply unchanged (23-12) | yes | RLS23-01, T-23-37 | `7cb8702` |
| `app/api/access/status/route.ts` | GET | current access device digest; editor first; missing closure function = closed (fail-closed, 23-09) | yes | RLS23-01, T-23-22 | `c2e6cf7` |
| `app/api/content/route.ts` | GET, PUT | GET по зрителю (Phase 24): `resolveGate`, редактор первым, сбой проверки редактора не даёт прав (fail-closed); при закрытом входе и отсутствии допуска 401 `access-required` до чтения строки контента; ответ очищается по уровню зрителя (`level-redact`), без маркеров из хранилища; все ответы `noStoreHeaders`, без тега кэша. PUT: `getEditorAccess`, закрытые разделы через `contentRefusal`; 413 до разбора; 422 `viewer-copy` для копии зрителя (по ключу `redaction` в теле или по признакам копии) до чтения и записи строки; подъём уровней детей до уровня раздела (`levelsRaised`); прежний контракт (403, 409, 23505, purge) сохранён | да (GET и PUT; общий кэш не используется) | SEC20-02, SEC20-05, SEC20-07, SEC20-09, SEC20-25, RLS24-01..RLS24-09 | `2cabb1b` |
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

Phase 24 не добавляет миграций; таблица без изменений относительно матрицы Phase 23. Каждый отслеживаемый SQL в `supabase/migrations` имеет ровно одну строку. Первые семь строк перенесены без изменений из матрицы Phase 21. Старые записи о staging — исторические результаты соответствующих фаз, не новые проверки.

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

## Phase 24 security findings

Ревью: `24-RLS-REVIEW.md`, раунд 1 на `f331dff2c9570365626201caeb0552164c2f91be`, раунд 2 на `a9847aaf6f0fd869670d0b83fd78b3b48c56e54f`. Открытых critical и high нет, medium нет (единственная medium исправлена и подтверждена в раунде 2).

| ID | Severity | Status | Evidence |
|---|---|---|---|
| RLS24-01 | medium | fixed | Файл корзины с пустым или битым `virusId` закрыт на уровне 5 (`e24dadf`); подтверждено в раунде 2. |
| RLS24-02 | low | accepted | Подъём уровней детей идёт после проверки закрытых вкладок, только вверх; утечки нет; возврат в Phase 25. |
| RLS24-03 | low | accepted | Ключ `slot` связан с секретом устройств; домены HMAC разделены; возврат в Phase 25. |
| RLS24-04 | low | fixed | PUT отказывает 422 по ключу `redaction` в теле с любым значением (`2cabb1b`); подтверждено в раунде 2. |
| RLS24-05 | low | fixed | Посетителю уходят только опубликованные сводки (`e24dadf`); подтверждено в раунде 2. |
| RLS24-06 | low | fixed | Точный набор из четырёх ключей ассистента (`e24dadf`); подтверждено в раунде 2. |
| RLS24-07 | low | fixed | Комментарий `proxy.ts` про CDN исправлен (`043d33c`); раунд 2: с оговоркой, см. RLS24-08. |
| RLS24-08 | low | release-ledger | Комментарий `proxy.ts` о `Set-Cookie` на GET `/api/content` неточен (GET может обновить сессию редактора); не утечка, ответ `no-store`; исправление в Phase 25, чтобы проверенный коммит остался итоговым; фактическое поведение BLOCKED (Netlify). |
| RLS24-09 | low | accepted | Имена файлов с битым `virusId` попадают в список закрытых терминов, лишние рекомендации отсекаются; fail-closed, не утечка; Phase 25. |
| SEC-01 (transfer) | high | transfer | Остаточный риск, не PASS: аноним читает `portia_content` напрямую по публичному ключу (`using (true)` для `anon, authenticated`, `supabase/migrations/20261101000000_portia_baseline.sql:245,249-252`); очистка на сервере обходится одним запросом PostgREST. Закрытие передано Phase 25 (SEC-01); принято владельцем в `.planning/PROJECT.md`. Если миграция `20261114000000` попадёт в production раньше Phase 25, закрытие будет только видимостью. |

## Phase 24 environment

| Lane | Verdict | Reason |
|---|---|---|
| Static content, redaction and save review | PASS-local | supabase-rls-reviewer, раунды на `f331dff` и `a9847aa`, открытых critical/high нет. |
| Browser backstop on a mocked API | PASS-local (mocked API) | `24-BROWSER-EVIDENCE.md`: S1, S3, S4, S6 на подменённых ответах `/api/**`; не доказывает живые роли. |
| Direct anon read of `portia_content` | BLOCKED | Не проверялось на живой базе; остаточный риск передан Phase 25 (SEC-01). |
| Live roles, Postgres/RLS and RPC gateway | BLOCKED | Нет изолированного проекта; миграции не применялись. |
| Netlify CDN and `Set-Cookie` on GET | BLOCKED | Нет прогона на реальном хостинге. |
| Staging, production and physical devices | BLOCKED | Нет развёртывания и проверки на устройствах для Phase 24. |
