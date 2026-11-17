# 25 - Security matrix (Phase 24 carried forward)

Дата: 2026-11-17. Проверяемый commit: `d2e963dd9110bdbf174db5b85dc7a29d39518f1c` (quick 261117-px5, инкрементальное статическое ревью, round 2 в `25-RLS-REVIEW.md`: правила квалификации, подготовленная попытка, два маршрута; Phase 25 round 1 был на `1b8f4f237f391bf8e686f0a0b8cb9c3a941fd8a6`; open critical/high 0).

Машинная проверка: `node --experimental-strip-types --test lib/security-matrix.test.ts` проверяет полноту маршрутов и миграций и отсутствие изменений охваченного кода после проверенного commit.

## Метод и границы

- Только статическое ревью SQL, RLS/RPC-контрактов и вызывающего TypeScript; один раунд в Phase 25 (25-10), выполненный самим исполнителем по инструкции `supabase-rls-reviewer` (у исполнителя нет инструмента Agent/Task; оркестратор разрешил этот путь), см. `25-RLS-REVIEW.md`. Независимого субагента в этом раунде не было. Результат не относится к живой базе.
- Phase 25 добавляет две миграции: `20261115000000_portia_server_read_expand.sql` (подписанные функции чтения содержимого и списка сотрудников) и `20261115000100_portia_closure_contract.sql` (снятие анонимного чтения трёх таблиц и листинга бакета). Аварийный файл `supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql` не миграция и не входит в таблицу миграций, но входит в охват файлов. Миграции Phase 22, 23 и 25 нигде не применялись агентом. Живой Postgres, ACL/RLS реальных ролей, staging, production, конкуренция, Netlify и физические устройства остаются `BLOCKED` либо `ОЖИДАЕТ ВЛАДЕЛЬЦА`.
- Раунд 1 Phase 25 (на `1b8f4f237f391bf8e686f0a0b8cb9c3a941fd8a6`): critical, high и medium не найдены, четыре low и одна info записаны в «Phase 25 security findings». Исправлений кода и SQL по ревью не было, закрепления хэшей (`migrationHashes`, `expected-authz.json`, golden, «Закреплённый sha256» чек-листа) не менялись.
- С раунда 2 Phase 24 (`a9847aa`) охваченные пути менялись только планами Phase 25 (25-01…25-09: чтение через сервер, ворота и снимок списка сотрудников, перезапись адреса картинки, кэш устройства, скан сборки); пути ревью прочитал исполнитель 25-10, клиентские модули кэша читались как контекст.
- Quick 261117-px5 (2026-11-17) добавил миграцию `20261117000000_portia_qualification_rules.sql` (столбец правил, подготовленная проекция, состояние банка с правилами, запись правил только проверяющим) и правки `app/api/promotion/test/route.ts`, `app/api/promotion/banks/route.ts`, `lib/portia-qualification-rules.ts`; раунд 2 выполнен исполнителем по инструкции `supabase-rls-reviewer`, не независимым субагентом; критических и высоких нет, миграция нигде не применялась.
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
- `lib/portia-qualification-rules.ts` (текст правил, закрытый список для маршрутов правил и проекции; quick 261117-px5)
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
- `lib/server-read.ts` (подпись и вызов подписанного чтения содержимого и списка; Phase 25)
- `lib/gate-for-request.ts` (одни ворота для `/api/content`, `/api/employees` и `/api/access/status`; Phase 25)
- `lib/employees-snapshot-cache.ts` (серверный снимок частей списка из Google Sheets и Roblox; Phase 25)
- `lib/media-rewrite.ts` (разбор адреса картинки сайта для перезаписи и удаления; Phase 25)
- `lib/media-rewrite-client.ts` (перезапись адреса картинки в редакторе; Phase 25)
- `lib/device-cache.ts` (ключи и штампы копий на устройстве, очистка при смене личности; Phase 25)
- `scripts/phase25-build-scan.mjs` (скан `.next` на маркеры стартового содержимого; Phase 25)
- `supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql` (аварийный возврат анонимного чтения таблиц, не миграция; Phase 25)

## Маршруты API (охват)

Каждый отслеживаемый `app/api/**/route.ts` имеет ровно одну строку. Строки `app/api/content`, `app/api/employees`, `app/api/uploads` и `app/api/access/status` обновлены Phase 25; остальные перенесены без изменений из матрицы Phase 24.

