---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
verified: 2026-11-15T12:00:00Z
status: human_needed
score: 15/20 must-haves verified
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
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-09-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-09-SUMMARY.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-10-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-10-SUMMARY.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-11-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-11-SUMMARY.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-12-PLAN.md"
  - ".planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-12-SUMMARY.md"
  - "app/api/access/editor-request/route.ts"
  - "app/api/access/request/route.ts"
  - "app/api/access/status/route.ts"
  - "app/api/promotion/requests/route.ts"
  - "app/api/promotion/status/route.ts"
  - "app/api/promotion/test/route.ts"
  - "app/page.tsx"
  - "app/portia.css"
  - "components/portia-access-gate.tsx"
  - "components/portia-promotion-ordinary-editor.tsx"
  - "components/portia-promotion-qualification-editor.tsx"
  - "components/portia-promotion.tsx"
  - "components/portia-template-builder.tsx"
  - "lib/access-closure.test.ts"
  - "lib/access-gate-view.ts"
  - "lib/access-gate.test.ts"
  - "lib/access-gate.ts"
  - "lib/access-identity.ts"
  - "lib/access-request-reply.test.ts"
  - "lib/access-request-reply.ts"
  - "lib/phase23-evidence.test.ts"
  - "lib/portia-canonical-parity.test.ts"
  - "lib/portia-migration-fingerprint.test.ts"
  - "lib/portia-promotion-api.ts"
  - "lib/portia-template-dossier.ts"
  - "lib/portia-template-export.ts"
  - "lib/promotion-participant.ts"
  - "lib/style-tokens.test.ts"
  - "supabase/migrations/20261113000000_portia_access_promotion.sql"
  - "supabase/migrations/20261114000000_portia_access_closure_default_on.sql"
covered_digest: "v4:sha256:b18c79611839096f8a5d364921b4d46f82bbf63c0e6fc5c5dc202436dc9cdd02"
behavior_unverified: 4
overrides_applied: 1
overrides:
  - must_have: "SC (ROADMAP, цель фазы): при выключенном по умолчанию закрытии сайт остаётся таким же открытым"
    reason: "Решение владельца 2026-11-14 (ответы 1a/2a/3a, gap G-PORTIA-23-4, D-01 override note в 23-CONTEXT.md): сайт закрыт для всех, чья заявка не одобрена; закрытие включено по умолчанию; без миграций гость видит закрытый экран с формой заявки; миграции владелец применяет сам (D-72). Режим open остаётся только как состояние, в которое сайт переводит владелец."
    accepted_by: "владелец проекта"
    accepted_at: "2026-11-14T00:00:00Z"
