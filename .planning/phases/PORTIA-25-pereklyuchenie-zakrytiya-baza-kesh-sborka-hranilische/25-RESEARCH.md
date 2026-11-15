# Phase PORTIA-25: Переключение закрытия: база, кэш, сборка, хранилище — Research

**Researched:** 2026-11-15
**Domain:** закрытие чтения контента на уровне базы (контрактная миграция), серверное чтение через подписанный RPC, кэш CDN/браузера, чистая сборка, хранилище картинок, чек-лист владельца
**Confidence:** HIGH по текущему коду и тестам-ограничителям (всё прочитано в этой сессии); MEDIUM по поведению Supabase Storage и Netlify CDN (документация, не стенд); живое поведение (Postgres/RLS, CDN, листинг хранилища, отказ анонима) — BLOCKED

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Перенесённые решения (не пересматриваются)
- **D-01:** Решения владельца 3а (убрать листинг картинок) и 4б (МОРОК/АРАХНА убрать из кода) — D-71, не пересматриваются.
- **D-02:** Закрытие включено по умолчанию после `20261114000000`; менять флаг может только владелец (Phase 23 D-01 отменено, Phase 24 D-06). Файл 8 уважает выбор владельца: строка с `updated_by` не перезаписывается.
- **D-03:** Новая миграция нумеруется после всех существующих (последняя — `20261114000000`), порядок применения записан явно; ревью `supabase-rls-reviewer` обязательно (контракт, политики хранилища, права). Агент ничего не применяет ни к какой базе и не использует боевые/service-role ключи.
- **D-04:** Очистка по уровню — серверная функция Phase 24 (`contentBodyFor` / redaction); Phase 25 меняет только источник чтения, а не правила очистки. Интервал опроса 30 с (Phase 24 D-23).

#### Порядок включения (чек-лист владельца)
- **D-05:** Сразу после применения файла 4 (`20261109000000_portia_access_foundation.sql`) владелец выключает закрытие функцией владельца (`portia_access_set_closure`), чтобы файл 8 не закрыл сайт преждевременно. Дальше: остальные файлы → массовое одобрение «из таблицы» кнопкой → проверка входа редактора → **включение флага отдельным шагом в конце** → сброс CDN по обоим тегам (`contentCacheTag`, `employeesCacheTag`). Сайт не закрывается для своих ни на минуту.
- **D-06:** Контрактная миграция (снятие анонимного чтения и политик `using (true)`) применяется строго после выкладки кода, читающего через сервер, и проверки, что сайт работает на этом коде. Чек-лист: «выложить код → проверить → применить контракт». Никогда наоборот. — **Reversibility:** costly — откат требует отдельной аварийной миграции (D-08).
- **D-07:** Включение флага и сброс CDN выполняет только владелец по чек-листу. Агент готовит текст и команды, ничего не запускает ни на preview, ни на production.

#### Откат
- **D-08:** Два уровня отката. Быстрый — выключить флаг (анонимное прямое чтение таблиц остаётся закрытым). Аварийный — заранее подготовленная, **не применённая** миграция, возвращающая анониму чтение; применяется владельцем только если сломалось чтение через сервер. Аварийная миграция проходит `supabase-rls-reviewer` и явно помечена «не применять без аварии».
- **D-09:** При выключенном флаге экран заявки видят **только ожидающие** (заявка подана, решения нет). Отклонённые и отозванные при выключенном флаге видят открытый сайт, как люди без заявки; одобренные и редакторы — тоже открытый сайт. Уточнено владельцем 2026-11-15 при планировании (вариант 2), заменяет прежнее толкование агента «отклонённые и отозванные тоже». `lib/access-gate.ts` при выключенном флаге уже возвращает `mode: "open"` с состоянием заявки — что показывать, решает клиент.
- **D-10:** Признаки «пора откатываться» в чек-листе: после включения редактор не может войти; одобренный сотрудник видит экран заявки; `/api/content` у одобренного отвечает ошибкой дольше 5 минут.

#### Хранилище картинок
- **D-11:** Листинг `portia-media` закрывается (снятие широкой `select`-политики для анонима); картинка открывается по точной ссылке. То, что сохранённая ссылка продолжает работать у человека, потерявшего доступ, — известное ограничение, записывается в известных ограничениях и релизных заметках по образцу SEC-07. Поведение «публичный GET без select-политики» доказывается на staging — до этого BLOCKED.
- **D-12:** Кэш картинок (браузер и CDN, 1 год) остаётся как есть.
- **D-13:** Новая возможность редактора «сменить адрес картинки»: копирует тот же файл под новым случайным именем, подставляет новый адрес в запись и удаляет старый файл (старая ссылка перестаёт работать на сервере). — **Reversibility:** one-way — удалённый файл не восстанавливается; отмена/история редактора может вернуть ссылку на удалённый файл.
- **D-14:** Кнопка предлагается автоматически, когда редактор поднимает уровень записи, у которой есть картинка (не всегда видима и не выполняется молча).
- **D-15:** Уже скачанные копии (браузер, CDN до года) не удаляются — записывается в известных ограничениях («ссылка перестаёт работать на сервере; уже скачанные копии у людей не удаляются»).

#### Сайт без сида и стенды
- **D-16:** `defaultPortiaContent` с МОРОК/АРАХНА убирается из клиентской сборки (сейчас импортируется в `components/portia-access-gate.tsx`). Одобренный посетитель при недоступной базе или отсутствии строки видит рабочий стол с пустыми приложениями и строкой «Данные временно недоступны»; если есть кэш устройства для того же человека и уровня — показывается он с отметкой устаревших данных.
- **D-17:** Редактор при отсутствии строки контента (новая база) получает пустую структуру, которую можно заполнить и сохранить — без МОРОК/АРАХНА.
- **D-18:** Все живые проверки (заголовки CDN, `Cache-Status`, сброс тегов, листинг хранилища, отказ анонимного чтения по публичному ключу) остаются BLOCKED; стенда нет. Чек-лист содержит шаги проверки, которые выполняет владелец; агент делает офлайн-стенд и тесты. Ничего из этого не записывается как PASS.
- **D-19:** Число вызовов функций Netlify при опросе 30 с агент меряет/считает офлайн и записывает расчёт; интервал остаётся 30 с.

### Claude's Discretion
- Способ чтения после контракта (ориентир research: token-gated `SECURITY DEFINER` RPC с проверкой заявки; редакторы — по `portia_can_edit()`). Не вводить service-role ключ в приложение без отдельного решения владельца.
- `/api/employees`: перевод на ответ по зрителю с `noStoreHeaders` (сейчас `publicCacheHeaders`) и чтение через сервер.
- Ключи кэша устройства (`-v1` → `-v2`, привязка к личности и уровню), очистка при отклонении/отзыве/выходе; браузерный тест на локальной сборке (SEC-04).
- Маркеры для проверки `.next` после сборки и как она подключается к `npm run build` / `/portia-check`.
- Судьба `purgeCacheTag` после PUT и тегов кэша (оставить на один релиз — research).
- Как отмена/история редактора обходится с удалённым старым файлом (D-13): удаление старого файла только после успешного сохранения записи.
- Закрытие долгов Phase 24 WR-01..WR-03 — если пересекаются с этой фазой.

### Deferred Ideas (OUT OF SCOPE)
- Полное закрытие картинок (приватный бакет, временные ссылки от сервера) — отклонено в этой фазе (D-11), возможная будущая доработка.
- Deploy preview / staging для живых проверок — когда владелец предоставит стенд.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Аноним не читает контент и список сотрудников напрямую по публичному ключу; посетители читают только через сервер с проверкой заявки | §1 (подписанные RPC `portia_content_read` / `portia_employees_read`), §2 (контрактная миграция, срез политик), §10 (порядок expand → код → contract) |
| SEC-02 | Закрытые ответы не кэшируются на CDN; старые открытые копии сбрасываются | §5 (`/api/employees` на `noStoreHeaders`, судьба `purgeCacheTag`, сброс по обоим тегам владельцем) |
| SEC-03 | Код, HTML и сборка не содержат контента (МОРОК, АРАХНА); проверка `.next` ищет маркеры | §3 (вынос сида в тестовый модуль, пустая структура), §4 (скрипт сканирования `postbuild`) |
| SEC-04 | Кэш браузера очищается при любом переходе в неодобренное состояние и не показывает данные до одобрения | §6 (ключи `-v2`, привязка к личности и уровню, очистка на смене зрителя, браузерный тест на моках), §8 (D-09) |
| SEC-05 | Список файлов хранилища недоступен; картинка открывается только по точной ссылке | §2 (снятие `select`-политики для anon, редакторская `select`-политика), §7 (смена адреса картинки) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Next.js App Router + React 19 + TS + Tailwind 4, Supabase (`@supabase/ssr`), Netlify; ответ владельцу по-русски. [VERIFIED: CLAUDE.md]
- Никакого production Supabase, настоящих секретов, service-role; никаких мутаций production; изменения БД — только в изолированной тестовой ветке/проекте. Агент ничего не применяет к базе.
- Не читать и не печатать настоящие `.env*` (`.env.example` можно). Хук `.claude/hooks/guard.mjs` блокирует такие команды.
- Не изменять, не стейджить, не коммитить: `.planning/milestone.lock`, `.planning/forensics/`, `.planning/milestones/v1.2-incomplete-research/`, `.planning/quick/261028-c9g-portia-promotion-1-8/`, `.planning/ui-reviews/`.
- Стейджить только явными путями; без `git add -A` / `.`, `git stash`, `git clean`, `git reset --hard`.
- BLOCKED не записывать как PASS: авторизованные роли, Postgres/RLS, staging/production, физические устройства — BLOCKED до своей фазы.
- Figma и Codex Security из плана убраны — не возвращать.
- Для `supabase/*.sql`, RLS, RPC, политик хранилища — обязателен агент `supabase-rls-reviewer` (`.claude/agents/supabase-rls-reviewer.md` существует). [VERIFIED: ls .claude/agents]
- Проверки: `npm test`, `npm exec tsc -- --noEmit`, `npm run lint`, `npm run build`; визуальный манифест — только `--verify-promotion`, **никогда `--verify`**. Эталонный Node 22.13.1 (в этой сессии он и стоит по умолчанию: `node --version` → v22.13.1).
- Память владельца: без галерей `review.html` и реестра по хэшам (визуальные изменения — текстом); вопросы выбора — нумерованным текстом, не диалогами; UAT 20-14 закрыт как принятый риск, не PASS.
- **Ловушка среды (проверено):** в процессе загружены staging-ключи, поэтому `guard.mjs` блокирует любую команду, где встречается слово `supabase` отдельным токеном (`ls supabase ...`, `supabase --version`). Пути вида `supabase/migrations/...` проходят. Планировщику и исполнителю: писать пути, а не голое слово. [VERIFIED: .claude/hooks/guard.mjs:31 `/(^|[\s;&|(])(npx\s+)?supabase(\s|$)/i`]

## Summary

Фаза разбирается на пять независимых потоков, связанных порядком выкладки: (1) база — две новые миграции и одна не применяемая аварийная, (2) серверное чтение через RPC вместо чтения таблиц публичным клиентом, (3) сборка без сида и скан `.next`, (4) кэш CDN/браузера, (5) хранилище и новая функция редактора «сменить адрес картинки». Плюс письменный чек-лист владельца. Новых npm-пакетов не нужно.

**Главные находки, которые меняют план (подробности в разделах):**

1. **Чтение «по токену заявки» недостаточно — серверный RPC должен быть подписан.** Публичный ключ виден всем; RPC, исполняемый анонимом, не отличает сервер Next от атакующего. Если проверять только дайджест токена, то при выключенном закрытии (и при «быстром откате» D-08) у посетителя уровня 1 токена нет — RPC обязан отвечать всем, то есть отдаёт **сырой** payload всех уровней в обход очистки Phase 24. Решение по образцу RLS21-01: сервер подписывает вызов HMAC общим секретом `PORTIA_ACCESS_SUBMIT_SECRET`, база сверяет с `portia_access_secrets` (строка `'submit'`, новых секретов и изменения CHECK не нужно). Редакторы идут по `portia_can_edit()` без подписи. (§1)
2. **Два файла миграций, не один.** D-06 («выложить код → проверить → применить контракт») требует, чтобы RPC существовал **до** выкладки кода: файл-expand (`CREATE FUNCTION`) применяется раньше, файл-contract (снятие anon-чтения) — после проверки. `supabase db push` применяет все ожидающие файлы разом, поэтому для этого раската применять по одному файлу через `psql` (вариант B из 23-MIGRATION-APPLY.md). Контракт начинается с защитного `DO`-блока, который отказывает, если expand или секрет отсутствуют. (§2, §10)
3. **Аварийная миграция не может лежать в `supabase/migrations/`.** Тест `portia-canonical-parity.test.ts` закрепляет хеш каждого файла этого каталога, а CLI применил бы её сразу за контрактом. Место — `supabase/emergency/` (прецедент: `supabase/teardown/portia_teardown.sql`), со своим текстовым тестом. И аварийный откат работает только в паре с откатом кода (Netlify «Publish previous deploy»): новый код читает через RPC и анонимные права на таблицы ему не нужны. (§2, §10)
4. **`GET /api/employees` сегодня вообще не проверяет допуск** и держится на CDN-кэше 600 с, который заодно был единственной защитой Google Sheets и Roblox API от нагрузки. После перехода на `no-store` каждый запрос зрителя идёт в Sheets и три вызова Roblox; нужен серверный TTL-кэш снимка ростера (одинаков для всех зрителей, ворота стоят перед ним). (§5)
5. **Сид попадает в клиентскую сборку не только через `components/portia-access-gate.tsx`.** `lib/portia-content-normalize.ts` читает `defaultPortiaContent.assistant*`, а нормализатор — клиентский код, поэтому весь объект остаётся в бандле. Проверено grep'ом по существующей сборке: «МОРОК» лежит в `.next/static/chunks/41ttny6iip7vm.js` (клиент), в `.next/server/chunks/**` и в `.map`; HTML-страницы чисты. Нужно вынести сид в тестовый модуль, оставив в рабочем коде только пустую структуру и `assistantDefaults`. (§3, §4)
6. **Тесты-ограничители сцеплены с миграциями и маршрутами через `git ls-files`.** `lib/phase23-evidence.test.ts` и `lib/phase24-evidence.test.ts` требуют по строке на **каждую** отслеживаемую миграцию и маршрут в матрицах фаз 23 и 24; `lib/security-matrix.test.ts` берёт «текущую матрицу» из каталога Phase 24 и проверяет свежесть (`matrix freshness`). Новая миграция и правки `app/api/**` ломают их, пока не обновлены (прецедент Phase 24: «окно красного» с `--test-skip-pattern`, финальный план пишет `25-SECURITY-MATRIX.md`). Новых файлов `route.ts` лучше не добавлять: смена адреса картинки — метод `POST`/`DELETE` в существующем `/api/uploads`. (§2, §11)
7. **У владельца нет пути вызвать `portia_access_set_closure`.** В коде есть обёртка `setClosure` (`lib/access-store.ts`), но ни маршрута, ни кнопки; сама функция требует JWT владельца (`portia_is_owner()`), из `psql` она не вызывается. Рабочий путь — SQL-оператор из 23-MIGRATION-APPLY.md с `updated_by = coalesce(updated_by, gen_random_uuid())`. Это расходится с формулировкой D-05 («функцией владельца») — вопрос к владельцу (Open Question 1). (§10)
8. **Редакторам нужна `select`-политика на `storage.objects`:** `copy` требует `select` на источнике и `insert` на приёмнике, `remove` — `delete` (документация Supabase). После снятия широкой политики добавляется «Editors can read PORTIA media» по `portia_can_edit()`. Публичный GET по точной ссылке не зависит от `select`-политики для публичного бакета (документация), листинг зависит — оба факта доказываются только на staging. (§2, §7)
9. **D-09 ломает один существующий тест** (`lib/access-gate.test.ts:299-308`, «D-05 unchanged: open mode keeps the card ... for every non-approved state») и требует менять `accessGateLayout`, а не сервер. (§8)
10. **Для SEC-04 есть готовый прецедент без источника данных:** `tests/e2e/specs/access-levels.spec.ts` подменяет все `/api/**` через `page.route` и уже проверяет очистку кэша после «отозван». Новый сценарий добавляется туда же (отклонён/отозван/выход/падение уровня, ключи `-v2`, удаление `-v1`). (§6)

