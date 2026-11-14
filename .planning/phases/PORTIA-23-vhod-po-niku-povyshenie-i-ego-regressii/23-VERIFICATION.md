---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
verified: 2026-11-15T09:00:00Z
status: human_needed
score: 10/14 must-haves verified
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
  - "lib/access-closure.test.ts"
  - "lib/access-gate-view.ts"
  - "lib/access-gate.test.ts"
  - "lib/access-gate.ts"
  - "lib/access-identity.ts"
  - "lib/phase23-evidence.test.ts"
  - "lib/portia-canonical-parity.test.ts"
  - "lib/portia-migration-fingerprint.test.ts"
  - "lib/portia-promotion-api.ts"
  - "lib/portia-template-dossier.ts"
  - "lib/portia-template-export.ts"
  - "lib/promotion-participant.ts"
  - "supabase/migrations/20261113000000_portia_access_promotion.sql"
  - "supabase/migrations/20261114000000_portia_access_closure_default_on.sql"
covered_digest: "v4:sha256:e33c724fc426f3bdf34e3409959c71839b0496f0a16d08f6ac4cfe05dfbc0041"
behavior_unverified: 3
overrides_applied: 1
overrides:
  - must_have: "SC (ROADMAP, цель фазы): при выключенном по умолчанию закрытии сайт остаётся таким же открытым"
    reason: "Решение владельца 2026-11-14 (ответы 1a/2a/3a, gap G-PORTIA-23-4, D-01 override note в 23-CONTEXT.md): сайт закрыт для всех, чья заявка не одобрена; закрытие включено по умолчанию; без миграций гость видит закрытый экран с формой заявки; миграции владелец применяет сам (D-72). Режим open остаётся только как состояние, в которое сайт переводит владелец."
    accepted_by: "владелец проекта"
    accepted_at: "2026-11-14T00:00:00Z"
re_verification:
  previous_status: human_needed
  previous_score: 7/9
  gaps_closed:
    - "G-PORTIA-23-4 (кодовая часть): отсутствующая функция закрытия закрывает сайт, редактор входит первым и не видит гостевую форму, отказ отправки показывает честный текст, миграция 20261114000000 включает закрытие по умолчанию, инструкция владельцу записана и закреплена тестом"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "ACC-05/ACC-06: частые повторы упираются в серверную паузу и лимит; отклонённый или отозванный посетитель подаёт новую заявку после паузы"
    test: "На базе владельца с применёнными миграциями 21-23 отправить заявку, получить отклонение в «Пользователях», сразу отправить повторно, затем после паузы"
    expected: "Сразу после отклонения нейтральный ответ cooldown/throttled без раскрытия чужих статусов; после паузы новая заявка принимается"
    why_human: "Пауза и лимит живут в Postgres (RPC Phase 21/23), миграции не применены (D-72). Офлайн-тесты используют подставные ответы RPC и текст SQL."
  - truth: "ACC-07: заявка с нового устройства для уже одобренного ника создаётся как отдельная заявка на рассмотрение и не одобряется автоматически"
    test: "Одобрить ник на устройстве A; подать тот же ник с устройства B (другой cookie)"
    expected: "У B отдельная заявка «ожидает»; решение по A не меняет статус B и наоборот"
    why_human: "Изоляция устройств проверена в lib/access-gate.test.ts на подставных ответах; создание отдельной записи делает SQL, который нигде не исполнялся."
  - truth: "Решение владельца 3a: после применения миграции 20261114000000 закрытие включено по умолчанию (default true, строка main = true, функция отвечает true)"
    test: "Выполнить проверки 5 и 8 из 23-MIGRATION-APPLY.md после применения всех восьми файлов и NOTIFY pgrst"
    expected: "portia_access_closure_enabled() = true; closure_enabled = true и never_toggled = true; column_default = true; POST на rpc/portia_access_closure_enabled отвечает true, а не PGRST202"
    why_human: "Состояние базы возникает только при исполнении SQL; агент к базе не подключался (D-72, CLAUDE.md). Текст миграции, эталонный отпечаток (default true) и sha256 сверены офлайн, но это не выполнение."
