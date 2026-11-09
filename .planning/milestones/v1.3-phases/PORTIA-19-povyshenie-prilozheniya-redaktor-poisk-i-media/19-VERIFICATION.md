---
phase: PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media
verified: 2026-11-03T20:00:00Z
status: gaps_found
score: 3/10 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-01-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-01-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-02-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-02-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-03-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-03-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-04-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-04-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-05-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-05-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-06-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-06-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-07-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-07-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-08-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-08-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-09-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-09-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-10-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-10-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-11-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-11-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-12-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-12-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-13-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-13-SUMMARY.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-14-PLAN.md"
  - ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-14-SUMMARY.md"
  - "app/api/uploads/route.ts"
  - "app/portia.css"
  - "components/portia-desktop-documents.tsx"
  - "components/portia-desktop-dossier.tsx"
  - "components/portia-desktop-media.tsx"
  - "components/portia-desktop-states.tsx"
  - "components/portia-desktop.tsx"
  - "components/portia-editor-dossier.tsx"
  - "components/portia-editor.tsx"
  - "components/portia-promotion-editor-main.tsx"
  - "components/portia-promotion-editor.tsx"
  - "components/portia-promotion-ordinary-editor.tsx"
  - "components/portia-promotion-qualification-editor.tsx"
  - "components/portia-promotion.tsx"
  - "lib/app-state.ts"
  - "lib/component-source.ts"
  - "lib/device-cache.ts"
  - "lib/editor-history.ts"
  - "lib/editor-save-status.ts"
  - "lib/image-upload.ts"
  - "lib/media-display.ts"
  - "lib/media-url.ts"
  - "lib/portia-employees.ts"
  - "lib/portia-promotion-reviewer.ts"
  - "lib/portia-promotion-sheet.ts"
  - "lib/portia-promotion-staging-roster.ts"
  - "lib/portia-promotion.ts"
  - "lib/search-index.ts"
  - "scripts/phase16-staging.mjs"
  - "scripts/phase19-acceptance.mjs"
  - "tests/e2e/fixtures/staging-harness.ts"
  - "tests/e2e/specs/app-states.spec.ts"
  - "tests/e2e/specs/editor-journeys.spec.ts"
  - "tests/e2e/specs/media-states.spec.ts"
  - "tests/e2e/specs/search-click.spec.ts"
  - "tests/e2e/specs/search.spec.ts"
