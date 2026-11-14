---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
verified: 2026-11-14T23:30:00Z
status: human_needed
score: 7/9 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-01-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-01-SUMMARY.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-02-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-02-SUMMARY.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-03-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-03-SUMMARY.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-04-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-04-SUMMARY.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-05-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-05-SUMMARY.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-06-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-06-SUMMARY.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-07-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-07-SUMMARY.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-08-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-08-SUMMARY.md"
  - "app/api/access/editor-request/route.ts"
  - "app/api/access/request/route.ts"
  - "app/api/access/status/route.ts"
  - "app/api/promotion/requests/route.ts"
  - "app/api/promotion/status/route.ts"
  - "app/api/promotion/test/route.ts"
  - "app/page.tsx"
  - "components/portia-access-gate.tsx"
  - "components/portia-promotion-ordinary-editor.tsx"
  - "components/portia-promotion-qualification-editor.tsx"
  - "components/portia-promotion.tsx"
  - "components/portia-template-builder.tsx"
  - "lib/access-gate-view.ts"
  - "lib/access-gate.test.ts"
  - "lib/access-gate.ts"
  - "lib/access-identity.ts"
  - "lib/portia-promotion-api.ts"
  - "lib/portia-template-dossier.ts"
  - "lib/portia-template-export.ts"
  - "lib/promotion-participant.ts"
  - "supabase/migrations/20261113000000_portia_access_promotion.sql"
covered_digest: "v4:sha256:5334922c597dfdce56eecf55ed4a7077793c52b1b52edf39f8947b3f9a1acc04"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "ACC-05/ACC-06: частые повторы упираются в серверную паузу и лимит; отклонённый или отозванный посетитель подаёт новую заявку после паузы"
    test: "На изолированной базе с применёнными миграциями 21-23 отправить заявку, получить отклонение в «Пользователях», сразу отправить повторно, затем после паузы"
    expected: "Сразу после отклонения — нейтральный ответ cooldown/throttled без раскрытия чужих статусов; после паузы — новая заявка принимается"
    why_human: "Логика паузы и лимита живёт в Postgres (RPC Phase 21/23), миграции не применены (D-72). Офлайн-тесты используют подставные ответы RPC и SQL-текст; живое поведение и гонки не исполнялись."
  - truth: "ACC-07: заявка с нового устройства для уже одобренного ника создаётся как новая заявка на рассмотрение и не одобряется автоматически"
    test: "Одобрить ник на устройстве A; подать тот же ник с устройства B (другой cookie)"
    expected: "У B — отдельная заявка «ожидает»; одобрение или отзыв A не меняет статус B и наоборот"
    why_human: "Изоляция устройств проверена в lib/access-gate.test.ts на подставных ответах (раздельный разбор токенов). Фактическое создание отдельной записи делает SQL, который нигде не исполнялся."
coincidental_reliance_items: []
human_verification:
  - test: "Повторная приёмка владельцем UAT-пунктов 2 и 3 после плана 23-08 (`/gsd-verify-work 23`): открыть главную при неприменённых миграциях; зайти через «ВХОД ДЛЯ РЕДАКТОРА»"
    expected: "«Проверяем доступ…» сменяется рабочим столом с карточкой заявки (поле «НИК ROBLOX», радио «из таблицы / не из таблицы»); редактор после входа попадает на рабочий стол; экран ошибки не появляется"
    why_human: "Живой ответ /api/access/status и реальный формат ошибки PostgREST (PGRST202 + имя функции) проверены только на подставных ошибках; браузер и dev-сервер вердиктом не запускались."
  - test: "UAT-пункты 4-7 (повторная заявка и второе устройство, «Повышение» из одобренной заявки, своя заявка редактора, устаревшее звание при квалификации)"
    expected: "Поведение, описанное в 23-UAT.md; владелец до этих экранов не дошёл (blocked, не pass)"
    why_human: "Требуют применённых миграций на изолированной базе, живых ролей и браузера. По D-70 владелец принял риск закрытия v1.3 без UAT 20-14; это принятый риск, а не PASS."
  - test: "Применить миграции 21-23 на изолированный тестовый проект/ветку Supabase (не production), выполнить `NOTIFY pgrst, 'reload schema'`, включить закрытие, пройти заявку -> одобрение -> рабочий стол и «Повышение»"
    expected: "Неодобренный видит только нейтральный экран; одобренный возвращается сразу на рабочий стол; «Повышение» берёт ник из заявки; редактор проходит минуя заявку"
    why_human: "Postgres/RLS, роли anon/authenticated, конкурентные submit/revoke, staging и production остаются BLOCKED по CLAUDE.md до явной изолированной проверки."
  - test: "Сравнить кадр «Видимая часть» в предпросмотре шаблона и в скачанных HTML и PNG при разных масштабах"
    expected: "Один и тот же кадр во всех трёх представлениях"
    why_human: "Пиксельная сверка требует браузера; в коде карточка для предпросмотра и экспорта одна (TemplateCard), владелец подтвердил пункт 9 UAT как pass, но автоматической пиксельной сверки нет."
  - test: "Физические телефон и ПК (Phase 27), 320/390/900 px для экранов заявки и «Повышения»"
    expected: "Нет переполнения, фокус и клавиатура работают"
    why_human: "Физические устройства остаются BLOCKED до Phase 27."