coincidental_reliance_items: []
human_verification:
  - test: "Применить восемь миграций по 23-MIGRATION-APPLY.md на свою базу (рекомендуется сначала изолированный проект и резервная копия), выполнить шаг секрета и `notify pgrst, 'reload schema'`, затем проверки 1-9 из раздела «Проверки после применения»"
    expected: "8 версий в истории; 5 таблиц portia_access_*; 18 функций доступа и 10 защищённых функций «Повышения»; закрытие включено; права anon/authenticated как в записи; кэш PostgREST отвечает true на closure RPC"
    why_human: "Postgres/RLS, роли, секрет и кэш схемы исполняет только владелец (D-72, решение 2a). Результаты в GSD не записаны как пройденные."
  - test: "До применения миграций повторить G-PORTIA-23-4 на dev-сервере: гость в приватном окне; затем вход через «ВХОД ДЛЯ РЕДАКТОРА»; в логе сервера искать строку «treating closure as ON (fail-closed)»; на глаз оценить задержку «Проверяем доступ…»"
    expected: "Гость: закрытый экран «Заявка на доступ» с полем ника и выбором «из таблицы / не из таблицы», рабочего стола нет; отправка честно падает текстом «Не удалось отправить заявку. Проверьте соединение и повторите.»; редактор: рабочий стол без карточки заявки; в логе одна строка за запуск"
    why_human: "Браузер, dev-сервер и живой ответ /api/access/status не запускались. Регэксп имени функции в lib/access-gate.ts:21 написан под ожидаемый текст ошибки PostgREST (PGRST202); реальный текст развёрнутой версии не проверен (BLOCKED в 23-RLS-REVIEW.md). Если формат иной, откат даст экран «Не удалось проверить доступ» без формы (тоже закрыто, но владелец ожидал форму). Причина долгой загрузки в коде не доказана и не исправлялась; замер на сервере за владельцем."
  - test: "После применения миграций пройти путь заявка -> одобрение в «Пользователях» -> рабочий стол на втором окне; затем нажать «×» на карточке одобренного посетителя"
    expected: "Рабочий стол открывается за несколько секунд без ввода ника; оценить, что показывает карточка «Доступ подтверждён…» и кнопка «ПОДАТЬ ЗАЯВКУ» после закрытия карточки (см. WR-07: кнопка вводит в заблуждение, формы для этого статуса нет)"
    why_human: "Живая выдача cookie устройства и автопереход по реальному ответу сервера; визуальная оценка карточки поверх рабочего стола."
  - test: "Повторная приёмка владельцем UAT 2-3 и пунктов 4-7 (`/gsd-verify-work 23`) после применения миграций"
    expected: "Поведение, описанное в 23-UAT.md: заявка, второе устройство, «Повышение» из заявки, своя заявка редактора, устаревшее звание"
    why_human: "Пункты 4-7 имеют статус blocked, не pass. По D-70 владелец принял риск закрытия v1.3 без UAT 20-14: это принятый риск, а не PASS."
  - test: "Сравнить кадр «Видимая часть» в предпросмотре шаблона и в скачанных HTML и PNG при разных масштабах"
    expected: "Один и тот же кадр во всех трёх представлениях"
    why_human: "Пиксельная сверка требует браузера; карточка предпросмотра и экспорта одна (TemplateCard), владелец отметил UAT 9 как pass."
  - test: "Физические телефон и ПК (Phase 27): 320/390/900 px для экранов заявки и «Повышения»"
    expected: "Нет переполнения, фокус и клавиатура работают"
    why_human: "Физические устройства остаются BLOCKED до Phase 27."
---

# Phase 23: Вход по нику, «Повышение» и его регрессии — отчёт верификации (повторная, после 23-09..23-11)

