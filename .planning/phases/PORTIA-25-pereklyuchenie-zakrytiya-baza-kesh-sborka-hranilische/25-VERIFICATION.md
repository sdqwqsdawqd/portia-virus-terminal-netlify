---
phase: PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische
verified: 2026-11-16T04:30:00Z
status: gaps_found
score: 3/5 must-haves verified
covered_files:
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-01-PLAN.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-01-SUMMARY.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-02-PLAN.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-02-SUMMARY.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-03-PLAN.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-03-SUMMARY.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-04-PLAN.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-04-SUMMARY.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-05-PLAN.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-05-SUMMARY.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-06-PLAN.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-06-SUMMARY.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-07-PLAN.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-07-SUMMARY.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-08-PLAN.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-08-SUMMARY.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-09-PLAN.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-09-SUMMARY.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-10-PLAN.md
  - .planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-10-SUMMARY.md
  - app/api/content/route.ts
  - app/api/employees/route.ts
  - app/api/uploads/route.ts
  - components/portia-access-gate.tsx
  - lib/device-cache.ts
  - lib/server-read.ts
  - scripts/phase25-build-scan.mjs
  - supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql
  - supabase/migrations/20261115000000_portia_server_read_expand.sql
  - supabase/migrations/20261115000100_portia_closure_contract.sql
covered_digest: "v4:sha256:8979c0415abd00804a1ccf1c5139e4e1be16bad717e142facca975e25f052b99"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SC1 / SEC-01: контрактная миграция написана так, что её нельзя применить наполовину (защитный блок гарантирует «ничего не изменено», если выкладка не готова)"
    status: partial
    reason: "Независимое ревью, находка L2 (решение владельца: закрыть в этой фазе). Защитный DO-блок только вызывает raise exception. Если файл запущен без -v ON_ERROR_STOP=1 и --single-transaction (SQL-редактор панели, psql без флагов), ошибка прерывает только DO, а revoke select / drop policy / create policy ниже выполняются. Результат: анонимное чтение снято при отсутствующих функциях чтения (сайт без данных) или без секрета. Текст «nothing was changed» в сообщении исключения при этом неверен. Чек-лист защищает только словами про psql-флаги."
    artifacts:
      - path: "supabase/migrations/20261115000100_portia_closure_contract.sql"
        issue: "строки 10-19: проверка в отдельном DO; строки 21-65: revoke/drop policy/create policy вне DO, поэтому не атомарны с проверкой"
    missing:
      - "Перенести все revoke / drop policy / create policy (три таблицы + storage.objects) ВНУТРЬ DO-блока через execute (после проверок), чтобы отказ был атомарным при любом способе запуска файла"
      - "Пересчитать закреплённый sha256 контрактной миграции: lib/portia-canonical-parity.test.ts, 25-OWNER-CHECKLIST.md (раздел «Закреплённый sha256»), lib/phase25-contract.test.ts (проверки текста защитного блока), lib/phase25-evidence.test.ts; отпечаток lib/portia-migration-fingerprint.test.ts"
      - "Тест, что ни один revoke/drop/create policy не стоит вне DO-блока (текстовая проверка порядка)"
      - "Повторное ревью supabase-rls-reviewer и обновление проверенного commit в 25-SECURITY-MATRIX.md (свежесть охваченных путей supabase/migrations)"
  - truth: "SC3 / SEC-05: у хранилища картинок нельзя получить список файлов; доступ редактора к хранилищу не позволяет обойти правило D-13 «удалять только файл без ссылок»"
    status: partial
    reason: "Независимое ревью, находка M1 (medium, решение владельца: закрыть офлайн-часть в этой фазе). Листинг для anon снят (VERIFIED текстом), но правило D-13 держится только в app/api/uploads/route.ts:107-117. Новая политика «Editors can read PORTIA media» даёт любому редактору list() всех UUID, а политики delete и update из baseline (supabase/migrations/20261101000000_portia_baseline.sql:1662-1673) разрешают редактору прямым вызовом Storage API remove()/перезапись любого файла, в том числе используемого записью."
    artifacts:
      - path: "supabase/migrations/20261101000000_portia_baseline.sql"
        issue: "строки 1662-1673: политики update и delete на storage.objects без ограничения префикса и без проверки ссылок"
      - path: "supabase/migrations/20261115000100_portia_closure_contract.sql"
        issue: "строки 58-61: добавлена select-политика редакторов, которая делает листинг возможным; delete/update не сужены"
      - path: "app/api/uploads/route.ts"
        issue: "строки 107-119: единственное место проверки ссылок; гонка проверка-удаление (L1) и обход прямым Storage API"
    missing:
      - "Сузить политику delete на storage.objects до name like 'recycle/%' И SECURITY DEFINER функции «нет ссылок в portia_content / portia_employee_profiles» (search_path = '', полные имена, revoke all from public, anon; grant только нужным ролям)"
      - "Учесть, что DELETE в маршруте после этого проходит через ту же проверку (поведение маршрута не меняется); файлы вне recycle/ (если есть исторические) через API перестанут удаляться: записать в релизную заметку"
      - "Решение «убрать политику update» зависит от поведения copy/upload в живом Storage: оформить как BLOCKED-пункт (staging), НЕ закрывать офлайн и НЕ записывать как пройденное"
      - "Тесты: текст новой политики и функции (prefix recycle/, вызов определённой функции, search_path, права), хеши и порядок в чек-листе; повторное ревью supabase-rls-reviewer"
      - "Опционально (low, связано): L1 — атомарная проверка и удаление внутри одной definer-функции; I2 — ограничить префикс recycle/ в политике insert"
