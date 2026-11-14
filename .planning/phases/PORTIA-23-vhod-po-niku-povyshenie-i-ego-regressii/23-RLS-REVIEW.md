# 23 — RLS/RPC review

- Reviewer: `supabase-rls-reviewer` agent, final read-only run 2026-11-14 23:08-23:10 UTC (23-12, round 3; run by the orchestrator).
- Reviewed commit: `7cb8702c51b50332d8687f21e58bd94ed71ee005`.
- Earlier rounds: 23-07, 2026-11-13, commit 0046f80ca35c01bb87e1475a0d316c2870484eb8 (Promotion RPCs); 23-11 round 2, 2026-11-14, commit 12eecb108f3c24f5cc0b558a882ddbef09ec2522 (closure ON by default and fail-closed gate).
- Scope: `supabase/migrations/20261113000000_portia_access_promotion.sql`, `app/api/access/editor-request/route.ts`, `app/api/promotion/{status,requests,test}/route.ts`, `lib/promotion-participant.ts`, `lib/portia-promotion-api.ts`, `supabase/migrations/20261114000000_portia_access_closure_default_on.sql`, `lib/access-gate.ts`, `app/api/access/status/route.ts`, `app/api/access/request/route.ts`, `lib/access-request-reply.ts`.
- Open critical: **0**. Open high: **0**. Verdict: **static review passed** (round 3: no critical, high or medium findings; RLS23-07 and RLS23-08 low, accepted; RLS23-05 accepted, RLS23-06 fixed; live Postgres items BLOCKED).

## Findings and fixes

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| RLS23-01 | high | Earlier direct `secure_submit` and test RPCs could bypass server-only checks. | Fixed before `465a1b9`: signed submit/test proof and old direct grants revoked; reviewer rechecked. |
| RLS23-02 | medium | An authenticated non-editor was offered guest approved status by the route helper, while SQL requires editor ownership for authenticated callers. | Fixed in `6db7d24`: helper returns unapproved for signed-in non-editors. |
| RLS23-03 | medium | Qualification start/current could invoke mutating legacy RPCs for a stale title before the route checked the title. | Fixed in `213d99b`: current roster title is passed to SQL; start/current check request title before old RPC. |
| RLS23-04 | medium | Test action HMAC does not bind `p_title_id`, answer, nonce, failure reason, or client mode. A leaked signature could be replayed within the five-minute window with altered fields. | Open defense-in-depth item. Signature stays server-only and is never returned to browser; no high authorization bypass found. |
| RLS23-05 | low | Round 2: manual re-run of `20261114000000` (psql, outside the CLI history) switches an OFF that the owner set outside `portia_access_set_closure` back to ON, because `updated_by` stays null. | accepted: no anon/authenticated path; warning and a safe shutdown statement are in `23-MIGRATION-APPLY.md`; SQL unchanged. |
| RLS23-06 | low | Round 2: the authz fixture cited the superseded foundation line 667 for the `closure_enabled` grants. | Fixed in `d675d73`: source is now `20261114000000_portia_access_closure_default_on.sql:38`. |
| RLS23-07 | low | Round 3: while the site is misconfigured (submit secret missing or different, or server clock skew), every anonymous POST that passes validation writes one constant alert line; the volume is bounded only by platform request limits. | accepted: T-23-38; this is the condition the alert exists to report, the foundation header requires a line for every unauthorized reply, rate-limiting the log would hide the alert. |
| RLS23-08 | low | Round 3: the 503 body says `unauthorized` instead of `unavailable`, so anyone can see the submit secret is misconfigured (same for every nickname, ACC-05 holds). Pre-existing and unchanged. | accepted: pre-existing, outside G-PORTIA-23-3-log; the client reply must stay unchanged in 23-12; the owner may decide later whether to send `unavailable` to the client and keep the alert. |

The reviewer checked `SECURITY DEFINER` functions, narrow grants and revoked legacy participant functions, current access proof, editor `requested_by=auth.uid()` ownership, signature parity, and title checks. This was static inspection only. Migration application, live Postgres/RLS roles, and concurrent revocation remain **BLOCKED** until an explicitly isolated test project is available.