**Цель фазы (ROADMAP, с поправкой владельца):** Посетитель может подать заявку по нику, не одобренный видит только нейтральный экран, одобренный возвращается сразу на рабочий стол, а «Повышение» берёт ник из одобренной заявки, его регрессии исправлены, а в шаблоне есть окно «Видимая часть».
**Проверено:** 2026-11-15
**Статус:** human_needed
**Повторная верификация:** Да, после закрытия G-PORTIA-23-4 планами 23-09, 23-10, 23-11

## Явная отметка об отмене решения владельцем

Оговорка цели «при выключенном по умолчанию закрытии сайт остаётся таким же открытым» (ROADMAP, D-01, Phase 21 D-05) **отменена владельцем 2026-11-14** (ответы 1a/2a/3a). Действует такое решение:

- сайт закрыт для всех, чья заявка не одобрена; без заявки входят только редакторы;
- закрытие включено по умолчанию (миграция `20261114000000`);
- пока миграций доступа нет в базе, гость видит закрытый экран с формой заявки, а не рабочий стол; отправка честно падает;
- миграции 21-23 владелец применяет сам, агент базу не трогает (D-72).

Решение записано в `23-CONTEXT.md` (пометка у D-01), `23-UAT.md` (gap G-PORTIA-23-4, `owner_decision`) и планах 23-09..23-11. Я проверял код против цели с этой поправкой. Прежняя истина 9 из первого отчёта («при отсутствующей функции закрытия сайт открыт», план 23-08) этим решением заменена и в счёт не входит. Состояние «закрытие выключено владельцем» осталось поддерживаемым (режим `open`, тест раскладки) и учтено в отдельной строке «PASSED (override)».

## Итог

Блокеров в коде не нашёл. Я проверял по самим файлам и по запущенным тестам, а не по SUMMARY:

- `lib/access-gate.ts`: редактор решается первым, до чтения флага. Отсутствующая функция закрытия (точный сигнал: `AccessStoreError`, `sqlState` ровно `PGRST202` или `42883`, имя функции целым идентификатором) даёт `{ mode: "closed", state: none, allowed: false, level: null, editor: false }`; любая другая ошибка пробрасывается и маршрут отвечает 503.
- Тест «tracer» гоняет настоящий клиент `@supabase/ssr` с подставным `fetch` на `https://probe.invalid` (без сети): ответ 404 с `PGRST202` даёт один запрос, закрытое решение и раскладку «закрытый экран с формой».
- `components/portia-access-gate.tsx` и `lib/access-gate-view.ts`: рабочий стол монтируется только при `desktop` (`open` или `allowed`); у редактора нет гостевой карточки, формы и кнопки; форма показывает только известные тексты или общий русский текст, не текст исключения.
- `app/page.tsx` рендерит только `PortiaAccessGate`, рабочего стола в статической оболочке нет.
- Миграция `20261114000000`: `default true`, строка `main` включается, если владелец её не менял, функция при отсутствии строки отвечает `true`; права как у фундамента. Эталонный отпечаток (`default: "true"`), sha256 (`44c07e2f…47b4`) и порядок восьми файлов в `23-MIGRATION-APPLY.md` согласованы с файлами в репозитории.

Статус `human_needed`, а не `passed`: исполнение SQL, роли, включённое закрытие вживую, браузер и устройства по правилам проекта остаются BLOCKED / ОЖИДАЕТ ВЛАДЕЛЬЦА. Владелец миграции ещё не применял и UAT не повторял.

## Оценка WR-07 (влияет ли на цель)

