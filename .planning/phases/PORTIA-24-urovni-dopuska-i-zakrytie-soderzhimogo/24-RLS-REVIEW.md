# 24 — RLS/RPC review

- Reviewer: `supabase-rls-reviewer` agent, read-only static run 2026-11-15 UTC (24-11, round 1; run by the orchestrator, not by the executor).
- Reviewed commit: `f331dff2c9570365626201caeb0552164c2f91be`. ВРЕМЕННО: это коммит раунда 1. После раунда 2 значение заменяется коммитом, который прочитал ревьюер в раунде 2; пока раунд 2 не выполнен, фаза не закрыта.
- Earlier rounds: нет (раунд 1 открывает ревью Phase 24).
- Scope: `app/api/content/route.ts`, `lib/content-response.ts`, `lib/level-redact.ts`, `lib/content-save.ts`, `lib/access-viewer.ts`, `lib/level-placeholders.ts`, `lib/embedded-documents.ts`, `lib/access-levels.ts`; контекст `lib/access-gate.ts`, `lib/access-session.ts`, `app/api/access/status/route.ts`, `proxy.ts`.
- Open critical: **0**. Open high: **0**. Verdict: **раунд 1 пройден без critical/high; одна medium (RLS24-01) исправлена после раунда 1 и ждёт подтверждения в раунде 2**. Итоговый вердикт записывается после раунда 2.

