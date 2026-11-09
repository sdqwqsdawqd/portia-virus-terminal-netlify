---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 60
subsystem: release-gate
tags: [D-69, G1, about:srcdoc, trace-snapshotter, STAB-REL-03, STAB-TMPL-01, STAB-A11Y-01]
requires:
  - phase: PORTIA-20
    provides: "20-13 rehearsal FAIL (D-69 gap closure), 20-58 owner verdict, 20-59 explicit npm"
provides:
  - "tests/e2e/fixtures/diagnostics.ts: sandboxedMeasureFrameScriptBlock (правило ожидаемого события кадра измерения PNG)"
  - "lib/portia-template-builder.test.ts: охрана песочницы measureCardPage и порядка «политика до кадра»"
  - "ui-contract-offline раннера: PASS 150/0/14 на 3e27b1e"
affects: [20-61, 20-63]
key-files:
  modified:
    - tests/e2e/fixtures/diagnostics.ts
    - lib/e2e-diagnostics.test.ts
    - lib/portia-template-builder.test.ts
    - tests/e2e/specs/template-builder.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/deferred-items.md
key-decisions:
  - "D-69 G1: причина события about:srcdoc — снимки DOM трассировки Playwright (флаг раннера --trace) в песочнице кадра measureCardPage; класс T, код продукта не менялся"
  - "Правило ожидаемого события только в пяти тестах с PNG (expectFault), глобальный allowlist 11 строк; свойство безопасности проверяется отдельно, не через консоль"
status: complete
outcome: complete
g1_class: T
plan_head_before: 74fe13c91c22bd82fd3028d2e5b7e3091b1d168a
plan_head_after: abdc4c4e3e9975a4b2f4f455e14ae6cd683dc794
commits: 4
actuals:
  tokens: 36000
  tasks: 3
  commits: 4
---

# Phase 20 Plan 60: причина красного ui-contract-offline (G1) Summary

Событие `Blocked script execution in 'about:srcdoc'` порождал не продукт, а инструмент проверки: флаг раннера `--trace=retain-on-first-failure` включает снимки DOM трассировки Playwright, и их скрипт упирается в песочницу скрытого кадра `measureCardPage`. Событие ожидаемо только в пяти тестах, которые скачивают PNG; песочница кадра и чистота страницы закреплены отдельными проверками. Код продукта не менялся, эталоны (`tests/e2e/visual/__screenshots__`) не менялись, вердикт владельца не трогался.

PLAN_BASE: 74fe13c91c22bd82fd3028d2e5b7e3091b1d168a

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | a6a77ae | docs: root cause of the about:srcdoc console event (G1) |
| 2 RED | 7c06c4d | test: RED for the expected sandboxed measuring-frame event (файл не загружается: нет экспорта) |
| 2 GREEN | 3e27b1e | test: expect the sandboxed measuring-frame event only where a PNG is made (G1) |
| 2 docs | abdc4c4 | docs: close the ui-contract-offline entry of deferred-items (G1) |

`commits: 4` измерено `git rev-list --count 74fe13c91c22..HEAD` на abdc4c4 (до коммита этого SUMMARY).

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

Состояние среды после Task 1: сервер остановлен по проверенному PID, порт 3100 — 0 слушателей, обе копии `portia-20-60-*` удалены (`git worktree list` без них), `tests/e2e/visual/__screenshots__` не менялся.

## Task 2: исправление в месте причины (ветка T)

Код продукта (`app`, `components`, `public`, `lib` без `*.test.*`) не менялся: `git diff --name-only 0c2a59d1d1a7 HEAD -- app components public lib | grep -v '\.test\.'` пуст (в разности только `lib/e2e-diagnostics.test.ts`, `lib/e2e-visual-policy.test.ts`, `lib/phase15-visual-manifest.test.ts`, `lib/phase20-release-gate.test.ts`, `lib/portia-template-builder.test.ts`).