re_verification:
  previous_status: human_needed
  previous_score: 10/14
  gaps_closed:
    - "G-PORTIA-23-3-r2 (кодовая часть): одобренному посетителю на рабочем столе карточка доступа не показывается; один раз на устройство появляется уведомление «Доступ подтверждён» в стиле квеста"
    - "G-PORTIA-23-3-log (кодовая часть): каждый ответ unauthorized маршрута POST /api/access/request пишет одну константную строку console.error"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "ACC-05/ACC-06: частые повторы упираются в серверную паузу и лимит; отклонённый или отозванный посетитель подаёт новую заявку после паузы"
    test: "На базе владельца с применёнными миграциями отправить заявку, получить отклонение в «Пользователях», сразу отправить повторно, затем после паузы"
    expected: "Сразу после отклонения нейтральный ответ cooldown/throttled без раскрытия чужих статусов; после паузы новая заявка принимается"
    why_human: "Пауза и лимит живут в Postgres (RPC Phase 21/23). Офлайн-тесты используют подставные ответы RPC и текст SQL; агент к базе не подключался. В 23-UAT.md владелец записал pass по тесту 4, но это запись владельца, а не проверка агента."
  - truth: "ACC-07: заявка с нового устройства для уже одобренного ника создаётся как отдельная заявка на рассмотрение и не одобряется автоматически"
    test: "Одобрить ник на устройстве A; подать тот же ник с устройства B (другой cookie)"
    expected: "У B отдельная заявка «ожидает»; решение по A не меняет статус B и наоборот"
    why_human: "Изоляция устройств проверена в lib/access-gate.test.ts на подставных ответах; отдельную запись создаёт SQL, который агент не исполнял. Запись владельца (UAT 4 pass) не заменяет проверку агента."
  - truth: "Решение владельца 3a: после применения миграции 20261114000000 закрытие включено по умолчанию (default true, строка main = true, функция отвечает true)"
    test: "Выполнить проверки 5 и 8 из 23-MIGRATION-APPLY.md после применения всех восьми файлов и NOTIFY pgrst"
    expected: "portia_access_closure_enabled() = true; closure_enabled = true и never_toggled = true; column_default = true; POST на rpc/portia_access_closure_enabled отвечает true, а не PGRST202"
    why_human: "Состояние базы возникает только при исполнении SQL; по данным оркестратора миграции 20261113 и 20261114 владелец ещё не применил (23-MIGRATION-APPLY.md). Текст миграции, эталонный отпечаток и sha256 сверены офлайн, но это не выполнение."
  - truth: "23-12 / G-PORTIA-23-3-r2: уведомление «Доступ подтверждён» показывается один раз после одобрения, не накладывается на другие уведомления, закрывается × и Escape, а карточка «Заявка на доступ» справа сверху у одобренного исчезает"
    test: "Повторить UAT test 3 в браузере: одобрить заявку, открыть сайт на одобренном устройстве; нажать × или Escape; перезагрузить; отдельно проверить момент, когда одновременно приходит уведомление о квесте"
    expected: "Рабочий стол без карточки доступа; одно короткое уведомление в стиле квеста с бирюзовым акцентом; после перезагрузки уведомления нет; два уведомления не лежат друг на друге, один Escape не закрывает оба (WR-09); после отзыва и нового одобрения поведение понятно (WR-08)"
    why_human: "Чистая раскладка и claimApprovedNotice проверены тестами с поведением. Но связка компонента (claim в refresh(), условие показа, Escape) проверяется только поиском подстрок в исходниках (IN-13), а вид и наложение (одинаковые position/top/right у .quest-toast, app/portia.css:605) видны только в браузере. UAT test 3 после 23-12 не повторялся."
coincidental_reliance_items: []
human_verification:
  - test: "Повторная приёмка владельцем UAT test 3 в браузере (`/gsd-verify-work 23`, test 3) после 23-12"
    expected: "Одобренное устройство открывает рабочий стол без карточки справа сверху; один раз показывается уведомление «Доступ подтверждён», закрывается × и Escape; после перезагрузки уведомления нет; ожидание, отказ и отзыв показывают прежние экраны; редактор не видит гостевую карточку"
    why_human: "Браузер и вид уведомления агент не запускал. От этой проверки зависит приёмка ACC-03. Это шаг владельца со статусом ОЖИДАЕТ ВЛАДЕЛЬЦА, а не PASS."
  - test: "Применить миграции 20261113000000 и 20261114000000 (и убедиться, что предыдущие шесть применены) по 23-MIGRATION-APPLY.md на свою базу, затем проверки 1-9 из раздела «Проверки после применения»"
    expected: "8 версий в истории; закрытие включено по умолчанию; права anon/authenticated как в записи; кэш PostgREST отвечает true на closure RPC"
    why_human: "Postgres/RLS, роли, секрет и кэш схемы исполняет только владелец (D-72). Результаты в GSD не записаны как пройденные; шлюз schema-drift в этом запуске пропущен решением владельца."
  - test: "Необязательно: проверить строку тревоги в логе сервера при неверном PORTIA_ACCESS_SUBMIT_SECRET (агент `.env*` не читает)"
    expected: "На каждый ответ unauthorized одна строка «PORTIA access request unauthorized: …»; клиент получает прежний 503 и общий текст формы"
    why_human: "Реальный отказ подписи возможен только с настоящей базой и секретом; в юнит-тесте проверена константная строка на настоящих submitAccessRequest и подписи."
  - test: "Решить, чинить ли WR-08 и WR-09 до закрытия фазы или принять как известные (в 23-REVIEW-DISPOSITION.md обе open)"
    expected: "Решение владельца: исправить (план 23-13 или правка в Phase 25) либо принять с записью причины"
    why_human: "Это продуктовое решение: WR-08 меняет смысл «один раз на устройство» (повторное одобрение проходит молча), WR-09 меняет расположение уведомления."
  - test: "Сравнить кадр «Видимая часть» в предпросмотре шаблона и в скачанных HTML и PNG при разных масштабах"
    expected: "Один и тот же кадр во всех трёх представлениях"
    why_human: "Пиксельная сверка требует браузера; владелец отметил UAT 9 как pass."
  - test: "Физические телефон и ПК (Phase 27): 320/390/900 px для экранов заявки, уведомления и «Повышения»"
    expected: "Нет переполнения, фокус и клавиатура работают"
    why_human: "Физические устройства остаются BLOCKED до Phase 27."