covered_digest: "v4:sha256:5e95e2c7bbeaa1cb6bf9dfbee7a47776f7fa788fcc410e658bce376047e2acc0"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SC5 / STAB-PROM-15: владелец подряд принимает participant/reviewer, bank CRUD, ordinary, qualification, retake, cleanup и direct denial после clean reload на PC и phone на staging"
    status: failed
    reason: "Живая приёмка на staging не выполнена. Шаги 2-8 владелец прошёл на PRODUCTION по ошибке (инцидент), на staging подтверждён только шаг 10. Шаги 1, 9, 11 на staging не проводились, шаг 9 (cleanup) не проводился нигде. Вердикт владельца - вариант 2 (долг), не PASS."
    artifacts:
      - path: ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-PROMOTION-EVIDENCE.md"
        issue: "STAB-PROM-15: BLOCKED / открыт"
      - path: ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-UAT.md"
        issue: "Тест 13 blocked (prior-phase)"
    missing:
      - "Новый acceptance-seed на staging и повторное прохождение шагов 1-9 и 11 владельцем на PC и phone (по инструкции из 19-PROMOTION-UAT.md) с запуском сервера только из окружения staging"
  - truth: "SC1-SC4 / STAB-PROM-01..14: цель фазы - поток «Повышения» ДОКАЗАН на staging (участник, reviewer, банки, ordinary, qualification, retake, cleanup)"
    status: partial
    reason: "Серверная часть (RLS, RPC, гонки, CAS, lease, admission, cleanup-vs-admission) доказана live-receipts на staging (770 pass, residual 0) и юнит-тестами. UI-поток участника и reviewer на staging не подтверждён: ячейки матрицы в 19-PROMOTION-EVIDENCE.md = «не подтверждено на staging». Reviewer-часть (F9-F12) BLOCKED (ENV). Исключение - direct denial (шаг 10) PASS на staging."
    artifacts:
      - path: ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-PROMOTION-EVIDENCE.md"
        issue: "Матрица: UI/поток по STAB-PROM-02..14 не подтверждён на staging"
    missing:
      - "Тот же повторный прогон на staging (закрывает и STAB-PROM-15); аккаунт reviewer на staging для F9-F12 (прогон mw0rbyf6_72424cdc оставлен владельцу)"
  - truth: "SC10 / STAB-MEDIA-02, -03, -05: пустые/устаревшие/частичные данные не дают stale image, crash или ложный fallback; offscreen collections lazy и устойчивы"
    status: failed
    reason: "CR-01 (19-REVIEW.md) подтверждён чтением кода. В components/portia-desktop-media.tsx:48-58 таймер 15 с (MEDIA_SLOW_MS) стартует при монтировании кадра, а не при начале запроса; mediaLoadingAttrs('lazy') даёт loading=lazy; в components/portia-desktop-documents.tsx:104,176-179 разделы «Справочника» стартуют свёрнутыми (grid hidden, .guide-grid[hidden]{display:none}, portia.css:1816), но PortiaImage priority=lazy смонтирован внутри. Браузер не запрашивает lazy-картинку в display:none, complete=false, через 15 с state=failed, <img> размонтируется и больше не восстанавливается. Все обложки свёрнутых разделов навсегда «Изображение недоступно» для валидных ссылок. Тесты (media-states.spec.ts: 4 теста, только видимый портрет сотрудника) эту ветку не покрывают; на staging «Справочник» без данных, поэтому ни автоматика, ни владелец её не видели. Disposition: open."
    artifacts:
      - path: "components/portia-desktop-media.tsx"
        issue: "таймер 15 с для незапрошенных lazy/скрытых картинок, нет восстановления после failed"
      - path: "components/portia-desktop-documents.tsx"
        issue: "обложки в hidden-гриде и lazy-iframe EmbeddedDocument с тем же риском (таймер 49-53)"
      - path: "tests/e2e/specs/media-states.spec.ts"
        issue: "нет теста: открыть «Справочник», подождать 16 с, раскрыть раздел"
    missing:
      - "Запускать таймер только когда запрос мог начаться (IntersectionObserver / видимость); то же для EmbeddedDocument и свёрнутых окон"
      - "e2e/юнит-тест на свёрнутый раздел «Справочника» с данными (потребует данных или перехвата ТОЛЬКО картинок, как в media-states.spec.ts)"
      - "Вернуть STAB-MEDIA-02/-03/-05 в REQUIREMENTS.md из Complete в Pending до закрытия"
  - truth: "SC6 / STAB-DESK-08, STAB-APP-01..06, STAB-APP-10: каждое из восьми приложений различает loading, empty, populated, stale/degraded, denied, fatal"
    status: partial
    reason: "Доказано браузером и владельцем: loading, populated и fatal у всех, stale у 5 из 8 (Сотрудники stale на chromium-desktop BLOCKED (DATA)), empty у «Справочника» и «Сводки». BLOCKED (DATA), не PASS: empty для «База вирусов», «Сотрудники», «Информация», «Корзина» (21 skipped в прогоне A); populated для «Справочник» и «Сводка» (данных на staging нет, и именно эта ячейка попадает под CR-01); stale для «Справочник» и «Сводка»."
    artifacts:
      - path: ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-EVIDENCE.md"
        issue: "Матрица 8x6x2: 21 тест skipped = BLOCKED (DATA)"
    missing:
      - "Изолированный источник данных (или отдельный staging-seed) с пустыми и непустыми наборами для перечисленных ячеек, без подмены собственных /api"
deferred: []
advisory: []
---

# Phase PORTIA-19: «Повышение», приложения, редактор, поиск и медиа - отчёт о верификации