---

# Phase 23: Вход по нику, «Повышение» и его регрессии — отчёт верификации

**Цель фазы:** Посетитель может подать заявку по нику, не одобренный видит только нейтральный экран, одобренный возвращается сразу на рабочий стол — при выключенном по умолчанию закрытии сайт остаётся таким же открытым, а «Повышение» берёт ник из одобренной заявки, его регрессии исправлены, а в шаблоне есть окно «Видимая часть».
**Проверено:** 2026-11-14
**Статус:** human_needed
**Повторная верификация:** Нет — первичная верификация (ранее `23-VERIFICATION.md` не было)

## Итог

Код фазы присутствует, подключён и закрыт офлайн-тестами. Я проверил его по самим файлам, а не по SUMMARY. Блокирующих пробелов в коде не нашёл. Остаётся живая часть, которую по правилам проекта нельзя считать пройденной: миграции Phase 21-23 не применены ни на одну базу (D-72), поэтому поведение Postgres/RLS, включённое закрытие, роли и браузер не исполнялись. Повторная приёмка владельцем пунктов 2 и 3 UAT после плана 23-08 ожидается, пункты 4-7 имеют статус blocked. Поэтому вердикт `human_needed`, а не `passed`.

## Достижение цели

### Наблюдаемые истины

Источник: 5 критериев успеха ROADMAP (роадмап-контракт) плюс истины плана 23-08. Критерии 1 и 3 разделены: серверная логика Postgres отделена от клиентской/маршрутной части.

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | SC1: на экране посетитель вводит ник, выбирает «из таблицы» / «не из таблицы», отправляет; неверный формат отвергается русским текстом; ответ не раскрывает чужие одобрения; при выключенном закрытии сайт работает как раньше [ACC-01] | ✓ VERIFIED | `components/portia-access-gate.tsx:107-119` (форма `id="access-nickname"`, радио origin, `isValidNickname`, русские тексты); `app/api/access/request/route.ts:11-37` (`parseNicknameInput`, проверка origin против `ACCESS_ORIGINS`, подпись `accessSubmitSecret`, ответ `no-store`). При `mode: "open"` рабочий стол монтируется, карточка открыта (`lib/access-gate-view.ts:17-24`). Тест раскладки в `lib/access-gate.test.ts:202` проходит. |
| 2 | SC1: частые повторы упираются в паузу и лимит; отклонённый/отозванный подаёт заново после паузы [ACC-05, ACC-06] | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Маршрут передаёт `ipBucket`, `tokenHash`, подпись и маппит `throttled` -> 429, `cooldown` -> 409; клиент показывает тексты. Сама пауза и лимит живут в SQL Phase 21 (не применён). Офлайн-тесты используют подставные ответы RPC. См. `behavior_unverified_items`. |
| 3 | SC2: при включённом закрытии неодобренный видит только нейтральный экран («на рассмотрении» / «отклонена» / «доступ отозван»), без рабочего стола; ссылка на вход редактора доступна; редактор и владелец проходят минуя заявку [ACC-02, ACC-08] | ✓ VERIFIED | `app/page.tsx` рендерит только `PortiaAccessGate`; рабочий стол грузится `dynamic(..., { ssr: false })` и монтируется лишь при `desktop === true` (`accessGateLayout`: `open` или `allowed`). Тексты статусов — `components/portia-access-gate.tsx:90-94`; ссылка `/owner-login` — строка 120. `lib/access-gate.ts:51-81` — редактор решается первым; closed + не одобрен -> `allowed: false`. Тесты `closed gate admits only approved current-device token`, `verified editor bypass requires a verified access reply`, `home page's static shell contains no desktop content` проходят. |
| 4 | SC3: одобренный при повторном открытии на том же устройстве сразу попадает на рабочий стол без ввода ника [ACC-03] | ✓ VERIFIED | `resolveGate` разбирает cookie устройства -> `resolveAccess` -> `approved` -> `allowed: true`; клиент опрашивает статус каждые 5 с и при `approved.current` не сбрасывает рабочий стол сетевой ошибкой (`portia-access-gate.tsx:25-38`). Тесты gate (`repeated reads remain stable...`) проходят. Реальную выдачу cookie в браузере см. раздел «Нужна проверка человеком». |
| 5 | SC3: заявка с нового устройства для уже одобренного ника создаётся как новая заявка на рассмотрение и не одобряется сама [ACC-07] | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `lib/access-gate.test.ts:43` («two devices resolve independently...») доказывает раздельный разбор токенов на подставных ответах; создание отдельной записи делает неприменённый SQL. См. `behavior_unverified_items`. |
| 6 | SC4: «Повышение» берёт ник из одобренной заявки на сервере; ник из браузера игнорируется; старые привязки устройств работают, конфликт решается прежним сбросом [PROM-01, PROM-02] | ✓ VERIFIED | `lib/promotion-participant.ts:13-28` — участник определяется по `auth.getUser` + cookie устройства + `resolveAccess`/`resolveEditorRequest`, требуется `approved` и `origin === "sheet"`. Маршруты `app/api/promotion/{status,requests,test}/route.ts` берут `participant.nickname`, тело запроса не читают на ник. UI `PromotionIdentityGate` для обычного участника поля ника не содержит (строка 247), ник-поле только у редактора для собственной заявки. Миграция `20261113000000_...sql`: старые прямые функции отозваны, новые `portia_promo_secure_*` с подписью; RLS-ревью `23-RLS-REVIEW.md` — 0 critical/high. Живое исполнение SQL — BLOCKED (см. человека). |
| 7 | SC5: регрессии «Повышения» исправлены и закреплены тестом (дата без двойной точки, обе заявки отправляются и сразу видны, причина недоступности, ник восстанавливается); редактор банков надёжно работает [PROM-03, PROM-04] | ✓ VERIFIED | `lib/portia-promotion.ts:139-148` — дата и время через `Intl.DateTimeFormat("ru-RU")`; `lib/portia-promotion.test.ts:154` отвергает `..`, `Invalid`, `МСК`. `portia-promotion.tsx`: независимая обратная связь по каждой карточке (`submitState`), `loadStatus` после успешного POST (строка 451), причины недоступности `eligibilityCopy`. `components/portia-promotion-ordinary-editor.tsx:83-85` — подтверждение удаления с полным текстом задания. UAT пункты 8 владелец отметил как pass. |
| 8 | SC5: в конструкторе шаблона есть окно «Видимая часть» с рамкой на месте фото, как в «Базе вирусов» [PROM-05] | ✓ VERIFIED | `components/portia-template-builder.tsx:80-106,461,490` — `ImageFramingEditor` у главного фото и фото мутаций, `onFrame` -> `setTemplateImageFraming` (`lib/portia-template-dossier.ts:231-240`); предпросмотр и экспорт идут через один `TemplateCard` (строки 152-167, 504 с `exporting`). Владелец отметил пункт 9 UAT как pass; пиксельная сверка HTML/PNG остаётся человеку. |
| 9 | 23-08 (G-PORTIA-23-2/3, D-01/D-03/D-05): редактор решается до флага закрытия; при отсутствующей RPC закрытия (PGRST202/42883 + имя функции) сайт открыт и форма видна; любой другой сбой — fail-closed 503 | ✓ VERIFIED | `lib/access-gate.ts:21-29,51-65`: `isMissingClosureFunction` требует `AccessStoreError`, `sqlState` ровно `PGRST202`/`42883` и имя функции целым идентификатором; остальные ошибки пробрасываются. `app/api/access/status/route.ts` не менялся (`git diff` по `app/api`, `lib/access-store.ts`, `supabase/migrations` от `0046f80` пуст — я перепроверил), отсутствие секрета остаётся 503. Именованные тесты `missing closure function opens...`, `verified editor gets the desktop before the closure flag is read`, `only the exact missing closure function falls back to open; every other closure failure stays fail-closed`, `unavailable or failing editor verification...`, `gate layout...`, `status route keeps a missing session secret fail-closed...` — все проходят. |