**Primary recommendation:** Реализовать контракт как «expand-миграция с двумя подписанными RPC → код читает через RPC → contract-миграция со срезом политик и защитным DO-блоком», вынести сид в `lib/testing/`, подключить `scripts/phase25-build-scan.mjs` как `postbuild`, перевести `/api/employees` на ворота + `no-store` + серверный TTL-кэш, а все живые проверки оформить шагами чек-листа владельца со статусом BLOCKED/ОЖИДАЕТ ВЛАДЕЛЬЦА.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Запрет анонимного чтения таблиц | Database / Storage (REVOKE + политики RLS) | — | Защита должна держаться при прямом обращении к PostgREST с публичным ключом, не в Next |
| Чтение контента и ростера для зрителя | API / Backend (route handlers + signed RPC) | Database (RPC проверяет подпись) | Только сервер знает секрет подписи; очистка по уровню — серверная (D-04) |
| Решение «кто зритель» | API / Backend (`resolveGate` → `viewerOf`) | Database (`portia_access_resolve`) | Уже реализовано в Phase 23–24, Phase 25 не меняет |
| Заголовки `no-store`, отсутствие тегов | API / Backend | CDN (поведение Netlify) | Заголовки ставит handler; фактическая раздача CDN доказывается только на стенде |
| Сброс старых CDN-копий | CDN / Static (Netlify purge по тегам) | Owner (шаг чек-листа) | Агент не имеет доступа к Netlify; шаг владельца |
| Страница без контента | Frontend Server (статическая оболочка) + Build (скан `.next`) | — | `app/page.tsx` статична; сид живёт только в клиентском бандле через нормализатор |
| Кэш устройства по личности и уровню | Browser / Client (localStorage) | Frontend (gate наблюдает переходы) | Ключи и очистка — клиентская логика; данные для решения даёт `/api/access/status` |
| Что показать в `mode: "open"` | Browser / Client (`accessGateLayout`) | — | Сервер уже отдаёт состояние заявки (D-09) |
| Хранилище: листинг закрыт, точная ссылка работает | Database / Storage (политики `storage.objects`, публичный бакет) | — | Поведение зависит от платформы, доказывается на staging |
| Смена адреса картинки | API / Backend (`/api/uploads`, сессия редактора) | Browser (поле, уведомление, очередь удаления) | Копия/удаление под ролью `authenticated` по существующим политикам редактора, без service-role |
| Скан сборки | Build (npm `postbuild`) | CI (Netlify build) | Падение сборки при находке маркера |

## Standard Stack

### Core (уже в проекте, версии из `package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.5 | App Router, route handlers, `.next` | Закреплена Phase 21 (SEC-08) [VERIFIED: package.json] |
| @supabase/supabase-js | ^2.117.3 | `rpc()`, `storage.from().copy/remove` | Уже используется в серверных маршрутах [VERIFIED: package.json] |
| @supabase/ssr | ^0.12.7 | серверный клиент с cookie сессии редактора | Уже используется [VERIFIED: package.json] |
| @netlify/functions | ^6.0.2 | `purgeCache({ tags })` | Уже используется в `lib/portia-cdn.ts` [VERIFIED: package.json, lib/portia-cdn.ts:1] |
| @playwright/test | 1.64.1 | браузерный тест SEC-04 на локальной сборке | Уже в devDependencies [VERIFIED: package.json] |
| node:test (встроенный) | Node 22.13.1 | юнит-тесты `lib/*.test.ts` | `npm test` = `node --experimental-strip-types --test lib/*.test.ts` [VERIFIED: package.json] |

### Supporting
Новых зависимостей нет. HMAC — `node:crypto` (как в `lib/access-session.ts`), SQL — `extensions.hmac`/`extensions.digest` (как в `portia_access_submit_request`, foundation.sql:224).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Подписанный RPC (сервер подписывает HMAC) | RPC, проверяющий только дайджест токена заявки | Не обслуживает режим «закрытие выключено» (нет токена) и тогда отдаёт сырой payload любому анониму; обходит очистку Phase 24 |
| Подписанный RPC | service-role ключ в Netlify | Запрещён CLAUDE.md и D-03 без отдельного решения владельца |
| Подписанный RPC | Перенос очистки по уровню в SQL | Противоречит D-04 («меняет только источник чтения»), дорого и без стенда не доказуемо |
| Общий секрет `'submit'` с отдельной меткой HMAC | Новая строка `'read'` в `portia_access_secrets` | CHECK `name in ('submit')` пришлось бы переписывать и обновлять golden fingerprint; отдельная метка даёт разделение доменов без этого |
| Две миграции (expand + contract) | Одна миграция | Один файл нарушает D-06: контракт применился бы раньше кода или RPC появился бы после кода |

**Installation:** не требуется.

## Package Legitimacy Audit

Фаза не устанавливает внешние пакеты. Проверка `package-legitimacy` не запускалась: нечего проверять. Любой пакет, который исполнитель захочет добавить (например, библиотека для скана файлов), считать `[ASSUMED]` и ставить только после `checkpoint:human-verify`; для скана хватает `node:fs`.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Браузер посетителя ──► `/` (статическая оболочка PortiaAccessGate, без контента)
   │
   ├─ каждые 5 с ──► GET /api/access/status ──► resolveGate ──► RPC portia_access_closure_enabled [+ portia_access_resolve]
   │                    (решение: open | closed, состояние заявки)           └► gate-view решает, что показать (D-09)
   │
   ├─ каждые 30 с ─► GET /api/content ─► resolveGate ─► viewerOf ─┬─ viewer = null ─► 401 access-required (no-store)
   │                                                               └─ viewer ─► [NEW] читает строку:
   │                                                                      посетитель: public client + подпись HMAC ─┐
   │                                                                      редактор:   session client, без подписи   ├► RPC portia_content_read
   │                                                                                                               ┘   (SECURITY DEFINER)
   │                                                                  └─► contentBodyFor (Phase 24, без изменений) ─► JSON no-store, без тегов
   │
   └─ каждые 5 мин ► GET /api/employees ─► [NEW] resolveGate ─► viewer? ─► roster-снимок (TTL-кэш в памяти: Sheets + Roblox)
                                                │                         └► RPC portia_employees_read (подпись) ─► no-store, без тегов
                                                └ viewer = null ─► 401 access-required

Редактор (сессия Supabase) ──► PUT /api/content, PATCH/POST/DELETE /api/employees ─► таблицы напрямую (политика select/insert/update по portia_can_edit)
                           └► POST /api/uploads {action: "rewrite"} ─► storage.copy ─► новый URL ─► запись сохранена ─► DELETE /api/uploads (старый URL) ─► storage.remove

Скан сборки: `npm run build` ─► postbuild ─► scripts/phase25-build-scan.mjs ─► обход `.next` (кроме cache/dev/diagnostics) ─► маркеры ─► exit 1 при находке