---

# Phase 23: Вход по нику, «Повышение» и его регрессии — отчёт верификации (повторная, после 23-12)

**Цель фазы (ROADMAP, с поправкой владельца):** Посетитель может подать заявку по нику, не одобренный видит только нейтральный экран, одобренный возвращается сразу на рабочий стол; «Повышение» берёт ник из одобренной заявки, его регрессии исправлены, а в шаблоне есть окно «Видимая часть». Оговорка «при выключенном по умолчанию закрытии сайт остаётся таким же открытым» отменена владельцем (см. override).
**Проверено:** 2026-11-15
**Статус:** human_needed
**Повторная верификация:** Да, после плана 23-12 (коммиты `51b06ae..3e0f51b`, ревью `8837430`, `90a4a24`)

## Итог

Блокеров в коде не нашёл. Предыдущий отчёт не содержал `gaps:` (статус `human_needed`), поэтому я проверил 23-12 полностью, а прежние истины 1-14 пересчитал регрессионно: файлы фазы, кроме восьми файлов 23-12, не менялись (`git diff --stat d98723e..HEAD -- app lib components` показывает ровно 8 файлов, миграций в диффе 0), а полный набор тестов проходит.

Что я проверил сам, а не по SUMMARY:

- `lib/access-gate-view.ts`: `accessGateLayout` теперь отдаёт `approvedNotice`. Для одобренного не-редактора с открытым рабочим столом (закрытый режим с `allowed` или открытый режим) при любом `cardOpen` получается `desktop=true`, `showCard=false`, `showReopen=false`, `showForm=false`, `approvedNotice=true`. Условие монтирования стола не менялось. Тест `gate layout: an approved visitor on an open desktop…` перебирает оба `cardOpen` и оба режима; тесты none/pending/rejected/revoked/error/checking и редактора фиксируют прежние значения с `approvedNotice: false`.
- `claimApprovedNotice`: проверено поведенческим тестом на подставных хранилищах. Первый вызов true и запись `"1"`, повтор false, ошибка `storage()`, чтения или записи даёт false. В хранилище пишется только `"1"`.
- `components/portia-access-gate.tsx`: `refresh()` забирает уведомление один раз за страницу (ref) и один раз за устройство (хранилище); тост рендерится при `noticeOpen && layout.approvedNotice`; `aside` с `portia-dialog quest-toast access-approved-toast` без `role`, строка `sr-only` с `role="status"`, ×, Escape (с исключениями для полей ввода, `contentEditable`, открытого `dialog`), автофокуса и таймера нет. CSS: две строки модификатора в `app/portia.css:619-620`.
- `lib/access-request-reply.ts` и `app/api/access/request/route.ts`: `reportAccessSubmit(result)` вызывается после каждого ответа RPC, пишет ровно одну константную строку только для `unauthorized`; в функцию попадает только код ответа, поэтому ник, token hash, IP bucket, подпись и секрет не могут оказаться в строке. Карта статусов `accessSubmitStatus` повторяет прежнюю, условие `Set-Cookie` не тронуто; ответ клиенту прежний (503, тело `{code: "unauthorized"}`). Тест `unauthorized submit is logged once per reply…` использует настоящие `submitAccessRequest` и подпись.
- Ревью и матрица: `23-RLS-REVIEW.md` содержит раунд 3 с `Reviewed commit: 7cb8702c51b50332d8687f21e58bd94ed71ee005` и итогом «открытых critical 0, открытых high 0»; `23-SECURITY-MATRIX.md` ссылается на тот же commit, `lib/access-request-reply.ts` в охвате. Тесты свежести матрицы и `phase23-evidence` входят в полный набор и зелёные. Само ревью запускал оркестратор через агента (только чтение); я его не повторял, это статический обзор, живой Postgres/RLS не исполнялся.
- Агент не менял SQL: `git diff --name-only d98723e..HEAD | grep -c migrations` равен 0.