**Цель фазы:** Существующий поток «Повышения» доказан на staging от безопасного поиска ника до ручного решения reviewer, пересдачи и очистки без утечек и ложных успехов; все остальные пользовательские поверхности устойчиво работают с полными, пустыми, устаревшими, частичными и запрещёнными данными на PC и phone.
**Проверено:** 2026-11-03 (HEAD `4d66404`, ветка `design/stage-1-desktop`)
**Статус:** gaps_found
**Повторная верификация:** нет, начальная проверка

## Вывод

Цель фазы достигнута частично и не в полном объёме. Первая половина цели («Повышение» доказан на staging) не выполнена: серверная граница доказана, но живая приёмка потока на staging (STAB-PROM-15) не проведена, а прохождение владельца шагов 2-8 ушло на production по ошибке и не засчитано. Вторая половина (устойчивость остальных поверхностей) выполнена для редактора, поиска и upload/URL-контракта, но не для медиа: подтверждённый в коде дефект CR-01 ломает валидные картинки в свёрнутых разделах «Справочника», а часть ячеек матрицы состояний осталась BLOCKED (DATA). BLOCKED нигде не засчитан как PASS.

Регрессионный гейт оркестратора (`npm test` 1069/0, `tsc` 0 ошибок, `npm run build` OK) принят как данность; независимо перепрогнаны 62 теста (`search-index`, `app-state`, `media-display`, `editor-save-status`): 62 pass, 0 fail. Это доказывает чистоту модулей, но не поведение в браузере.

## Достижение цели