behavior_unverified_items: []
deferred: []
human_verification: []
---

# Phase PORTIA-25: Переключение закрытия: база, кэш, сборка, хранилище. Отчёт верификации

**Цель фазы:** Содержимое сайта физически недоступно без допуска: аноним не читает таблицы напрямую, страница и сборка не содержат содержимого, CDN не раздаёт чужое, список картинок закрыт, браузер чистит кэш; включение закрытия на production — шаг владельца по письменному чек-листу.
**Проверено:** 2026-11-16, на HEAD `37ad5d4` (рабочее дерево чисто для файлов фазы)
**Статус:** gaps_found
**Повторная верификация:** нет, первичная

Исходная позиция: цель не достигнута, пока код не докажет обратное. Результат: код и тексты SQL сделаны основательно и честно размечены как BLOCKED, но два замечания независимого ревью (L2, M1) подтверждены в самих файлах и по решению владельца записаны как пробелы.

## Достижение цели

### Наблюдаемые истины (контракт ROADMAP, пять критериев)

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| SC1 | Контрактная миграция написана, прошла ревью и офлайн-стенд; «аноним не читает» записано как BLOCKED / ожидает владельца | ЧАСТИЧНО, ПРОБЕЛ (L2) | Миграция есть и снимает `select` у anon и политики `using (true)` на трёх таблицах и на `storage.objects` (`20261115000100_portia_closure_contract.sql:23-65`), оставляет чтение редакторам по `portia_can_edit()`. Подписанные функции `portia_content_read` / `portia_employees_read` (`20261115000000_...expand.sql`): `security definer`, `search_path = ''`, `revoke all ... from public, anon, authenticated`, окно -300/+60 с, regex подписи, сравнение через `digest`. Посетитель читает только через `lib/server-read.ts` и `GET /api/content` / `GET /api/employees` после `resolveGateFor`. Других прямых чтений таблиц анонимным клиентом в `app/`, `components/`, `lib/` нет (остальные `.from("portia_*")` идут через сессию редактора). BLOCKED записан честно (`25-OWNER-CHECKLIST.md` раздел «Статус», `25-SECURITY-MATRIX.md` строка SEC-01 carried). Ревью: независимое (`25-RLS-REVIEW-INDEPENDENT.md`), critical 0 / high 0. Пробел: L2, защитный блок не атомарен (см. gaps). |
| SC2 | Ни код страницы, ни HTML, ни сборка не содержат содержимого (МОРОК, АРАХНА); проверка после сборки ищет маркеры в `.next` и падает при находке; сид убран из статической оболочки | VERIFIED | `grep` маркеров (МОРОК, АРАХНА, КАЛЛИСТО, VIR-Δ17, ники, заголовки статей) по `app/`, `components/`, `lib/` без `*.test.ts` и `lib/testing/`: пусто (совпадения только в тестах, фикстуре `lib/testing/portia-content-fixture.ts`, скрипте сканирования и старом worktree `.claude/worktrees`, не входящем в сборку). `app/page.tsx` рендерит только `PortiaAccessGate`. `package.json`: `"postbuild": "node scripts/phase25-build-scan.mjs"`; скрипт возвращает 1 при находке, 2 при отсутствии `.next`. Мой запуск на существующей сборке `.next` (BUILD_ID от 2026-11-16 00:58): `build scan: 0 markers in 457 files`, код 0. Тесты границы фикстуры (`phase25-fixture-boundary.test.ts`) и сканера проходят. Оговорка: работа `postbuild` на Netlify (Node 22.13.0) BLOCKED до deploy preview (записано в чек-листе, A4). |
| SC3 | Закрытые ответы с `no-store` для браузера и CDN, без тегов кэша; при включении закрытия старые копии сбрасываются по обоим тегам; список картинок закрыт, картинка по точной ссылке; всё это BLOCKED до живого доказательства | ЧАСТИЧНО, ПРОБЕЛ (M1) | `/api/content` GET и `/api/employees` GET: везде `noStoreHeaders` (`Cache-Control: no-store`, `Netlify-CDN-Cache-Control: no-store`), `Netlify-Cache-Tag` отсутствует; `publicCacheHeaders` не используется нигде, кроме определения в `lib/portia-cdn.ts`; `proxy.ts` не добавляет заголовки кэша. Редакторский `/api/employees/editor` тоже no-store. Сброс по тегам `portia-content` и `portia-employees`: шаг 14 чек-листа с командой и запасным путём; код этого не делает по решению D-07 (записи по-прежнему вызывают `purgeCacheTag` один релиз). Листинг для anon закрыт текстом миграции, картинка по точной ссылке остаётся (бакет public, D-12). Пробел: M1, доступ редактора к `storage.objects` позволяет обойти D-13 (см. gaps). Живые заголовки CDN, сброс и Storage: BLOCKED, записаны как таковые. |
| SC4 | Кэш браузера очищается при любом переходе в неодобренное состояние и не показывает данные до одобрения (браузерный тест на локальной сборке) | VERIFIED (PASS-local, mocked API) | `lib/device-cache.ts`: ключи `-v2`, `clearDeviceContentCaches`, `purgeLegacyDeviceCaches` (v1), `identityChanged`, `cacheMatchesViewer` (человек и уровень). Проводка: `components/portia-access-gate.tsx:53,58,73`, `components/portia-desktop.tsx:604,719,771-799`. Спека `tests/e2e/specs/access-levels.spec.ts` содержит 8 сценариев SEC-04 / D-09 (строки 413-530); запись `25-BROWSER-EVIDENCE.md`: 17 passed на локальной сборке с подменой всех `/api/**`, обязательный список прерванных путей пуст. Браузерный прогон я не повторял (нужен сервер); юнит-покрытие и типы повторил сам (ниже). Это «PASS-local (mocked API)», не живые роли и не физические устройства: так и записано. |
| SC5 | Письменный чек-лист владельца: порядок применения (три ожидающих, затем новые), массовое одобрение «из таблицы», проверка входа редактора до включения, включение флага, сброс CDN, откат; шаги production записаны как ожидающие владельца | VERIFIED | `25-OWNER-CHECKLIST.md`: десять файлов по возрастанию версии (три ожидающих `20261104000000`, `...0100`, `20261106000000` первыми, затем доступ, expand `20261115000000`, contract `20261115000100`), шаг 10 массовое одобрение, шаг 11 проверка входа редактора до шага 12 (contract), шаг 13 включение флага, шаг 14 сброс CDN по двум тегам, шаг 15 проверка хранилища, разделы быстрого и аварийного отката с признаками (D-10), закреплённые sha256 (сверяются тестом), таблица «Статус»: 37 отметок «ОЖИДАЕТ ВЛАДЕЛЬЦА», слов «PASS» в чек-листе нет. Аварийный файл лежит вне `supabase/migrations/`. Оговорка: после исправления L2 и M1 хеши и текст шага 12 нужно обновить (входит в пробелы). |