Статус `human_needed`, а не `passed`: приёмка ACC-03 после 23-12 ожидает повторного UAT владельца (test 3), связка уведомления в компоненте проверена только подстроками, а исполнение SQL, роли, закрытие по умолчанию вживую, браузер и устройства по правилам проекта остаются BLOCKED / ОЖИДАЕТ ВЛАДЕЛЬЦА.

## Замечание о записях UAT владельца

В `23-UAT.md` владелец записал pass по тестам 1, 2, 4-9 и issue по тесту 3 (косметическая: уведомление, ныне закрытое кодом 23-12). Эти записи принимаю как свидетельство владельца, но не как проверку агента: в них сказано, что миграции 21-23 были применены, тогда как по данным оркестратора миграции 20261113 и 20261114 ещё ждут применения (`23-MIGRATION-APPLY.md`). Какая именно база стояла под UAT, из репозитория не установить. Поэтому ACC-05, ACC-06, ACC-07 и «закрытие по умолчанию» остаются PRESENT_BEHAVIOR_UNVERIFIED, а не VERIFIED.

## Достижение цели

### Наблюдаемые истины

Источник: 5 критериев успеха ROADMAP, истины планов 23-08..23-11 и должностные истины 23-12 (`must_haves` в `23-12-PLAN.md`).

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | SC1 [ACC-01]: посетитель вводит ник, выбирает «из таблицы» / «не из таблицы», отправляет; неверный формат отвергается русским текстом; ответ не раскрывает чужие одобрения | ✓ VERIFIED | `components/portia-access-gate.tsx` (форма `access-nickname`, радио, `isValidNickname`); `app/api/access/request/route.ts` (проверка ника и origin, 400 с русским текстом); тесты шлюза и маршрута проходят |
| 2 | SC1 [ACC-05, ACC-06]: частые повторы упираются в серверную паузу и лимит; отклонённый/отозванный подаёт заявку после паузы | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Маршрут передаёт `ipBucket`, `tokenHash`, подпись и маппит `throttled` в 429, `cooldown` в 409; пауза и лимит живут в SQL, который агент не исполнял |
| 3 | SC2 [ACC-02, ACC-08]: при включённом закрытии неодобренный видит только нейтральный экран, без рабочего стола; ссылка на вход редактора есть | ✓ VERIFIED | `accessGateLayout`: `desktop` только для `open` или `allowed`; `error` и `checking` стол не монтируют; ссылка `/owner-login` в карточке; тесты раскладки |
| 4 | SC3 [ACC-03]: одобренный при повторном открытии на том же устройстве сразу попадает на рабочий стол без ввода ника | ✓ VERIFIED (код/тесты; живая выдача cookie у человека) | `resolveGate` даёт `allowed: true` для `approved`; клиент опрашивает статус каждые 5 с; раскладка для одобренного даёт `desktop=true`. Приёмка в браузере после 23-12 вынесена в истину 17 и человеческую проверку |
| 5 | SC3 [ACC-07]: заявка с нового устройства для уже одобренного ника создаётся как новая заявка на рассмотрение | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Раздельный разбор токенов проверен на подставных ответах; отдельную запись создаёт неприменённый SQL |
| 6 | SC4 [PROM-01, PROM-02]: «Повышение» берёт ник из одобренной заявки на сервере; браузерный ник игнорируется; привязки устройств работают | ✓ VERIFIED (код) | `lib/promotion-participant.ts` и маршруты `app/api/promotion/*` в диффе 23-12 не менялись; тесты проходят; SQL живьём не исполнялся |
| 7 | SC5 [PROM-03, PROM-04]: регрессии «Повышения» исправлены и закреплены тестом; редактор банков надёжен | ✓ VERIFIED | `portia-promotion*.tsx`, `lib/portia-promotion*.ts` не менялись; тесты проходят; UAT 8 pass (запись владельца) |
| 8 | SC5 [PROM-05]: в конструкторе шаблона есть окно «Видимая часть» | ✓ VERIFIED | `portia-template-builder.tsx`, `portia-template-dossier.ts`, `portia-template-export.ts` не менялись; тест `portia-template-dossier` проходит; UAT 9 pass. Пиксельная сверка у человека |
| 9 | PASSED (override): при выключенном по умолчанию закрытии сайт остаётся открытым | ✓ PASSED (override) | Override владельца 2026-11-14 (frontmatter). Режим `open` как состояние «владелец выключил закрытие» работает: тест раскладки `open` (строки 271-272) |
| 10 | Поправка 1a [ACC-01, ACC-02]: отсутствующая функция закрытия даёт закрытое решение с формой; редактор первым | ✓ VERIFIED | `lib/access-gate.ts`; тест-трассер на настоящем клиенте с `PGRST202` проходит |
| 11 | WR-04 / WR-03 [ACC-08]: редактор не видит гостевую карточку, форму и кнопку; форма не показывает текст исключения | ✓ VERIFIED | `editor` гасит `showCard`/`showForm`/`showReopen`/`approvedNotice` (`access-gate-view.ts:23-37`); `accessSubmitFailure` отдаёт только известные коды, ограниченную строку сервера или общий текст |
| 12 | Поправка 3a: закрытие включено по умолчанию после миграции `20261114000000` | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Файл на месте и заморожен, отпечаток и sha256 сверены (тесты проходят), но SQL не исполнялся и по данным оркестратора не применён |
| 13 | Инструкция владельцу (G-PORTIA-23-4): порядок применения миграций 21-23, секрет, NOTIFY, проверки после | ✓ VERIFIED | `23-MIGRATION-APPLY.md` и `lib/phase23-evidence.test.ts` (проходит) |
| 14 | G-PORTIA-23-4: долгая загрузка «Проверяем доступ…» измерена и, если причина доказана, устранена | ? UNCERTAIN | Бюджет запросов опроса измерен офлайн (анонимный: 1 запрос; редактор: 4, флаг не читается); реальную задержку агент не видел, владелец записал UAT 2 pass |
| 15 | 23-12 [G-PORTIA-23-3-r2, ACC-03]: у одобренного на рабочем столе `showCard=false`, `showReopen=false`, `showForm=false`, `approvedNotice=true` при любом `cardOpen`; остальные состояния и редактор без изменений; условие монтирования стола прежнее (D-06) | ✓ VERIFIED | `lib/access-gate-view.ts:22-39`; тесты `gate layout: …` (строки 271-298) на значения, а не на подстроки; `showCard` для случая `allowed=false` сохраняется (строка 298) |
| 16 | 23-12: «один раз на устройство»: `claimApprovedNotice` true только когда хранилище читается и пишется и ключ ещё не равен `1`; любая ошибка хранилища даёт false; пишется только `1` | ✓ VERIFIED | `access-gate-view.ts:41-57`; тест `approved notice is claimed once per device and never when storage fails` исполняет функцию на подставных хранилищах (в т.ч. бросающих) |
| 17 | 23-12: уведомление выглядит как квест-уведомление, закрывается × и Escape, не берёт фокус, не накладывается на другие | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Разметка и обработчик Escape на месте (`portia-access-gate.tsx:147-176`), CSS на месте. Связка проверена только подстроками (IN-13); наложение на `QuestToast` (одинаковые `position:fixed; top:106px; right:12px`, `app/portia.css:605`) и двойное закрытие Escape (WR-09) видны только в браузере; UAT test 3 не повторялся |
| 18 | 23-12 [G-PORTIA-23-3-log, ACC-01]: каждый `unauthorized` пишет ровно один `console.error` с константной строкой без секретов; другие коды не пишутся; ответ клиенту прежний | ✓ VERIFIED | `lib/access-request-reply.ts`; `route.ts:30` вызывает `reportAccessSubmit(result)` после каждого ответа RPC; тест на настоящих `submitAccessRequest` и подписи проверяет отсутствие секрета, подписи, ника, token hash и IP bucket в строке; карта статусов закреплена |
| 19 | 23-12: матрица снова описывает HEAD; ревью раунд 3 на 40-hex commit; «Проверяемый commit» равен «Reviewed commit:»; `access-request-reply.ts` в охвате | ✓ VERIFIED (статически) | `23-RLS-REVIEW.md:4`, `23-SECURITY-MATRIX.md:3,35`; `security-matrix.test.ts` и `phase23-evidence.test.ts` зелёные. Ревью выполнено оркестратором, живая БД BLOCKED |
| 20 | 23-12: агент не менял SQL и миграции, не подключался к базе | ✓ VERIFIED | `git diff --name-only d98723e..HEAD` содержит 0 путей миграций; SUMMARY честно помечает живые дорожки BLOCKED |