Построитель страницы кадра = построитель скачанного HTML: `templateCardDocument`, `lib/portia-template-export.ts:355-365`, вызов `components/portia-template-builder.tsx:351`; `ensureClean(page, "html")` — строка 352, `measureCardPage(page)` — строка 355; тот же `page` уходит в файл HTML (строка 353). Новой проверки на странице кадра отдельным построителем не потребовалось.

- RED (7c06c4d): три теста нового `describe` в `lib/e2e-diagnostics.test.ts` против ещё не существующего экспорта. Вывод: `SyntaxError: The requested module '../tests/e2e/fixtures/diagnostics.ts' does not provide an export named 'sandboxedMeasureFrameScriptBlock'`, файл не загружается, `not ok 1`.
- GREEN (3e27b1e):
  - `tests/e2e/fixtures/diagnostics.ts`: `export const sandboxedMeasureFrameScriptBlock: ExpectedFaultRule` — `kind: "console"`, `source: "browser:"`, текст — регулярное выражение от начала до конца на измеренное сообщение, `reason` называет measureCardPage и 20-60, комментарий в две строки (почему ожидаемо; чем компенсировано).
  - `tests/e2e/specs/template-builder.spec.ts`: `diagnostics.expectFault(sandboxedMeasureFrameScriptBlock)` в начале пяти тестов с кликом «Скачать PNG»: D-55 PNG, «a local image and long text…», «an encoding failure…», «a card too long for PNG…», D-65 PC (в D-65 PC — после `test.skip`).
  - Свойство безопасности: `expectNoExecutableContent(html)` (`templateExportViolations` пуст, нет `<script`, нет `<…on…=`, нет `javascript:`) в трёх тестах скачанного HTML: «D-55 the downloaded HTML is the archive card», «a local image and long text…» (HTML того же содержимого, что и PNG), «participant builds a text template…» (враждебное имя `<img onerror=…>` в экранированном виде). В `accessibility.spec.ts` кадра нет, файл не менялся.
  - `lib/portia-template-builder.test.ts`: два теста. (1) песочница `measureCardPage` — ровно одно `setAttribute("sandbox", "allow-same-origin")`, ни одного другого разрешения, нет `.sandbox`, `srcdoc = page`, нет `.src =`/`contentWindow`/`eval`, кадр удаляется, в файле нет слова `allow-scripts`. (2) порядок «собрана — проверена закрытой политикой — измерена», тот же `page` идёт в HTML, `ensureClean` бросает при любом нарушении, единственный вызов `measureCardPage`.
  - Мутационная проверка охранных тестов через `GSD_PROHIB_SUBJECT` (копии компонента в scratchpad): песочница `allow-same-origin allow-scripts` — тест 1 красный; убрана `ensureClean(page, "html")` — тест 2 красный; убран атрибут sandbox — тест 1 красный. Настоящий компонент — оба зелёные.
- Не менялись: глобальный allowlist (тест «keeps the global allowlist at 11 rows» зелёный, плюс такая же проверка в новом `describe`), флаги раннера, `playwright.config.ts`, песочница, CSP, `tests/e2e/visual/__screenshots__`.

### Проверки

| Проверка | Результат |
|----------|-----------|
| `node --experimental-strip-types --test lib/e2e-diagnostics.test.ts lib/portia-template-builder.test.ts lib/portia-template-export.test.ts` | 50 tests, 50 pass, 0 fail |
| `node --experimental-strip-types --test lib/*.test.ts` (основная папка, Node 22.13.1) | 1643 tests, 1640 pass, 0 fail, 3 skipped (до правки 20-59/20-13: 1615/1612) |
| `tsc --noEmit` | exit 0 |
| `eslint . --ignore-pattern dist --ignore-pattern .next` | exit 0, 0 errors, 17 warnings (как раньше) |
| Раннер `--run --commit HEAD --only npm-ci,ui-contract-offline --npm-cli …` на 3e27b1e (`test-results/release-gate/3e27b1e2d544-20261108T133841857Z/`) | npm-ci PASS; ui-contract-offline PASS (offline D-68) 150 passed / 0 failed / 14 skipped (по проекту 14, каждый пропуск объяснён правилом 20-59); шаги 40/0/2, 15/0/5, 87/0/3, 8/0/4; было 139/11/14 |
| Контроль с флагами 20-58 (F0 `--retries=0`), копия на HEAD, chromium-desktop + chromium-phone, `template-builder.spec.ts` + `accessibility.spec.ts` `-g "STAB-TMPL-01\|template builder"` | 40 passed, 0 failed, 2 skipped (число 20-58: 40/0/2) |

