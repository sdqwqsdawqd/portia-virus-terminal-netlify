---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 60
subsystem: release-gate
tags: [D-69, G1, about:srcdoc, trace-snapshotter, STAB-REL-03, STAB-TMPL-01, STAB-A11Y-01]
requires:
  - phase: PORTIA-20
    provides: "20-13 rehearsal FAIL (D-69 gap closure), 20-58 owner verdict, 20-59 explicit npm"
status: in-progress
outcome: in-progress
g1_class: T
plan_head_before: 74fe13c91c22bd82fd3028d2e5b7e3091b1d168a
---

# Phase 20 Plan 60: причина красного ui-contract-offline (G1) Summary

PLAN_BASE: 74fe13c91c22bd82fd3028d2e5b7e3091b1d168a

Черновик после Task 1 (точка возобновления): причина установлена, исправления ещё нет. Код продукта не менялся и не будет менять (класс T).

## Причина (G1)

Систематическая отладка по D-69: сначала воспроизведение тем же инструментом, затем матрица с одним изменяемым фактором, затем источник скрипта в трассировке и в коде Playwright, и только после этого место исправления. До записи этого раздела ни один файл кода и тестов не менялся.

### Воспроизведение раннером на HEAD (шаг 1 из verify)

`node --experimental-strip-types scripts/phase20-release-gate.mjs --run --commit HEAD --only npm-ci,ui-contract-offline --npm-cli "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"` на Node 22.13.1, commit `74fe13c91c22bd82fd3028d2e5b7e3091b1d168a` (код продукта равен `0c2a59d1d1a7`: `git diff --name-only 0c2a59d1d1a7 HEAD -- app components public lib` без `*.test.*` пуст). Строка протокола `npm: 11.19.0 (--npm-cli …)`.

- Артефакты: `test-results/release-gate/74fe13c91c22-20261108T132048256Z/` (каталог в .gitignore).
- npm-ci PASS; ui-contract-offline FAIL, exit 1: шаг 1 — 31 passed, 9 failed, 2 skipped; шаг 2 — 13/2/5; шаг 3 — 87/0/3; шаг 4 — 8/0/4. Итого 139/11/14, то же, что в 20-13 (c11adf6). Воспроизведено полностью и детерминированно (это третий прогон: два были в 20-13 на c11adf6, этот на 74fe13c).
- Упавшие: те же 11 тестов, что в 20-13. Запись `portia-diagnostics` в каждом: разрешённый 404 `/api/promotion/status` и ровно одно непредусмотренное `{ kind: "console", source: "browser:", text: "Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set." }`; в тесте «an encoding failure keeps the draft…» таких записей пять — по одной на каждую попытку скачать PNG (null, throw, context, decode и повтор).
- Порт 3100 после раннера: 0 слушателей; копия `portia-release-*` раннером удалена.

Значит расхождение с 20-58 не случайность запуска и не обёртка npm (20-13 шёл через `npm.cmd` в scratchpad, этот прогон — через `--npm-cli`): причина в чём-то, чем раннер отличается от прогона 20-58.

### Матрица (один тест D-55 PNG, `chromium-desktop`, сервер production под `offline-supabase.cjs`)

Копии на HEAD, без env-файлов, без junction и symlink: WT — `node_modules` физической копией robocopy из основной папки; WT_CI — чистый `npm ci` (npm 11.19.0, по закоммиченному lockfile). Playwright 1.64.1 в обеих. Сборка каждой копии `next build` exit 0.

| Копия | Флаги | Результат | Событие `about:srcdoc` в `portia-diagnostics` |
|-------|-------|-----------|-----------------------------------------------|
| WT (robocopy) | F0 `--retries=0` (флаги 20-58) | passed | нет |
| WT (robocopy) | F1 F0 + `--fail-on-flaky-tests` | passed | нет |
| WT (robocopy) | F2 F0 + `--trace=retain-on-first-failure` | failed | 1 |
| WT (robocopy) | F3 все три флага раннера | failed | 1 |
| WT_CI (`npm ci`) | F0 | passed | нет |
| WT_CI (`npm ci`) | F1 | passed | нет |
| WT_CI (`npm ci`) | F2 | failed | 1 |
| WT_CI (`npm ci`) | F3 | failed | 1 |
| WT_CI | F0 + `trace: {mode: retain-on-first-failure, snapshots: true}` из временного конфига | failed | 1 |
| WT_CI | F0 + `trace: {mode: retain-on-first-failure, snapshots: false}` из временного конфига | passed | нет |

Временные конфиги (`pw-trace-*.config.ts`, обёртка над `playwright.config.ts` с заменой `use.trace`) жили только в копии WT_CI и удалены вместе с ней; в репозиторий не попадали.

Читается так:

- Один фактор переворачивает результат: `--trace=retain-on-first-failure`. Без него (F0, F1) зелёно, с ним (F2, F3) красно, в обеих копиях одинаково.
- `--fail-on-flaky-tests` ни при чём (F1 зелёный).
- Способ получения `node_modules` ни при чём (robocopy и `npm ci` дают одинаковые клетки), то есть кандидат из 20-13 «чистая установка зависимостей npm 11.19.0» опровергнут. Версии транзитивных пакетов копий не сравнивались: клетки совпали и без этого.
- Внутри трассировки виновата ровно часть «снимки DOM» (`snapshots: true` красно, `snapshots: false` зелено; скриншоты и видео остаются включены).

### Кадр и источник скрипта