**Счёт:** 15/20 (14 проверены кодом и тестами + 1 PASSED override). Исключены: 4 PRESENT_BEHAVIOR_UNVERIFIED (2, 5, 12, 17) и 1 UNCERTAIN (14); все пять вынесены в человеческую проверку.

### Отложенные пункты

Нет. Пункты, требующие применённых миграций и браузера, не отнесены к более поздней фазе в ROADMAP (Phase 25 включает необратимое переключение, но не принимает эти проверки), поэтому не отложены.

### Обязательные артефакты

| Артефакт | Ожидание | Статус | Детали |
|----------|----------|--------|--------|
| `lib/access-gate-view.ts` | `approvedNotice`, `ACCESS_APPROVED_NOTICE_KEY`, `claimApprovedNotice`, только type-импорты | ✓ VERIFIED | прочитан, используется компонентом; `node:crypto` в клиент не тянет |
| `components/portia-access-gate.tsx` | `AccessApprovedToast`, claim в `refresh()` | ✓ VERIFIED (проводка) | содержит `access-approved-toast`, `claimApprovedNotice(() => window.localStorage)`, `layout.approvedNotice`; поведение в браузере не проверено |
| `lib/access-request-reply.ts` | `ACCESS_SUBMIT_UNAUTHORIZED_ALERT`, `accessSubmitStatus`, `reportAccessSubmit` | ✓ VERIFIED | 22 строки, используется маршрутом |
| `lib/access-request-reply.test.ts` | тревога без секретов, карта статусов, проводка маршрута | ✓ VERIFIED | три содержательных теста |
| `app/api/access/request/route.ts` | `reportAccessSubmit(result);` и `accessSubmitStatus(result.code)` | ✓ VERIFIED | прочитан целиком |
| `app/portia.css` | модификатор `.access-approved-toast` | ✓ VERIFIED | строки 619-620 |
| `23-RLS-REVIEW.md` (раунд 3), `23-SECURITY-MATRIX.md` | свежее ревью и матрица | ✓ VERIFIED | см. истину 19 |
| миграция `20261114000000_portia_access_closure_default_on.sql` | закрытие включено по умолчанию | ⚠️ НЕ ПРИМЕНЕНА | файл верен и заморожен; применение за владельцем (D-72) |
| Артефакты 23-01..23-11 | как в предыдущем отчёте | ✓ VERIFIED (регрессионно) | не менялись, тесты проходят |

