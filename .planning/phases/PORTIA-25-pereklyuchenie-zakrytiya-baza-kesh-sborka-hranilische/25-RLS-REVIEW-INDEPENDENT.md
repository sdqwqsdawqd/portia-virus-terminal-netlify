# 25 — Независимое ревью RLS (supabase-rls-reviewer)

Reviewed commit: 8edd3d6c552ce509ae6c6577bd57c798b99d5e47
Исполнитель: агент `supabase-rls-reviewer` (отдельный контекст, только чтение), запущен оркестратором после 25-10, потому что ревью в `25-RLS-REVIEW.md` выполнил сам исполнитель плана.
Режим: статический. SQL не запускался, к Supabase не подключались, `.env*` не читались.

Итог: critical 0, high 0, medium 1 (существовала до Phase 25), low 3, info 4.

## Проверено без замечаний

- Обе definer-функции: `search_path = ''`, полные имена (включая `extensions.hmac`/`extensions.digest`), `revoke all ... from public, anon, authenticated` перед грантами; PUBLIC execute не остаётся.
- `portia_can_edit()` внутри definer-функции у anon без JWT даёт false — пути эскалации нет.
- Подпись: отсутствующий секрет → `hmac` с null → отказ; regex `^[0-9a-f]{64}$`; окно −300/+60 с; сравнение sha256 обеих hex-строк (не строго constant-time, но тайминг бесполезен); единый нейтральный ответ на все отказы.
- После контракта: у anon нет `select` на трёх таблицах; у вошедшего не-редактора нет select-политик; листинг `storage.objects` только у редакторов, политика ограничена `bucket_id`.
- `updated_by` убирается и в SQL, и в TS; у ручных сотрудников явный список столбцов.
- `stable` уместен.
- Аварийный файл не подхватывается: `db push` читает только `supabase/migrations/`, `sql_paths = ["./seed.sql"]` (`supabase/config.toml:72`).

## Находки

| ID | Severity | Где | Суть | Рекомендация |
|---|---|---|---|---|
| M1 | medium (до Phase 25) | `supabase/migrations/20261101000000_portia_baseline.sql:1662-1673`, `supabase/migrations/20261115000100_portia_closure_contract.sql:58-61` | Правило D-13 «удалять только файл без ссылок» держится только в `app/api/uploads/route.ts:107-117`. Любой редактор (включая редактора с закрытыми вкладками) напрямую через Storage API: `list()` (новая политика «Editors can read PORTIA media» показывает все UUID), затем `remove()`/перезапись используемого файла. | Удалить политику update, если она не нужна (`upload` с `upsert:false`, `copy` = insert; проверить на staging); в delete добавить `name like 'recycle/%'` и definer-функцию «нет ссылок в `portia_content`/`portia_employee_profiles`». |
| L1 | low | `app/api/uploads/route.ts:107-119` | Гонка «проверка ссылок → remove»: окно — два сетевых запроса, а не миллисекунды. Итог — битая картинка. | Атомарная проверка+удаление в БД (см. M1) или `select ... for update` строки `main` в одной definer-функции. |
| L2 | low | `supabase/migrations/20261115000100_portia_closure_contract.sql:10-19` | Защитный DO-блок обходится при запуске без `-v ON_ERROR_STOP=1 --single-transaction` (или в SQL-редакторе): `raise` прерывает только DO, `revoke`/`drop policy` идут дальше. Также блок не проверяет, что код Phase 25 выложен: `db push` с двумя ожидающими миграциями применит обе (отказ в доступе, не утечка). | Перенести `revoke`/`drop/create policy` внутрь DO через `execute`; для выкладки — строка-маркер, которую ставит владелец. |
| L3 | low (= RLS25-03) | `supabase/migrations/20261115000000_portia_server_read_expand.sql:83` | Профили отдаются «всё, кроме запрещённого» — новый столбец уйдёт посетителю автоматически. | Явный `jsonb_build_object` со списком разрешённых столбцов, как для manual на строке 85. |
| L4 | low (= RLS25-04) | `supabase/migrations/20261115000000_portia_server_read_expand.sql:33-37`, `:74-78` | Подпись чтения повторяема в окне 360 с; секрет `submit` общий. Подделка подписи другой области невозможна (метки разделены). | При разделении ключей расширить `portia_access_secrets_name_check` (`20261109000000_portia_access_foundation.sql:157`). |
| I1 | info (= RLS25-05) | — | `stable` разрешает GET `/rpc`, подпись тогда попадёт в URL/логи; сервер сейчас вызывает POST. | Тест, что `.rpc()` вызывается без `get: true`. |
| I2 | info (до Phase 25) | `supabase/migrations/20261101000000_portia_baseline.sql:1655-1658` | Insert в `storage.objects` не проверяет префикс `recycle/`; MIME — только заявленный. | Ограничить путь в политике insert. |
| I3 | info | `lib/phase25-emergency.test.ts:25` | Тест ищет в `migrations/` только имена со словом «emergency»; переименованная копия аварийного файла прошла бы и применилась `db push`. | Сравнивать sha256 файлов `migrations/` с аварийным. |
| I4 | info | — | Пороги секрета (≥32) считают символы, не энтропию; уход часов Netlify вперёд >60 с отключит чтение (503, отказ закрытый). | — |

## Сравнение с `25-RLS-REVIEW.md`

- RLS25-01, 03, 04, 05 — согласен.
- RLS25-02 — не согласен с обоснованием «адрес случайный, окно в миллисекундах»: редакторская select-политика даёт листинг, а проверку в route обходит прямой вызов Storage → вынесено в M1 (medium).
- Пункт «raise exception до первого изменения» верен только при `ON_ERROR_STOP`/одной транзакции → L2.

## BLOCKED (нужен живой Postgres/PostgREST/Storage; ничего не засчитано)

- Фактический отказ anon по трём таблицам и в листинге Storage.
- PUBLIC-гранты или select-политики, созданные в панели вне репозитория.
- Владелец функций и его BYPASSRLS (на `portia_access_secrets` RLS без политик).
- Наличие `extensions.hmac`/`extensions.digest` на проекте.
- Поведение `stable` в PostgREST.
- Работа `copy`/`upload`/`remove` с одной редакторской select-политикой; нужна ли политика update.
- Realtime и GraphQL после `revoke`.
