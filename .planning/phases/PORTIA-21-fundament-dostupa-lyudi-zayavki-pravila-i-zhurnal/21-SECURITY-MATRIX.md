# 21 — Security matrix (access foundation, ASVS L1, local scope)

Дата: 2026-11-09. Проверяемый commit: `10b5e98e80947062dc80e8bc20a12fb9692375c4` (итоговый проверенный commit из `21-RLS-REVIEW.md`, раунд 3, вердикт «без блокирующих замечаний»). Матрица продолжает архивную матрицу v1.3 (`20-SECURITY-MATRIX.md`, заморожена как история): она переносит охват v1.3 и добавляет слой доступа Phase 21 (миграция `20261109000000_portia_access_foundation.sql`, `lib/nickname.ts`, `lib/access-session.ts`, `lib/access-store.ts`, `lib/access-levels.ts`).

Машинная проверка: `node --experimental-strip-types --test lib/security-matrix.test.ts`. Тест падает с «stale matrix», если файл из раздела «Охват файлов» изменился после проверяемого commit, и с «missing migration row», если в дереве появилась миграция без строки. После изменения охватываемого файла матрицу нужно пересмотреть и записать новый commit в шапку. Структура находок, маршруты API и перенесённые находки 19-REVIEW (D-33) проверяются по архивной матрице v1.3, потому что Phase 21 не добавляла маршрутов.

## Метод и границы

- Только статическое чтение: ревью supabase-rls-reviewer читал SQL и TypeScript (Read, Grep, Glob), три раунда. Ни SQL, ни Supabase он не запускал.
- Живого Postgres, RLS, ролей с аутентификацией, staging и production в этой фазе нет. Всё, что требует живой базы, платформы или устройства, остаётся BLOCKED и нигде не записано как пройденное (список в `21-RLS-REVIEW.md`, разделы «BLOCKED» трёх раундов).
- Миграция фазы 21 нигде не применена: ни агентом, ни владельцем. Порядок применения и шаги владельца записаны в `21-MIGRATION-APPLY.md`.
- Маршрутов и компонентов, которые вызывают новые функции, в фазе 21 нет (тест «нет вызывающих в app/, components/»). Поверхность появится в Phase 23 с требованиями, перечисленными в `21-RLS-REVIEW.md`.
- Реальные `.env*` не читались, к Supabase агент не подключался.

## Охват файлов

Свежесть матрицы: `git diff --name-only <проверяемый commit> HEAD -- <пути ниже>` должен быть пуст. Любое изменение этих путей после проверяемого commit требует пересмотра матрицы и нового commit в шапке. Планировочные файлы (`.planning`) и тесты в охват не входят.

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

## Миграции (охват)

Каждый отслеживаемый файл `git ls-files supabase/migrations` имеет ровно одну строку (тест migration coverage). Чтение SQL статическое. Первые шесть строк перенесены из матрицы v1.3 без изменений. Production-применение выполняет только владелец; агент production не трогал и не трогает.

