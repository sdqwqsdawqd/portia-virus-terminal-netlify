# 20-21: миграция D-36(б), переименование классов в сохранённых данных

Статус: миграция написана, закреплена, проверена offline и reviewer-ом; по решению владельца (вариант a) применена на изолированном staging с фикстурой (см. «Staging»). **На production не применялась.**

## Миграция

- Файл: `supabase/migrations/20261104000000_portia_rename_virus_classes.sql`
- sha256 (текст с нормализованными EOL, как в `lib/portia-canonical-parity.test.ts`): `0037b9303c9524920af5dc810e1d0efacdbc038dcfe535b50535b032c816a98c`
- Закреплена одной новой строкой в `migrationHashes`; прежние строки не менялись.
- Что делает: один data-only оператор `with class_map ... update public.portia_content`. В `payload -> 'viruses'` и `payload -> 'recycledViruses'` (только если значение — массив) в каждом элементе-объекте с объектом `classification` заменяет значения ключей `mind`, `behavior`, `appearance`, если это строка из девяти старых названий (таблица D-35):
  - mind: Рубедо -> Люцидиум, Альбедо -> Транзитиум, Нигредо -> Обливиум
  - behavior: Фобус -> Стабилар, Ареус -> Импульсар, Селенус -> Инфернар
  - appearance: Нюктея -> Изоморф, Морфея -> Полиморф, Дедалея -> Ксеноморф
- Что не меняется: остальные ключи payload и элемента, оси danger/spread/transmission/escapeRisk, порядок массивов, строки без старых названий, строки, где payload не JSON-объект, тексты «Информации», `updated_by`.
- Затронутые строки: только `public.portia_content` (в приложении используется одна строка `id = 'main'`). У изменённой строки `revision + 1` и `updated_at = now()`; у неизменённой ничего (условие `payload is distinct from <новое значение>`). Повторный запуск ничего не меняет (идемпотентна).
- Открытый редактор со старой копией после применения получит 409 (проверено по `app/api/content/route.ts`: `update ... eq("revision", baseRevision)`), а не перезапишет данные.
- Обратимость: **односторонняя**. Откат — только обратной миграцией (новые названия -> старые); значения, которые уже были новыми до миграции, от переписанных после неё неотличимы.
- Без begin/commit, без DDL, grants, policies, функций, триггеров, других таблиц (проверено тестом `D-36`).
- Локально выполнить SQL нечем (нет psql, docker, PGlite). Поведение на реальных строках — **BLOCKED до staging** (Task 3); offline доказаны только текст миграции, таблица пар (та же, что в коде, `legacyClassificationNames`) и чистые функции staging-скрипта.

Offline-проверки: `node --experimental-strip-types --test lib/portia-canonical-parity.test.ts lib/portia-class-migration.test.ts` — 15 тестов, 0 fail (шесть тестов `D-36`); `npm test` — 1230 тестов, 1227 pass, 0 fail, 3 skipped (как раньше); `npm exec tsc -- --noEmit` — чисто; ESLint по файлам плана — 0 ошибок; полный `npm run lint` — 62 problems (32 errors), все вне файлов плана, число не изменилось с 20-20.

## Ревью supabase-rls-reviewer

Исполнитель плана запускать субагентов не может, поэтому агент `.claude/agents/supabase-rls-reviewer.md` был запущен оркестратором. Вердикт агента: **PASS-WITH-NOTES, только статический анализ** (на живом Postgres агент не запускал SQL). Открытых high/critical нет.

Выводы агента:

- Влияния на RLS, grants и политики нет. Конкурентность безопасна при любом порядке (повторная проверка условия под READ COMMITTED плюс 409 по revision). Миграция идемпотентна; пути потери данных нет.
- LOW: точное сравнение не ловит варианты с U+0301, NBSP и пробелами. Принято (LOW-2), не исправлялось.
- LOW: выражение в 22 строки продублировано в SET и WHERE. Приемлемо как есть (чтобы не использовать снимок из CTE).
- LOW/INFO: `scripts/phase16-staging.mjs push` выполняет `supabase db push --yes` и применяет ВСЕ неприменённые миграции репозитория (baseline, explicit_grants, drop_legacy_promo_overloads, который деструктивен для перегрузок функций, и эту). Закрыто предварительной проверкой в разделе «Staging»: три прежние версии уже стоят на staging, единственная ожидающая миграция — эта.
- INFO: повторное сканирование payload пренебрежимо по стоимости. INFO: отсутствие триггера на `portia_content` проверено только grep.