| Маршрут | Методы | Проверка прав | no-store | Находки | Последний коммит |
|---|---|---|---|---|---|
| `app/api/access/route.ts` | GET | `getUser()` + `getEditorAccess`; сбой auth или RPC даёт 503, не `canEdit:false` | да | — | `e0f89ef` |
| `app/api/access/editor-request/route.ts` | GET, POST | authenticated editor, own request token and auth.uid | yes | RLS23-02 | `465a1b9` |
| `app/api/access/request/route.ts` | POST | signed guest sheet request, current device; every unauthorized reply logs one constant alert line (no secret, signature, nickname, token hash or IP bucket), reply unchanged (23-12) | yes | RLS23-01, T-23-37 | `7cb8702` |
| `app/api/access/status/route.ts` | GET | одни ворота с `/api/content` (`lib/gate-for-request.ts`): редактор первым, затем флаг закрытия и устройство; отсутствие функции закрытия = закрыто (fail-closed, 23-09); в ответе только решение для этого устройства | yes | RLS23-01, T-23-22 | `d175cd9` |
| `app/api/content/route.ts` | GET, PUT | GET (Phase 25): ворота (`lib/gate-for-request.ts`), закрытый сайт без допуска получает 401 `access-required` до чтения строки; строку читает подписанная функция `portia_content_read` (посетитель: публичный ключ плюс подпись сервера, редактор: своя сессия, без подписи), затем очистка по уровню зрителя (`level-redact`); сбой чтения или подписи — 503 `content-unavailable`, в журнал только вид сбоя; посетитель без читаемой строки не получает стартового содержимого (D-22); все ответы `noStoreHeaders`, без тега кэша. PUT: `getEditorAccess`, закрытые разделы через `contentRefusal`; 413 до разбора; 422 `viewer-copy`; подъём уровней детей; прежний контракт (403, 409, 23505, purge) сохранён | да (GET и PUT; общий кэш не используется) | SEC20-02, SEC20-05, SEC20-07, SEC20-09, SEC20-25, RLS24-01..RLS24-09, RLS25-01, RLS25-04, RLS25-05 | `1478867` |
| `app/api/editors/route.ts` | GET, POST, DELETE, PATCH | только владелец (`canManageEditors`) | да, кроме части 403/500 | SEC20-02, SEC20-05, SEC20-07 | `49555da` |
| `app/api/employees/editor/route.ts` | GET | `getEditorAccess`, вкладка `employees` открыта | да | SEC20-02 | `6f6b841` |
| `app/api/employees/route.ts` | GET, PATCH, POST, DELETE | GET (Phase 25): те же ворота, что у `/api/content`, 401 до обращения к таблицам, Google Sheets и Roblox; профили и ручные сотрудники читает подписанная функция `portia_employees_read` (без `updated_by`), сбой — список из таблицы Google с флагами `degraded`; серверный снимок общих внешних частей стоит после ворот и не хранит данных зрителя; ответ `no-store`, без тега (раньше GET был публичным и кэшировался CDN). Изменения: `getEditorAccess` и вкладка `employees` | да (GET и изменения, кроме 403) | SEC20-02, SEC20-05, SEC20-07, RLS25-01, RLS25-03..RLS25-05 | `5826281` |
| `app/api/promotion/banks/route.ts` | GET, POST | проверяющий (`requirePromotionReviewer`); превью и подтверждение сверяют токен версии банка; `save-qualification-rules` (quick 261117-px5): тот же проверяющий, размер тела до разбора, переход из списка, текст не длиннее 4000 символов, запись только через `portia_promo_save_qualification_rules` (вкладка `promo` в SQL), без миграции 503 `pending-database` | да | SEC20-23, RLS25-07 | `d2e963d` |
| `app/api/promotion/requests/route.ts` | POST | approved current access request, current roster, signed secure submit | yes | RLS23-01..04 | `d42184e` |
| `app/api/promotion/reviewer/route.ts` | GET, POST | проверяющий; удаление запроса и сброс привязки только владелец | да | SEC20-03, SEC20-05 | `ad377c4` |
| `app/api/promotion/status/route.ts` | GET | approved current access request, secure status | yes | RLS23-02 | `d42184e` |
| `app/api/promotion/test/route.ts` | GET, POST | approved access, fresh roster/title, signed secure test RPCs; подготовленная проекция (quick 261117-px5) добавляет только `questionCount` (неотрицательное целое) и `rulesText` (строка до 4000 символов), вопроса и ключей до старта нет | yes | RLS23-03..04, RLS25-06 | `d2e963d` |
| `app/api/uploads/route.ts` | POST, DELETE | `getEditorAccess` одним шлюзом для загрузки, перезаписи и удаления; 503/403/413 до `request.formData()`; тело JSON не больше 4096 байт; сверка magic bytes; перезапись копирует файл под новым случайным путём, адрес проверяет `parsePortiaMediaUrl` (бакет сайта, `recycle/<uuid>.<ext>`, без `%`, `..`, запроса); удаление только если ни сохранённое содержимое, ни фото сотрудников не ссылаются на файл, ошибка чтения не удаляет ничего | да | SEC20-05, SEC20-08, SEC20-15, RLS25-02 | `5c7eb55` |
| `app/api/users/route.ts` | GET, POST | `getEditorAccess` и открытая вкладка `users`; для `view=bulk`, массового одобрения и снятия паузы — владелец; каждый users RPC повторно проверяет `portia_can_edit_tab('users')` | да | RLS22-03, RLS22-04 | `28611bf` |