Трассировка воспроизведения (`ui-contract-1/…D-55-the-downloaded-PNG-is-the-archive-card-chromium-desktop/trace.zip`, распакована в scratchpad): событие `console` `messageType: error`, `location.url = "about:srcdoc"`, строка 0, колонка 0, время 29940,5 мс. Вокруг него: действие `click` «Скачать PNG» (`click action done` в 29938,5 мс, «waiting for scheduled navigations»), экранные кадры страницы, затем `after`-снимок кадра `frame@68af…` (основная страница `http://127.0.0.1:3100/`). Событие приходит через ≈2 мс после клика, когда обработчик уже создал скрытый кадр.

Кадр — это `iframe` из `measureCardPage` (`components/portia-template-builder.tsx`, строки 207-231): `sandbox="allow-same-origin"` (без `allow-scripts`), `srcdoc` = страница карточки, создаётся при каждом скачивании PNG и удаляется в `finally`. Один кадр на одну попытку PNG — отсюда по одному событию на попытку (пять в тесте с отказом кодирования). Источник у записи `browser:` без имени, потому что `new URL("about:srcdoc").hostname` пуст (`installDiagnostics` пишет `browser:<hostname>`).

Кто пытается исполнить скрипт: сам инструмент проверки. Playwright 1.64.1, `node_modules/playwright-core/lib/coreBundle.js`, класс `Snapshotter` (строки 15961-16076):

- `_initialize` (≈16003-16005): `context.addInitScript(frameSnapshotStreamer…)` и `safeNonStallingEvaluateInAllFrames(initScriptSource, "main")`;
- `_captureFrameSnapshot` (≈16014-16016): `frame.nonStallingRawEvaluateInExistingMainContext("window[…].captureSnapshot(…)")` для каждого кадра страницы на каждом шаге `before/action/after`;
- `_annotateFrameHierarchy` (≈16058-16070): `context.evaluate(… markIframe …)` при каждом присоединении кадра.

Эти вызовы запускают собственный JavaScript Playwright в главном мире каждого кадра, в том числе в кадре без `allow-scripts`; Chromium блокирует его этим сообщением. Снимки DOM включаются только при трассировке (`trace: "on-first-retry"` при `retries: 0` в `playwright.config.ts` — выключено), поэтому без `--trace` кадр никто не трогает. Это подтверждено клеткой `snapshots: false`.

Исполняемого содержимого в самой странице кадра нет:

- Страницу строит `templateCardDocument(card.html, card.css, card.title)` (`lib/portia-template-export.ts`, строки 355-365) в `onDownload` (`components/portia-template-builder.tsx`, строка 351), и именно эта строка `page` затем и скачивается как HTML (строка 353: `content = page`) и отдаётся в `measureCardPage(page)` (строка 355). Построитель страницы кадра = построитель скачанного HTML.
- Закрытая политика проходит до кадра: `ensureClean(page, "html")` (строка 352, `templateExportViolations`, `lib/portia-template-export.ts` строки 388-407: external address, `<script`, `<link`, `url(`, обработчики `on…=`, ссылочные атрибуты, `iframe/object/embed/base/form/…`, не-data изображения) стоит раньше `measureCardPage` (355). Нарушение даёт `throw`, кадр не создаётся.
- Встроенная политика страницы: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">` (строка 359) — скрипты запрещены дважды (песочница и политика).

### Вывод

- Класс: T. Событие порождает инструмент проверки (снимки DOM трассировки Playwright, которые раннер включил флагом `--trace=retain-on-first-failure`) в кадре, который продукт намеренно изолирует без разрешения скриптов. Событие — свидетельство работающей песочницы, а не исполненного содержимого страницы. Дефекта продукта нет, код продукта не меняется.
- Почему в 20-58 было 0 упавших: 20-58 гонял Playwright только с `--retries=0` (клетка F0 зелёная на этом же коде), без `--trace`; раннер 20-13 впервые добавил `--trace=retain-on-first-failure` к тем же проверкам. Расхождение — флаг, а не код и не установка зависимостей. Опровергнуты оба кандидата из 20-13 (`--fail-on-flaky-tests`, чистая установка).
- Гипотеза планировщика подтверждена по существу (трассировка, песочница `allow-same-origin`, скрытый кадр measureCardPage), с уточнением: виноваты снимки DOM трассировки, не весь `--trace`.
- Место исправления (ветка T): правило ожидаемого события только в тестах, которые создают кадр измерения PNG, с точным текстом и источником `browser:` (`tests/e2e/fixtures/diagnostics.ts`, `DiagnosticLedger.expectFault`); глобальный allowlist остаётся 11 строк; флаги раннера, `playwright.config.ts`, песочница и CSP не меняются. Свойство безопасности, которое событие могло бы сигнализировать (в странице кадра есть исполняемое содержимое), закрепляется отдельно: unit-тест песочницы (`allow-same-origin` и ничего больше) и порядка «проверка политики до кадра», e2e-проверка скачанного HTML без `<script`, обработчиков и `javascript:`. Обоснование по причине, а не по удобству: единственный источник события — инструмент, которого в продукте нет, а правило не прячет событие того же вида от страницы, потому что страница проверяется до кадра и после (скачанный файл).

Тесты, создающие кадр измерения PNG (клики «Скачать PNG» в `tests/e2e/specs/template-builder.spec.ts`, фикстура `diagnostics`): строки 453, 481, 616, 679, 1265 (пять; в `accessibility.spec.ts` кнопки «Скачать PNG» нет, а тест D-61 PNG работает в собственном контексте `browser`, где диагностика фикстуры не подключена).

Полученное состояние среды после Task 1: сервер остановлен по проверенному PID, порт 3100 — 0 слушателей, обе копии `portia-20-60-*` удалены (`git worktree list` без них), `tests/e2e/visual/__screenshots__` не менялся.