## Findings and fixes

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| RLS24-01 | medium | Файл корзины `kind: "virus"` с пустым или битым `virusId` открывался на уровне 1 (`lib/level-redact.ts:144-145`, `?? BASE_LEVEL`). Имя такого файла по умолчанию `${virus.name}_${virus.code}.virus`; если закрытый вирус окончательно удалён из корзины, а файл остался, или редактор выбрал «нет вируса», посетитель уровня 1 получал имя и код закрытого вируса, `recycle:<id>:content` и `imageFraming`. В коде это было допущение O-3/A-4, а не решение владельца; расходилось с fail-closed D-03. | fixed in `e24dadf`: сначала падающий тест (`lib/level-redact.test.ts`, «файл вируса с пустым или битым virusId закрыт на уровне 5»), затем `?? MAX_ACCESS_LEVEL`. Файл такого вида виден только на уровне 5. Допущение O-3/A-4 уточнено, решение владельца D-03..D-12 не затронуто. Ждёт подтверждения в раунде 2. |
| RLS24-02 | low | Подъём уровней детей (`raiseChildLevels`) идёт после проверки закрытых вкладок: `contentRefusal` сравнивает `normalized`, а пишется `prepared.content` (`app/api/content/route.ts:93` и `:99`). При уже сломанной иерархии в базе редактор с закрытой «Информацией»/«Справочником» меняет уровни детей закрытой вкладки (только вверх). | accepted: утечки нет, подъём идёт только вверх и только если иерархия в хранимом контенте уже сломана (каждый PUT Phase 24 её чинит, новые поломки не записываются); сравнение с собственным намерением редактора закреплено тестом `lib/content-save.test.ts` («the closed-section check still compares the editor's own intent») и менять его на сравнение с поднятой копией — отдельное решение для сохранения контракта PUT. Записано для Phase 25. |
| RLS24-03 | low | Ключ `slot` (HMAC метка `slot:`) использует тот же секрет, что `PORTIA_PROMOTION_DEVICE_SECRET` (`lib/content-response.ts:26`, `app/api/content/route.ts:50`): ротация секрета меняет все slot и инвалидирует токены устройств. Гигиена: отдельный производный ключ `HMAC(secret, "slot-key-v1")`. | accepted: при ротации секрета и так сбрасываются токены устройств, поэтому смена slot не добавляет эффекта; домены HMAC разделены метками, пересечений нет (ответ ревьюера на вопрос 5); отдельный производный ключ поменяет все slot выпущенного контракта в закрывающейся фазе. Вернуться в Phase 25. |
| RLS24-04 | low | `redaction: null` проходит проверку копии зрителя (`lib/level-placeholders.ts:65`): нормализуется в `undefined`, `prepareContentSave` не отказывает; копия зрителя без маркера и без закрытых записей перезапишет (удалит) закрытые записи. Только для багованного или враждебного клиента редактора. | fixed in `2cabb1b`: `prepareContentSave(normalized, body.content)` отказывает 422 `viewer-copy`, если в присланном теле есть ключ `redaction` с любым значением; сначала падающий тест. Ждёт подтверждения в раунде 2. |
| RLS24-05 | low | Неопубликованные сводки уходят посетителям (`lib/level-redact.ts:228` `broadcasts: content.broadcasts` и `:191`): черновики `published: false` с `broadcast:<id>:body`; черновик может назвать закрытую запись. | fixed in `e24dadf`: посетителю уходят только `published` сводки и их ключи formattedText; сайт неопубликованные не показывает и не ищет (`portia-desktop.tsx:261`, `search-index.ts:105`); сначала падающий тест. Ждёт подтверждения в раунде 2. |
| RLS24-06 | low | `assistant:` пропускает любой суффикс (`lib/level-redact.ts:193`). | fixed in `e24dadf`: точный набор из четырёх ключей `portiaTextKey.assistant*`; сначала падающий тест. Ждёт подтверждения в раунде 2. |
| RLS24-07 | low (docs) | Устаревший комментарий `proxy.ts:11-12` утверждает, что GET `/api/content` кешируется CDN. | fixed in `043d33c`: комментарий приведён к Phase 24 (ответ по зрителю, no-store; список сотрудников по-прежнему кешируется). Ждёт подтверждения в раунде 2. |

Информационно (не находка): хост «Устава» виден в CSP `frame-src` (`next.config.ts:21,43`), путь не виден; документ публичен по SEC-07, по D-11 допустимо.

Остаточный риск, передан Phase 25 (SEC-01), статус transfer, не PASS: аноним читает `portia_content` напрямую по публичному ключу (политика `using (true)` для `anon, authenticated`, `supabase/migrations/20261101000000_portia_baseline.sql:245,249-252`; GET читает публичным клиентом, `app/api/content/route.ts:39-40`; риск записан в `.planning/PROJECT.md:141` как принятый владельцем). Следствие: очистка на сервере обходится одним запросом PostgREST; если миграция `20261114000000` попадёт в production раньше Phase 25, закрытие будет только видимостью. Туда же сид в статической оболочке и листинг Storage (картинки закрытых записей).

## Round 1 (24-11): per-viewer content and level redaction

Round commit: `f331dff2c9570365626201caeb0552164c2f91be`

- Дата и время (UTC): 2026-11-15; час в отчёте ревьюера не указан.
- Как запускался: ревьюера `supabase-rls-reviewer` запустил оркестратор execute-phase по тексту запроса исполнителя 24-11; у исполнителя нет инструмента Agent/Task. Это запуск оркестратора, а не самого исполнителя. Отчёт ревьюера передан исполнителю оркестратором как есть; ниже ответы и находки записаны по-русски, номера строк и файлы сохранены. Ревью исполнитель не писал. Режим: только чтение, статический; ни SQL, ни подключений к базе, ни чтения `.env*`.
- Область: см. Scope выше. Решения, которые ревью не отменяет: D-03, D-04, D-05, D-08..D-12 Phase 24, D-11 (защита разделов только сервером), решение владельца 2026-11-14 (fail-closed шлюз).
- Проверка до запроса: `git diff --name-only 7cb8702c51b50332d8687f21e58bd94ed71ee005 f331dff2c9570365626201caeb0552164c2f91be` по охвату файлов матрицы Phase 23 вывел только `app/api/content/route.ts` и `lib/access-levels.ts`.
- Вердикт ревьюера: critical нет, high нет; одна medium (M-1 -> RLS24-01) и шесть low (L-1..L-6 -> RLS24-02..RLS24-07).

Ответы ревьюера на вопросы:

1. Закрытые данные через GET: нет через перечисленные поля, кроме M-1. Массивы `viruses`, `recycledViruses`, `infoSections`, `guideSections`, `recycleFiles`, `recycleOrder` собираются только из открытых (`lib/level-redact.ts:133-169`, `172-173`); у закрытого раздела нет детей и нет ключа в `infoSubsections`/`guideCards` (`:82-86`); закрытая запись учёного урезана до пяти полей и `withheld`, `richContent` и неизвестные ключи не копируются (`:57`). `formattedText` — разрешённый список (`:192-209`), неизвестные префиксы отбрасываются, `virus:/info:/info-block:/guide-block:/recycle:` проверяются по множествам открытых id. Рекомендации: строка с именем или кодом закрытой записи (или её частью) удаляется вместе с `search:recommendations` (`:181-194`). `documents`: посетителю адрес только при маркере `redaction` и открытом `charter` (`lib/content-response.ts:37`), fail-closed. `slots` — только открытые id; заглушки несут только `slot`, `requiredLevel`, `at`. Маркеры из хранилища не принимаются (`withoutViewerMarkers`, `content-response.ts:32`). Сознательно не уровневые: свободный текст сводок и фраз ассистента (записано в PROJECT.md); сюда же неопубликованные сводки (RLS24-05).
2. Общий ответ (CDN, браузер, теги): по коду нет. Все ответы GET, включая 401 и 503, с `Cache-Control: no-store` и `Netlify-CDN-Cache-Control: no-store`, без `Netlify-Cache-Tag` (`lib/portia-cdn.ts:15-18`, `route.ts:37,47,50,53`); `force-dynamic`; `proxy.ts` не перехватывает `/api/content`; `netlify.toml` и `next.config.ts` cache-заголовков не добавляют; `localStorage` ключуется зрителем (`viewerKeyOf`), сброс при несовпадении. Реальный CDN — BLOCKED.
3. Чтение строки до ворот или сбой проверки редактора: нет и нет. Чтение (`route.ts:40`) идёт после `viewerOf(decision)`, при `null` — 401 (`:36-37`). Сбой или исключение проверки редактора = `unavailable`, прав не даёт (`lib/access-gate.ts:47-50`); в закрытом режиме `unavailable` бросает, ответ 503 (`:67`, `:79`). Ошибка `getUser` без retryable даёт `user=null` (`lib/editor-access.ts:23`).
4. Правило уровня в открытом режиме: проверенный редактор — решение до флага закрытия, неочищенная копия, уровень 5. Устройство `approved` — `state.level`, проверен `isAccessLevel` (`lib/access-store.ts:127`). Остальные (`none/pending/rejected/revoked`) и сбой `resolveAccess` — уровень 1 (`lib/access-viewer.ts:13`, `access-gate.ts:75`). Мусорный уровень записи = 5 (`requiredLevelOf`).
5. `slot`: HMAC-SHA256 с меткой `slot:`, усечение до 22 символов base64url (около 132 бит). Секрет общий с `PORTIA_PROMOTION_DEVICE_SECRET`, домены разделены метками `access:`, `access-ip:`, `device:`, `ip:`, `signal:`, `attempt:`, `risk:`, `slot:`; пересечений нет; публичность slot не помогает подделать `access:` (PRF, разные форматы hex64 и b64url22). Остаётся связанный жизненный цикл ключа (RLS24-03).
6. PUT: проверка редактора первой (403), размер в байтах до разбора (413). `prepareContentSave` отказывает 422 `viewer-copy` до чтения и записи строки (`route.ts:80-81`); признаки — `redaction !== undefined` или любой `withheld` (нормализатор сохраняет поддельный `withheld`, `portia-content-normalize.ts:370`). `raiseChildLevels` на глубокой копии. CAS по ревизии, 409, 23505, purge не изменились; контракт расширен добавочно (`levelsRaised`, новый 422). Замечания RLS24-02 и RLS24-04.
7. Anon-чтение `portia_content`: подтверждено, остаётся до Phase 25, записано как переданный риск (см. выше «Остаточный риск»).

Таблица находок раунда 1:

| ID | Severity | Файл:строка | Злоупотребление | Исправление | Статус |
|---|---|---|---|---|---|
| RLS24-01 | medium | `lib/level-redact.ts:144-145` | Файл корзины вируса с пустым или битым `virusId` открывался на уровне 1 и выдавал имя и код закрытого вируса. | `?? MAX_ACCESS_LEVEL` | fixed in `e24dadf`, ждёт раунда 2 |
| RLS24-02 | low | `app/api/content/route.ts:93`, `:99` | Подъём уровней после проверки вкладок; только вверх, без утечки. | сравнить с поднятой копией | accepted |
| RLS24-03 | low | `lib/content-response.ts:26`, `route.ts:50` | Ключ slot связан с device-секретом. | отдельный производный ключ | accepted (Phase 25) |
| RLS24-04 | low | `lib/level-placeholders.ts:65` | `redaction: null` проходит проверку копии зрителя. | отказ по ключу `redaction` в теле | fixed in `2cabb1b`, ждёт раунда 2 |
| RLS24-05 | low | `lib/level-redact.ts:228`, `:191` | Черновики сводок уходят посетителям. | только `published` | fixed in `e24dadf`, ждёт раунда 2 |
| RLS24-06 | low | `lib/level-redact.ts:193` | `assistant:` пропускает любой суффикс. | точный набор ключей | fixed in `e24dadf`, ждёт раунда 2 |
| RLS24-07 | low (docs) | `proxy.ts:11-12` | Устаревший комментарий про CDN. | обновить комментарий | fixed in `043d33c`, ждёт раунда 2 |

BLOCKED ревьюера (нужен живой Postgres, PostgREST, Netlify или staging; ни один пункт не записан как пройденный):

- Фактическое anon-чтение `portia_content` через PostgREST и его закрытие в Phase 25.
- RLS insert/update `portia_content` (`portia_can_edit()`) для ограниченного редактора, владельца и outsider; прямая запись `level`, `redaction`, `withheld` в обход PUT.
- `portia_access_closure_enabled` и `portia_access_resolve` на реальной БД, включая PGRST202/42883 и перезагрузку кэша схемы.
- Netlify CDN: отсутствие `Cache-Status: hit` для `/api/content`, сброс старых durable-копий с тегом `portia-content`, `Set-Cookie` при обновлении сессии.
- Публичный листинг и чтение Storage и сид в статической оболочке (Phase 25).
- Применение миграций `20261113`/`20261114` (D-73) и состояние флага закрытия на production.

Исправления после раунда 1 (до раунда 2): `e24dadf` (RLS24-01, -05, -06: `lib/level-redact.ts` и тесты), `2cabb1b` (RLS24-04: `lib/content-save.ts`, `app/api/content/route.ts`, тесты), `043d33c` (RLS24-07: `proxy.ts`, комментарий), `78514fd` (комментарий теста). Охваченные пути изменились, поэтому новый раунд на новом HEAD обязателен.

Итог раунда: открытых critical 0, открытых high 0