## Миграции (охват)

Phase 25 добавляет две миграции (последние две строки); остальные строки перенесены без изменений из матрицы Phase 24. Последняя строка — из quick 261117-px5 (`20261117000000`), она не входит в порядок применения Phase 25. Каждый отслеживаемый SQL в `supabase/migrations` имеет ровно одну строку; аварийный файл из `supabase/emergency/` в таблицу не входит. Первые семь строк перенесены без изменений из матрицы Phase 21. Старые записи о staging — исторические результаты соответствующих фаз, не новые проверки.

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
| `supabase/migrations/20261115000000_portia_server_read_expand.sql` | Подписанные функции чтения `portia_content_read` и `portia_employees_read`: сервер подписывает метку области и время общим секретом заявок, редактор читает по своей сессии | Две функции `security definer`, `search_path ''`, `revoke ... from public, anon, authenticated` перед явными grants (anon, authenticated, привилегированная роль); без подписи и без `portia_can_edit()` ответ `unauthorized`; окно 300 с назад и 60 с вперёд; профили без `updated_by`; находки RLS25-03..RLS25-05 | supabase-rls-reviewer по инструкции, 25-10, раунд 1 на `1b8f4f237f391bf8e686f0a0b8cb9c3a941fd8a6`: critical/high 0 (выполнил исполнитель, не независимый субагент) | BLOCKED (ENV): не применялась, живого прогона нет | ОЖИДАЕТ ВЛАДЕЛЬЦА (применяет владелец по `25-OWNER-CHECKLIST.md`, до выкладки кода) |
| `supabase/migrations/20261115000100_portia_closure_contract.sql` | Контракт: снято анонимное чтение `portia_content`, `portia_employee_profiles`, `portia_manual_employees` и листинг бакета `portia-media`; остаются редакторские политики чтения | Защитный блок (функции и секрет на месте, иначе ошибка до изменений); `revoke select ... from anon` трёх таблиц; политики «Public can read ...» сняты, «Editors can read ...» только `authenticated` и `portia_can_edit()`; права `authenticated` и бакет не менялись (D-12); откат — аварийный файл вместе с предыдущим деплоем | supabase-rls-reviewer по инструкции, 25-10, раунд 1 на `1b8f4f237f391bf8e686f0a0b8cb9c3a941fd8a6`: critical/high 0 (выполнил исполнитель, не независимый субагент) | BLOCKED (ENV): не применялась, живого прогона нет | ОЖИДАЕТ ВЛАДЕЛЬЦА (после выкладки и проверки кода) |
| `supabase/migrations/20261117000000_portia_qualification_rules.sql` | Столбец `rules_text` банка квалификации, подготовленная попытка читается в любом режиме клиента с числом вопросов и правилами перехода, состояние банка с правилами, запись правил только проверяющим | Новая функция `portia_promo_save_qualification_rules`: `security definer`, `search_path ''`, проверка `portia_has_tab_grant('promo')`, `revoke ... from public, anon, authenticated` перед `grant ... to authenticated`; столбец без прав и политик; две заменённые функции сохраняют свои права и привязку устройства, вопрос до старта `null`; находки RLS25-06, RLS25-07 | supabase-rls-reviewer по инструкции, quick 261117-px5, раунд 2 на `d2e963dd9110bdbf174db5b85dc7a29d39518f1c`: critical/high 0 (выполнил исполнитель, не независимый субагент) | BLOCKED (ENV): не применялась, живого прогона нет | ОЖИДАЕТ ВЛАДЕЛЬЦА (применяет владелец вручную на изолированном проекте, затем в production) |

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