Правило видно в протоколе: в результатах раннера вложение `portia-diagnostics-expected-faults` показывает совпадения (19 событий в 12 запусках зарегистрировавших правило тестов); в контроле без `--trace` событий нет, правило не срабатывает.

Порт 3100 после каждого шага: 0 слушателей; копии `portia-20-60-*` и `portia-release-*` удалены; `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст.

## Task 3

Task 3 не требуется: код продукта после 0c2a59d1d1a7 не менялся. Владельцу ничего не отправляется, `owner_verdict*` не писались, строка «Код продукта» репетиции остаётся «НЕ ИЗМЕНЁН».

## Deviations from Plan

**1. [Rule 3 - Blocking] Расширение матрицы подвариантами трассировки.** План предписывал клетки F0-F3 в двух копиях; к ним добавлены две клетки с временным конфигом `trace: {mode: retain-on-first-failure, snapshots: true|false}`, чтобы отделить снимки DOM от остальных частей трассировки. Конфиги жили только в копии и удалены с ней. Результат вошёл в раздел «Причина (G1)».

**2. [Rule 3 - Blocking, среда] Ошибка пути при повторной копии.** При создании копии для контроля с флагами 20-58 я поставил `MSYS_NO_PATHCONV=1` на всю команду, и `git worktree add` создал копию по пути `C:/c/Users/User/AppData/Local/Temp/portia-20-60-verify`, а robocopy положил `node_modules` в правильный каталог. Копию по неверному пути убрал `git worktree remove --force` + `prune`, `node_modules`/`.next` по верному пути удалил `rm -rf` по полному пути, копию создал заново. Остались пустые каталоги `C:\c\Users\User\AppData\Local\Temp` (цепочка `C:\c`), созданные этой ошибкой: удаление `rmdir /c/c` заблокировано защитной проверкой Claude Code (подходит под «критический каталог»), я его не обходил. Удалить `C:\c` вручную безопасно (в нём нет файлов). На результаты это не влияет: сервер и прогон шли только из правильной копии.

## Deferred Issues

Нет новых. Остальные пункты D-69 (G2, G3, G6) в планах 20-61..20-63. Нерасследованное по этому плану: версии транзитивных пакетов двух копий не сравнивались, так как клетки F0/F3 совпали в обеих копиях.

## Known Stubs

None.

## Threat Flags

None. Новых сетевых путей, путей авторизации и доступа к файлам нет; правило ожидаемого события не расширяет доверие: оно принадлежит пяти тестам, точное по тексту и источнику, а исполняемое содержимое страницы проверяется отдельно (T-20-141, T-20-142 закрыты тестами выше; T-20-143 не применим: код продукта не менялся).

## Self-Check: PASSED

- Коммиты a6a77ae, 7c06c4d, 3e27b1e, abdc4c4 — предки HEAD.
- `grep -c '^## Причина (G1)'` = 1; `export const sandboxedMeasureFrameScriptBlock` = 1; `expectFault(sandboxedMeasureFrameScriptBlock)` = 5; `status: closed (20-60)` = 1; `sandbox` в lib/portia-template-builder.test.ts не меньше 1.
- Порт 3100 свободен; копий `portia-20-60-` нет; эталоны не менялись.