## Round 2 (23-11): closure ON by default and fail-closed gate

Round commit: `12eecb108f3c24f5cc0b558a882ddbef09ec2522`

- Дата и время (UTC): 2026-11-14, отчёт получен перед 18:57 UTC.
- Как запускался: ревьюера `supabase-rls-reviewer` запустил оркестратор инструментом Agent (subagent_type `supabase-rls-reviewer`) по тексту запроса из checkpoint исполнителя; у исполнителя 23-11 инструмента Agent/Task нет. Это запуск оркестратора, а не запуск инструментом Agent самим исполнителем. Отчёт ревьюера (на английском) передан исполнителю оркестратором; ниже его выводы, ответы и находки записаны по-русски без изменения смысла, номера строк и файлы сохранены. Ревью исполнитель не писал.
- Область: `supabase/migrations/20261114000000_portia_access_closure_default_on.sql` целиком; `supabase/migrations/20261109000000_portia_access_foundation.sql` строки 635-695; `lib/access-gate.ts`; `app/api/access/status/route.ts`; `lib/access-store.ts` строки 255-270; `lib/editor-access.ts` строки 21-48; запись `public.portia_access_closure_enabled()` в `tests/e2e/fixtures/data/expected-authz.json` и в `supabase/fingerprint/expected/portia.fingerprint.json`.
- Решения владельца, которые ревью не отменяет: 2026-11-14 (1a, 2a, 3a), D-03, Phase 21 D-05 и D-07.
- Вердикт ревьюера: статическое ревью, критических, высоких и средних находок нет; две низких. Ни SQL, ни подключений к Supabase, `.env*` не читались.

Ответы ревьюера на вопросы:

1. Отсутствующая, упавшая или устаревшая функция закрытия не даёт рабочий стол не-редактору. `editor: true` возвращается только в `lib/access-gate.ts:56-57` при `canEdit === true` без `unavailable`; `canEdit` приходит с сервера (`getUser()` и RPC `portia_can_edit`, `lib/editor-access.ts:23-40`). `mode: "open"` только при настоящем булевом `false` (`lib/access-store.ts:265`, `lib/access-gate.ts:71`). Отсутствующая или устаревшая функция (PGRST202 или 42883 с именем функции) даёт закрытый экран (`lib/access-gate.ts:63-68`); любая другая ошибка пробрасывается и маршрут отвечает 503 (`app/api/access/status/route.ts:24-26`).
2. anon и authenticated не меняют флаг и не читают ничего кроме одной булевой: таблица настроек под RLS без политик, права отозваны (`20261109000000_portia_access_foundation.sql:646-649`); `portia_access_set_closure` проверяет `portia_is_owner()` внутри (`:682`, `:693-695`) и миграцией не затронута.
3. Повторный запуск не отменяет OFF, поставленный через `portia_access_set_closure` (всегда пишет `updated_by = auth.uid()`; зависит от того, что `portia_is_owner` не пропускает вызов без сессии, чего ревьюер повторно не читал). Удалённая строка настроек пересоздаётся с `true` (`20261114000000_portia_access_closure_default_on.sql:20-21`), fallback функции тоже `true` (`:34`). Единственный непокрытый случай — L1.
4. Права переопределённой функции: `security definer`, `stable`, `search_path = ''`, имя таблицы с схемой, `revoke` перед `grant`, те же роли (`:27-39`); отпечаток совпадает (`portia.fingerprint.json:2473-2487`).
5. `notify pgrst` доставляется после commit при транзакции CLI и при `psql --single-transaction`, при откате отбрасывается; пропуск перезагрузки даёт случай устаревшего кэша, который закрыт (fail-closed).
6. Флаг публичен по замыслу (T-21-20); раскрывается только одна булева, `updated_by` и `updated_at` не читаются.
7. Устаревший кэш схемы теперь fail-closed по доступности. Остаточный риск: если функции закрытия нет или кэш старый, а `portia_access_resolve` жива, одобренный посетитель не распознаётся (токен не читается, `lib/access-gate.ts:65`) и видит закрытый экран до перезагрузки кэша. Это цена доступности по решению 1a.