### Наблюдаемые истины (roadmap Success Criteria)

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | Участник без аккаунта видит только safe projection и одну допустимую action или стабильную русскую причину; outage/missing migration/stale/validation refusal не маскируются | PARTIAL (FAILED для «доказано на staging») | Сервер: live role matrix и promotion-live PASS (receipts, residual 0); юнит `portia-promotion-api`, `portia-promotion-ui`. UI-поток на staging: «не подтверждено» (19-PROMOTION-EVIDENCE.md) |
| 2 | Первый принятый запрос атомарно создаёт binding и один flow; cooldown не продлевается; reload восстанавливает; отказ не оставляет следов | PARTIAL | `admission-same-nickname`, `admission-split-device` PASS (staging). UI reload/чужой ник на staging не подтверждены. Дефект cooldown (столбец E) исправлен в `4d2a3e9`, повтор шага 6 был на production |
| 3 | Ordinary/qualification выдают immutable наборы; переходы, типы вопросов, server deadline, CAS, PC/phone policy, без утечки ключей | PARTIAL | `answer-cas`, `heartbeat-vs-expire`, `start-test-client-mode` PASS на staging; инвентарь RPC PASS. Видимое поведение на устройствах на staging не подтверждено |
| 4 | Reviewer с актуальным `promo` управляет очередью и банками, единолично claims, вручную выбирает итог; retake и cleanup соблюдают сроки | PARTIAL | `claim`, `release-reject-delete-vs-claim`, `cleanup-vs-admission` PASS; Playwright staging-authz 70 PASS. UI reviewer и cleanup (шаг 9) не проводились на staging; F9-F12 BLOCKED (ENV) |
| 5 | Владелец подряд принимает полный flow на физическом PC и phone | FAILED | STAB-PROM-15 BLOCKED/открыт; staging-шаг подтверждён только 10 (direct denial). Вариант 2 владельца = долг, не приёмка |
| 6 | Восемь приложений различают loading/empty/populated/stale/denied/fatal без потери last-good | PARTIAL | 77 passed / 21 skipped (BLOCKED DATA) / 0 failed; владелец PASS по пункту A (19-UAT тесты 6, 7, 8). Пустые/populated ячейки перечислены в gaps |
| 7 | Редактор на PC/phone: undo/redo, drafts, конфликт, save-all, grants, per-field errors, WYSIWYG; success после authoritative ответа | VERIFIED (автоматика), физический осмотр BLOCKED | `editor-journeys.spec.ts` 21/21 PASS на staging, receipt `evidence/receipt-playwright-19-14-editor-journeys.json` (residual 0); 19-UAT тест 11 помечен pass только как automated, владелец физически не проверял (нет аккаунта редактора). Предупреждение WR-05 |
| 8 | Глобальный поиск находит только разрешённое опубликованное, нормализует `е/ё`, открывает точную сущность, не индексирует private/answer keys | VERIFIED (с оговоркой) | `lib/search-index.ts`: явный allowlist полей, broadcasts фильтруются по `published`; click-through 5 из 7 типов PASS на обоих проектах, владелец PASS (тесты 3, 4, 5). Типы guide и broadcast: BLOCKED (DATA). Тест `ё/е` проходит и на нулевых счётчиках (WR-07) |
| 9 | Upload и URL проверяют реальные bytes, размер, формат, scheme/path; UUID URL; fallback для legacy | VERIFIED | `app/api/uploads/route.ts` (MIME + размер + magic bytes, путь `recycle/<crypto.randomUUID()>.<ext>`, `upsert:false`), `lib/media-url.ts` (отвергает `//`, `/\`, управляющие символы); сценарии 4 и 5 mutation-lane PASS (поддельный PNG отклонён, значение поля не стёрто) |
| 10 | Hero с приоритетом, offscreen lazy, immutable media кэшируется, смена записи/ошибка/blocked host не дают stale image, crash, infinite spinner | FAILED | Hero/lazy/immutable cache (`cacheControl: "31536000"`) и смена A->B->A подтверждены; но CR-01 даёт ложный постоянный «Изображение недоступно» для незапрошенных lazy/скрытых картинок. STAB-MEDIA-04 остаётся Pending (инвалидация ревизии не доказана в браузере) |

**Счёт:** 3/10 истин подтверждено (7, 8, 9); 4 истины PARTIAL (1-4 и 6 учитываются как не подтверждённые), 2 FAILED (5, 10).

### Отложенные пункты

Нет. Кандидат: SC7 фазы 20 («Владелец на физическом PC/phone принимает полный «Повышение»...»). Но STAB-PROM-15 закреплён за фазой 19 в REQUIREMENTS.md и отсутствует в списке требований фазы 20, формулировка фазы 20 не называет staging-доказательство серверного потока, поэтому пункт не переносится в `deferred`. Решение о переносе - за владельцем.

### Обязательные артефакты

| Артефакт | Ожидание | Статус | Детали |
|----------|----------|--------|--------|
| `app/api/uploads/route.ts` | проверка bytes/size/MIME, UUID путь | VERIFIED | 59 строк, magic bytes, cacheControl 1 год; WR-03 (403 вместо 503, formData до size gate) |
| `components/portia-desktop-media.tsx` | PortiaImage со скелетоном, fallback, 15 с | WIRED, дефектен | используется в employees/info/trash/guide; CR-01 |
| `components/portia-desktop-states.tsx`, `lib/app-state.ts` | единые состояния приложений | VERIFIED | подключены в `portia-desktop.tsx`, юнит 62 pass |
| `lib/search-index.ts` | allowlist-индекс 7 типов | VERIFIED | 177 строк, тесты pass |
| `lib/editor-save-status.ts`, `components/portia-editor.tsx` | статусы сохранения, конфликт, частичное сохранение | VERIFIED | e2e 21/21; WR-05 в `EmployeeProfilesEditor` |
| `components/portia-promotion.tsx`, `lib/portia-promotion-reviewer.ts` | поток участника и reviewer | WIRED | WR-04 (не-503 ошибка опроса сбрасывает статус и снимает замок теста), WR-06 (`keyPattern` отвергает ники на `_` и кириллицу) |
| `scripts/phase19-acceptance.mjs`, `lib/portia-promotion-staging-roster.ts` | seed/teardown приёмки, fail-closed ростер | VERIFIED | teardown выполнен, residual 0 (`evidence/19-ACCEPTANCE-TEARDOWN.json`); WR-01, WR-02 |
| `evidence/receipt-*.json` (8 файлов), `19-ACCEPTANCE-RUN.json` | receipts прогонов | EXISTS | прочитаны названия и сводка в evidence-доках; содержимое receipts в этой проверке не пересчитывалось |

### Проверка ключевых связей

| Откуда | Куда | Через | Статус | Детали |
|--------|------|-------|--------|--------|
| `PortiaImage` (documents.tsx:172,179) | таймер `MEDIA_SLOW_MS` | `useEffect` без привязки к видимости | BROKEN для скрытых/lazy | CR-01 |
| `PortiaPromotion.loadStatus` | клиентский замок теста | `onLockChange` при размонтировании `QualificationRunner` | PARTIAL | WR-04: не-503 при опросе вызывает `setStatus(null)` |
| `reset-device` reviewer UI | RPC | `keyPattern` | PARTIAL | WR-06: тихий 400 для нетипичных ников |
| Поиск | окно-владелец | `data-search-hit`/`aria-current` | WIRED | 5 из 7 типов e2e PASS |
| Upload route | `portia-media` bucket | `storage.upload(recycle/<uuid>)` | WIRED | |

### Трассировка потока данных (Level 4)

| Артефакт | Переменная | Источник | Реальные данные | Статус |
|----------|------------|----------|-----------------|--------|
| «Справочник» (обложки) | `item.cover` -> `PortiaImage` | реальный контент `portia_content` | да, но `state` принудительно становится `failed` | HOLLOW для свёрнутых разделов (CR-01) |
| «Сотрудники» (портрет) | `portrait` | живой ростер Google Sheet | да | FLOWING (видимый портрет, media-states PASS) |
| Поиск | `SearchIndexInput` | контент, сотрудники, корзина | да | FLOWING |

### Поведенческие проверки

| Поведение | Команда | Результат | Статус |
|-----------|---------|-----------|--------|
| Индекс поиска, app-state, media-display, editor-save-status | `node --experimental-strip-types --test lib/search-index.test.ts lib/app-state.test.ts lib/media-display.test.ts lib/editor-save-status.test.ts` | 62 pass, 0 fail | PASS |
| Лишний таймер для lazy-картинки в `display:none` | чтение кода (поведение браузера не запускалось) | гарантируется семантикой lazy-loading; подтверждено структурой кода | FAIL (по коду) |
| Browser e2e, Supabase, staging | не запускались (запрет задания) | - | SKIP, доказательства взяты из receipts и evidence-доков |

### Выполнение probe

Не применимо: PLAN не объявляют `probe-*.sh`. В `scripts/*/tests` проб для этой фазы нет.

### Покрытие требований

Все 35 ID фазы заявлены в PLAN-frontmatter (19-01..19-14) и в REQUIREMENTS.md; осиротевших требований нет. Побочное наблюдение: план 19-09 заявляет `STAB-MOTION-05`, которое в REQUIREMENTS.md закреплено за Phase 18 (Pending); в список фазы 19 оно не входит и здесь не засчитывается.

| Требование | Статус | Доказательство / причина |
|------------|--------|---------------------------|
| STAB-PROM-01 | PARTIAL | сервер PASS; UI и закрытие доступа удалением строки таблицы на staging не подтверждены |
| STAB-PROM-02 | PARTIAL | юнит PASS; UI на staging не подтверждён |
| STAB-PROM-03 | PARTIAL | admission-гонки PASS; UI не подтверждён |
| STAB-PROM-04 | PARTIAL | partial unique и гонки PASS; границы 5/15/60 мин на staging не подтверждены |
| STAB-PROM-05 | NEEDS HUMAN | только юнит; staging UAT не проведён |
| STAB-PROM-06 | PARTIAL | инвентарь RPC PASS; поток не подтверждён |
| STAB-PROM-07 | PARTIAL | CAS/heartbeat PASS; видимое поведение не подтверждено |
| STAB-PROM-08 | PARTIAL | режим клиента фиксируется сервером (PASS); поведение на PC/phone не подтверждено |
| STAB-PROM-09 | PARTIAL | claim, revoke, direct denial PASS на staging; badges и очередь не подтверждены |
| STAB-PROM-10 | NEEDS HUMAN | только юнит |
| STAB-PROM-11 | NEEDS HUMAN | только юнит |
| STAB-PROM-12 | NEEDS HUMAN | только юнит |
| STAB-PROM-13 | PARTIAL | cleanup-vs-admission PASS; шаг 9 не проводился нигде |
| STAB-PROM-14 | PARTIAL | различие кодов ошибок PASS (сервер, юнит); UI-состояния не подтверждены |
| STAB-PROM-15 | BLOCKED | приёмка на staging не проведена |
| STAB-DESK-08 | PARTIAL | см. gap SC6 (21 ячейка BLOCKED DATA) |
| STAB-APP-01 | PARTIAL | loading/populated/stale/fatal PASS; empty BLOCKED (DATA) |
| STAB-APP-02 | PARTIAL | populated/fatal PASS, stale desktop BLOCKED (DATA), phone PASS; empty BLOCKED (DATA) |
| STAB-APP-03 | PARTIAL | «Сводка» populated/stale BLOCKED (DATA), данных на staging нет |
| STAB-APP-04 | PARTIAL | «Информация» PASS; «Справочник» populated BLOCKED (DATA) и под CR-01 |
| STAB-APP-05 | PARTIAL | «Корзина» populated/stale/fatal PASS, owner PASS; empty BLOCKED (DATA) |
| STAB-APP-06 | SATISFIED | «Таблица» и «Устав»: loading/populated/fatal PASS на обоих проектах, empty/stale N/A по дизайну, owner PASS (тест 7) |
| STAB-APP-07 | SATISFIED (автоматика) / NEEDS HUMAN | e2e 21/21; физически не проверено; WR-05 (сырой `error.message` в редакторе сотрудников) |
| STAB-APP-08 | SATISFIED (автоматика) / NEEDS HUMAN | юнит `rich-text-style`, `panel-position`; физический осмотр WYSIWYG на phone не проведён |
| STAB-APP-09 | SATISFIED | `editor-journeys` сценарий 6 и `staging-authz` PASS; fail-closed сообщение подтверждено |
| STAB-APP-10 | PARTIAL | см. SC6 |
| STAB-SEARCH-01 | SATISFIED | allowlist, `published`-фильтр, нормализация `е/ё` (юнит + owner PASS) |
| STAB-SEARCH-02 | PARTIAL | 5 из 7 типов подтверждены; guide и broadcast BLOCKED (DATA) |
| STAB-SEARCH-03 | SATISFIED | owner PASS теста 5 (Ctrl+K, стрелки, Enter, Esc) |
| STAB-SEARCH-04 | SATISFIED | allowlist исключает `scientistLogs`/drafts/keys (код, юнит); поведение при deleted-after-poll отдельно в браузере не показано |
| STAB-MEDIA-01 | SATISFIED | route читает bytes, 415 на подделку, сценарий 4 PASS |
| STAB-MEDIA-02 | PARTIAL | URL-контракт един (`media-url.ts`, SQL); рендер выдаёт ложный fallback для валидных ссылок (CR-01); в REQUIREMENTS стоит Complete |
| STAB-MEDIA-03 | BLOCKED by CR-01 | hero/lazy/смена записи PASS, но offscreen lazy ломается; в REQUIREMENTS стоит Complete |
| STAB-MEDIA-04 | PARTIAL | год кэша и один fetch подтверждены (сценарий 5); инвалидация ревизии не доказана; Pending верно |
| STAB-MEDIA-05 | BLOCKED by CR-01 | 404/never-answers для видимого портрета PASS; скрытые lazy-картинки ложно падают; в REQUIREMENTS стоит Complete |

### Найденные анти-паттерны

| Файл | Строка | Паттерн | Серьёзность | Влияние |
|------|--------|---------|-------------|---------|
| `components/portia-desktop-media.tsx` | 48-58 | таймер до начала запроса | BLOCKER | CR-01: валидные обложки навсегда «недоступны» |
| `components/portia-desktop-documents.tsx` | 49-53, 104, 176-179 | то же для lazy-iframe и скрытого грида | BLOCKER (часть CR-01) | |
| `components/portia-promotion.tsx` | 326-333 | любая не-503 ошибка опроса сбрасывает статус | Warning | WR-04: теряется UI теста, снимается замок |
| `lib/portia-promotion-reviewer.ts` | 30 | `keyPattern` только ASCII, первый символ буква/цифра | Warning | WR-06: reset-device тихо отвергает ники |
| `components/portia-editor.tsx` | 1808, 1834-1835 | сырой `error.message`, нет защиты от двойной отправки | Warning | WR-05 |
| `app/api/uploads/route.ts` | 18-35 | сбой проверки прав -> 403, formData до size gate | Warning | WR-03 |
| `scripts/phase16-staging.mjs` | 38-53 | `parseDbUrl` игнорирует query | Warning | WR-01 (guard staging/production) |
| `scripts/phase19-acceptance.mjs` | 256-359 | teardown по окну времени | Warning | WR-02 |
| `tests/e2e/specs/search.spec.ts` | 88, 115-121 | тест `ё/е` проходит на нулях | Warning | WR-07: ложная уверенность |
| маркеры `TBD`/`FIXME`/`XXX` | - | не найдены в исходниках фазы | - | - |

Все семь Warning и CR-01 имеют disposition `open` (19-REVIEW-DISPOSITION.md); пять Info перенесены в Phase 20.

### Требуется проверка человеком

Эти пункты остаются BLOCKED и в `score` не засчитаны.

1. **Живая приёмка «Повышения» на staging (STAB-PROM-15, шаги 1-9 и 11)**
   **Тест:** новый acceptance-seed, сервер только из окружения staging (`refHash 01d085e7b9f0`), затем чек-лист `19-PROMOTION-UAT.md` на PC и phone.
   **Ожидается:** participant -> reviewer -> bank CRUD -> ordinary -> qualification -> retake -> cleanup -> direct denial без unresolved failures.
   **Почему человек:** физические устройства и аутентифицированные роли на staging.
2. **Reviewer-часть (F9-F12)**: переносы предупреждений, прокрутка длинной очереди и банков, длинный вопрос рядом с ✓/✗, скелетон очереди. Нужен аккаунт проверяющего (run `mw0rbyf6_72424cdc` есть, не пройден).
3. **Редактор физически (D)** на PC и phone: нужен временный staging-аккаунт редактора.
4. **«Справочник» и «Сводка» с данными**: populated/stale, поиск типов guide и broadcast, и CR-01 при раскрытии свёрнутого раздела.
5. **Empty-состояния** «База вирусов», «Сотрудники», «Информация», «Корзина» (источник без записей).

### Сводка по разрывам

Три группы причин. (1) Доказательство потока «Повышения» на staging неполно: серверная сторона проверена автоматикой, пользовательский поток и решение владельца - нет, и это сказано прямо в 19-PROMOTION-EVIDENCE.md, 19-UAT.md и 19-06-SUMMARY.md (инцидент production, вариант 2). Это закрывается только повторным прогоном (STAB-PROM-01..15). (2) Дефект CR-01 в `PortiaImage` является регрессом плана 19-10 и ломает именно «частичные/скрытые» данные; требования STAB-MEDIA-02/-03/-05 помечены Complete преждевременно. (3) Данные staging не позволяют показать половину ячеек матрицы состояний; эти ячейки честно BLOCKED (DATA). Предупреждения WR-01..WR-07 не блокируют цель сами по себе, но WR-04 и WR-06 затрагивают поведение потока «Повышения» (STAB-PROM-07/-09) и должны быть учтены при повторной приёмке.

Рекомендованный маршрут: `/gsd-plan-phase --gaps` для исправления CR-01 (с тестом), затем новый seed и живая приёмка на staging. Либо владелец явным решением переносит остаток STAB-PROM-15 и BLOCKED-ячейки в Phase 20 (тогда нужен `overrides` с указанием ответственного).

---

_Проверено: 2026-11-03T20:00:00Z_
_Верификатор: Claude (gsd-verifier)_