WR-07 (`lib/access-gate-view.ts:31`, `showReopen: desktop && !editor && !cardOpen`): после «×» одобренный посетитель видит кнопку «ПОДАТЬ ЗАЯВКУ», хотя формы для статуса `approved` нет; карточка «Доступ подтверждён. Открываем рабочий стол.» сама не закрывается. Я перечитал код и CSS: рабочий стол при `allowed` монтируется сразу (`desktop === true`), карточка лежит в углу с `pointer-events: none` на контейнере и не блокирует рабочий стол. Поэтому цель «одобренный возвращается сразу на рабочий стол» (ACC-03) этим не нарушена. Это **WARNING (UX), не BLOCKER**: путь не раскрывает чужих данных и не даёт доступа. Особенность из ревью «ожидающий посетитель» верна только в режиме `open` (при закрытии ON у ожидающего `desktop` ложен, кнопки нет). Правило «кнопка видна, когда карточка закрыта» было и до 23-09 (тест раскладки это закрепил), но при закрытии ON по умолчанию его теперь видит каждый одобренный посетитель. Рекомендация: исправить до приёмки владельцем (одна строка в раскладке плюс закрытие карточки после первого `approved`, как в предложении ревью). Если владелец примет как есть, записать disposition `deferred` с причиной; сейчас в `23-REVIEW-DISPOSITION.md` он `open`.

## Достижение цели

### Наблюдаемые истины