### Проверка ключевых связей

| Откуда | Куда | Через | Статус | Детали |
|--------|------|-------|--------|--------|
| `portia-access-gate.tsx` | `accessGateLayout`, `claimApprovedNotice` | прямой вызов в `refresh()` и в рендере | ✓ WIRED | `claimApprovedNotice(() => window.localStorage)` и `layout.approvedNotice` в компоненте |
| `app/api/access/request/route.ts` | `lib/access-request-reply.ts` | `reportAccessSubmit(result)` после RPC, `accessSubmitStatus(result.code)` | ✓ WIRED | прочитан маршрут; один `console.error` в самом маршруте остаётся в `catch` |
| `23-SECURITY-MATRIX.md` | `23-RLS-REVIEW.md` | один и тот же 40-hex commit | ✓ WIRED | `7cb8702c…` в обоих; тесты зелёные |
| `lib/access-gate.ts` | `app/api/access/status/route.ts` | `resolveGate` с `editorAccess` | ✓ WIRED | не менялся |
| `app/page.tsx` | `PortiaAccessGate` | прямой рендер | ✓ WIRED | не менялся |

### Трассировка данных (уровень 4)

| Артефакт | Данные | Источник | Реальные данные | Статус |
|----------|--------|----------|-----------------|--------|
| `PortiaAccessGate` | `view.decision` и `noticeOpen` | `/api/access/status` -> `resolveGate`; claim из `localStorage` | Да при применённых RPC; при отсутствующей функции осознанное закрытое решение | ✓ FLOWING (живьём у человека) |
| `AccessApprovedToast` | статичный текст, условие `layout.approvedNotice` | решение шлюза | Да | ✓ FLOWING (вид у человека) |
| `PortiaPromotion` | `status` | `/api/promotion/status` -> подписанный RPC | Да при применённой миграции 23 | ✓ FLOWING (живьём у человека) |