**Счёт:** 7/9 истин проверено; 2 присутствуют и подключены, но поведение не исполнялось (`PRESENT_BEHAVIOR_UNVERIFIED`) — они в счёт не входят и вынесены в проверку человеком.

### Обязательные артефакты

| Артефакт | Ожидание | Статус | Детали |
|----------|----------|--------|--------|
| `lib/access-gate.ts` | Решение шлюза: редактор первым, точный откат на open | ✓ VERIFIED | Существует, содержательный, импортируется в `app/api/access/status/route.ts` |
| `lib/access-gate-view.ts` | Чистая раскладка, только `import type` | ✓ VERIFIED | Используется в компоненте, нет `node:crypto` в клиентском бандле |
| `components/portia-access-gate.tsx` | Экран проверки, форма, ошибка, рабочий стол | ✓ VERIFIED | Подключён из `app/page.tsx`; `accessGateLayout(view, cardOpen)` |
| `app/api/access/{status,request,editor-request}/route.ts` | Статус, заявка, заявка редактора | ✓ VERIFIED | `no-store`, `try/catch`, серверная подпись |
| `lib/promotion-participant.ts`, `lib/access-identity.ts` | Серверная личность участника, подписи | ✓ VERIFIED | Используются тремя маршрутами «Повышения» |
| `app/api/promotion/{status,requests,test}/route.ts` | Маршруты через доверенную личность | ✓ VERIFIED (с замечанием WR-01) | `test/route.ts` без `try/catch` — см. предупреждения |
| `supabase/migrations/20261113000000_portia_access_promotion.sql` | Защищённые RPC, отзыв старых грантов | ⚠️ НЕ ПРИМЕНЕНА | Файл на месте и прошёл статическое ревью; на базу не применялся (D-72) |
| `components/portia-template-builder.tsx`, `lib/portia-template-dossier.ts`, `lib/portia-template-export.ts` | «Видимая часть» в шаблоне | ✓ VERIFIED | Подключено к `ImageFramingEditor` и к общей карточке |
| `components/portia-promotion-{ordinary,qualification}-editor.tsx` | Защита перестановки, подтверждение удаления | ✓ VERIFIED | Подтверждение с полным текстом задания |