Источник: 5 критериев успеха ROADMAP плюс истины планов 23-08..23-11. Критерии разделены на серверную часть (Postgres) и клиентскую/маршрутную.

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | SC1 [ACC-01]: посетитель вводит ник, выбирает «из таблицы» / «не из таблицы», отправляет; неверный формат отвергается русским текстом; ответ не раскрывает чужие одобрения | ✓ VERIFIED | `components/portia-access-gate.tsx:115-127` (форма `access-nickname`, радио origin, `isValidNickname`, тексты ошибок); `app/api/access/request/route.ts` (разбор ника, проверка origin, серверная подпись) не менялся с первой верификации; тесты `lib/access-gate.test.ts` проходят. |
| 2 | SC1 [ACC-05, ACC-06]: частые повторы упираются в серверную паузу и лимит; отклонённый/отозванный подаёт заявку после паузы | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Маршрут передаёт `ipBucket`, `tokenHash`, подпись и маппит `throttled` в 429, `cooldown` в 409; пауза и лимит в неприменённом SQL. См. `behavior_unverified_items`. |
| 3 | SC2 [ACC-02, ACC-08]: при включённом закрытии неодобренный видит только нейтральный экран («на рассмотрении» / «отклонена» / «доступ отозван»), без рабочего стола; ссылка на вход редактора есть | ✓ VERIFIED | `accessGateLayout`: `desktop` только для `open` или `allowed`; `error` и `checking` рабочий стол не монтируют (тест раскладки, строки 269-278); статусные тексты `portia-access-gate.tsx:98-102`; ссылка `/owner-login` строка 128; тест статической оболочки `app/page.tsx` проходит. Ограничение: закрытие скрывает интерфейс, данные `/api/content`, `/api/employees` отдаются до Phase 25 (T-23-31, записано владельцу в 23-MIGRATION-APPLY.md). |
| 4 | SC3 [ACC-03]: одобренный при повторном открытии на том же устройстве сразу попадает на рабочий стол без ввода ника | ✓ VERIFIED (код/тесты; живая выдача cookie у человека) | `resolveGate` разбирает cookie устройства, `approved` даёт `allowed: true`; клиент опрашивает статус каждые 5 с и при `approved.current` не сбрасывает стол сетевой ошибкой (`portia-access-gate.tsx:37-50`). Тест `closed gate admits only approved current-device token` проходит. Оговорка WR-07 выше: предупреждение, не отказ. |
| 5 | SC3 [ACC-07]: заявка с нового устройства для уже одобренного ника создаётся как новая заявка на рассмотрение | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Тест «two devices resolve independently…» доказывает раздельный разбор токенов на подставных ответах; отдельную запись создаёт неприменённый SQL. |
| 6 | SC4 [PROM-01, PROM-02]: «Повышение» берёт ник из одобренной заявки на сервере; браузерный ник игнорируется; привязки устройств работают | ✓ VERIFIED | `lib/promotion-participant.ts` и три маршрута `app/api/promotion/*` не менялись в 23-09..23-11 (`git diff 9a7b0db..HEAD --stat` по app/lib/components затрагивает только 8 файлов шлюза и тестов); тесты `portia-promotion-security`, `portia-promotion-api`, `access-identity`, `access-editor-request` проходят. RLS-ревью: 0 critical/high. Живое исполнение SQL BLOCKED. |
| 7 | SC5 [PROM-03, PROM-04]: регрессии «Повышения» исправлены и закреплены тестом; редактор банков надёжен | ✓ VERIFIED | Файлы `portia-promotion*.tsx`, `lib/portia-promotion*.ts` не менялись; тесты `portia-promotion-ui`, `portia-promotion-editor` проходят; UAT 8 владелец отметил pass. |
| 8 | SC5 [PROM-05]: в конструкторе шаблона есть окно «Видимая часть» | ✓ VERIFIED | `portia-template-builder.tsx`, `portia-template-dossier.ts`, `portia-template-export.ts` не менялись; тест `portia-template-dossier` проходит; UAT 9 pass. Пиксельная сверка у человека. |
| 9 | PASSED (override): при выключенном по умолчанию закрытии сайт остаётся открытым | ✓ PASSED (override) | Override владельца 2026-11-14 (см. раздел выше и frontmatter). Режим `open` для состояния «владелец выключил закрытие» по-прежнему работает: тест `gate layout: open mode…` (строки 271-272). |
| 10 | Поправка владельца 1a [ACC-01, ACC-02]: отсутствующая функция закрытия даёт закрытое решение с формой; не-редактор не получает рабочий стол; редактор первым | ✓ VERIFIED | `lib/access-gate.ts:52-69`; тесты `tracer: a real Supabase client answering PGRST202…` (один запрос, `closedNone`, раскладка с формой, один `warn`), `missing closure function closes the site…`, `only the exact missing closure function…` (11 других сбоев остаются 503), `verified editor gets the desktop before the closure flag is read`, `unavailable or failing editor verification…` (редактор с `unavailable` получает 503, не стол). Я перезапустил: 188 тестов набора фазы, 0 fail. |
| 11 | WR-04 / WR-03 [ACC-08]: редактор не видит гостевую карточку, форму и кнопку; форма заявки не показывает текст исключения | ✓ VERIFIED | `accessGateLayout`: `editor` гасит `showCard`/`showForm`/`showReopen` (`access-gate-view.ts:23-31`); `accessSubmitFailure` показывает только известные коды, строку `error` сервера 1-300 символов или общий текст; компонент не содержит `error.message`, `response.json()` читается через `.catch`. Тесты WR-04 и WR-03 проходят. |
| 12 | Поправка владельца 3a: закрытие включено по умолчанию после миграции `20261114000000` | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Файл на месте: `alter column … set default true`, `insert … ('main', true) on conflict do nothing`, защищённый `update` по `updated_by is null`, функция с fallback `true`, права без изменений, `notify pgrst` последним. Отпечаток `portia.fingerprint.json:308-311` (`default: "true"`), sha256 совпадает с записью. Исполнение SQL не проводилось (D-72). |
| 13 | Инструкция владельцу (G-PORTIA-23-4, missing 4): точный порядок применения миграций 21-23, секрет, NOTIFY, проверки после | ✓ VERIFIED | `23-MIGRATION-APPLY.md`: восемь файлов в возрастающем порядке совпадают с `supabase/migrations/`, проверки 1-9, откат и безопасное выключение, предупреждение RLS23-05, sha256 `44c07e2f…47b4` равен `sha256sum` файла; `lib/phase23-evidence.test.ts` (проходит) сверяет порядок, хеши и числа функций. |
| 14 | G-PORTIA-23-4 (missing 5): долгая загрузка «Проверяем доступ…» измерена и, если причина доказана, устранена | ? UNCERTAIN | Бюджет запросов опроса измерен офлайн на настоящем клиенте (анонимный посетитель: 1 запрос; редактор: 4 запроса, флаг не читается; тест `status poll network budget…`). Причина жалобы владельца в коде не найдена, поэтому исправления нет; реальный замер на dev-сервере остаётся за владельцем. Симптом не закрыт, но и не доказан. |