**Счёт:** 3/5 истин подтверждено (SC2, SC4, SC5); SC1 и SC3 подтверждены в основной части и остаются частичными из-за L2 и M1.

### Артефакты

| Артефакт | Ожидание | Статус | Детали |
|----------|----------|--------|--------|
| `supabase/migrations/20261115000000_portia_server_read_expand.sql` | подписанные функции чтения | VERIFIED (офлайн) | definer, `search_path=''`, права, окно; не применена нигде (по дизайну, шаг владельца) |
| `supabase/migrations/20261115000100_portia_closure_contract.sql` | снятие anon read и листинга | ЧАСТИЧНО | существенно, подключено в чек-лист; не атомарна (L2) |
| `supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql` | аварийный откат вне `migrations/` | VERIFIED | не подхватывается `db push` (`config.toml` sql_paths), sha256 закреплён |
| `lib/server-read.ts` | подпись и вызов RPC | VERIFIED | используется `app/api/content` и `app/api/employees` |
| `app/api/content/route.ts`, `app/api/employees/route.ts` | ворота, подписанное чтение, no-store | VERIFIED | ворота `resolveGateFor`, 401 до чтения, 503 нейтральный |
| `app/api/uploads/route.ts` | перезапись адреса, удаление без ссылок | VERIFIED как код маршрута | проверка D-13 только здесь (см. M1) |
| `lib/device-cache.ts` | кэш v2, очистка | VERIFIED | проведён в шлюз и рабочий стол |
| `scripts/phase25-build-scan.mjs` | скан `.next` | VERIFIED | подключён как `postbuild`, запущен мной, 0 находок |
| `lib/testing/portia-content-fixture.ts` | стартовое содержимое только для тестов | VERIFIED | граница импорта проверяется тестом; открытый вопрос A-25-05 (реальные записи в фикстуре) не пробел |