## Phase 25 security findings

Ревью: `25-RLS-REVIEW.md`, раунд 1 на `1b8f4f237f391bf8e686f0a0b8cb9c3a941fd8a6`, раунд 2 (quick 261117-px5) на `d2e963dd9110bdbf174db5b85dc7a29d39518f1c`. Открытых critical, high и medium нет.

| ID | Severity | Status | Evidence |
|---|---|---|---|
| RLS25-01 | low | release-ledger | Комментарии `proxy.ts` («must never carry Set-Cookie» для GET `/api/content` и `/api/employees`), `app/api/employees/editor/route.ts:9` и `lib/supabase/server.ts:6` неточны или устарели: оба GET создают серверный клиент и могут обновить сессию редактора; не утечка, ответы `no-store`, без тега. Правка комментариев при следующем проходе; фактический `Set-Cookie` BLOCKED (Netlify). Переносит RLS24-08. |
| RLS25-02 | low | accepted | `DELETE /api/uploads`: проверка ссылок и удаление файла — два шага без блокировки; другой редактор может сохранить ссылку между ними; требуется вошедший редактор и знание UUID; теряется только доступность картинки. |
| RLS25-03 | low | release-ledger | `portia_employees_read` убирает из профилей один столбец (`updated_by`), а не отдаёт список разрешённых; новый столбец ушёл бы посетителю; сегодня столбцы уже были публичными; TypeScript-слой убирает `updated_by` повторно. Учесть при добавлении столбца. |
| RLS25-04 | low | accepted | Подпись чтения без привязки к запросу, окно 300 с, общий с заявками секрет; метки разные, сервер не подписывает чужих префиксов; способ чтения — решение владельца Phase 25. |
| RLS25-05 | info | accepted | Функции чтения доступны `anon` без ограничения частоты; ответ на отказ один и тот же; оракула существования нет. |
| RLS25-06 | low (info) | accepted | Quick 261117-px5: подготовленная попытка читается участником со своей привязкой устройства в любом режиме клиента; режим берётся из запроса и не сохраняется до старта; вопроса и ключей в проекции нет. |
| RLS25-07 | low | accepted | Quick 261117-px5: запись правил не сверяет версию (побеждает последняя); писать может только проверяющий с вкладкой `promo`; на данные кандидатов не влияет. |
| SEC-01 (carried) | high | resolved in code, live BLOCKED | Анонимное прямое чтение `portia_content` и списка сотрудников закрыто контрактной миграцией и заменено подписанным чтением на сервере; миграции не применены и не проверены на живой базе, поэтому факт закрытия BLOCKED (ОЖИДАЕТ ВЛАДЕЛЬЦА), не PASS. |
| SEC-05/SEC-07 (carried) | low | accepted | Сохранённая ссылка на картинку остаётся открытой, пока редактор не сменит адрес (решение D-11); листинг закрыт контрактной миграцией (BLOCKED на живом Storage). |

## Phase 25 environment

| Lane | Verdict | Reason |
|---|---|---|
| Static review of reads, contract, emergency file and routes | PASS-local | `25-RLS-REVIEW.md`: раунд 1 на `1b8f4f237f391bf8e686f0a0b8cb9c3a941fd8a6` и раунд 2 (quick 261117-px5) на `d2e963dd9110bdbf174db5b85dc7a29d39518f1c`, critical/high 0; оба выполнены исполнителем по инструкции ревьюера, не независимым субагентом. |
| Browser transitions SEC-04 on a mocked API | PASS-local (mocked API) | `25-BROWSER-EVIDENCE.md`: восемь сценариев на локальной сборке с подменёнными ответами `/api/**`; не доказывает живые роли. |
| Direct anon read after the contract, anon listing and GET of Storage | BLOCKED | Не проверялось на живой базе; миграции не применялись. |
| Live roles, Postgres/RLS and the signed read functions | BLOCKED | Нет изолированного проекта; миграции не применялись. |
| Netlify CDN, headers, `Set-Cookie` on GET, `postbuild` on Netlify | BLOCKED | Нет прогона на реальном хостинге. |
| Staging, production, closure switch-on and physical devices | BLOCKED | ОЖИДАЕТ ВЛАДЕЛЬЦА: применение по `25-OWNER-CHECKLIST.md`. |