**Счёт:** 10/14 (9 проверены кодом и тестами + 1 PASSED override). Исключены: 3 PRESENT_BEHAVIOR_UNVERIFIED (истины 2, 5, 12), 1 UNCERTAIN (истина 14); все четыре вынесены в человеческую проверку.

### Обязательные артефакты

| Артефакт | Ожидание | Статус | Детали |
|----------|----------|--------|--------|
| `lib/access-gate.ts` | редактор первым; отсутствующая функция даёт closed/none; прочие сбои пробрасываются | ✓ VERIFIED | 85 строк, используется в `app/api/access/status/route.ts`; в коде нет литерала имени функции закрытия (его ищет `lib/access-closure.test.ts`) |
| `lib/access-gate-view.ts` | чистая раскладка с `showReopen`, `accessSubmitFailure` | ✓ VERIFIED | только `import type`, в клиентский пакет не тянет `node:crypto` |
| `components/portia-access-gate.tsx` | экран проверки, форма, ошибка, рабочий стол | ✓ VERIFIED | подключён из `app/page.tsx`; `layout.showReopen`, `accessSubmitFailure(` присутствуют |
| `lib/access-gate.test.ts` | трассер на настоящем клиенте, раскладка, тексты отказа, бюджет опроса | ✓ VERIFIED | 16 тестов, содержательные утверждения, не заглушки |
| `supabase/migrations/20261114000000_portia_access_closure_default_on.sql` | закрытие включено по умолчанию | ⚠️ НЕ ПРИМЕНЕНА | файл верен и заморожен; применение за владельцем (D-72) |
| `23-MIGRATION-APPLY.md` | инструкция владельцу | ✓ VERIFIED | см. истину 13 |
| Артефакты 23-01..23-08 (шлюз, маршруты, участник «Повышения», редакторы, шаблон, миграция 23) | как в первом отчёте | ✓ VERIFIED (регрессионная проверка) | файлы не менялись, соответствующие тесты проходят |

### Проверка ключевых связей

| Откуда | Куда | Через | Статус | Детали |
|--------|------|-------|--------|--------|
| `app/api/access/status/route.ts` | `resolveGate` | `editorAccess` callback, любое исключение 503 | ✓ WIRED | маршрут не менялся с `a1555f6`; тест читает его текст |
| `portia-access-gate.tsx` | `accessGateLayout`, `accessSubmitFailure` | прямой вызов | ✓ WIRED | `layout.showReopen`, `accessSubmitFailure(` в компоненте |
| `lib/access-gate.ts` | `lib/access-store.ts` | `isMissingClosureFunction` по `AccessStoreError.sqlState` и имени функции | ✓ WIRED | покрыто тестом на 11 «других» сбоях |
| `app/page.tsx` | `PortiaAccessGate` | прямой рендер, без рабочего стола в статике | ✓ WIRED | тест статической оболочки |
| миграция 8 | эталонный отпечаток и матрица прав | `default: "true"`, источник `20261114000000…:38` | ✓ WIRED | `portia-migration-fingerprint`, `phase16-expected-authz`, `access-rls-round2` проходят |

### Трассировка данных (уровень 4)

| Артефакт | Данные | Источник | Реальные данные | Статус |
|----------|--------|----------|-----------------|--------|
| `PortiaAccessGate` | `view.decision` | `/api/access/status` -> `resolveGate` -> RPC закрытия/разбора и `auth.getUser` | Да при применённых RPC; при отсутствующей функции осознанное закрытое решение | ✓ FLOWING (живьём у человека) |
| `PortiaPromotion` | `status` | `/api/promotion/status` -> подписанный RPC | Да при применённой миграции 23 | ✓ FLOWING (живьём у человека) |

### Поведенческие проверки