### Ключевые связи

| Откуда | Куда | Через | Статус |
|--------|------|-------|--------|
| `GET /api/content` | `portia_content_read` | `readContentRow` → rpc, подпись `HMAC` | WIRED |
| `GET /api/employees` | `portia_employees_read` | `readEmployeeRows` | WIRED |
| `next build` | скан `.next` | `postbuild` | WIRED (локально); на Netlify BLOCKED |
| шлюз | очистка кэша устройства | `clearDeviceContentCaches` / `identityChanged` | WIRED |
| удаление картинки | правило D-13 | только маршрут | NOT_WIRED на уровне БД (M1) |

### Поток данных (уровень 4)

Содержимое посетителя: вход шлюза → `viewerOf` → подписанный RPC → `contentBodyFor` (редакция по уровню) → `no-store` ответ → клиент. Статического возврата и пустой заглушки нет. Для не-редактора отсутствие строки отдаёт 503 «Данные временно недоступны» (D-22), пустая структура только у редактора.

### Поведенческие проверки

| Что | Команда | Результат | Статус |
|-----|---------|-----------|--------|
| Юнит-набор | `node --experimental-strip-types --test lib/*.test.ts` | tests 2229, pass 2226, fail 0, skipped 3 | PASS |
| Типы | `node node_modules/typescript/bin/tsc --noEmit` | код 0, вывод пуст | PASS |
| Скан сборки | `node scripts/phase25-build-scan.mjs` | `0 markers in 457 files` | PASS |
| Браузерные SEC-04 | не повторялся (нужен локальный сервер) | по `25-BROWSER-EVIDENCE.md`: 17 passed, mocked API | PASS-local (mocked API), не пересчитан мной |