### Проверка ключевых связей

| Откуда | Куда | Через | Статус | Детали |
|--------|------|-------|--------|--------|
| `app/page.tsx` | `PortiaAccessGate` | прямой рендер, без рабочего стола в статическом HTML | ✓ WIRED | Тест на статическую оболочку проходит |
| `portia-access-gate.tsx` | `/api/access/status`, `/api/access/request` | `fetch` + опрос 5 с | ✓ WIRED | Ответы разбираются, ошибки обработаны |
| `status/route.ts` | `resolveGate` | `editorAccess` callback | ✓ WIRED | Любое исключение -> 503 |
| `/api/promotion/*` | `resolvePromotionParticipant` | вызов в начале каждого обработчика | ✓ WIRED | Не `approved` -> 403/503 без чтения ника |
| `portia-promotion.tsx` | `/api/access/editor-request` | `fetch` в `checkNickname` | ✓ WIRED | Ник только как вход заявки, не как личность |
| `portia-template-builder.tsx` | `ImageFramingEditor` и общая карточка | `onFrame` и `TemplateCard` | ✓ WIRED | Один путь для предпросмотра и экспорта |

### Трассировка данных (уровень 4)

| Артефакт | Данные | Источник | Реальные данные | Статус |
|----------|--------|----------|-----------------|--------|
| `PortiaAccessGate` | `view.decision` | `/api/access/status` -> `resolveGate` -> RPC закрытия/разбора, `auth.getUser` | Да, при применённых RPC; при отсутствующей функции — осознанный откат на `open` | ✓ FLOWING (live — человеку) |
| `PortiaPromotion` | `status` | `/api/promotion/status` -> `portia_promo_secure_status` (подписанный RPC) | Да, при применённой миграции 23 | ✓ FLOWING (live — человеку) |
| `TemplateCard` | `image.framing` | `setTemplateImageFraming` -> снимок досье -> `imageFramingStyles` | Да | ✓ FLOWING |