Заметка об области (не находка против этого diff): `resolveGate` вызывается только из `/api/access/status`; закрытие рисуется на клиенте по этому ответу, а серверные маршруты данных рабочего стола закрытие заново не проверяют. Ревьюер этого не проверял; это прежний замысел, вне ревью, передано Phase 25 (T-23-31, T-23-33).

| ID | Severity | Файл:строка | Злоупотребление | Исправление | Статус |
|---|---|---|---|---|---|
| RLS23-05 | low | `supabase/migrations/20261114000000_portia_access_closure_default_on.sql:23-25` | Если владелец выключил закрытие вне `portia_access_set_closure` (Studio, SQL-редактор, service-role), `updated_by` остаётся null, и ручной повторный запуск файла (psql по решению 2a, мимо истории миграций CLI) молча включит закрытие снова. Пути для anon и authenticated нет. | Записать в 23-MIGRATION-APPLY.md, что выбор сохраняет только `portia_access_set_closure` и файл вручную повторно не запускают; ручное выключение из SQL по инструкции дополнительно ставит `updated_by`. Миграция заморожена, SQL не менялся. | accepted: низкий риск, нет пути для anon/authenticated, предупреждение и безопасный оператор выключения записаны в 23-MIGRATION-APPLY.md (раздел «Откат и выключение закрытия»); SQL не менялся |
| RLS23-06 | low | `tests/e2e/fixtures/data/expected-authz.json:203-225` | Ячейки прав `portia_access_closure_enabled()` ссылались на устаревшую строку 667 фундамента; действующая выдача прав теперь в `20261114000000_portia_access_closure_default_on.sql:38`. Исход (allow) верен, неточен только источник доказательства. | Обновить `source` у шести ячеек на новый файл и строку. | fixed in `d675d73` (источник ячеек теперь `20261114000000_portia_access_closure_default_on.sql:38`; lib/phase16-expected-authz.test.ts, lib/access-rls-round2.test.ts, lib/portia-staging-live.test.ts зелёные) |

BLOCKED ревьюера (нужен живой Postgres или PostgREST; ни один пункт не записан как пройденный):

- Чистое применение миграции после `20261113000000_portia_access_promotion.sql` и неизменность при втором запуске.
- Реальные ACL и proconfig после применения в сравнении с `portia.fingerprint.json`, включая `src_sha256` нового тела, которое статически не пересчитать.
- Фактический текст сообщений PGRST202 и 42883 развёрнутой версии PostgREST, под который написан регэксп имени в `lib/access-gate.ts:21`.
- Доставка NOTIFY после commit и длина окна устаревшего кэша под CLI и под `psql --single-transaction`.
- RLS отказывает anon и authenticated в прямом SELECT/UPDATE по `portia_access_settings`.
- `portia_access_set_closure` бросает `owner-required` для не-владельца, `updated_by` непустой у владельца.
- Работа шлюза с аутентифицированными ролями (редактор, неподтверждённая почта, отозванный редактор) от начала до конца.

В этом раунде никакое поведение Postgres/RLS не выполнялось: только статическое чтение. Пункты BLOCKED остаются BLOCKED.

Итог раунда: открытых critical 0, открытых high 0

## Round 3 (23-12): unauthorized submit alert

Round commit: `7cb8702c51b50332d8687f21e58bd94ed71ee005`