Замечание: ранее красный тест «the real audit evidence verifies» (25-LOCAL-CHECK.md) теперь зелёный после `c6cf768` (аудит снят заново). Набор в 25-LOCAL-CHECK.md с исключением больше не нужен.

### Выполнение проб

Проб `scripts/*/tests/probe-*.sh` для фазы не заявлено; шаг пропущен.

### Покрытие требований

| Требование | План | Описание | Статус | Доказательство |
|------------|------|----------|--------|----------------|
| SEC-01 | 25-01, 25-03, 25-04, 25-07, 25-10 | аноним не читает контент и список сотрудников напрямую, посетители только через сервер с проверкой заявки | ЧАСТИЧНО в коде; живое BLOCKED | миграции и маршруты есть; пробел L2; факт отказа anon не доказан (нужен staging) |
| SEC-02 | 25-03, 25-07, 25-10 | закрытые ответы не кэшируются CDN; старые копии сбрасываются | VERIFIED в коде; заголовки и сброс BLOCKED | no-store во всех закрытых ответах, шаг 14 чек-листа |
| SEC-03 | 25-05, 25-06, 25-09, 25-10 | код и HTML без содержимого, проверка сборки по маркерам | VERIFIED локально; `postbuild` на Netlify BLOCKED | grep, скан `.next` 0/457 |
| SEC-04 | 25-08, 25-10 | кэш браузера чистится при неодобрении, не показывает до одобрения | VERIFIED PASS-local (mocked API) | кэш v2, 8 сценариев |
| SEC-05 | 25-02, 25-04, 25-07, 25-10 | список файлов хранилища недоступен, картинка по точной ссылке | ЧАСТИЧНО; листинг закрыт текстом, пробел M1, живое BLOCKED | политики `storage.objects` |

Все пять идентификаторов из PLAN frontmatter (SEC-01…SEC-05) найдены в `REQUIREMENTS.md` (строки 57-61, таблица трассировки строки 141-145, все «Phase 25, Pending»). Осиротевших требований нет: другого ID, привязанного к Phase 25, в REQUIREMENTS.md нет. Галочки в REQUIREMENTS.md не ставились (`requirements-completed: []` во всех 10 SUMMARY), это корректно: живые части BLOCKED, а пробелы L2 и M1 открыты.

### Антипаттерны

Поиск `TBD` / `FIXME` / `XXX` по файлам кода и SQL фазы (`lib/server-read.ts`, `lib/device-cache.ts`, три маршрута, скрипт скана, обе миграции, аварийный файл, `components/portia-access-gate.tsx`): единственное совпадение `scripts/phase25-build-scan.mjs:38` это запись «обратная косая, u, XXXX» (формат кода символа) в комментарии, не маркер долга. Заглушек и пустых реализаций в прочитанном коде нет. Блокирующих антипаттернов, кроме пробелов L2 и M1, нет.

### Прочие находки независимого ревью (не пробелы этой фазы; решение владельца не требовалось)

| ID | Серьёзность | Статус | Замечание верификатора |
|----|-------------|--------|------------------------|
| L1 | low | связан с M1 | Гонка проверка ссылок → remove в `uploads/route.ts`. Закрывается тем же definer-решением (атомарно); если M1 закрывается только политикой, L1 останется записанным остаточным риском. |
| L3 | low (RLS25-03) | открыт | `portia_employees_read` отдаёт профили как «всё, кроме `updated_by`»: новый столбец уйдёт посетителю автоматически (`expand.sql:83`). Рекомендуется явный `jsonb_build_object` (можно сделать вместе с исправлением L2, пока миграции нигде не применены). |
| L4 | low (RLS25-04) | принят | Подпись повторяема в окне 360 с, общий секрет `submit`; подделка другой области исключена метками. |
| I1 | info | открыт | Нет теста, что `.rpc()` вызывается без `get: true`. |
| I2 | info | открыт | `insert` в `storage.objects` не требует префикса `recycle/` (можно сузить вместе с M1). |
| I3 | info | открыт | `lib/phase25-emergency.test.ts` ищет только имена со словом «emergency» в `migrations/`; переименованная копия аварийного файла не будет поймана. Рекомендуется сверка sha256. |
| I4 | info | принят | Пороги секрета по длине; уход часов Netlify вперёд >60 с даёт 503 (закрытый отказ). |