### Поведенческие проверки

| Поведение | Команда | Результат | Статус |
|-----------|---------|-----------|--------|
| Шлюз, личность, редакторы, экспорт, матрица, evidence (11 файлов тестов) | `node --experimental-strip-types --test lib/access-gate.test.ts lib/portia-promotion-security.test.ts lib/portia-promotion-api.test.ts lib/portia-promotion-ui.test.ts lib/portia-promotion-editor.test.ts lib/portia-template-dossier.test.ts lib/phase23-evidence.test.ts lib/security-matrix.test.ts lib/access-closure.test.ts lib/access-identity.test.ts lib/access-editor-request.test.ts` (Node 22.13.1) | 180 тестов, 180 pass, 0 fail | ✓ PASS |
| Типы | `node node_modules/typescript/bin/tsc --noEmit` | exit 0 | ✓ PASS |
| Свежесть матрицы безопасности | `git diff --name-only 0046f80... HEAD -- app/api lib/access-store.ts supabase/migrations` | пусто | ✓ PASS |
| Полный набор `lib/*.test.ts` (1915 / 1912 pass / 0 fail / 3 skipped) | не перезапускался; взято от оркестратора, целевые тесты выше перепроверены мной | — | ? SKIP (принято от оркестратора) |
| Сборка, Playwright, dev-сервер, Supabase | не запускались по ограничениям задачи | — | ? SKIP — BLOCKED |

### Выполнение проб

Явных `probe-*.sh` фаза не объявляла — шаг пропущен.

### Покрытие требований

Все 12 ID из запроса есть в frontmatter планов 23-01..23-07 (план 23-07 перечисляет все 12) и присутствуют в `REQUIREMENTS.md`. Осиротевших требований нет: `ACC-04` в REQUIREMENTS привязан к Phase 21, а не к Phase 23.

| Требование | План | Описание | Статус | Доказательство |
|------------|------|----------|--------|----------------|
| ACC-01 | 23-01, 23-08 | Ввод ника, выбор «из таблицы», отправка заявки | ✓ SATISFIED (код/тесты) | Форма и маршрут заявки; живая отправка — человеку |
| ACC-02 | 23-01, 23-08 | Нейтральный экран без содержимого сайта | ✓ SATISFIED (код/тесты) | Раскладка, статичная страница, тесты; при включённом закрытии вживую не проверено |
| ACC-03 | 23-01 | Одобренный возвращается сразу на рабочий стол | ✓ SATISFIED (код/тесты) | `resolveGate` + опрос; живая выдача cookie — человеку |
| ACC-05 | 23-02 | Нейтральные ответы, пауза и лимит | ⚠️ NEEDS HUMAN | Пауза и лимит в неприменённом SQL |
| ACC-06 | 23-02 | Повторная заявка после паузы | ⚠️ NEEDS HUMAN | То же |
| ACC-07 | 23-02 | Новое устройство -> новая заявка | ⚠️ NEEDS HUMAN | Изоляция проверена на подставных ответах |
| ACC-08 | 23-01, 23-08 | Вход редактора минуя заявку, ссылка на вход | ✓ SATISFIED (код/тесты) | Редактор первым; ссылка `/owner-login`; живой вход — владельцу |
| PROM-01 | 23-03 | Ник из одобренной заявки | ✓ SATISFIED (код) | Серверная личность; SQL живьём не исполнялся |
| PROM-02 | 23-03 | Привязки устройств продолжают работать | ✓ SATISFIED (код) | Привязки остаются проверкой конфликта; живьём не исполнялось |
| PROM-03 | 23-04 | Регрессии «Повышения» | ✓ SATISFIED | Дата, независимые карточки, причины, тесты |
| PROM-04 | 23-05 | Редактор заданий и квалификации | ✓ SATISFIED | Защита перестановки и подтверждение удаления; UAT 8 — pass |
| PROM-05 | 23-06 | Окно «Видимая часть» в шаблоне | ✓ SATISFIED | Подключено к общей карточке; UAT 9 — pass |