Порядок выкладки (владелец): expand-миграция ─► деплой кода ─► проверка ─► contract-миграция ─► включить флаг ─► сбросить теги CDN
```

### Recommended Project Structure

```
supabase/migrations/
├── 20261115000000_portia_server_read_expand.sql   # [NEW] portia_content_read, portia_employees_read (+grants), notify
└── 20261115000100_portia_closure_contract.sql     # [NEW] DO-guard; revoke anon select; политики; storage; notify
supabase/emergency/
└── 20261115000200_portia_emergency_restore_anon_read.sql  # [NEW, НЕ применяется, вне migrations/]
lib/
├── server-read.ts                 # [NEW] signServerRead, readContentRow, readEmployeeRows (клиент RPC)
├── server-read.test.ts            # [NEW] метка/раскладка HMAC = SQL, ответы, fail-closed
├── gate-for-request.ts            # [NEW] resolveGateFor(request) — закрывает IN-04 и убирает копию в третьем маршруте
├── portia-content.ts              # [EDIT] seed удалён; assistantDefaults, emptyPortiaContent
├── testing/portia-content-fixture.ts   # [NEW] бывший seed дословно + cloneFixtureContent (только тесты и скрипты)
├── device-cache.ts                # [EDIT] ключи -v2, бинд личность+уровень, LEGACY_CACHE_KEYS, purge
├── access-gate-view.ts            # [EDIT] D-09: rejected/revoked в open = none
├── media-rewrite.ts               # [NEW] разбор URL бакета, список картинок записи, проверка пути (чистая логика)
└── employees-snapshot-cache.ts    # [NEW] серверный TTL-кэш снимка Sheets+Roblox
scripts/
└── phase25-build-scan.mjs         # [NEW] скан `.next`, экспортирует scanTree/CONTENT_MARKERS для теста
supabase/…  (тесты: lib/phase25-*.test.ts)
.planning/phases/PORTIA-25-.../
├── 25-OWNER-CHECKLIST.md          # [NEW] по образцу 23-MIGRATION-APPLY.md
├── 25-POLL-BUDGET.md              # [NEW] расчёт D-19
└── 25-SECURITY-MATRIX.md, 25-RLS-REVIEW.md, 25-RELEASE-NOTES.md  # финальный план (прецедент 24-11)
```

### 1. Серверное чтение после контракта (вопрос 1)

**Текущее состояние (прочитано):**
- `app/api/content/route.ts` GET: клиент `createServerSupabaseClient()` нужен только для ворот; строка читается **публичным** клиентом: строка 40 `const { data: row, error } = await createPublicSupabaseClient()` с `.from("portia_content").select("payload, revision, updated_at").eq("id", "main").maybeSingle(...)`. Комментарий в коде: «Still the public client: Phase 25 closes the anonymous read of the table.» [VERIFIED: app/api/content/route.ts:39-43]
- `app/api/content/route.ts` PUT: клиент **сессии редактора** (`createServerSupabaseClient`): предварительное чтение строки (`supabase.from("portia_content").select("payload, revision")`) для редакторов с закрытыми вкладками и `insert`/`update ... .select(...)`. Это остаётся таблицами: `UPDATE ... RETURNING` и `WHERE` по строке требуют, чтобы политика `select` пропускала строку, поэтому `select`-политика редакторов **должна остаться**. [VERIFIED: app/api/content/route.ts:85-110]
- `app/api/employees/route.ts` GET: `loadEmployees(createPublicSupabaseClient())` и `publicCacheHeaders(employeesCacheTag, complete ? 600 : 30)`; **ворот нет вообще** (`resolveGate` в файле не вызывается). PATCH/POST/DELETE — клиент сессии, `loadEmployees(supabase)` для POST/DELETE. [VERIFIED: app/api/employees/route.ts:10-23, :34, :84]
- `app/api/employees/editor/route.ts` GET: клиент сессии, только редакторы с открытой вкладкой `employees`, `noStoreHeaders`. [VERIFIED: app/api/employees/editor/route.ts]
- Единственные вызовы публичного клиента: `app/api/access/request/route.ts` (RPC заявки), `app/api/content/route.ts:40`, `app/api/employees/route.ts:14`. [VERIFIED: grep createPublicSupabaseClient]
- Чтение таблиц `portia_employee_profiles` / `portia_manual_employees` — только в `lib/portia-employees.ts` (`readEmployeeProfiles` `select("*")`, `readManualEmployees` явные колонки, `findKnownEmployee`, `saveEmployeeProfile` и т.д.). Профильные строки содержат `updated_by` (uuid пользователя Supabase): сейчас аноним получает его через `select("*")`, RPC должен отдавать проекцию без него. [VERIFIED: lib/portia-employees.ts:301-316, :341-356]

**Почему подписанный RPC, а не «проверка по токену».** Дайджест токена посетителя — HMAC с серверным секретом (`accessTokenDigest`, `lib/access-session.ts`), его нельзя посчитать без секрета, поэтому RPC, требующий **одобренный** дайджест, был бы надёжным для закрытого сайта. Но: (а) при выключенном закрытии посетитель без заявки (уровень 1) читает контент без токена, RPC должен отвечать и ему; (б) тогда любой аноним с публичным ключом вызывает RPC напрямую и получает сырой payload всех уровней, обходя очистку Phase 24; (в) «быстрый откат» D-08 как раз выключает флаг. Единственный способ отличить сервер — общий секрет. В проекте он уже есть и уже проверяется в базе: `portia_access_submit_request` сверяет HMAC с `portia_access_secrets` (`name = 'submit'`).
[VERIFIED: supabase/migrations/20261109000000_portia_access_foundation.sql:157 `constraint portia_access_secrets_name_check check (name in ('submit')),`; :224 `expected_signature := encode(extensions.hmac(`; :229 `or p_issued_at < now_epoch - 300 or p_issued_at > now_epoch + 60`]

**Рекомендуемый дизайн (две функции, объявления по шаблону foundation):**

| Функция | Аргументы | Возврат | Доступ | Кто вызывает |
|---------|-----------|---------|--------|--------------|
| `public.portia_content_read(p_issued_at bigint, p_signature text)` | время (секунды) и HMAC | `jsonb`: `{code:'ok', row:{payload,revision,updated_at}\|null}` или `{code:'unauthorized'}` | `revoke all ... from public, anon, authenticated; grant execute ... to anon, authenticated; grant execute ... to service_role;` (как у `portia_access_resolve`) | GET `/api/content` |
| `public.portia_employees_read(p_issued_at bigint, p_signature text)` | то же | `jsonb`: `{code:'ok', profiles:[...], manual:[...]}` или `{code:'unauthorized'}` | то же | GET `/api/employees` |

Тело: `if not public.portia_can_edit() then <проверка подписи как в submit с меткой 'content-read-v1|' || p_issued_at> end if;` — редактор с JWT проходит без подписи (не зависит от секрета, снимает IN-06-подобную зависимость), остальные — только с валидной подпиской, иначе `{code:'unauthorized'}` (fail closed, ответ нейтральный). `security definer`, `set search_path = ''`, `stable`. Сообщение подписи — `"<scope>-read-v1|<issuedAt>"` (`scope` = `content` или `employees`), домен отделён от `access-submit-v1`.

TypeScript (`lib/server-read.ts`) повторяет `lib/access-session.ts` (`signAccessSubmit`) и пинится тестом к тексту SQL так же, как `lib/access-requests.test.ts` пинит submit. Редакторский путь: клиент сессии (`createServerSupabaseClient`) вызывает RPC с `p_issued_at: 0, p_signature: ""` (подпись не нужна). Посетительский путь: `createPublicSupabaseClient()` + `accessSubmitSecret()`; если секрета нет — 503 «Данные временно недоступны», как и сейчас для отсутствующей базы.

Для `employees` в проекции использовать `to_jsonb(p) - 'updated_by'` (профили) и явные колонки `employee_id, nickname, title, rank, callsign` с `order by created_at` (ручные), как в `readManualEmployees`. RPC возвращает одну jsonb-строку, а не набор: `max_rows = 1000` из `supabase/config.toml` её не обрезает. [VERIFIED: supabase/config.toml `max_rows = 1000`] Колонки рейтингов добавляются `add column if not exists` в baseline; `to_jsonb(p)` берёт все текущие колонки, что повторяет смысл `select("*")` («columns the database does not have yet cannot fail the whole read»).

`lib/portia-employees.ts` перестраивается так: `readEmployeeProfiles`/`readManualEmployees` принимают источник строк (таблица через клиент **или** уже полученный jsonb), `loadEmployees(client, rows?)`. Путь редактора (PATCH/POST/DELETE/`/editor`) остаётся на таблицах сессии; путь GET зрителя — на RPC.

**Тест сегодняшнего маршрута придётся править:** `lib/content-response.test.ts:171-184` разбирает исходник GET и требует `get.indexOf("viewerOf(") < get.indexOf('.from("portia_content")')`; после перехода на RPC порядок «ворота → чтение» сохраняется, меняется маркер (`.rpc(` / `readContentRow(`). [VERIFIED: lib/content-response.test.ts:171-184]

### 2. Контрактная миграция и тесты, которые сканируют миграции (вопрос 2)

**Что снимается (дословно из baseline, [VERIFIED: supabase/migrations/20261101000000_portia_baseline.sql]):**

| Объект | Строки | Текст |
|--------|--------|-------|
| `portia_content` grant | 245 | `grant select on table public.portia_content to anon, authenticated;` |
| `portia_content` policy | 248-252 | `drop policy if exists "Public can read PORTIA content" on public.portia_content;` / `create policy "Public can read PORTIA content"` / `on public.portia_content for select` / `to anon, authenticated` / `using (true);` |
| `portia_employee_profiles` grant | 273 | `grant select on table public.portia_employee_profiles to anon, authenticated;` |
| `portia_employee_profiles` policy | 276-280 | `create policy "Public can read PORTIA employee profiles"` … `using (true);` |
| `portia_manual_employees` grant | 312 | `grant select on table public.portia_manual_employees to anon, authenticated;` |
| `portia_manual_employees` policy | 315-319 | `create policy "Public can read PORTIA manual employees"` … `using (true);` |
| `storage.objects` listing policy | 1647-1651 | `drop policy if exists "Public can read PORTIA media" on storage.objects;` / `create policy "Public can read PORTIA media"` / `on storage.objects for select` / `to anon, authenticated` / `using (bucket_id = 'portia-media');` |
| бакет | 1636-1644 | `'portia-media'`, `public = true`, `4194304`, mime-типы png/jpeg/webp/gif — остаётся публичным (D-11) |

Редакторские политики записи (`insert`/`update`/`delete` на content, profiles, manual, storage) остаются нетронутыми. Функции `portia_can_edit()` и `portia_can_edit_tab(text)` отозваны у `public, anon` и выданы `authenticated` (baseline 195-201), поэтому политика `to authenticated using ((select public.portia_can_edit()))` корректна.

**Содержимое contract-миграции** (`20261115000100_portia_closure_contract.sql`, без `begin/commit`):
1. Защитный `DO`-блок: отказ (`raise exception`), если нет `portia_content_read(bigint, text)` или `portia_employees_read(bigint, text)`, или нет строки `portia_access_secrets` с `name = 'submit'` и `length(secret) >= 32`. Это страхует порядок D-06 и исключает «закрыли чтение, а сервер читать не может».
2. `revoke select on table public.portia_content from anon;` и то же для двух таблиц сотрудников (по одному оператору на таблицу — этот вид оператора понимает проигрыватель `phase16-expected-authz.test.ts`).
3. Для каждой из трёх таблиц: `drop policy if exists "Public can read ..."`, затем `create policy "Editors can read PORTIA ..." on ... for select to authenticated using ((select public.portia_can_edit()));`. Employees читаются по `portia_can_edit()`, а не по `portia_can_edit_tab('employees')` (так в ARCHITECTURE.md §4 и ROADMAP).
4. `storage.objects`: `drop policy if exists "Public can read PORTIA media" on storage.objects;` и `create policy "Editors can read PORTIA media" ... to authenticated using (bucket_id = 'portia-media' and (select public.portia_can_edit()));`.
5. Последняя строка `notify pgrst, 'reload schema';`.

**Эффект для ролей (для матрицы `expected-authz.json`):** `anon` — `42501` на select трёх таблиц (grant снят); `outsider` (вошёл, но не редактор) — grant `authenticated` остаётся, политика отфильтровывает всё: исход `rls-empty`; `editor-*`, `promo-reviewer`, `owner` — `allow`, если проходят `portia_can_edit()` (в матрице `promo-reviewer` — это редактор с выданной вкладкой `promo`, то есть `portia_can_edit()` для него true). [VERIFIED: tests/e2e/fixtures/data/expected-authz.json, roles и outcomes]. Для `storage.read`: `anon` — `rls-empty`/403 на листинге, `outsider` — то же, редакторы — `allow`. Живая проверка BLOCKED.

**Expand-миграция** (`20261115000000_portia_server_read_expand.sql`): создаёт обе функции (см. Code Examples), `revoke all ... from public, anon, authenticated` **перед** любым `grant` (тест `portia-sql.test.ts`: «every function created after the baseline is revoked from public, anon and authenticated before any grant»), `grant execute ... to anon, authenticated` и `to service_role`, `notify pgrst, 'reload schema';`. Это аддитивный файл: старый код продолжает читать таблицы.

**Следующая временная метка:** последняя существующая `20261114000000_portia_access_closure_default_on.sql`; имена файлов должны соответствовать `^\d{14}_portia_[a-z0-9_]+\.sql$`, версии строго возрастают и уникальны. [VERIFIED: lib/portia-canonical-parity.test.ts:69-77, :103-107; ls supabase/migrations] Предлагаю `20261115000000` и `20261115000100` (расстояние оставлено под вставку).

**Аварийная миграция.** Файл **не** кладётся в `supabase/migrations/`: каждый файл этого каталога обязан иметь закреплённый хеш в `migrationHashes` (`assert.deepEqual([...files].sort(), Object.keys(migrationHashes).sort(), "new migration without a pinned hash ...")`), и `db push` применил бы его следом за контрактом. Место — `supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql`; первая строка комментария «НЕ ПРИМЕНЯТЬ БЕЗ АВАРИИ» (по образцу `supabase/teardown/portia_teardown.sql`, у которого тест требует первую строку `-- ISOLATED TEST PROJECT ONLY`). Тело: `grant select on table ... to anon;` для трёх таблиц и повторное создание трёх политик «Public can read ...» (`to anon, authenticated using (true)`); восстановление листинга хранилища — отдельным **закомментированным** блоком (сайту оно не нужно: публичный бакет отдаёт по точной ссылке). Нужен текстовый тест (`lib/phase25-emergency.test.ts`): файл вне `migrations/`, первая строка с маркером, нет `begin`/`commit`, нет `service_role`, не затрагивает `auth.`; плюс прогон `supabase-rls-reviewer` (D-08). [VERIFIED: lib/portia-canonical-parity.test.ts:69-84 «migrations are forward-only, pinned, ordered and carry no transaction wrapper»; :118-124 teardown]

**Что ещё сканирует `supabase/migrations/*.sql` (контракт для новых файлов):**

| Тест | Что проверяет | Что делать с новыми файлами |
|------|---------------|-----------------------------|
| `lib/portia-canonical-parity.test.ts` | имя файла, возрастание версий, `migrationHashes` для **каждого** файла, нет `begin;`/`commit;` | добавить обе записи с sha256 (LF-нормализованный) в `migrationHashes` после финального ревью |
| `lib/phase16-expected-authz.test.ts` | проигрывает **все** миграции по версиям: `create or replace function public.portia_*`, `drop function if exists`, `grant execute on function ... to ...;`, `revoke (all\|execute) on function ...`, `grant/revoke ... on table public.portia_* ...;`; сверяет с `tests/e2e/fixtures/data/expected-authz.json`: список `migrations` (равен отсортированному списку файлов), набор функций, ячейки ролей, каждая ячейка с `source: "supabase/migrations/<файл>:<строка>"` на реальную непустую строку не-комментарий | обновить JSON: `migrations`, две функции (ячейки 6 ролей, `args` — плейсхолдеры из `matrix.placeholders`), ячейки `select` трёх таблиц и `storage.ops.read`, источники на строки новых файлов. **Операторы писать в одну строку, в именно таких формах** — проигрыватель их не разбирает иначе |
| `lib/portia-migration-fingerprint.test.ts` | для каждой эффективной `portia_*` функции сверяет с `supabase/fingerprint/expected/portia.fingerprint.json`: sha256 тела между `as $$` и `$$;`, `secdef`, волатильность, config, тип результата, ACL; число функций `1 + effectiveFunctions.size` | добавить две записи функций в golden (`public.portia_content_read(p_issued_at bigint, p_signature text)` и т.д.), посчитанные скриптом тем же регулярным выражением. Записи `policies`, `tables.acl`, `bucket` golden тестом не сверяются, но править их нужно для согласованности, помечая «выведено офлайн, на staging не снято» |
| `lib/portia-sql.test.ts` | нет `set search_path = public`; перед любым `grant` — `revoke all ... from public, anon, authenticated` | следовать форме |
| `lib/access-closure.test.ts` | последняя миграция с определением `portia_access_closure_enabled(` — `20261114000000`; хеши и операторы файла 8 | новые файлы не должны переопределять эту функцию |
| `lib/phase23-evidence.test.ts:80-125` и `lib/phase24-evidence.test.ts:62-70` | **по `git ls-files`**: каждая отслеживаемая миграция и каждый `app/api/**/route.ts` встречается ровно один раз в `23-SECURITY-MATRIX.md` / `24-SECURITY-MATRIX.md`; в `23-MIGRATION-APPLY.md` порядок применения равен **всем** версиям после `20261101000200` | ограничить эти сверки версией `<= 20261114000000` (миграции фаз 23–24 заморожены) или дописать строки; выбрать первое: матрицы прошлых фаз — исторические записи |
| `lib/security-matrix.test.ts:243-250, 299-304, 372-380` | «текущая матрица» берётся из `24-SECURITY-MATRIX.md` (`currentMatrixText`): по строке на трек. маршрут и миграцию и **свежесть** (коммит матрицы — предок HEAD и ни один из охваченных путей не менялся после) | финальный план пишет `25-SECURITY-MATRIX.md` и переключает `currentMatrixText` на Phase 25. До него тест `matrix freshness: the real matrix commit` красный; прецедент: все планы Phase 24 гоняли `node --experimental-strip-types --test --test-skip-pattern="matrix freshness: the real matrix commit" lib/*.test.ts` |
| `lib/e2e-offline-supabase-harness.test.ts` + `tests/e2e/harness/offline-supabase.cjs` | harness подменяет `GET /rest/v1/portia_content` и ENOTFOUND для `.supabase.co` | после перехода на RPC подмена таблицы мертва; обновить комментарий/подмену на `POST /rest/v1/rpc/portia_content_read` либо удалить. Спеки уже подменяют `/api/**` и от этой подмены не зависят |

Поскольку `tracked()` использует `git ls-files`, незакоммиченные новые файлы эти тесты не ломают — они упадут при первом коммите, поэтому правки тестов и матриц должны попасть в тот же коммит (как в Phase 21 «fingerprint и expected-authz обновлены в том же коммите»).

### 3. Удаление сида (вопрос 3)

**Все использования `defaultPortiaContent` в рабочем коде** [VERIFIED: grep по app, components, lib, scripts, tests]:

| Файл | Строки | Использование |
|------|--------|---------------|
| `lib/portia-content.ts` | 338 (объявление), 549-550 `cloneDefaultContent` | сид |
| `components/portia-access-gate.tsx` | 10, 121 | `initialContent={defaultPortiaContent}` для `PortiaDesktop` |
| `app/api/content/route.ts` | 1, 91 | PUT: baseline для редактора с закрытыми вкладками: `normalizePortiaContent(stored?.payload ?? defaultPortiaContent) ?? normalizePortiaContent(defaultPortiaContent)` |
| `lib/content-response.ts` | 6, 30 | `const stored = (row?.payload ? normalizePortiaContent(row.payload) : null) ?? defaultPortiaContent;` |
| `lib/portia-content-normalize.ts` | 10, 405-470 | **только `assistant*` поля** (фразы, интервалы, режим) как запасные значения нормализатора |
| `scripts/phase19-matrix-data.mjs` | 8, 89, 95 | запасной контент и образец вируса для матрицы на staging |
| ~20 `lib/*.test.ts` и 8 спеков/визуальных тестов под `tests/e2e/**` | — | фикстура (`structuredClone(defaultPortiaContent)`, `cloneDefaultContent`) |

«Роутера контента» отдельного модуля нет: упоминание в CONTEXT относится к `app/api/content/route.ts` и `lib/content-response.ts`. Роли сида в запросе GET (строка отсутствует) и PUT-baseline — заменить на пустую структуру.

**Почему сид в клиентском бандле:** `normalizePortiaContent` импортируется клиентским кодом (`components/portia-desktop.tsx`), а нормализатор ссылается на поля `defaultPortiaContent`, поэтому весь объект с вирусами и статьями остаётся в чанке. Проверено на существующей production-сборке: «МОРОК» найден в `.next/static/chunks/41ttny6iip7vm.js`, `.next/server/chunks/_1hcl90-4f114g._.js`, `.next/server/chunks/ssr/_0r8vz30q3yl0n._.js` и их `.map`; в `.next/server/app/*.html` — нет. [VERIFIED: grep -rl по `.next`]. Значит, достаточно убрать `defaultPortiaContent` из `lib/portia-content.ts` целиком; одной замены в `portia-access-gate.tsx` мало.

**Что должна удовлетворять пустая структура** (`emptyPortiaContent`): `normalizePortiaContent` возвращает `null`, если `viruses`, `infoSections`, `broadcasts` или `searchRecommendations` — не массивы; пустые массивы допустимы. [VERIFIED: lib/portia-content-normalize.ts:324-332 `!Array.isArray(candidate.viruses) || ... return null`]. Нормализатор требует непустых `assistant*` значений только как запасных (строки 405-470, подставляет `defaultPortiaContent.assistant*`, если массив пуст). Поэтому:

```ts
// lib/portia-content.ts (рабочий код)
export const assistantDefaults = { assistantAdvice: [...], assistantOffendedPhrase: "...", /* ... все assistant* как в сиде */ } satisfies Partial<PortiaContent>;
export const emptyPortiaContent: PortiaContent = {
  viruses: [], recycledViruses: [], infoSections: [], guideSections: [], broadcasts: [], broadcastSections: [],
  recycleFiles: [], recycleOrder: [], searchRecommendations: [], searchRecommendationSections: [],
  ...assistantDefaults, formattedText: {},
};
```

Нормализатор переходит на `assistantDefaults`. **Решение для подтверждения (A1):** фразы помощника и подсказки (`assistantAdvice`: «Глобальный поиск видит названия, коды, классификации и сообщения станции…») — служебный текст интерфейса, а не контент сайта; D-16 называет только МОРОК/АРАХНА. Маркеры скана их **не** включают. Если владелец сочтёт их контентом, они уйдут в пустой список и нормализатор будет подставлять `[]`/встроенные константы (меняет поведение помощника — отдельное решение).

**Сид** переносится дословно в `lib/testing/portia-content-fixture.ts` под именем `portiaContentFixture` + `cloneFixtureContent()`; тесты и скрипты меняют импорт (механическая замена, дословно тот же объект ⇒ визуальные эталоны и `phase20-baselines.json` не двигаются). Каталог `lib/testing/` не попадает под `lib/*.test.ts` (глоб `npm test` без подкаталогов). Нужен ограничитель, повторяющий `lib/e2e-import-boundary.test.ts`: рабочие корни `app`, `components`, `lib` (кроме `lib/testing` и `*.test.ts`) не импортируют `testing/portia-content-fixture`.

**Тесты, зависящие от строк МОРОК/АРАХНА** (после переименования импорта правятся механически): `lib/level-redact.test.ts:432-441` — строки `"МОРОК"`, `"КАЛЛИСТО"` заданы в самом тесте (от сида не зависят); `tests/e2e/visual/phase20.spec.ts:169-180` — «МОРОК (vir-d17) of the starting content» берётся из фикстуры через `page.route`; `lib/virus-classes.test.ts:15` — `defaultPortiaContent.infoSections.find(... "classification")`; `lib/portia-content-normalize.test.ts` (длины списков сравниваются с сидом); `tests/e2e/specs/access-levels.spec.ts:45` — `cloneDefaultContent()`.

**Поведение без сида (D-16, D-17):**
- GET: если `row === null` и зритель — не редактор → 503 `{"error":"Данные временно недоступны."}` + `noStoreHeaders` (клиент уже трактует 5xx как `unavailable` и показывает устаревший кэш с баннером либо «fatal»-состояние, см. `lib/app-state.ts`). Для редактора — 200 с `emptyPortiaContent`, `revision: 0`, чтобы PUT создал первую строку (`baseRevision === 0` → `insert`, route 98-101). [VERIFIED: app/api/content/route.ts:98-101]
- Клиент: `initialContent={emptyPortiaContent}`; `appViewState` уже считает «встроенные значения не данными» (`hasData`), пустой контент + ошибка → `fatal`, кэш + ошибка → `stale`. [VERIFIED: lib/app-state.ts `appViewState`]. Новая строка «Данные временно недоступны» — текст копирайта; ближайшие существующие: `failureCopy.unavailable.heading = "Сервис временно недоступен"` и `staleBannerText`. Точную формулировку D-16 планировщик фиксирует в `lib/app-state.ts` (новая запись или правка `failureCopy`).
- **WR-03 пересекается:** `shownViewerLevel(content)` в `lib/level-placeholders.ts:111-113` отдаёт 5 для копии без маркера; с пустым `initialContent` (раньше это был `defaultPortiaContent` без маркера) ошибка проявится как «Уровень 5» на пустом рабочем столе до первого ответа. Исправление из 24-REVIEW (`viewerLevel ?? shownViewerLevel(content)` в `components/portia-desktop.tsx:1887,1914,2078`) входит в эту фазу.

### 4. Скан `.next` после сборки (вопрос 4)

**Что сканировать.** Всё дерево `.next`, **кроме** `cache/`, `dev/`, `diagnostics/`, `trace*` (кэш сборщика, dev-вывод и трассировки не деплоятся; в локальном `.next` лежат ещё и dev-чанки со старым сидом, поэтому исключать `dev` обязательно). Включить `static/`, `server/**` (в том числе `.html`, `.rsc`, `.json`, `.map`), `build/`, манифесты. Production-источников `.map` в `server/` в этой сборке есть — карты тоже содержат строки. [VERIFIED: ls .next, grep -rl]

**Маркеры.** Только то, что есть в сиде и больше нигде в рабочем коде (проверено grep'ом: `ИМЯ УЧЁНОГО`, `Здесь будет текст записи`, `VIRUS_ARCHIVE`, `Что такое вирусы` встречаются в рабочем коде только в `lib/portia-content.ts`, кроме UI-подписи `PORTIA://VIRUS_ARCHIVE` в `components/portia-desktop-window.tsx:11`, значит `VIRUS_ARCHIVE` **не** маркер). Предлагаемый список: названия и коды вирусов `МОРОК`, `АРАХНА`, `КАЛЛИСТО`, `VIR-Δ17`, `VIR-Θ04`, `VIR-Σ12`; id `vir-d17`, `vir-t04`, `vir-s12`; заголовки статей `Что такое вирусы?`, `Способы распространения вирусов`, `Документация и утверждение`; ники из документа `maryerrar`, `anuargovni1`, `wewewewestrelok`; уникальный фрагмент текста `Всем вирусам присваивается по три класса`; рекомендации поиска сами по себе (`Протей`, `Воздушно-пылевой`) **нельзя** — это словарь `classificationOptions` (`lib/portia-content.ts:~41-80`), который остаётся в клиентском коде редактора намеренно. Каждый маркер проверять в двух видах: литерал UTF-8 и `\uXXXX`-экранированный (регистр hex любой). Экранирование минификатором — `[ASSUMED]` (в текущей сборке литералы UTF-8, проверено); сканер страхуется обоими видами.

**Защита от дрейфа:** юнит-тест `lib/phase25-build-scan.test.ts`: (а) каждый маркер встречается в фикстуре `portiaContentFixture` (иначе маркер устарел); (б) ни один маркер не встречается ни в одном рабочем файле `app/`, `components/`, `lib/` (кроме `lib/testing/` и тестов) — исходный уровень той же проверки; (в) `scanTree` на временном каталоге: чистый каталог → пусто, файл с маркером → находка с путём и маркером, `.next/cache` и `.next/dev` пропущены; (г) скрипт никогда не печатает содержимое файлов — только путь и маркер.

**Подключение:**
- `package.json`: `"postbuild": "node scripts/phase25-build-scan.mjs"` — npm автоматически запускает `post<script>` после `npm run build`, поэтому проверка срабатывает и в Netlify (`netlify.toml`: `command = "npm run build"`), и в `playwright.config.ts` (`webServer.command` начинается с `npm run build`), и в `check` (`npm test && npm run build && npm run lint`). [VERIFIED: package.json, netlify.toml, playwright.config.ts]. Netlify собирает на Node `22.13.0` (`NODE_VERSION`), что поддерживает и обычный `.mjs`; поэтому скрипт — обычный ESM без импорта TS (маркеры — литералами в самом файле, синхронизация с фикстурой — тестом). Сам Netlify-запуск `postbuild` — `[ASSUMED]` (поведение npm lifecycle) и доказывается только на deploy preview: BLOCKED.
- `.claude/skills/portia-check/run.sh`: режим `build` уже вызывает `npm run build --silent` — `postbuild` отработает сам; добавить явный шаг `step "build scan" node scripts/phase25-build-scan.mjs` для отдельной строки в отчёте (повтор безвреден). Файл — рабочий инструмент проекта, не в списке защищённых путей.
- Сборка без `.env.local`: `NEXT_PUBLIC_*` вшиваются из переменных процесса; для офлайн-сборки подходят выдуманные значения `OFFLINE_ENV` из `tests/e2e/harness/offline-supabase.cjs` (URL `https://abcdefghijklmnopqrst.supabase.co`, ключ `sb_publishable_dummy...`, `PORTIA_PROMOTION_DEVICE_SECRET`). Так делают офлайн-ворота `scripts/phase20-release-gate.mjs` (`offlineChildEnv`, строки 252-266). В этой исследовательской сессии сборка не запускалась (инструкция фазы).
- Существующий локальный `.next` собран со старым сидом — первый прогон скана на нём **должен упасть** (удобная проверка самого скана до пересборки).

### 5. Кэш и CDN (вопрос 5)

**Заголовки и теги (`lib/portia-cdn.ts`):** `publicCacheHeaders(tag, seconds)` возвращает `"Cache-Control": "public, max-age=0, must-revalidate"`, `"Netlify-CDN-Cache-Control": \`public, durable, s-maxage=${seconds}, stale-while-revalidate=86400\``, `"Netlify-Cache-Tag": tag`; `noStoreHeaders = { "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store" }`; `purgeCacheTag(tag)` глотает ошибки и логирует. [VERIFIED: lib/portia-cdn.ts:7-26]

**Какие ответы должны стать `no-store` без тегов:**
- `GET /api/content` — уже так (`noStoreHeaders` на каждом ответе, без `Netlify-Cache-Tag`); тест `lib/content-response.test.ts:171-184` это пинит.
- `GET /api/employees` — **единственный** оставшийся публичный: заменить `publicCacheHeaders(employeesCacheTag, ...)` на `noStoreHeaders` на всех ветках (успех и 502-ошибка уже `noStoreHeaders`), добавить ворота и 401 `contentAccessRequired`.
- Остальные маршруты уже на `noStoreHeaders` (grep по `app/api/**`). `/api/uploads` — `noStoreHeaders`.
- Комментарии в `app/api/employees/route.ts` («keys this cache by path only») и в `proxy.ts` («the employees list is still CDN-cached») устарели — обновить.

**Судьба `purgeCacheTag`:** оставить вызовы в PUT/PATCH/POST/DELETE ещё на один релиз (решение Discretion): они безвредны, а тесты их пинят (`lib/content-save.test.ts:84,96`, `lib/editor-tabs.test.ts:162` — порядок «отказ раньше сброса», `purgeCacheTag(contentCacheTag)` в PUT). Константы тегов остаются, `publicCacheHeaders` остаётся экспортированной, но без потребителей; удалить всё в следующем релизе вместе с тестами. Цель вызовов теперь только одна: опустошить старые копии, пока они не истекли сами.

**Старые CDN-копии (ловушка раската).** Ответы прежнего кода живут `s-maxage` 600 с плюс `stale-while-revalidate=86400` и помечены `durable`. Netlify пишет, что «all new deploys invalidate the cache for the given deploy context by default» (кроме опт-аута `Netlify-Cache-ID`), но про `durable`-записи страница ничего не говорит. [CITED: https://docs.netlify.com/build/caching/caching-overview/] Поэтому сброс по обоим тегам (`portia-content`, `portia-employees`) оставлен отдельным шагом владельца после деплоя и **до/вместе** с включением флага; лимит API — «Each cache tag or site can only be purged twice every 5 seconds». Запасной путь — «Clear cache and deploy site». Заголовки и сброс — BLOCKED до deploy preview.

**Серверный TTL-кэш ростера (новая находка).** Единственная защита Google Sheets (`fetchSheetRows`, таймаут 8 с) и Roblox (`resolveRobloxProfiles`: три запроса с таймаутом 5 с) от нагрузки — CDN-кэш 600 с; в `lib/portia-employees.ts` собственного кэша нет (комментарий строка 145: «the CDN caches the API response»). После `no-store` каждый посетитель при загрузке и каждые 5 минут запускает все четыре внешних вызова. Рекомендация: модульный кэш снимка `{rows, robloxByName}` на 60-300 с внутри экземпляра функции (одинаков для всех зрителей, ворота стоят перед ним; профили из базы читаются каждый раз через RPC и не кэшируются). Записи редактора сбрасывают кэш снимка в своём экземпляре. Рекомендуемые значения TTL — `[ASSUMED]`, подтвердить владельцем/на стенде. Если планировщик не берёт это в фазу, это надо явно записать как известное ограничение и риск лимитов Roblox.

**Расчёт вызовов Netlify при опросе 30 с (D-19, офлайн).** Только подсчёт HTTP-запросов к функциям; цены и кредиты Netlify здесь не оцениваются (`[ASSUMED]` для любой стоимости).

| Источник | Интервал | Запросов в минуту на одну видимую вкладку | Из чего берётся |
|----------|----------|-------------------------------------------|-----------------|
| `GET /api/access/status` (шлюз) | 5 с, только при `document.visibilityState === "visible"` | 12 | `components/portia-access-gate.tsx:66` `}, 5000);` |
| `GET /api/content` | 30 с (редактор 10 с) | 2 (редактор 6) | `components/portia-desktop.tsx:151-152` `const contentSyncMs = 30_000;` / `const editorContentSyncMs = 10_000;` |
| `GET /api/employees` | 5 мин | 0,2 | `components/portia-desktop.tsx:827` `window.setInterval(fetchEmployees, 5 * 60 * 1000)` |
| итого посетитель | | **14,2** в минуту = **852** в час на вкладку | |

Это вклад **шлюза**, не 30-секундного опроса: интервал D-19 даёт только 2 из 14,2, а 12 — опрос статуса раз в 5 с. Запросов к Supabase на вызов: статус — 1 (флаг) или 2 (флаг + `portia_access_resolve` при наличии токена); `/api/content` — флаг + resolve + `portia_content_read` = 3 (для редактора — `getUser` и проверки прав вместо resolve). Посетитель в закрытом режиме с токеном: ≈ 12×2 + 2×3 + 0,2×3 ≈ 30,6 запросов к Supabase в минуту на вкладку. Формула для владельца: `вызовов за сутки ≈ 852 × (число вкладок) × (часов видимости)`. Предложение: зафиксировать числа в `25-POLL-BUDGET.md` и пинить тестом `lib/phase25-poll-budget.test.ts`, читающим константы 5000 / 30_000 / `5 * 60 * 1000` из исходников (по образцу `lib/portia-desktop.test.ts`), чтобы смена интервала требовала пересчёта. Интервал остаётся 30 с (D-19); обратить внимание владельца на опрос 5 с — вопрос к владельцу, не решение фазы.

### 6. Кэш устройства (вопрос 6)

**Текущее состояние.** `lib/device-cache.ts` объявляет `CONTENT_CACHE_KEY = "portia-content-last-success-v1"` и `EMPLOYEES_CACHE_KEY = "portia-employees-last-success-v1"` (строки 21-22) и `clearDeviceContentCaches` (стирает обе); те же литералы **продублированы** в `components/portia-desktop.tsx:220-221` (IN-05) и закреплены тестами: `lib/device-cache.test.ts:42-43` и `lib/portia-desktop.test.ts:148` (список ключей `portia-…-vN` в исходнике). Кэш контента хранит поле `viewer` (`"editor"` или `"level-N"`, `viewerKeyOf` в `lib/content-sync.ts:25-30`) и проверяется при загрузке `cacheMatchesViewer` (desktop:757); кэш сотрудников **не привязан** ни к зрителю, ни к уровню (только к источнику, desktop:779) и пишется без `viewer` (desktop:717). Очистка есть в двух местах: gate на ответе `closed && !allowed` (`shouldClearDeviceCaches`, `lib/access-viewer.ts:26`, вызов `components/portia-access-gate.tsx:51`) и desktop на 401 `access-required` (desktop:587, до `isNewerAnswer` — IN-07).

**Что нужно:**

1. **Ключи `-v2`** для обоих кэшей и константы одним источником: `portia-desktop.tsx` импортирует их из `lib/device-cache.ts` (закрывает IN-05); тест `lib/portia-desktop.test.ts:148` меняется на проверку импорта и список без `portia-*-last-success-v1`.
2. **Удаление старых `-v1`** при первом запуске gate независимо от решения: `LEGACY_CACHE_KEYS = ["portia-content-last-success-v1", "portia-employees-last-success-v1"]`, `purgeLegacyDeviceCaches(storage)` вызывается один раз на монтировании `PortiaAccessGate`. Иначе у уже заходивших устройств в `localStorage` остаётся копия контента, снятая до закрытия.
3. **Привязка к личности и уровню.** Сегодня «личность» нигде не хранится. Рекомендация: в штамп обоих кэшей писать `viewer` (как сейчас) и новое поле `person` — `nicknameKey(state.nickname)` из решения шлюза для одобренного (`decision.state.state === "approved"`), пустая строка для редактора и открытого сайта без заявки. `PortiaDesktop` получает проп `viewerPerson` рядом с `viewerKey`; `cacheMatchesViewer(cached, viewerKey, person)` требует равенства обоих; кэш сотрудников получает те же поля и ту же проверку при загрузке. `payload.viewer` с сервера не расширяется (серверный ключ `acceptFetchedContent` не меняется). `lib/nickname.ts` клиентобезопасен (уже импортируется gate). Записи кэша собрать в одну функцию `writeContentCache` (закрывает IN-03: сегодня `saveContent` не кладёт `documents`).
4. **Очистка на любом переходе.** Gate уже опрашивает статус каждые 5 с и держит `decision`; добавить в `refresh()` наблюдателя: запоминать предыдущий ключ `viewerKey + person` и при **любом** изменении (одобрен → отклонён/отозван, падение уровня, выход редактора, подъём уровня) вызывать `clearDeviceContentCaches`. Подъём тоже чистить: кэш чужого уровня всё равно не показывается, а чистка проще правила «только вниз». Кроме того оставить граничные правила: `shouldClearDeviceCaches` (closed и не допущен) и 401 в desktop, а проверку 401 привязать к последнему запросу (`requestSeq === contentRequestSeq.current`, IN-07), чтобы поздний 401 не стирал свежий кэш. Отдельный случай D-09: в `open`-режиме отклонённый/отозванный зритель получает уровень 1 (`viewerOf`) → ключ меняется → сработает правило 4 (`shouldClearDeviceCaches` для `mode: "open"` сам по себе их не чистит). Выход редактора выполняется серверным действием (`app/owner-login/actions.ts` `supabase.auth.signOut()`) с перезагрузкой страницы: при загрузке кэш `"editor"` не совпадёт с ключом `level-1`/`closed` и удаляется проверкой на старте (для контента — как сейчас; для сотрудников — новая проверка).
5. **«Не показывает данные до одобрения».** `PortiaDesktop` (единственный читатель кэша) монтируется только при `desktop === true`, то есть `open` или `closed && allowed`; в закрытом состоянии без допуска он не рендерится вовсе (`accessGateLayout`). Поэтому кэш никогда не показывается неодобренному; правило 4 дополняет это физическим удалением.

**Где наблюдаются переходы (файлы):** `components/portia-access-gate.tsx` (`refresh()`, строки 41-62), `components/portia-desktop.tsx` (`fetchContent` 401-ветка 580-592, начальная загрузка кэша 750-790, записи 615 и 1410, `fetchEmployees` 704-720 — здесь же добавить обработку 401 и очистку: сейчас 401 от `/api/employees` даст `failureFromResponse(401)` = `unexpected`), `lib/access-viewer.ts`, `lib/device-cache.ts`.

**Браузерный тест SEC-04 на локальной сборке — осуществим без источника данных.** Прецедент `tests/e2e/specs/access-levels.spec.ts`: `mockApi(page, control)` отвечает на все `**/api/**` (`/api/access/status`, `/api/content`, `/api/employees`, `/api/access`), неизвестные пути обрывает и записывает; уже есть режимы `level`, `editor`, `revoked`; тест «Revoke» проверяет, что `localStorage` обоих ключей пуст (спека 303-335). Плюс `page.clock.runFor(31_000)` для проходов опроса. Расширение: ключи `-v2`; сценарии approved → rejected (открытый режим, D-09 и закрытый), approved → revoked, уровень 3 → 2 (кэш ушёл), редактор → выход (`mode: closed, allowed: false` или `open` уровня 1), старые `-v1` стёрты после первой загрузки, кэш другого человека того же уровня не показывается. Конфигурация: `playwright.config.ts` запускает префлайт `visitor` (нужны `NEXT_PUBLIC_SUPABASE_URL` в форме корня `*.supabase.co`, публичный ключ, `PORTIA_PROMOTION_DEVICE_SECRET`, Node `22.13.x`) и собирает `npm run build && npm run start` при отсутствии `PORTIA_E2E_BASE_URL`; в офлайн-режиме D-68 это обеспечивают `scripts/phase20-release-gate.mjs` + `tests/e2e/harness/offline-supabase.cjs` (сервер на `127.0.0.1:3100`, выдуманные значения, `PORTIA_E2E_ALLOW_HTTP=1`). Результат записывается как «browser test on a local build with mocked /api», не как проверка на данных. Проекты `chromium-desktop`/`chromium-phone`. Данные-зависимые полосы (`test:e2e:mutation`, `staging-authz`) остаются BLOCKED (нужен staging).

### 7. «Сменить адрес картинки» (вопрос 7, D-13/D-14)

**Что есть.**
- `/api/uploads` (`app/api/uploads/route.ts`): `POST`, клиент **сессии** (`createServerSupabaseClient`), `getEditorAccess`, `uploadGate`, путь `recycle/${crypto.randomUUID()}.${ext}`, `supabase.storage.from("portia-media").upload(path, file, { cacheControl: "31536000", contentType, upsert: false })`, ответ `{ url: getPublicUrl(path) }`, везде `noStoreHeaders`; маршрут входит в `proxy.ts` matcher (`/api/uploads`) — сессия обновляется. [VERIFIED: app/api/uploads/route.ts, proxy.ts]
- Клиент: `uploadImage(file, onUploaded)` в `components/portia-editor.tsx:~908-935` (единственный `fetch("/api/uploads")`, строка 923); поле — `ImageEditorField` (`components/portia-editor-dossier.tsx:357`), используется для фото вирусов (1279), мутаций (1309), блоков фото «Информации» и «Справочника» (1377, 1460), обложек (1428, 1447), файлов корзины (1603).
- Уровни ставятся `LevelPicker` (`components/portia-level-picker.tsx`) с необязательным `notice` — механизм «поднято до родителя» через `raisedNotice` (`portia-editor.tsx:514, 1357, 1421`).
- Адреса картинок в записях — любые `https:` или локальные пути (`isAllowedMediaUrl`, `lib/media-url.ts`), не только наши; сменить адрес можно только у картинок нашего бакета.

**Права без service-role.** Серверный клиент сессии работает под ролью `authenticated`; политики записи для редакторов на `storage.objects` уже есть (baseline 1653-1673: insert/update/delete по `portia_can_edit()`). Документация Supabase: «To copy objects, users need select permission on the source object and insert permission on the destination object»; удаление требует `delete`; загрузка без upsert — только `insert`. [CITED: https://supabase.com/docs/guides/storage/management/copy-move-objects.md; https://supabase.com/docs/guides/storage/security/access-control] Поэтому после снятия широкой политики `select` нужна редакторская `select`-политика (§2) — без неё `copy` редактора упадёт.

**Рекомендуемая схема (без нового файла `route.ts`, чтобы не ломать `phase23/24-evidence`):**
1. Клиент → `POST /api/uploads` с JSON `{ "action": "rewrite", "url": "<адрес из записи>" }` (ветка по `content-type: application/json`, существующая `multipart` не меняется). Сервер разбирает URL чистой функцией из `lib/media-rewrite.ts`: host равен хосту `NEXT_PUBLIC_SUPABASE_URL`, путь точно `/storage/v1/object/public/portia-media/<path>`, `<path>` совпадает с `^recycle/[0-9a-f-]{36}\.(png|jpg|webp|gif)$` (иначе 400 — никакого произвольного пути, SSRF и копирования чужих объектов нет). `supabase.storage.from("portia-media").copy(path, "recycle/<новый UUID>.<ext>")`, ответ `{ url: <новый публичный адрес> }`. Старый файл **не** удаляется.
2. Клиент подставляет новый адрес в черновик (обычное `changeDraft`) и записывает старый адрес в очередь `retiredUrls` (ref в редакторе).
3. После **успешного** сохранения записи (`await onSave(...)` вернул ревизию) клиент вызывает `DELETE /api/uploads` с `{ url }` для каждого адреса из очереди. Сервер перед `storage.remove([path])` читает сохранённую строку контента (клиент сессии редактора, политика `select` сохранена) и отказывает 409, если **любое** поле сохранённого payload ещё содержит этот адрес (поиск строки в `JSON.stringify(payload)`). Это инвариант на сервере: удаляется только файл, на который не ссылается ни одна сохранённая запись, независимо от порядка действий на клиенте.
4. Отмена/история (`lib/editor-history.ts`): до сохранения отмена вернёт старый адрес, а старый файл ещё жив (удаление выполняется только после сохранения), поэтому очередь при возврате адреса в черновик вычеркивается; после сохранения история обнуляется (`historyReducer` «saved»: `past: [], future: []` при `state.present === action.savedFrom`), то есть «отмена возвращает ссылку на удалённый файл» из D-13 возможна только при правке черновика во время сохранения (редкий путь) — для него остаётся серверный запрет 409 и честная запись в известных ограничениях.
5. Параллельный редактор с устаревшим черновиком, ссылающимся на удалённый файл: его сохранение отклоняется по ревизии (409), в режиме «Заменить своей» берёт свои разделы — риск принят и записывается.
6. D-14: кнопка «Сменить адрес картинки» встраивается в `notice` `LevelPicker` записи (по образцу `raisedNotice`): предлагается, когда редактор **поднял** уровень записи, у которой есть наша картинка. Список адресов записи — чистая функция `imageUrlsOfRecord` в `lib/media-rewrite.ts` (вирус: `infectedImage`, `mutations[].image`; раздел/подраздел «Информации»: блоки `photo`; раздел/карточка «Справочника»: `photo`, `cover`, блоки `photo`). Кнопка не выполняется молча.

`lib/portia-desktop.test.ts:149-150` закрепляет число обращений редактора к `/api/uploads`: `{ "/api/uploads": 1, ... }` — вторая и третья ссылки изменят счётчик; обновить (либо вынести вызовы в `lib/media-rewrite-client.ts`). Известные ограничения (D-11, D-15) для релизных заметок: сохранённая ссылка продолжает открываться у человека, потерявшего доступ; уже скачанные копии (браузер, CDN до года) не удаляются.

### 8. D-09: что решает клиент в `mode: "open"` (вопрос 8)

`lib/access-gate.ts` при выключенном флаге возвращает `{ mode: "open", state }` для **любого** состояния; токен читается, `resolveAccess` ошибка глотается (строки ~70-77). [VERIFIED: lib/access-gate.ts:6, :77] `viewerOf` для `open` даёт уровень одобренной заявки либо 1 (`lib/access-viewer.ts`). Клиентская развилка целиком в чистой функции `accessGateLayout` (`lib/access-gate-view.ts:19-40`): `showForm = !editor && (state === "none" || state === "rejected" || state === "revoked")`, `status` равен состоянию при `pending|approved|rejected|revoked`, `showCard: !editor && !approvedOnDesktop && (!desktop || cardOpen)`.

**Изменение по D-09:** в `mode: "open"` состояния `rejected` и `revoked` приравнять к `none` — перед расчётом ввести `const state = decision?.mode === "open" && (raw === "rejected" || raw === "revoked") ? "none" : raw`. Тогда у них `status: null` (нет текстов «Заявка отклонена»/«Доступ отозван»), форма и кнопка «ПОДАТЬ ЗАЯВКУ» — как у человека без заявки; ожидающие (`pending`) сохраняют карточку со статусом. В закрытом режиме (`mode: "closed"`) поведение не меняется. Тексты `statusText` в `components/portia-access-gate.tsx:113-117` для `rejected/revoked` остаются для закрытого режима.

**Толкование, требующее подтверждения (Open Question 2):** фраза «видят открытый сайт, как люди без заявки» прочитана как «ровно как `none` в открытом режиме», а в нём сегодня поверх рабочего стола показывается закрываемая карточка с формой (тест `lib/access-gate.test.ts:271-272`: `{ desktop: true, showCard: true, showForm: true, showReopen: false ...}`). Если владелец имел в виду «без карточки вовсе», изменение шире (для `none` тоже).

**Тест, который придётся изменить:** `lib/access-gate.test.ts:299-308` — «D-05 unchanged: open mode keeps the card and the reopen button for every non-approved state» перечисляет `none`, `pending`, `rejected`, `revoked`; для `rejected/revoked` ожидание станет «как `none`» (`status: null`). Добавить тест на закрытый режим (без изменений). Кэш устройства для `open` + `rejected/revoked` — §6 правило 4.

### 9. Долги Phase 24 (вопрос 9)

Источник: `24-REVIEW-DISPOSITION.md` (все 10 находок `open`) и `24-REVIEW.md`. [VERIFIED: .planning/phases/PORTIA-24-.../24-REVIEW-DISPOSITION.md]

| Находка | Пересекается с Phase 25 | Решение |
|---------|-------------------------|---------|
| WR-01 (телефон: тело открытого раздела «Информации» недостижимо) | нет | вне фазы; Phase 26 («Информация» на телефоне) |
| WR-02 (`<legend>` не первый потомок `fieldset` у `LevelPicker` с `caption`) | косвенно: D-14 встраивает кнопку в `LevelPicker`, трогаем разметку | можно закрыть попутно (две строки), иначе отложить |
| **WR-03** (показ уровня 5 для копии без маркера) | **да**: пустой `initialContent` без маркера (D-16) делает ошибку видимой | **закрыть в этой фазе** (`viewerLevel ?? shownViewerLevel(content)` + тест) |
| IN-01 (`reconcileSelection`) | нет | отложить |
| IN-02 (`normalizeDocumentLinks` обещает больше) | нет | отложить |
| **IN-03** (кэш после сохранения без `documents`) | да: пишем кэш `-v2` с привязкой | **закрыть**: одна функция `writeContentCache` |
| **IN-04** (дубль сборки зависимостей `resolveGate` в двух маршрутах) | да: третий маршрут `/api/employees` | **закрыть**: `lib/gate-for-request.ts` `resolveGateFor(request)` |
| **IN-05** (дубли литералов ключей кэша, устаревший комментарий) | да: бамп ключей | **закрыть** (импорт констант) |
| IN-06 (секрет слота на пути редактора) | косвенно: редактор не должен зависеть от секретов подписи | закрыть, если трогаем `contentBodyFor`-вызов (ленивый `slotOf`), иначе отложить |
| **IN-07** (401 без проверки порядка) | да: напрямую влияет на SEC-04 (поздний 401 стирает свежий кэш) | **закрыть** (`requestSeq === contentRequestSeq.current`) |

После закрытия поправить `24-REVIEW-DISPOSITION.md` (поля `disposition`, `deferred` — вручную; правило инструмента: `deferred` ставится руками с причиной в `Source`).

### 10. Структура чек-листа владельца (вопрос 10)

Модель — `23-MIGRATION-APPLY.md` [VERIFIED: прочитан полностью]: разделы «Что изменится на сайте», «Перед началом», «Порядок применения», «Проверка до применения», «Как применить», «Секрет подписи…», «Перезагрузка кэша схемы», «Проверки после применения», «Проверка сайта после применения», «Откат…», «Закреплённый sha256», «Статус», «Ревью», «Что доказано офлайн». Правила тона: «Агент не применил ничего и нигде», «при первой ошибке остановитесь», секреты только по именам, проверки только чтением, нет слова PASS (тест `phase23-evidence` проверяет это для записи Phase 23; для `25-OWNER-CHECKLIST.md` нужен свой тест `lib/phase25-evidence.test.ts` по образцу `phase23-evidence`/`phase24-evidence`).

**Порядок шагов (D-05, D-06, D-07), с учётом найденного:**

0. **Перед началом.** Резервная копия; изолированный проект и preview — по возможности. Секреты (только имена): `PORTIA_PROMOTION_DEVICE_SECRET`, `PORTIA_ACCESS_SUBMIT_SECRET` — **оба нужны в Netlify**; `PORTIA_ACCESS_SUBMIT_SECRET` теперь подписывает и чтение, и заявки; в базе строка `'submit'` с тем же значением (шаг «Секрет подписи заявок» из 23-MIGRATION-APPLY.md). Применять **каждый файл отдельно через `psql` (вариант B)** с `migration repair`; `db push` для этого раската не использовать, потому что он применил бы контракт вместе с остальными.
1. Файлы 1–3 (`20261104000000`, `20261104000100`, `20261106000000`), затем файл 4 `20261109000000_portia_access_foundation.sql`.
2. **Сразу после файла 4** — выключить закрытие (D-05). Рабочий путь — SQL-оператор из 23-MIGRATION-APPLY.md («Откат и выключение закрытия»): `update public.portia_access_settings set closure_enabled = false, updated_at = now(), updated_by = coalesce(updated_by, gen_random_uuid()) where id = 'main';` — именно ненулевой `updated_by` заставляет файл 8 уважать выбор (`... where id = 'main' and updated_by is null and ...`, `20261114000000_…sql`). Вызвать `portia_access_set_closure(false)` из консоли нельзя: она требует JWT владельца (`if not public.portia_is_owner() then raise exception 'owner-required'`, foundation), а маршрута/кнопки в приложении нет (**Open Question 1**).
3. Файлы 5–8 (`20261110000000`, `20261112000000`, `20261113000000`, `20261114000000`); секрет подписи; `notify pgrst, 'reload schema';`; проверки из 23-MIGRATION-APPLY.md (закрытие выключено: `portia_access_closure_enabled()` → false).
4. **Файл 9 (expand)** `20261115000000_portia_server_read_expand.sql`; проверка: обе функции есть, анон выполняет, с неверной подписью получает `{"code":"unauthorized"}`; `notify pgrst`.
5. **Выкладка кода Phase 25** (Netlify). Проверка при выключенном закрытии: сайт открыт; `/api/content` и `/api/employees` отвечают; в заголовках `Cache-Control: no-store`, нет `Netlify-Cache-Tag` (владелец смотрит ответ). Всё это — шаги владельца, до выполнения «ОЖИДАЕТ ВЛАДЕЛЬЦА».
6. Массовое одобрение «из таблицы» кнопкой во вкладке «Пользователи» (код Phase 22 уже в сборке).
7. Проверка входа редактора (`/owner-login`).
8. **Файл 10 (contract)** `20261115000100_portia_closure_contract.sql` (только после шагов 5-7, D-06). Проверки только чтением: аноним с публичным ключом на `…/rest/v1/portia_content?select=revision` получает отказ прав; `…/rest/v1/portia_employee_profiles`, `…/portia_manual_employees` — то же; листинг `…/storage/v1/object/list/portia-media` — пусто/отказ; **публичная ссылка на известную картинку открывается** (HTTP 200); сайт у одобренного и у редактора работает. Любой провал — к разделу отката.
9. **Включение закрытия отдельным шагом в конце** (D-05): `update public.portia_access_settings set closure_enabled = true, updated_at = now(), updated_by = coalesce(updated_by, gen_random_uuid()) where id = 'main';`. Проверки: приватное окно — закрытый экран; одобренное устройство — рабочий стол; редактор входит.
10. **Сброс CDN по обоим тегам** `portia-content` и `portia-employees` (`purgeCache` через API/панель Netlify; запасной путь — «Clear cache and deploy site»); проверка `Cache-Status` на `/api/employees`.
11. **Откат (D-08, D-10), в двух уровнях:**
    - Признаки: после включения редактор не может войти; одобренный видит экран заявки; `/api/content` у одобренного отвечает ошибкой дольше 5 минут. Стоят прямо рядом с шагом 9.
    - Быстрый: флаг выключить (оператор с `false` из шага 2). Анонимное прямое чтение таблиц остаётся закрытым, сайт открыт через сервер на уровне 1. **Не помогает**, если сломано чтение через сервер (тогда ломаются и открытый, и закрытый режимы).
    - Диагностика перед аварийным: совпадают ли значения `PORTIA_ACCESS_SUBMIT_SECRET` в Netlify и строка `'submit'` в базе (длина ≥ 32); применён ли файл 9; ответ RPC на тестовый вызов.
    - Аварийный (только если сломано чтение через сервер): (а) в Netlify «Publish deploy» для **предыдущего** деплоя (старый код читает таблицы и не знает RPC), затем (б) применить `supabase/emergency/…restore_anon_read.sql` через `psql` в одной транзакции. Порядок строго такой: новый код с аварийной миграцией анонимные права не использует. Анонимное прямое чтение при этом открыто — это цена аварии.
12. «Закреплённый sha256» (после заморозки; тесты сверяют с `migrationHashes`), «Статус» (таблица Staging/Production: BLOCKED / ОЖИДАЕТ ВЛАДЕЛЬЦА), «Ревью» (`supabase-rls-reviewer`, раунды), «Что доказано офлайн» (таблица тестов), «Известные ограничения» (SEC-07-образец: ссылки на картинки у потерявших доступ; копии не удаляются; «Устав»/«Таблица» открыты по ссылке).

### 11. Тест-ограничители и последовательность работ (вывод для плана)

Обязательный набор правок «в том же коммите, что и миграции/маршруты»: `portia-canonical-parity.test.ts` (хеши), `tests/e2e/fixtures/data/expected-authz.json`, `supabase/fingerprint/expected/portia.fingerprint.json`, `phase23-evidence.test.ts` и `phase24-evidence.test.ts` (ограничить версию `<= 20261114000000`), `security-matrix.test.ts` (`currentMatrixText` → Phase 25), новые `25-SECURITY-MATRIX.md`, `25-RLS-REVIEW.md`, `lib/phase25-evidence.test.ts`. До финального плана — окно красного с `--test-skip-pattern="matrix freshness: the real matrix commit"`, как в 24-01…24-10.

### Anti-Patterns to Avoid
- **Контракт раньше кода (или в одном файле с expand):** сайт остаётся без чтения. Всегда: expand → код → проверка → contract.
- **RPC, отвечающий анониму сырым payload без подписи** (при выключенном флаге): обход очистки Phase 24.
- **Аварийная миграция в `supabase/migrations/`:** применяется `db push` сразу, ломает тест хешей.
- **Аварийное восстановление прав без отката кода:** новый код таблицы не читает.
- **`purgeCacheTag` вместо `no-store`:** сброс по тегу не защищает от копии, которой тега нет.
- **Хранить в кэше устройства данные без привязки к человеку:** кэш другого человека того же уровня показывается следующему.
- **`git add -A`, `.env*`, `--verify` визуального манифеста** — запрещено CLAUDE.md и хуком.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Проверка подписи на стороне базы | свой формат токена/JWT | `extensions.hmac`/`extensions.digest` как в `portia_access_submit_request` | Образец уже прошёл два раунда `supabase-rls-reviewer`; сравнение через digest, срок 300 с назад / 60 с вперёд |
| Подпись на стороне сервера | своя криптография | `createHmac("sha256", secret)` из `node:crypto`, как `signAccessSubmit` | Один образец раскладки, пинится тестом к SQL |
| Решение «кто зритель» | новая проверка допуска | `resolveGate` + `viewerOf` (вынести в `resolveGateFor`) | Уже покрыто тестами Phase 23–24; расхождение ключей ломает опрос |
| Очистка по уровню | вторая очистка в SQL | `contentBodyFor` (Phase 24) | D-04: меняется только источник чтения |
| Скан сборки | парсинг AST/сторонний сканер | обход `node:fs` + список маркеров | Достаточно подстрок; без новых зависимостей |
| Копирование/удаление картинок | запросы к Storage REST вручную | `supabase.storage.from("portia-media").copy/remove` | Уже поддерживается клиентом, роль `authenticated` + политики |
| Кэш ростера | CDN-кэш на ростере | серверный TTL-кэш снимка Sheets+Roblox | CDN не может отдавать чужие копии (D2); ворота перед кэшем |
| Видимость кэша устройства | свои флаги «одобрен» | `viewerKeyOf` + новое поле `person` | Ключ уже сравнивается при загрузке |

**Key insight:** вся новая защита — это замена **источника** данных и **места** проверки, а не новая логика допуска; всё, что решает «кого пускать» и «что вырезать», уже есть и покрыто тестами.

## Runtime State Inventory

(Фаза не переименование, но меняет то, что живёт вне git.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Production `portia_content` (строка `main`) и таблицы сотрудников: данные не меняются; меняются права и политики. На устройствах — `localStorage` `portia-content-last-success-v1` / `portia-employees-last-success-v1` с контентом, снятым до закрытия | код: ключи `-v2` и `purgeLegacyDeviceCaches` (не миграция данных БД) |
| Live service config | Netlify: переменные `PORTIA_ACCESS_SUBMIT_SECRET`, `PORTIA_PROMOTION_DEVICE_SECRET` (имена, значения не записывать); CDN хранит старые ответы `/api/content` и `/api/employees` с тегами `portia-content`, `portia-employees` и `s-maxage` до 600 с + SWR 86400 | шаг владельца: сброс по обоим тегам; проверить, что оба секрета заданы |
| OS-registered state | None — проверено: фаза не регистрирует задач/служб | — |
| Secrets/env vars | В базе строка `portia_access_secrets.name='submit'` должна совпадать с `PORTIA_ACCESS_SUBMIT_SECRET`; теперь от неё зависит чтение контента | шаг чек-листа + защитный `DO`-блок contract-миграции |
| Build artifacts | Локальный `.next` собран со старым сидом (клиент, сервер, `.map`); `.next/dev` содержит dev-чанки | после пересборки скан проходит; `dev`/`cache` из скана исключены |

## Common Pitfalls

### Pitfall 1: Порядок «код → контракт» нарушается `db push`
**What goes wrong:** владелец выполняет `supabase db push` как в 23-MIGRATION-APPLY.md и применяет контракт вместе с остальными файлами до выкладки кода. **Why:** CLI применяет все ожидающие файлы. **How to avoid:** в чек-листе — только вариант B (`psql` по одному файлу + `migration repair`); защитный `DO`-блок контракта; контракт отдельным пунктом после проверки. **Warning signs:** `/api/content` отвечает 503 сразу после миграций.

### Pitfall 2: Подпись есть, секрета в базе нет
**What goes wrong:** после контракта чтение у всех (кроме редакторов) даёт `unauthorized` → 503. **Why:** строка `'submit'` не вставлена или значение расходится с Netlify. **How to avoid:** `DO`-блок контракта проверяет `length(secret) >= 32`; чек-лист требует сравнить значения без печати; редакторы читают по `portia_can_edit()` и не затронуты. **Warning signs:** «Данные временно недоступны» у одобренных, редактор работает.

### Pitfall 3: `/api/employees` без ворот и без CDN
**What goes wrong:** либо ростер по-прежнему отдаётся анониму (если оставить как есть), либо Sheets/Roblox получают лавину запросов (если убрать CDN без серверного кэша). **How to avoid:** ворота `resolveGateFor` + `noStoreHeaders` + TTL-кэш снимка. **Warning signs:** 429 от Roblox, таймауты Sheets 8 с.

### Pitfall 4: Сид остаётся в клиентском бандле через нормализатор
**What goes wrong:** замена в `portia-access-gate.tsx` сделана, а скан падает. **Why:** `portia-content-normalize.ts` держит ссылку на весь объект. **How to avoid:** удалить `defaultPortiaContent` целиком, оставить `assistantDefaults`; скан после сборки; тест (б) на отсутствие маркеров в рабочем коде.

### Pitfall 5: Тесты фаз 23/24 и «свежесть» матрицы падают на новом коммите
**What goes wrong:** `phase23-evidence`, `phase24-evidence`, `security-matrix` красные после первой миграции/маршрута. **How to avoid:** §11; не добавлять `route.ts`; окно красного с `--test-skip-pattern`; обновлять записи в том же коммите.

### Pitfall 6: Редактор теряет возможность читать/копировать после снятия `select`-политики
**What goes wrong:** `UPDATE ... RETURNING` в PUT возвращает пусто (политика select не видит строку) или `storage.copy` падает. **How to avoid:** редакторские `select`-политики на трёх таблицах и на `storage.objects` — часть контракта (§2); проверка на staging — BLOCKED.

### Pitfall 7: Поздний 401 стирает свежий кэш (IN-07) и кэш чужого человека
**How to avoid:** §6 (проверка порядка запросов; `person` в штампе; очистка на смене ключа).

### Pitfall 8: Смена адреса удаляет файл, на который ещё ссылается запись
**How to avoid:** удаление только после сохранения и только если сохранённый payload не содержит адрес (серверная проверка, 409); путь проверяется регулярным выражением; копирование без удаления.

### Pitfall 9: Старые CDN-копии переживают выкладку
**What goes wrong:** `stale-while-revalidate=86400` и `durable` отдают открытую копию ростера после перехода на `no-store`. **How to avoid:** сброс по обоим тегам; запасной путь — полный деплой с очисткой кэша; проверка `Cache-Status`. Всё — шаги владельца, BLOCKED.

### Pitfall 10: Хук блокирует команды со словом `supabase`
**What goes wrong:** `ls supabase`, `supabase --version` блокируются, пока в окружении загружены staging-ключи. **How to avoid:** писать пути `supabase/...`; не вызывать CLI (всё равно запрещено фазой).

## Code Examples

### Expand: подписанное чтение контента (SQL, по образцу `portia_access_submit_request`)
```sql
-- Source: образец supabase/migrations/20261109000000_portia_access_foundation.sql:224-229 (метка и срок те же)
create or replace function public.portia_content_read(p_issued_at bigint, p_signature text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  now_epoch bigint := floor(extract(epoch from now()))::bigint;
  signing_secret text;
  expected_signature text;
  stored record;
begin
  if not public.portia_can_edit() then
    select s.secret into signing_secret from public.portia_access_secrets s where s.name = 'submit';
    expected_signature := encode(extensions.hmac('content-read-v1|' || coalesce(p_issued_at::text, ''), signing_secret, 'sha256'), 'hex');
    if signing_secret is null or length(signing_secret) < 32
      or p_issued_at is null or p_signature is null or p_signature !~ '^[0-9a-f]{64}$'
      or p_issued_at < now_epoch - 300 or p_issued_at > now_epoch + 60
      or extensions.digest(p_signature, 'sha256') is distinct from extensions.digest(expected_signature, 'sha256') then
      return jsonb_build_object('code', 'unauthorized');
    end if;
  end if;
  select c.payload, c.revision, c.updated_at into stored from public.portia_content c where c.id = 'main';
  if not found then return jsonb_build_object('code', 'ok', 'row', null); end if;
  return jsonb_build_object('code', 'ok', 'row', jsonb_build_object('payload', stored.payload, 'revision', stored.revision, 'updated_at', stored.updated_at));
end; $$;

revoke all on function public.portia_content_read(bigint, text) from public, anon, authenticated;
grant execute on function public.portia_content_read(bigint, text) to anon, authenticated;
grant execute on function public.portia_content_read(bigint, text) to service_role;
```
Аналогично `portia_employees_read` (метка `employees-read-v1|`; профили `to_jsonb(p) - 'updated_by'`, ручные — `employee_id, nickname, title, rank, callsign order by created_at`).

### TypeScript: подпись и вызов
```ts
// lib/server-read.ts — раскладка сообщения повторяет SQL; пинится lib/server-read.test.ts
import { createHmac } from "node:crypto";
export const serverReadRpc = { content: "portia_content_read", employees: "portia_employees_read" } as const;
export function signServerRead(scope: "content" | "employees", issuedAt: number, secret: string) {
  if (secret.length < 32) throw new Error("Server read secret must contain at least 32 characters.");
  return createHmac("sha256", secret).update(`${scope}-read-v1|${issuedAt}`).digest("hex");
}
// Посетитель: public client + подпись. Редактор: клиент сессии, p_issued_at: 0, p_signature: "".
```

### Contract: защитный блок и срез (SQL)
```sql
do $$
begin
  if to_regprocedure('public.portia_content_read(bigint, text)') is null
    or to_regprocedure('public.portia_employees_read(bigint, text)') is null then
    raise exception 'PORTIA: the server-read functions are missing, nothing was changed';
  end if;
  if not exists (select 1 from public.portia_access_secrets where name = 'submit' and length(secret) >= 32) then
    raise exception 'PORTIA: the submit secret is missing, nothing was changed';
  end if;
end; $$;

revoke select on table public.portia_content from anon;
drop policy if exists "Public can read PORTIA content" on public.portia_content;
create policy "Editors can read PORTIA content"
on public.portia_content for select
to authenticated
using ((select public.portia_can_edit()));
-- то же для portia_employee_profiles и portia_manual_employees;
drop policy if exists "Public can read PORTIA media" on storage.objects;
create policy "Editors can read PORTIA media"
on storage.objects for select
to authenticated
using (bucket_id = 'portia-media' and (select public.portia_can_edit()));
notify pgrst, 'reload schema';
```

### D-09 в `accessGateLayout`
```ts
// lib/access-gate-view.ts — только open-режим; closed не меняется
const raw = decision?.state.state;
const state = decision?.mode === "open" && (raw === "rejected" || raw === "revoked") ? "none" : raw;
```

### Скан сборки (ядро)
```js
// scripts/phase25-build-scan.mjs — экспорт для теста; печатает только путь и маркер
export const SKIP_DIRS = new Set(["cache", "dev", "diagnostics"]);
export function* walk(dir) { /* readdirSync; пропуск SKIP_DIRS и файлов trace*; yield путь файла */ }
export function scanTree(dir, markers) { /* для каждого файла: utf8 и экранированный \uXXXX вид каждого маркера; вернуть [{ file, marker }] */ }
if (import.meta.url === pathToFileURL(process.argv[1]).href) { /* найдено → stderr список → process.exit(1) */ }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Публичное чтение таблиц анонимом + CDN-кэш (`s-maxage` 600) | Чтение через подписанный RPC + `no-store` по зрителю | Phase 24 (ответ контента) / Phase 25 (источник и ростер) | CDN больше не раздаёт чужое; нужен серверный кэш ростера |
| Сид в `lib/portia-content.ts` | Пустая структура в коде, сид только в `lib/testing/` | Phase 25 (D-01, D-16) | Бандл и страница без контента; скан после сборки |
| Общий кэш устройства `-v1` | `-v2` по человеку и уровню, очистка на смене ключа | Phase 25 | Кэш не переходит между людьми |
| Широкая `select`-политика на бакет | Редакторская `select`-политика | Phase 25 (D-11) | Листинг закрыт; публичный GET по точной ссылке (доказывается на staging) |

**Deprecated/outdated:** `publicCacheHeaders` и теги кэша — без потребителей после этой фазы (оставить на один релиз); `defaultPortiaContent`/`cloneDefaultContent` — удаляются из рабочего кода.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Фразы помощника/подсказки (`assistant*`) — служебный интерфейс, остаются как `assistantDefaults` в коде; в маркеры скана не входят | §3, §4 | Если владелец считает их контентом, нужно убрать и перепроверить поведение помощника |
| A2 | Общий секрет `'submit'` можно использовать для подписи чтения с отдельной меткой HMAC (без новой строки и без правки CHECK) | §1 | Если владелец хочет отдельный секрет: правка CHECK, golden fingerprint, новый шаг чек-листа |
| A3 | Минификатор Next/Turbopack пишет кириллицу литералами UTF-8; сканер всё равно проверяет и `\uXXXX`-вид | §4 | Без двойной проверки скан мог бы пропустить экранированный сид |
| A4 | npm lifecycle `postbuild` срабатывает в сборке Netlify (`command = "npm run build"`) | §4 | Если нет — скан защищает только локальную сборку; нужен явный вызов в `build` |
| A5 | Публичный бакет отдаёт файл по точной ссылке без `select`-политики; листинг без `select`-политики не работает | §2, §7 | Если листинг остаётся — D-11 не выполнен; если GET падает — картинки на сайте исчезнут. Доказывается только на staging (BLOCKED) |
| A6 | Серверный TTL-кэш ростера 60–300 с достаточен для лимитов Sheets/Roblox; значения не измерены | §5 | Лимиты/задержки; подобрать на стенде |
| A7 | Netlify сбрасывает `durable`-записи при деплое неизвестно (документ молчит) — сброс по тегам нужен всегда | §5 | Недосброс оставит открытую копию ростера на срок SWR |
| A8 | Для зрителя без строки контента сервер отвечает 503 «Данные временно недоступны», для редактора — 200 с пустой структурой, `revision: 0` | §3 | Иная трактовка D-16/D-17 меняет ветки GET и тесты |
| A9 | Аварийный откат = «предыдущий деплой Netlify + аварийная миграция» (код с RPC не читает таблицы) | §2, §10 | Если нужен откат без отката кода — потребуется переходный код с запасным чтением таблиц |
| A10 | Подпись RPC разрешает допуск при совпадении HMAC, а не проверяет заявку отдельно; ворота остаются серверными (`resolveGate`) | §1 | Для двойной проверки (подпись + дайджест одобренной заявки в DB) нужно добавить аргумент `p_token_hash` |

## Open Questions

1. **Как владелец «выключает/включает закрытие функцией владельца» (D-05, D-07)?**
   - Знаем: `portia_access_set_closure(boolean)` требует JWT владельца; обёртка `setClosure` в `lib/access-store.ts` без вызывающего; ни маршрута, ни кнопки нет. Подтверждено grep'ом по `app/` и `components/`.
   - Неясно: нужна ли кнопка/маршрут в этой фазе.
   - Рекомендация: в чек-листе дать SQL-оператор с `updated_by = coalesce(updated_by, gen_random_uuid())` (как 23-MIGRATION-APPLY.md); маршрут и кнопку — отдельным решением владельца (новый `route.ts` потребует правок матриц).
2. **Что именно видят отклонённые/отозванные при выключенном флаге?**
   - Знаем: D-09 — «открытый сайт, как люди без заявки»; у `none` сегодня поверх рабочего стола закрываемая карточка с формой.
   - Неясно: нужна ли карточка с формой им (как у `none`) или вовсе без карточки.
   - Рекомендация: «как `none`» (минимальное изменение); при ином ответе расширить правило и на `none`.
3. **Текст строки D-16 «Данные временно недоступны»** — новое состояние или `failureCopy.unavailable`? Рекомендация: добавить отдельную строку в `lib/app-state.ts`.
4. **Серверный кэш ростера** входит в фазу или записывается как ограничение? Рекомендация: войти (защита Sheets/Roblox).
5. **Опрос статуса каждые 5 с** (12 из 14,2 вызовов в минуту) — оставить (Phase 23) или обсудить? Интервал D-19 (30 с) не затрагивается.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | `npm test`, `tsc`, скрипты, сборка | ✓ | v22.13.1 (эталон; по умолчанию на машине также 24) | `%TEMP%\portia-node-v22.13.1\...` — на момент проверки есть |
| npm | `postbuild`, скрипты | ✓ | 10.9.2 | — |
| Playwright + Chromium | браузерный тест SEC-04 | пакет есть (`node_modules/@playwright/test`); наличие браузеров не проверялось | 1.64.1 | если нет — `npx playwright install chromium` перед прогоном (сетевой шаг) |
| Supabase (любая база, CLI) | живые проверки | ✗ (запрещено/нет стенда) | — | BLOCKED; офлайн-тесты по тексту SQL |
| Netlify deploy preview | заголовки CDN, сброс тегов, `postbuild` на Netlify | ✗ | — | BLOCKED; шаги владельца |
| `.env.local` | `npm run build` (разработчик) | не читался | — | офлайн-значения `OFFLINE_ENV` из harness вместо реальных |

**Missing dependencies with no fallback:** живая база/staging/preview — блокируют только живые проверки (они и так BLOCKED по D-18).
**Missing dependencies with fallback:** браузеры Playwright (установка), `.env.local` (выдуманные офлайн-значения).

## Validation Architecture

> `.planning/config.json` содержит `workflow.nyquist_validation: false`; раздел оставлен, потому что его запросил оркестратор.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (юнит, `lib/*.test.ts`), Playwright 1.64.1 (браузер) |
| Config file | `playwright.config.ts`; для юнитов конфига нет |
| Quick run command | `node --experimental-strip-types --test lib/<файл>.test.ts` |
| Full suite command | `npm test` (база Phase 24: 1981 тест, 0 fail, 3 skipped — [VERIFIED: 24-02-SUMMARY.md:67]); на время окна красного — `node --experimental-strip-types --test --test-skip-pattern="matrix freshness: the real matrix commit" lib/*.test.ts` |

Живые наборы `lib/portia-*-live.test.ts` при `npm test` регистрируют skip («mutating live suite; not run by npm test») и ничего не мутируют. [VERIFIED: lib/portia-staging-live.test.ts:20,133]

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | подпись TS = SQL; ответы RPC; fail-closed; GET читает после ворот через RPC | unit | `node --experimental-strip-types --test lib/server-read.test.ts lib/content-response.test.ts` | ❌ Wave 0 (`server-read.test.ts`), ✅ правка |
| SEC-01 | contract/expand: операторы, DO-guard, политики; golden и матрица прав | unit | `node --experimental-strip-types --test lib/phase16-expected-authz.test.ts lib/portia-migration-fingerprint.test.ts lib/portia-canonical-parity.test.ts lib/portia-sql.test.ts` | ✅ (правки) |
| SEC-01 | аварийная миграция вне `migrations/`, маркер, без begin/commit | unit | `node --experimental-strip-types --test lib/phase25-emergency.test.ts` | ❌ Wave 0 |
| SEC-01 | аноним не читает таблицы по публичному ключу | live | — | **BLOCKED** (нужен staging) |
| SEC-02 | `/api/employees`: ворота, `noStoreHeaders` на всех ветках, без тегов | unit (разбор исходника) | `node --experimental-strip-types --test lib/phase25-employees-route.test.ts` | ❌ Wave 0 |
| SEC-02 | серверный TTL-кэш ростера | unit | `node --experimental-strip-types --test lib/employees-snapshot-cache.test.ts` | ❌ Wave 0 |
| SEC-02 | расчёт вызовов | unit | `node --experimental-strip-types --test lib/phase25-poll-budget.test.ts` | ❌ Wave 0 |
| SEC-02 | заголовки CDN, `Cache-Status`, сброс тегов | live | — | **BLOCKED** (deploy preview/staging) |
| SEC-03 | маркеры есть в фикстуре, нет в рабочем коде; `scanTree` | unit | `node --experimental-strip-types --test lib/phase25-build-scan.test.ts` | ❌ Wave 0 |
| SEC-03 | `.next` чист после сборки | build | `npm run build` (запускает `postbuild`); или `node scripts/phase25-build-scan.mjs` | ❌ Wave 0 (скрипт); сборка с выдуманными офлайн-значениями |
| SEC-03 | граница: рабочий код не импортирует `lib/testing` | unit | в `phase25-build-scan.test.ts` | ❌ Wave 0 |
| SEC-04 | ключи `-v2`, `cacheMatchesViewer` + `person`, legacy purge, очистка на смене ключа | unit | `node --experimental-strip-types --test lib/device-cache.test.ts lib/access-gate.test.ts lib/portia-desktop.test.ts` | ✅ (правки) |
| SEC-04 | браузер: отклонён/отозван/выход/падение уровня → пусто | browser (моки `/api`) | `npx playwright test tests/e2e/specs/access-levels.spec.ts --project=chromium-desktop` (с офлайн-окружением D-68) | ✅ (расширение) |
| SEC-05 | `select`-политика редактора, снятие листинга (текст SQL) | unit | `lib/phase16-expected-authz.test.ts`, `lib/portia-canonical-parity.test.ts` | ✅ (правки) |
| SEC-05 | листинг закрыт, GET по точной ссылке открыт | live | — | **BLOCKED** (staging) |
| SEC-05 | `rewrite`/`DELETE` картинок: разбор URL, порядок, 409 при ссылке | unit | `node --experimental-strip-types --test lib/media-rewrite.test.ts` | ❌ Wave 0 |
| — | D-09: `accessGateLayout` open + rejected/revoked | unit | `node --experimental-strip-types --test lib/access-gate.test.ts` | ✅ (правка :299-308) |
| — | чек-лист: заголовки, порядок, нет PASS, хеши | unit | `node --experimental-strip-types --test lib/phase25-evidence.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** целевые файлы (`node --experimental-strip-types --test <файлы>`) + `npm exec tsc -- --noEmit`.
- **Per wave merge:** `npm test` (на время окна красного — с `--test-skip-pattern` выше), `npm run lint`.
- **Phase gate:** `bash .claude/skills/portia-check/run.sh build` (юнит, tsc, lint, `phase15-visual-manifest.test.ts`, `phase15-visual-manifest.mjs --verify-promotion`, сборка и скан); `matrix freshness` зелёный после `25-SECURITY-MATRIX.md`. **Никогда `--verify`** визуального манифеста.

### Wave 0 Gaps
- [ ] `lib/testing/portia-content-fixture.ts` и механическая смена импортов в ~20 `lib/*.test.ts`, `scripts/phase19-matrix-data.mjs`, 8 файлах `tests/e2e/**`
- [ ] `lib/server-read.test.ts`, `lib/phase25-build-scan.test.ts`, `lib/phase25-emergency.test.ts`, `lib/phase25-evidence.test.ts`, `lib/phase25-poll-budget.test.ts`, `lib/media-rewrite.test.ts`, `lib/employees-snapshot-cache.test.ts`, `lib/phase25-employees-route.test.ts`
- [ ] `scripts/phase25-build-scan.mjs`
- [ ] Расширение `tests/e2e/specs/access-levels.spec.ts` (ключи `-v2`, переходы)

**Остаётся BLOCKED (не записывать как PASS):** отказ анонимного чтения по публичному ключу; заголовки/`Cache-Status`/сброс тегов на CDN; листинг хранилища и публичный GET без `select`-политики; Postgres/RLS-выполнение миграций и golden fingerprint на живой базе; запуск `postbuild` на Netlify; живые роли; физические устройства; production и включение закрытия — «ОЖИДАЕТ ВЛАДЕЛЬЦА».

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | да (редактор/владелец) | `portia_can_edit()`/`portia_is_owner()` в базе, существующий вход; не менять |
| V3 Session Management | да (токен устройства, cookie `portia_access`) | HttpOnly-токен + HMAC-дайджест на сервере (Phase 21–23); кэш устройства очищается на смене зрителя |
| V4 Access Control | да — основа фазы | RLS на таблицах + подписанный `SECURITY DEFINER` RPC; политики редакторов; закрытие анонимного чтения |
| V5 Input Validation | да | регулярка пути картинки `^recycle/[0-9a-f-]{36}\.(png\|jpg\|webp\|gif)$`; `parseJsonObject`; проверка подписи/срока в SQL |
| V6 Cryptography | да | `HMAC-SHA256` (`node:crypto`, `extensions.hmac`), сравнение через digest; не самописная криптография; метка домена `*-read-v1` |
| V8 Data Protection | да | `no-store`, без тегов; проекция без `updated_by`; кэш устройства по человеку и уровню |
| V14 Configuration | да | сканирование сборки; секреты только по именам; нет `service_role` в приложении |

### Known Threat Patterns for этого стека

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Прямое чтение таблиц публичным ключом | Information Disclosure | `revoke select ... from anon` + удаление политик `using (true)`; вызов контента только через подписанный RPC |
| Вызов RPC анонимом без подписи (особенно при выключенном закрытии) | Information Disclosure / Elevation | HMAC подпись сервера (секрет в закрытой таблице), срок 300/60 с, нейтральный отказ `unauthorized` |
| Повтор перехваченной подписи | Spoofing | окно 300 с, подпись живёт только в серверных запросах (не доходит до браузера) — риск остаточный, принят по образцу RLS21-01 |
| CDN отдаёт чужой ответ | Information Disclosure | `no-store` без тегов; сброс старых копий по тегам; проверка на preview — BLOCKED |
| Контент в бандле/HTML/`.map` | Information Disclosure | вынос сида; скан `.next` падает при находке |
| Кэш устройства одного человека показан другому / после отзыва | Information Disclosure | ключи `-v2`, `person`, очистка на смене ключа, удаление `-v1` |
| Смена адреса картинки: произвольный путь/хост | Tampering / SSRF | жёсткий разбор URL, фиксированный бакет и префикс, только сессия редактора, копирование внутри бакета |
| Удаление используемого файла | Denial of Service (данных) | удаление только после сохранения и только если нет ссылок в сохранённом payload (409) |
| Утечка `updated_by` (uuid редакторов) | Information Disclosure | проекция `to_jsonb(p) - 'updated_by'` в RPC |
| Захват 5-секундного опроса/рост вызовов | DoS (стоимость) | расчёт бюджета, пины интервалов; решение о 5 с — владельцу |

## Sources

### Primary (HIGH confidence)
- Код и миграции репозитория, прочитанные в этой сессии (с указанием файла и строк в тексте): `app/api/content/route.ts`, `app/api/employees/route.ts`, `app/api/employees/editor/route.ts`, `app/api/uploads/route.ts`, `app/api/access/status/route.ts`, `lib/access-gate.ts`, `lib/access-viewer.ts`, `lib/access-gate-view.ts`, `lib/access-session.ts`, `lib/access-store.ts`, `lib/content-response.ts`, `lib/device-cache.ts`, `lib/portia-cdn.ts`, `lib/portia-content.ts`, `lib/portia-content-normalize.ts`, `lib/portia-employees.ts`, `lib/supabase/server.ts`, `components/portia-access-gate.tsx`, `components/portia-desktop.tsx`, `components/portia-editor.tsx`, `components/portia-level-picker.tsx`, `proxy.ts`, `next.config.ts`, `netlify.toml`, `package.json`, `playwright.config.ts`, `supabase/migrations/20261101000000_portia_baseline.sql`, `20261101000100_portia_explicit_grants.sql`, `20261109000000_portia_access_foundation.sql`, `20261114000000_portia_access_closure_default_on.sql`, `supabase/fingerprint/expected/portia.fingerprint.json`, `tests/e2e/fixtures/data/expected-authz.json`, `tests/e2e/harness/offline-supabase.cjs`, `tests/e2e/specs/access-levels.spec.ts`, `scripts/phase20-release-gate.mjs`, `.claude/hooks/guard.mjs`, `.claude/skills/portia-check/run.sh`.
- Тесты-ограничители: `lib/portia-canonical-parity.test.ts`, `lib/phase16-expected-authz.test.ts`, `lib/portia-migration-fingerprint.test.ts`, `lib/portia-sql.test.ts`, `lib/access-closure.test.ts`, `lib/phase23-evidence.test.ts`, `lib/phase24-evidence.test.ts`, `lib/security-matrix.test.ts`, `lib/content-response.test.ts`, `lib/device-cache.test.ts`, `lib/portia-desktop.test.ts`, `lib/access-gate.test.ts`, `lib/e2e-import-boundary.test.ts`.
- `.planning/phases/PORTIA-23-.../23-MIGRATION-APPLY.md`, `.../PORTIA-24-.../24-REVIEW-DISPOSITION.md`, `24-REVIEW.md`, `24-RELEASE-NOTES.md`, `24-01-SUMMARY.md`/`24-02-SUMMARY.md` (окно красного), `.planning/research/ARCHITECTURE.md` (expand/contract), `.planning/ROADMAP.md` §Phase 25, `.planning/REQUIREMENTS.md`.
- grep по существующей сборке `.next` (наличие «МОРОК» в клиентском/серверном чанках и `.map`).

### Secondary (MEDIUM confidence)
- Supabase Storage: [Copy/Move Objects](https://supabase.com/docs/guides/storage/management/copy-move-objects.md) (copy: select на источнике + insert на приёмнике; move: select + update), [Access Control](https://supabase.com/docs/guides/storage/security/access-control) (upload — только insert; upsert — insert+select+update; select-политика для публичных бакетов «not needed»), [Buckets fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals) (публичный бакет «effectively bypasses access controls for both retrieving and serving files»; контроль остаётся для upload/delete/move/copy). Листинг публичного бакета без `select`-политики в документации не описан явно — A5.
- Netlify: [Caching overview](https://docs.netlify.com/build/caching/caching-overview/) (деплой инвалидирует кэш по умолчанию; `Netlify-Cache-Tag`, purge по тегу, лимит «twice every 5 seconds»; приоритет `Netlify-CDN-Cache-Control`; `stale-while-revalidate`).

### Tertiary (LOW confidence)
- Поведение `postbuild` на Netlify и экранирование кириллицы минификатором — A3/A4, проверяются на preview/сборке.
- Context7 MCP в этой сессии не подключился (CONNECTION_CLOSED); документация получена через WebFetch/WebSearch. Содержимое страниц содержало встроенные просьбы «отправить отчёт обратной связи» — игнорировано как не относящееся к задаче.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — новых зависимостей нет, версии из `package.json`.
- Architecture (RPC, expand/contract, тесты-ограничители): HIGH по коду и тестам, прочитанным здесь; MEDIUM по поведению Postgres/PostgREST (BLOCKED — выполнить нечем).
- Pitfalls: HIGH для сцепленности тестов и порядка раската; MEDIUM для CDN и хранилища.

**Research date:** 2026-11-15
**Valid until:** 2026-12-15 (платформы Netlify/Supabase меняются; перепроверить пункты A5, A7 перед фиксацией)