## Документальный долг (предупреждения)

1. `25-SECURITY-MATRIX.md` и `25-OWNER-CHECKLIST.md` (раздел «Ревью») по-прежнему описывают ревью как «один раунд, выполненный самим исполнителем, не независимый». Независимый отчёт `25-RLS-REVIEW-INDEPENDENT.md` (commit `37ad5d4`) в них не отражён, находки M1/L1-L4/I1-I4 и несогласие с RLS25-02 не внесены в таблицу findings матрицы. Обновить при закрытии пробелов.
2. После правки миграций проверенный commit матрицы (`1b8f4f2`) устареет: тест свежести охваченных путей потребует нового ревью и нового commit.

## BLOCKED (не засчитано, не пробел)

Ничего из перечисленного не записывалось как пройденное; расхождений между записью и фактом не найдено.

- Живой Postgres и RLS: фактический отказ anon по трём таблицам и в листинге Storage, права функций, `extensions.hmac` / `extensions.digest` на проекте, поведение `stable` в PostgREST, Realtime и GraphQL после `revoke`, PUBLIC-гранты и политики, созданные вне репозитория.
- Аутентифицированные роли (посетитель, одобренный, редактор, владелец).
- Storage: работа `copy` / `upload` / `remove` при одной редакторской select-политике; нужна ли политика update (часть M1, зависит от staging).
- Netlify CDN (заголовки, `Cache-Status`, сброс по тегам) и `postbuild` на Netlify.
- Staging, deploy preview, production и включение закрытия: ОЖИДАЕТ ВЛАДЕЛЬЦА.
- Физические устройства; другие движки браузера (Firefox, WebKit) и проекты `chromium-dpr125`, `chromium-phone`.
- Применение миграций нигде по решению владельца (обход шлюза schema-drift): не пробел.

## Открытые вопросы владельцу (не пробелы)

- A-25-05: реальные записи остаются в тестовой фикстуре `lib/testing/portia-content-fixture.ts`.
- A1: `assistantDefaults` считается интерфейсным текстом, а не содержимым.

## Известные ограничения среды (вне фазы)

`npm` под временным Node 22.13.1 сломан, инструменты запускались напрямую; `.claude/skills/portia-check/run.sh` под этим Node не зелёный целиком. Не относится к достижению цели фазы.

## Итог по пробелам

Фаза доставила всё запланированное, включая честную разметку BLOCKED. Цель «содержимое физически недоступно без допуска» держится в коде и текстах SQL, но два дефекта защиты на уровне БД подтверждены в самих файлах и по решению владельца должны быть закрыты в этой фазе до перехода дальше:

1. L2: защитный блок контрактной миграции не атомарен при запуске без `ON_ERROR_STOP` и одной транзакции (`20261115000100_portia_closure_contract.sql:10-19`). Перенести `revoke` / `drop policy` / `create policy` внутрь DO через `execute`.
2. M1 (офлайн-часть): правило D-13 обходится прямым вызовом Storage API редактором. Сузить политику delete до `recycle/%` и добавить SECURITY DEFINER проверку отсутствия ссылок в `portia_content` / `portia_employee_profiles`. Вопрос, можно ли убрать политику update, остаётся BLOCKED до staging и пробелом не является.

Оба пробела правят одни и те же файлы (контрактная миграция), поэтому разумно планировать одним планом закрытия с общим пересчётом sha256, тестов и повторным ревью `supabase-rls-reviewer`. Заодно дёшево закрыть L3 и I2 (пока миграции нигде не применены).

---

_Проверено: 2026-11-16_
_Верификатор: Claude (gsd-verifier)_