| Поведение | Команда | Результат | Статус |
|-----------|---------|-----------|--------|
| Шлюз, закрытие, отпечаток, эталон прав, матрица, evidence, RLS раунд 2 | `node --experimental-strip-types --test lib/access-gate.test.ts lib/access-closure.test.ts lib/phase23-evidence.test.ts lib/portia-canonical-parity.test.ts lib/portia-migration-fingerprint.test.ts lib/security-matrix.test.ts lib/phase16-expected-authz.test.ts lib/access-rls-round2.test.ts` (Node 22.13.1) | 124 теста, 124 pass, 0 fail | ✓ PASS |
| Набор фазы (11 файлов первой верификации) | `node --experimental-strip-types --test` по тем же файлам | 188 тестов, 188 pass, 0 fail | ✓ PASS |
| Типы | `node node_modules/typescript/bin/tsc --noEmit` | exit 0 | ✓ PASS |
| Линт файлов шлюза | `node node_modules/eslint/bin/eslint.js` по 4 файлам | exit 0 | ✓ PASS |
| Полный набор `lib/*.test.ts` | не перезапускал; от оркестратора: 1923 теста, 1920 pass, 0 fail, 3 skipped | принято | ? SKIP (принято от оркестратора) |
| Сборка, Playwright, dev-сервер, база, миграции | не запускались по правилам проекта | — | ? SKIP (BLOCKED) |

### Выполнение проб

Явных `probe-*.sh` фаза не объявляла, шаг пропущен.

### Покрытие требований

Все 12 ID из запроса есть в frontmatter планов: 23-01 (ACC-01, 02, 03, 08), 23-02 (ACC-05, 06, 07), 23-03 (PROM-01, 02), 23-04 (PROM-03), 23-05 (PROM-04), 23-06 (PROM-05), 23-07 (все 12), 23-08/23-09/23-11 (ACC-01, 02, 08), 23-10 (ACC-02). Все 12 присутствуют в `REQUIREMENTS.md`. Осиротевших нет: ACC-04 и ACC-09 привязаны к Phase 21.

| Требование | Планы | Статус | Доказательство |
|------------|-------|--------|----------------|
| ACC-01 | 23-01, 23-08, 23-09, 23-11 | ✓ SATISFIED (код/тесты) | форма и маршрут; закрытый экран с формой и при отсутствующей функции; живая отправка у человека |
| ACC-02 | 23-01, 23-08..23-11 | ✓ SATISFIED (код/тесты) | рабочий стол не монтируется без допуска; закрытие ON по умолчанию в миграции (не применена) |
| ACC-03 | 23-01 | ✓ SATISFIED (код/тесты) | cookie устройства, опрос, `allowed`; WR-07 как предупреждение |
| ACC-05 | 23-02 | ⚠️ NEEDS HUMAN | пауза и лимит в неприменённом SQL |
| ACC-06 | 23-02 | ⚠️ NEEDS HUMAN | то же |
| ACC-07 | 23-02 | ⚠️ NEEDS HUMAN | изоляция устройств проверена на подставных ответах |
| ACC-08 | 23-01, 23-08, 23-09, 23-11 | ✓ SATISFIED (код/тесты) | редактор первым, без гостевой формы, ссылка `/owner-login`; живой вход у владельца |
| PROM-01 | 23-03 | ✓ SATISFIED (код) | серверная личность участника; SQL живьём не исполнялся |
| PROM-02 | 23-03 | ✓ SATISFIED (код) | привязки устройств; живьём не исполнялось |
| PROM-03 | 23-04 | ✓ SATISFIED | дата, независимые карточки, причины, тесты |
| PROM-04 | 23-05 | ✓ SATISFIED | защита перестановки, подтверждение удаления; UAT 8 pass |
| PROM-05 | 23-06 | ✓ SATISFIED | окно «Видимая часть» в общей карточке; UAT 9 pass |