### Поведенческие проверки

| Поведение | Команда | Результат | Статус |
|-----------|---------|-----------|--------|
| Полный набор юнит-тестов (один запуск, Node 22.13.1) | `node --experimental-strip-types --test lib/*.test.ts` | 1929 tests, 1926 pass, 0 fail, 3 skipped (какие именно, я не разбирал; пропуски не записаны как PASS) | ✓ PASS |
| Типы | `node node_modules/typescript/bin/tsc --noEmit` | exit 0 | ✓ PASS |
| Линт 6 файлов 23-12 | `node node_modules/eslint/bin/eslint.js <6 файлов>` | exit 0, без сообщений | ✓ PASS |
| Сборка `next build` | не запускал; от оркестратора: exit 0 | принято от оркестратора | ? SKIP (принято) |
| Playwright, dev-сервер, база, миграции, браузер | не запускались по правилам проекта | — | ? SKIP (BLOCKED) |

### Выполнение проб

Явных `probe-*.sh` фаза не объявляла, шаг пропущен.

### Покрытие требований

Все 12 ID из запроса присутствуют в frontmatter планов (23-01: ACC-01, 02, 03, 08; 23-02: ACC-05, 06, 07; 23-03: PROM-01, 02; 23-04: PROM-03; 23-05: PROM-04; 23-06: PROM-05; 23-07: все 12; 23-08/09/11: ACC-01, 02, 08; 23-10: ACC-02; 23-12: ACC-01, ACC-03) и в `REQUIREMENTS.md`. Осиротевших нет: ACC-04 и ACC-09 привязаны к Phase 21.

| Требование | Планы | Статус | Доказательство |
|------------|-------|--------|----------------|
| ACC-01 | 23-01, 23-08, 23-09, 23-11, 23-12 | ✓ SATISFIED (код/тесты) | форма и маршрут; тревога unauthorized; живая отправка у человека |
| ACC-02 | 23-01, 23-08..23-11 | ✓ SATISFIED (код/тесты) | стол не монтируется без допуска; закрытие ON по умолчанию в неприменённой миграции |
| ACC-03 | 23-01, 23-12 | ? NEEDS HUMAN | логика допуска и раскладка проверены тестами; приёмка после 23-12 (UAT test 3) ожидает владельца |
| ACC-05 | 23-02 | ⚠️ NEEDS HUMAN | пауза и лимит в неприменённом SQL |
| ACC-06 | 23-02 | ⚠️ NEEDS HUMAN | то же |
| ACC-07 | 23-02 | ⚠️ NEEDS HUMAN | изоляция устройств на подставных ответах |
| ACC-08 | 23-01, 23-08, 23-09, 23-11 | ✓ SATISFIED (код/тесты) | редактор первым, без гостевой формы и уведомления, ссылка `/owner-login` |
| PROM-01 | 23-03 | ✓ SATISFIED (код) | серверная личность участника; SQL живьём не исполнялся |
| PROM-02 | 23-03 | ✓ SATISFIED (код) | привязки устройств; живьём не исполнялось |
| PROM-03 | 23-04 | ✓ SATISFIED | исправления и тесты проходят |
| PROM-04 | 23-05 | ✓ SATISFIED | защита перестановки, подтверждение удаления |
| PROM-05 | 23-06 | ✓ SATISFIED | окно «Видимая часть» в общей карточке |

Замечание по документам (не пробел кода): в `REQUIREMENTS.md` ACC-03, 05, 06, 07 и PROM-01..05 по-прежнему `Pending`, ACC-01, 02, 08 `Complete`. Такой статус для ACC-03 и ACC-05..07 согласуется с этим отчётом (human). Для PROM-01..05 решение об обновлении статусов остаётся за оркестратором и владельцем. ROADMAP и PROJECT всё ещё формулируют цель «при выключенном по умолчанию закрытии…»; обновить формулировку под override владельца остаётся за оркестратором.