- Дата и время (UTC): 2026-11-14, окно запуска 23:08-23:10 UTC.
- Как запускался: ревьюера `supabase-rls-reviewer` запустил оркестратор инструментом Agent (subagent_type `supabase-rls-reviewer`, только чтение, раунд 3, 23-12) по тексту запроса из динамического checkpoint исполнителя; у исполнителя 23-12 инструмента Agent/Task нет. Это запуск оркестратора, а не запуск инструментом Agent самим исполнителем. Отчёт ревьюера (на английском) передан исполнителю оркестратором; ниже его выводы, ответы и находки записаны по-русски без изменения смысла, номера строк и файлы сохранены. Ревью исполнитель не писал.
- Проверка вместо shell ревьюера: у ревьюера не было shell, и `git diff 12eecb1 7cb8702` он выполнить не мог. Оркестратор выполнил `git diff 12eecb1 7cb8702 -- app/api/access/request/route.ts` и подтвердил, что diff показывает только новый импорт `accessSubmitStatus`/`reportAccessSubmit`, добавленную строку `reportAccessSubmit(result);` и замену тернарного выражения статуса на `const status = accessSubmitStatus(result.code);`, и больше ничего. Исполнитель дополнительно проверил, что `git diff --name-only 12eecb1 7cb8702` по охваченным путям печатает ровно `app/api/access/request/route.ts` и `lib/access-request-reply.ts`.
- Область: `app/api/access/request/route.ts` и `lib/access-request-reply.ts` целиком; `lib/access-store.ts` строки 9-14, 52-54, 93-117; `lib/access-session.ts` строки 35-76; `supabase/migrations/20261109000000_portia_access_foundation.sql` строки 15-33 и 217-232 (только контекст, SQL в 23-12 не менялся); `accessGateLayout` в `lib/access-gate-view.ts` (только контекст для вопроса 5); проводка маршрута в `lib/access-request-reply.test.ts:74-86` и текст плана 23-12-PLAN.md.
- Решения владельца, которые ревью не отменяет: 2026-11-14 (1a, 2a, 3a), D-03, Phase 21 D-05 и D-07; ответ формы одинаков для любого ника (ACC-05).
- Вердикт ревьюера: статическое ревью, только чтение; критических, высоких и средних находок нет, две низких. Ни SQL, ни подключений к базе, `.env*` не читались.

Ответы ревьюера на вопросы:

1. Утечки: нет. `reportAccessSubmit` (`lib/access-request-reply.ts:20-22`) читает только `result.code` и пишет фиксированную ASCII-строку (строки 10-11) с именем переменной `PORTIA_ACCESS_SUBMIT_SECRET`, без значения. Маршрут получает `SubmitResult` только после вызова. `SubmitResult` (`lib/access-store.ts:52-54`) строится заново в `lib/access-store.ts:110-116` и может содержать только `code` и, для cooldown, `retryAt`. Подпись, token hash, IP bucket, ник, сырой токен и адрес клиента не попадают ни в тело ответа, ни в новую строку лога. Единственная другая строка лога — прежний catch (`app/api/access/request/route.ts:36`); она печатает `error.message`: либо фиксированная строка из `lib/access-session.ts:26/44/58-62/74/143` (только имя переменной), либо сообщение PostgREST через `AccessStoreError` (`lib/access-store.ts:86`). Этот catch не менялся.
2. Ответ клиенту не изменён. `accessSubmitStatus` (`lib/access-request-reply.ts:14-17`): created, pending, approved дают 200; invalid 400; throttled 429; cooldown 409; всё остальное, включая unauthorized, 503. Это прежняя карта. Тело по-прежнему `Response.json(result, ...)` (`app/api/access/request/route.ts:34`). Set-Cookie по-прежнему только для created/pending/approved при отсутствии токена (`app/api/access/request/route.ts:32`). Catch не менялся (`app/api/access/request/route.ts:35-38`). Тревога — побочный эффект без возвращаемого значения; штатный `console.error` не бросает, путь ответа не затрагивается.
3. Оракул или поток строк в логе: нового оракула нет. Клиент и раньше получал 503 `{"code":"unauthorized"}`; тревога добавляет строку в лог, а не видимый клиенту сигнал, и от ника не зависит, поэтому ACC-05 держится. Анонимный вызывающий не может нарочно получить unauthorized от базы, пока сайт настроен правильно: сервер подписывает каждый запрос по уже проверенным значениям (`lib/access-session.ts:57-64`); SQL хеширует те же сырые значения `p_*` в том же порядке (`supabase/migrations/20261109000000_portia_access_foundation.sql:224-226`); алфавит ника и hex-поля нельзя сдвинуть друг в друга. Прямой вызов RPC с anon-ключом возвращает unauthorized без прохода через маршрут и строку в логе сайта не пишет. Остаточный риск (низкий, принят как T-23-38): при неправильной настройке (секрет отсутствует или другой, либо часы сервера отстают больше чем на 300 с или спешат больше чем на 60 с) каждый анонимный POST, прошедший валидацию, пишет одну короткую фиксированную строку; объём ограничен только лимитами платформы. Это именно то состояние, о котором тревога сообщает; ограничение частоты лога скрыло бы его.
4. Подпись и секрет не изменились. Раскладка сообщения и HMAC — `lib/access-session.ts:68-76`; минимальная длина 32, окно 300/60; соответствует SQL строки 224-231. Аргументы RPC (`lib/access-store.ts:102-109`): `p_nickname`, `p_origin`, `p_token_hash`, `p_ip_bucket`, `p_issued_at`, `p_signature` — поля секрета нет. Секрет сессии идёт только в HMAC для дайджестов токена и IP (`app/api/access/request/route.ts:20, 26-27`).
5. Условие рабочего стола не изменилось: `const desktop = decision !== null && (decision.mode === "open" || decision.allowed)` (`lib/access-gate-view.ts:21`). Новое `approvedOnDesktop` (строка 29) требует уже истинного `desktop`, только сбрасывает `showCard` (строка 33) и `showReopen` (строка 35) и ставит `approvedNotice` (строка 38); в `desktop` и `showForm` оно не возвращается. Флаг localStorage (строки 42-49) на вход `accessGateLayout` не влияет.
6. BLOCKED: см. список ниже.