Замечания по документам (не пробелы кода): в `REQUIREMENTS.md` ACC-03, 05, 06, 07 и PROM-01..05 по-прежнему `Pending`, ACC-01, 02, 08 помечены `Complete`; ROADMAP и PROJECT всё ещё формулируют цель «при выключенном по умолчанию закрытии…». Обновление формулировки цели в ROADMAP под override владельца и статусов остаётся за оркестратором, живые части в REQUIREMENTS нельзя ставить как PASS до приёмки.

### Найденные антипаттерны

| Файл | Строка | Паттерн | Серьёзность | Влияние |
|------|--------|---------|-------------|---------|
| файлы шлюза и миграция 8 | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` | — | не найдено, гейт долговых маркеров чист |
| `lib/access-gate-view.ts` | 31 | WR-07: `showReopen` не зависит от статуса | ⚠️ Warning | вводящая в заблуждение кнопка у одобренного; цель не нарушена |
| `lib/access-gate-view.ts` | 43-53 | IN-07: серверный отказ `invalid` показывается как «Проверьте соединение»; магическое 300 | ℹ️ Info | текст неточен, доступ не затронут |
| `lib/access-gate.ts` | 26 | IN-06: type predicate, ложный для части `AccessStoreError` | ℹ️ Info | ловушка для будущего вызова, сейчас вреда нет |
| `lib/access-gate.test.ts`, `lib/portia-migration-fingerprint.test.ts`, `lib/phase23-evidence.test.ts` | — | IN-08, IN-09, IN-10: копия callback, неполный повтор `alter column`, хрупкие константы | ℹ️ Info | слабое место тестов, не продукта |

### Код-ревью и RLS (`23-REVIEW.md` round 2, `23-RLS-REVIEW.md`)

Критических 0; предупреждение WR-07 (оценено выше) и пять info (IN-06..IN-10). RLS раунд 2: 0 critical/high/medium; RLS23-05 (low) принята с записью в инструкции владельцу, RLS23-06 (low) исправлена в `d675d73`. Открытые из прежнего ревью и не относящиеся к G-PORTIA-23-4: WR-01, WR-05, WR-06, IN-01..IN-05, RLS23-04 (defense-in-depth по подписи действия теста). WR-02, WR-03, WR-04 закрыты. Все остаются в `23-REVIEW-DISPOSITION.md` как `open` или `fixed`.

### Нужна проверка человеком

См. `human_verification` во frontmatter. Кратко:

1. Применить восемь миграций на базу владельца по `23-MIGRATION-APPLY.md` и выполнить проверки 1-9.
2. До применения: повторить G-PORTIA-23-4 на dev-сервере (гость: закрытый экран с формой и честная ошибка отправки; редактор: стол без карточки; строка в логе; оценка задержки). Отдельно подтвердить реальный текст ошибки PostgREST под регэксп имени функции.
3. После применения: путь заявка, одобрение, автопереход; оценить поведение карточки и кнопки (WR-07).
4. Повторная приёмка UAT 2-7 (4-7 blocked, не PASS; D-70 принятый риск).
5. Пиксельная сверка «Видимой части»; физические устройства (Phase 27).

### Итог по пробелам

Блокирующих пробелов в коде нет. Кодовая часть G-PORTIA-23-4 закрыта: шлюз fail-closed, редактор без гостевой формы, честный отказ отправки, миграция «закрытие ON» и инструкция владельцу присутствуют, подключены и подтверждены тестами (включая сквозной трассер на настоящем клиенте). Статус `human_needed` вызван тем, что исполнение SQL, живое закрытие, роли, браузер и устройства по правилам проекта остаются BLOCKED / ОЖИДАЕТ ВЛАДЕЛЬЦА и не записаны как PASS; три истины присутствуют, но не исполнялись (ACC-05/06, ACC-07, закрытие ON по умолчанию вживую), одна (причина долгой загрузки) не доказана. WR-07 цель не нарушает.

---

_Проверено: 2026-11-15_
_Верификатор: Claude (gsd-verifier)_