| Миграция | Назначение | RLS / grants | Ревью supabase-rls-reviewer | Staging | Production |
|---|---|---|---|---|---|
| `supabase/migrations/20261101000000_portia_baseline.sql` | Канонический SQL: таблицы, RPC, политики, storage | Все `security definer` со `search_path=''`, `revoke ... from public`, явные grants, RLS таблиц и storage; находки SEC20-01, SEC20-03, SEC20-04, SEC20-08, SEC20-09, SEC20-10 | Phase 16 (находки MEDIUM/LOW перенесены в эту матрицу) | PASS: receipts Phase 16 (`receipt-roles.json`, `receipt-concurrency.json`) | Применена владельцем в Phase 16; postflight `16-PRODUCTION-POSTFLIGHT.md` |
| `supabase/migrations/20261101000100_portia_explicit_grants.sql` | Явные grants для привилегированной роли, лишение последовательностей прав anon и authenticated | Сужает права (least privilege), расширяет только привилегированную роль API | Phase 16 | PASS: receipts Phase 16 | Применена владельцем в Phase 16; postflight, совпадает с golden (SEC20-11) |
| `supabase/migrations/20261101000200_portia_drop_legacy_promo_overloads.sql` | Удаляет две устаревшие перегрузки `portia_promo_confirm_assignment(uuid, jsonb)` и `portia_promo_confirm_test(uuid, jsonb, text)`, которые обходили проверки банка и версии | Убирает пути обхода; прав не добавляет | Phase 16 | PASS: `receipt-roles-postdrop.json`, `receipt-concurrency-postdrop.json` | Применена владельцем в Phase 16; postflight `16-PRODUCTION-POSTFLIGHT.md` |
| `supabase/migrations/20261104000000_portia_rename_virus_classes.sql` | Переименование девяти значений классов вирусов в `portia_content` (`viruses`, `recycledViruses`), `revision + 1` у изменённых строк | RLS, grants и политики не затрагивает (вердикт агента: PASS-WITH-NOTES, статический); находка SEC20-22 | supabase-rls-reviewer через оркестратора, 20-21: PASS-WITH-NOTES, без high | PASS по фикстуре на изолированном staging (`20-CLASS-MIGRATION-EVIDENCE.md`); строки `main` на staging не было, поведение на реальном контенте не доказано (LIMITATION) | ОЖИДАЕТ ВЛАДЕЛЬЦА |
| `supabase/migrations/20261104000100_portia_editor_notes.sql` | Таблица `portia_editor_notes` для заметок редактора (D-41/D-47), недоступная anon | RLS включена; anon и authenticated лишены прав, затем authenticated получает select, insert и update по столбцам; три политики по `portia_can_edit_tab(tab)`; delete нет; находки SEC20-18..SEC20-21 | supabase-rls-reviewer через оркестратора, 20-24: PASS-WITH-NOTES, без high; LOW-1..3 и MEDIUM-4 приняты владельцем без исправлений | PASS на изолированном staging 2026-11-05 (`20-EDITOR-NOTES-EVIDENCE.md`); таблицу удаляет `20261106000000` | ОЖИДАЕТ ВЛАДЕЛЬЦА (вместе с `20261106000000`, итог — таблицы нет) |
| `supabase/migrations/20261106000000_portia_drop_editor_notes.sql` | Удаление таблицы `portia_editor_notes`: владелец убрал заметки редактора (20-33), маршрут `/api/content/notes` удалён | `drop table if exists`: уходят таблица, её три политики и grants; `portia_can_edit_tab` и другие таблицы не затрагиваются; закрывает SEC20-18..SEC20-21 | supabase-rls-reviewer, 20-33: PASS-WITH-NOTES, без high и medium (статическое чтение; дроп на живой базе не выполнялся); применять только вместе с `20261104000100`, никогда одну create-миграцию | Не применена: ОЖИДАЕТ ВЛАДЕЛЬЦА | ОЖИДАЕТ ВЛАДЕЛЬЦА |
| `supabase/migrations/20261109000000_portia_access_foundation.sql` | Фундамент доступа: люди, заявки, уровни 1-5, журнал решений только на добавление, флаг закрытия (по умолчанию OFF), серверная подпись заявок, revoke `portia_promo_register_attempt` (SEC-06) и `portia_promo_bind_device` (RLS21-02) | Четыре таблицы только через RPC (RLS включён, политик нет, всё отозвано у public, anon, authenticated); 12 определяемых функций со `search_path ''`, revoke перед каждым grant; `submit`, `resolve` и `closure_enabled` (одна булева) доступны anon, остальные только вошедшим или привилегированной роли; триггеры журнала на update/delete и на truncate; секрет подписи в закрытой таблице, значения в миграции нет | supabase-rls-reviewer через оркестратора, три раунда (`70fe43d`, `9f9dad2`, `10b5e98`): итог «без блокирующих замечаний»; находки RLS21-01..16 | BLOCKED (ENV): не применялась, живого прогона на изолированном staging нет | ОЖИДАЕТ ВЛАДЕЛЬЦА |

## Находки Phase 21

Источник: `21-RLS-REVIEW.md` (три раунда). Статусы: `fixed` (исправлено, коммит указан), `accepted` (принято с причиной), `deferred` (вне диффа фазы, причина записана). Статус `open` недопустим; high и critical без статуса `fixed` недопустимы.

| ID | Severity | Статус | Коммит или причина |
|---|---|---|---|
| RLS21-01 | high | fixed | `ff78fcc`: серверная подпись HMAC-SHA256 и глобальный лимит 20 в минуту; запись секрета владельцем и живая проверка BLOCKED; перенос в Phase 23 (проверка человека или грубый лимит) |
| RLS21-02 | high | fixed | `9c25ab7`: revoke `portia_promo_bind_device` (D-10 расширен владельцем 2026-11-09) |
| RLS21-03 | medium | fixed | `9d26a31`: триггер before truncate, grant журнала `select, insert`; остаток владельца таблицы и суперпользователя принят |
| RLS21-04 | medium | fixed | `9d26a31`: `account_id = account_for_person` при повторном одобрении |
| RLS21-05 | low | accepted | вкладка users появится в Phase 22; сейчас проверка равна `portia_can_edit()`, что согласуется с D-02 |
| RLS21-06 | low | accepted | остаток, присущий D-06; зондирование шумное, одобренные люди не раскрываются |
| RLS21-07 | low | fixed | `ff78fcc`: валидные ники проб |
| RLS21-08 | medium | fixed | `1d6da55`: `accessIpGroup`/`accessIpBucket` (канонизация IPv6, группа /48); перенос в Phase 23 |
| RLS21-09 | low | fixed | `1fcbe6b`: `drop function if exists` старой перегрузки submit |
| RLS21-10 | low | fixed | `1fcbe6b`: у привилегированной роли на последовательности журнала только select и usage |
| RLS21-11 | low | fixed | `1fcbe6b`: `expected_response` в ячейке матрицы и контрактный тест порядка |
| RLS21-12 | low | accepted | повтор подписи в течение 300 с привязан к token_hash и не создаёт новую строку, кроме случая после `clear_cooldown` для того же устройства |
| RLS21-13 | low | accepted | `1fcbe6b`: шаг владельца со страховкой длины; Phase 23 пишет каждый `unauthorized` в журнал тревог |
| RLS21-14 | low | deferred | устаревшие `supabase/portia_setup.sql` и `supabase/phase14_apply.sql` закреплены хешами; действующая схема строится из `supabase/migrations/`; не разворачивать эти скрипты вместо миграций |
| RLS21-15 | low | fixed | `6098b81`: живой прогон сравнивает `expected_response`; сам прогон BLOCKED |
| RLS21-16 | low | accepted | перенос в Phase 23: маршрут читает только `x-nf-client-connection-ip`, иначе нейтральная ошибка и тревога |