Ранее исполнитель делал собственную статическую самопроверку по шести пунктам списка агента (critical 0, high 0, medium 0); вывод агента её подтверждает. Статус «ревью агентом»: **выполнено (PASS-WITH-NOTES)**.

## Решение владельца

Ответ владельца (дословно): **Вариант a** — «Применить на staging только переименование классов (рекомендуется)».
Подтверждение владельца: изолированный staging свободен (другого staging-прогона нет, сессия Phase 19 его не использует).
Вариант b (D-38, текст «Классификация») не выбран: миграция не менялась, hash остался `0037b9303c9524920af5dc810e1d0efacdbc038dcfe535b50535b032c816a98c`.

## Staging

Статус: **PASS по фикстуре; поведение на реальных данных main не доказано** (см. оговорку). Production не затрагивался. Все команды шли через `scripts/phase16-staging.mjs` (`resolveStagingTarget`, `runCli`) и `scripts/phase20-class-migration-staging.mjs`; значения окружения и .env не читались и не печатались.

Предпроверка (только чтение, на той же защищённой цели):

- `phase16-staging.mjs self-test-production-block`: `{"checked":1,"blocked":1}`, exit 0 (production-ссылка блокируется до любого запуска).
- `phase16-staging.mjs attest`: `{"status":"ATTESTED","refHash":"01d085e7b9f0"}`, exit 0. Цель — изолированный staging (guard: live-confirm, список production-проектов, отсутствие linked-проекта).
- `supabase migration list` (через `runCli`, `--db-url` подставляет обёртка), exit 0: Local и Remote совпадают для `20261101000000`, `20261101000100`, `20261101000200`; `20261104000000` есть локально, на remote пусто.
- `supabase db push --dry-run` (через `runCli`), exit 0: «Would push these migrations: 20261104000000_portia_rename_virus_classes.sql». Других ожидающих миграций нет.
- Только чтение: в `public.portia_content` на staging строк всего 0, строк со значениями U+0301: 0. То есть строки `main` на staging нет.

Прогон runId `p20cls-20261104-a7k2`:

| Шаг | Команда | exit | Receipt |
|-----|---------|------|---------|
| seed | `phase20-class-migration-staging.mjs seed p20cls-20261104-a7k2` | 0 | `{"runId":"p20cls-20261104-a7k2","step":"seed","fixtureRevision":1,"mainRevision":null,"mainOldValues":0,"ok":true,"residual":null}` |
| push | `phase16-staging.mjs push` | 0 | «Applying migration 20261104000000_portia_rename_virus_classes.sql...»; migration list: все четыре версии Local = Remote, `20261104000000` применена |
| verify | `phase20-class-migration-staging.mjs verify p20cls-20261104-a7k2` | 0 | `{"runId":"p20cls-20261104-a7k2","step":"verify","fixtureRevision":2,"mainRevision":null,"mainOldValues":0,"problems":[],"ok":true,"residual":null}` |
| cleanup | `phase20-class-migration-staging.mjs cleanup p20cls-20261104-a7k2` | 0 | `{"runId":"p20cls-20261104-a7k2","step":"cleanup","ok":true,"residual":0}` |

После прогона `supabase db push --dry-run`: «Remote database is up to date.» (применено ровно то, что планировалось).

Что доказано: на реальном Postgres staging миграция применилась без ошибки; фикстурная строка со всеми девятью старыми названиями трёх осей в `viruses` и `recycledViruses` после push содержит новые, остальные поля payload глубоко равны (`checkRewritten`: problems пусто), revision 1 -> 2; фикстура удалена, residual 0.

Оговорка (LIMITATION, не PASS): строки `main` на staging не было, поэтому проверка «у main не осталось старых значений» вакуозна (mainRevision null, mainOldValues 0). Поведение на настоящем контенте main и на конкурентном сохранении редактором (LOW-1) не проверялось. Идемпотентность подтверждена только косвенно (миграция применена один раз; повторное применение журналом не допускается).

## Production — действие владельца

ОЖИДАЕТ ВЛАДЕЛЬЦА; агент production не трогал и не трогает. Файл для применения: `supabase/migrations/20261104000000_portia_rename_virus_classes.sql`, sha256 `0037b9303c9524920af5dc810e1d0efacdbc038dcfe535b50535b032c816a98c`. Перед применением на production владельцу: проверить, что `supabase migration list` показывает ожидающей только эту версию (staging была в таком состоянии). До применения сайт показывает новые имена благодаря чтению старых значений в коде (D-36а, 20-20). Дата и способ применения владельцем: _не заполнено_.