### Найденные антипаттерны

| Файл | Строка | Паттерн | Серьёзность | Влияние |
|------|--------|---------|-------------|---------|
| файлы 23-12 | — | `TBD` / `FIXME` / `XXX` | — | не найдено, гейт долговых маркеров чист |
| `components/portia-access-gate.tsx` | 49-53 | WR-08: ключ `portia-access-approved-notice-v1` ставится один раз на устройство, `noticeClaimed` не сбрасывается; после отзыва и нового одобрения на том же устройстве уведомления нет, а `noticeOpen` остаётся `true` | ⚠️ Warning | цель не нарушена (стол открывается, карточки нет), но уведомление молчит при повторном одобрении |
| `components/portia-access-gate.tsx`, `app/portia.css` | 147-176, 605 | WR-09: `.quest-toast` и `.access-approved-toast` в одной точке (`top:106px; right:12px`, `z-index:965`); один Escape может закрыть оба (`preventDefault` в тосте уведомления, нет в `QuestToast`) | ⚠️ Warning | наложение при одновременном квест-уведомлении; косметика, но ровно та поверхность, на которую жаловался владелец |
| `components/portia-access-gate.tsx` | 108 | IN-11: ветка `approved` в `statusText` теперь недостижима | ℹ️ Info | мёртвый код |
| `components/portia-access-gate.tsx`, `lib/access-gate-view.ts` | 11, 113-117 | IN-12: `dynamic(..., { ssr: false })` без `loading`, пустой экран до загрузки стола; фокус на размонтированной карточке | ℹ️ Info | возможная пауза без индикатора |
| `lib/access-gate.test.ts`, `lib/access-request-reply.test.ts` | — | IN-13: подстроки исходников вместо поведения `refresh()`; число `console.` в маршруте закреплено | ℹ️ Info | WR-08 не ловится тестами; хрупкость |
| `lib/access-gate-view.ts` | 31 | WR-07 (раунд 2): для `pending/rejected/revoked` в режиме `open` кнопка «ПОДАТЬ ЗАЯВКУ» остаётся; для `approved` на столе закрыто 23-12 | ⚠️ Warning (частично закрыто) | цель не нарушена |

Открытые из прежних раундов и не относящиеся к 23-12: WR-01, WR-05, WR-06, IN-01..IN-10 (см. `23-REVIEW-DISPOSITION.md`, все `open`, 19 из 22). RLS: раунд 3 даёт 0 critical/high/medium, две низкие находки RLS23-07 и RLS23-08 приняты (accepted).

### Нужна проверка человеком

См. `human_verification` во frontmatter. Кратко:

1. UAT test 3 в браузере после 23-12 (`/gsd-verify-work 23`): вид и однократность уведомления, наложение на квест-уведомление, отсутствие карточки. От этого зависит приёмка ACC-03.
2. Применить миграции 20261113 и 20261114 на базу владельца по `23-MIGRATION-APPLY.md`, затем проверки 1-9 (закрывает ACC-05/06/07 и «закрытие по умолчанию» на уровне базы).
3. Решение владельца по WR-08 и WR-09 (исправить или принять).
4. Необязательно: строка тревоги в логе при неверном секрете; пиксельная сверка «Видимой части»; физические устройства (Phase 27).

### Итог по пробелам

Блокирующих пробелов в коде нет. Кодовая часть G-PORTIA-23-3-r2 и G-PORTIA-23-3-log закрыта и подтверждена тестами: раскладка и хранилище уведомления проверены поведением, тревога unauthorized проверена на настоящих `submitAccessRequest` и подписи, ответ клиенту не менялся, ревью и матрица свежие. Чего агент не доказал и не доказывает: вид и однократность уведомления в браузере (две открытые предупреждения WR-08 и WR-09 именно об этой поверхности), SQL-часть ACC-05/06/07 и закрытие по умолчанию в базе, живой Postgres/RLS, staging, production и физические устройства. Они остаются BLOCKED / ОЖИДАЕТ ВЛАДЕЛЬЦА, ни одна не записана как пройденная.

---

_Проверено: 2026-11-15_
_Верификатор: Claude (gsd-verifier)_