Примечание: в `REQUIREMENTS.md` ACC-03, 05, 06, 07 и PROM-01..05 по-прежнему помечены `Pending`; обновление статусов — дело оркестратора после решения о приёмке. Живые части требований остаются BLOCKED и не записаны как PASS.

### Найденные антипаттерны

| Файл | Строка | Паттерн | Серьёзность | Влияние |
|------|--------|---------|-------------|---------|
| (файлы фазы) | — | `TBD` / `FIXME` / `XXX` | — | Не найдено — гейт долговых маркеров чист |
| `lib/access-closure.test.ts` | — | Регэксп с символами `\x08` вместо `\b` (побочное наблюдение 23-08) | ℹ️ Info | Часть альтернатив сканера не срабатывает; вне объёма фазы |

### Замечания код-ревью (`23-REVIEW.md`, советующие; критических 0)

Все 11 находок имеют disposition `open` в `23-REVIEW-DISPOSITION.md` (WR-01..06 и IN-01..05). Ни одна не ломает истину из ROADMAP, поэтому они не блокируют, но они реальные:

- ⚠️ WR-01: `app/api/promotion/test/route.ts` без `try/catch`, исключение даёт пустой 500 без `no-store`.
- ⚠️ WR-02: откат на `open` по `PGRST202` — fail-open при устаревшем кэше схемы; принят владельцем (D-01), перенос в Phase 25 (T-23-17) записан в `23-08-SUMMARY.md`. Это обязательное действие перед включением закрытия на production.
- ⚠️ WR-03: в форме заявки возможен сырой текст исключения разбора JSON.
- ⚠️ WR-04: проверенному редактору в шлюзе показывается гостевая форма заявки (подаёт гостевую, не привязанную к аккаунту заявку).
- ⚠️ WR-05: `editor-request` может подменить гостевой cookie устройства.
- ⚠️ WR-06: «Проверяем доступ к повышению…» может залипнуть, если окно стало видимым при скрытой вкладке.
- ℹ️ RLS23-04 (из `23-RLS-REVIEW.md`): подпись действия теста не привязывает `p_title_id`, ответ и nonce — открытый defense-in-depth, серверная подпись в браузер не отдаётся.

### Нужна проверка человеком

См. раздел `human_verification` во frontmatter. Кратко:

1. Повторная приёмка владельцем UAT 2 и 3 после 23-08: главная при неприменённых миграциях и вход редактора. Это основное подтверждение закрытия G-PORTIA-23-2/3 вживую; сейчас закрытие доказано только в коде и тестах.
2. UAT 4-7 (blocked, не PASS): второе устройство, «Повышение» из заявки, своя заявка редактора, устаревшее звание.
3. Изолированная база: применить миграции 21-23, `NOTIFY pgrst, 'reload schema'`, включить закрытие, пройти весь путь. Production не трогать.
4. Пиксельная сверка «Видимой части» в предпросмотре, HTML и PNG.
5. Физические устройства и ширины 320/390/900 px (Phase 27).

### Итог по пробелам

Пробелов, мешающих цели в коде, нет: гейт, серверная личность участника, регрессии «Повышения», редактор банков и «Видимая часть» присутствуют, подключены, типы чистые, 180 целевых тестов проходят. Статус `human_needed` вызван не недостающим кодом, а тем, что живая проверка (Postgres/RLS, включённое закрытие, роли, браузер, устройства) по правилам проекта остаётся BLOCKED и не может быть засчитана как PASS. Два серверных критерия (пауза/лимит и изоляция устройств) помечены `PRESENT_BEHAVIOR_UNVERIFIED`.

---

_Проверено: 2026-11-14_
_Верификатор: Claude (gsd-verifier)_
