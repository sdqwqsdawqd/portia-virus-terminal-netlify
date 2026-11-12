# 22 — Security matrix («Пользователи», ASVS L1, local scope)

Дата: 2026-11-12. Проверяемый commit: `9f2778c49f63ef44925170bcf07df8e98baf842e` (итоговый проверенный commit `22-RLS-REVIEW.md`, раунд 2, `SECURED` только для статического scope). Матрица продолжает Phase 21 и архив v1.3, добавляя маршрут пользователей, три серверных модуля и миграцию Phase 22.

Машинная проверка: `node --experimental-strip-types --test lib/security-matrix.test.ts` проверяет полноту маршрутов и миграций и отсутствие изменений охваченного кода после проверенного commit.

## Метод и границы

- Только статическое ревью SQL, RLS/RPC-контрактов и вызывающего TypeScript; два раунда `supabase-rls-reviewer`. Результат `SECURED` не относится к живой базе.
- Миграция Phase 22 нигде не применялась агентом. Живой Postgres, ACL/RLS реальных ролей, staging, production, конкуренция, Netlify и физические устройства остаются `BLOCKED` либо `ОЖИДАЕТ ВЛАДЕЛЬЦА` по `22-RLS-REVIEW.md`.
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
- `lib/access-store.ts`
- `lib/access-levels.ts`
- `lib/users-api.ts`
- `lib/users-model.ts`
- `lib/users-roster.ts`

## Маршруты API (охват)

Каждый отслеживаемый `app/api/**/route.ts` имеет ровно одну строку. Первые 11 строк перенесены без изменений из архивной матрицы v1.3.

| Маршрут | Методы | Проверка прав | no-store | Находки | Последний коммит |
|---|---|---|---|---|---|
| `app/api/access/route.ts` | GET | `getUser()` + `getEditorAccess`; сбой auth или RPC даёт 503, не `canEdit:false` | да | — | `e0f89ef` |
| `app/api/content/route.ts` | GET, PUT | PUT: `getEditorAccess`, закрытые разделы через `contentRefusal`; GET публичный (CDN-кэш) | PUT да; GET публичный кэш | SEC20-02, SEC20-05, SEC20-07, SEC20-09, SEC20-25 | `f93f894` |
| `app/api/editors/route.ts` | GET, POST, DELETE, PATCH | только владелец (`canManageEditors`) | да, кроме части 403/500 | SEC20-02, SEC20-05, SEC20-07 | `49555da` |
| `app/api/employees/editor/route.ts` | GET | `getEditorAccess`, вкладка `employees` открыта | да | SEC20-02 | `6f6b841` |
| `app/api/employees/route.ts` | GET, PATCH, POST, DELETE | GET публичный (CDN-кэш); изменения: `getEditorAccess` и вкладка `employees` | изменения да, кроме 403 | SEC20-02, SEC20-05, SEC20-07 | `6f6b841` |
| `app/api/promotion/banks/route.ts` | GET, POST | проверяющий (`requirePromotionReviewer`); превью и подтверждение сверяют токен версии банка | да | SEC20-23 | `97d7abb` |
| `app/api/promotion/requests/route.ts` | POST | без входа: ник по ростеру, токен устройства, бакеты | да | SEC20-04, SEC20-06 | `eb6026d` |
| `app/api/promotion/reviewer/route.ts` | GET, POST | проверяющий; удаление запроса и сброс привязки только владелец | да | SEC20-03, SEC20-05 | `ad377c4` |
| `app/api/promotion/status/route.ts` | GET | без входа: ник по ростеру, токен устройства; проекция по allowlist | да | SEC20-06 | `08f0498` |
| `app/api/promotion/test/route.ts` | GET, POST | токен попытки и устройства, сервер владеет состоянием попытки | да | SEC20-16, SEC20-17 | `b8ba080` |
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
| `supabase/migrations/20261109000000_portia_access_foundation.sql` | Фундамент доступа: люди, заявки, уровни 1-5, журнал решений только на добавление, флаг закрытия (по умолчанию OFF), серверная подпись заявок, revoke `portia_promo_register_attempt` (SEC-06) и `portia_promo_bind_device` (RLS21-02) | Четыре таблицы только через RPC (RLS включён, политик нет, всё отозвано у public, anon, authenticated); 12 определяемых функций со `search_path ''`, revoke перед каждым grant; `submit`, `resolve` и `closure_enabled` (одна булева) доступны anon, остальные только вошедшим или привилегированной роли; триггеры журнала на update/delete и на truncate; секрет подписи в закрытой таблице, значения в миграции нет | supabase-rls-reviewer через оркестратора, три раунда (`70fe43d`, `9f9dad2`, `10b5e98`): итог «без блокирующих замечаний»; находки RLS21-01..16 | BLOCKED (ENV): не применялась, живого прогона на изолированном staging нет | ОЖИДАЕТ ВЛАДЕЛЬЦА |
| `supabase/migrations/20261110000000_portia_users_tab.sql` | Список заявок и людей, история 5 событий, кандидаты массового одобрения, удержание последних 20 записей журнала | `security definer` read RPC с `search_path=''`, revoke-before-grant; маска email для не-владельца; owner-only bulk candidates; bounded prune D-07, запрет обычного UPDATE/DELETE/TRUNCATE | `supabase-rls-reviewer`, два раунда: RLS22-01..05 исправлены, итог `SECURED` статически на `9f2778c` | BLOCKED (ENV): не применялась, нет прогона на изолированном staging | ОЖИДАЕТ ВЛАДЕЛЬЦА |

## Находки Phase 22

Раунд 1: три medium и два low. Исправлены в `28611bf`; раунд 2 на `9f2778c` новых находок не обнаружил. Живые проверки остаются `BLOCKED`.

| ID | Severity | Статус |
|---|---|---|
| RLS22-01 | medium | fixed `28611bf` — двузначный self-guard |
| RLS22-02 | medium | fixed `28611bf` — маска для ровно одного `@` |
| RLS22-03 | medium | fixed `28611bf` — строгий JSON MIME и лимит тела |
| RLS22-04 | low | fixed `28611bf` — исходная длина и ASCII в поиске |
| RLS22-05 | low | fixed `28611bf` — advisory lock в prune-trigger |