Заметка ревьюера: побайтный diff остальных строк маршрута он без shell не доказал; это закрыто проверкой оркестратора выше.

| ID | Severity | Файл:строка | Злоупотребление | Исправление | Статус |
|---|---|---|---|---|---|
| RLS23-07 | low | `app/api/access/request/route.ts:30`, `lib/access-request-reply.ts:20-22` | При неправильной настройке (нет секрета подписи, другой секрет, перекос часов) каждый анонимный POST, прошедший валидацию, пишет одну короткую фиксированную строку без ограничения частоты; объём ограничен только лимитами платформы. | Нет: заголовок фундамента (строка 29) требует строку на каждый unauthorized; ограничение частоты лога скрыло бы тревогу. | accepted: T-23-38; нет оракула (ответ клиенту прежний), строка константа без значений, срабатывает только в состоянии, о котором тревога и сообщает |
| RLS23-08 | low | `app/api/access/request/route.ts:34` | Прежнее поведение: тело 503 содержит `unauthorized` вместо `unavailable`, поэтому любой может понять, что секрет подписи на сайте настроен неверно. Для всех ников одинаково, ACC-05 держится. | Возможное минимальное исправление, если владелец захочет: отдавать клиенту `unavailable` для unauthorized и сохранить тревогу. Продуктовое решение вне этого diff. | accepted: уже было до 23-12 и вне G-PORTIA-23-3-log; в этом плане ответ клиенту обязан остаться прежним; владелец может решить позже |

BLOCKED ревьюера (нужен живой Postgres или PostgREST; ни один пункт не записан как пройденный):

- `portia_access_submit_request` действительно возвращает unauthorized для отсутствующего, короткого или другого секрета, плохой подписи и времени выпуска вне окна -300/+60 с.
- `extensions.hmac` и `extensions.digest` есть в целевом проекте и дают тот же hex, что `createHmac` в Node для этого алфавита.
- Защищённая владельцем вставка сохраняет секрет, а `portia_access_secrets` закрыта для anon и authenticated (RLS и права).
- `PORTIA_ACCESS_SUBMIT_SECRET` на Netlify равен значению в базе.
- Какой текст PostgREST кладёт в `error.message` при сбое RPC (то, что печатает catch).
- Что строка тревоги реально появляется в логах функций Netlify.
- Полное поведение ответа и cookie от начала до конца на staging-базе.

В этом раунде никакое поведение Postgres/RLS не выполнялось: только статическое чтение. Пункты BLOCKED остаются BLOCKED.

Итог раунда: открытых critical 0, открытых high 0
