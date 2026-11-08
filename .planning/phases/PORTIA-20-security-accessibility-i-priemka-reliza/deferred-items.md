# Deferred items (Phase 20)

Найдено при выполнении 20-08. Не вызвано изменениями CSP, в область плана не входит.

- `media-states.spec.ts` "[STAB-MEDIA-03] a portrait that never answers gives up after 15s" на `webkit-phone` падает в полном прогоне файла (получает `failed` вместо `loading`), в одиночном запуске проходит. Падение воспроизводится и с временно отключённым Report-Only заголовком, то есть существовало до 20-08.
  → 20-25: PW-01, класс fixed (часы шли в реальном времени, запас 1 с; тест паркует часы и доказывает перехват запроса).
- `app-states.spec.ts:227` (chromium-desktop): диагностики `requestfailed ERR_FAILED` и `Failed to load resource` по изображению.
  → 20-25: PW-02, класс expected-fault (события прерванного собственного API приходили после однократного фильтра; правила `expectFault` применяются в момент проверки). Идентичность базовых событий не сохранена, доказательство косвенное, не воспроизведено в шести прогонах после правки.
- `app-states.spec.ts:204` (firefox-desktop): консольная ошибка `Image corrupt or truncated`.
  → 20-25: PW-03, класс expected-fault (тест сам делает `page.reload()`; Firefox зеркалит отменённое изображение в консоль вместе с двумя NS_BINDING_ABORTED; правило только внешний хост и только этот тест).
- `media-offscreen.spec.ts:54` (firefox-desktop): `requestfailed NS_BINDING_ABORTED` по удержанному хосту фрейма.
  → 20-25: PW-04, класс expected-fault (подресурсы стороннего фрейма отменяются при его перемонтировании). Тот же тест падал по таймауту 30 с на четырёх проектах: PW-05, класс fixed (`runFor` тратит реальное время, `test.slow()`).
  Три последних: ни одной записи `csp`; это шум диагностик от намеренно сломанных внешних запросов в чужих спеках.

Найдено при выполнении 20-25 (не было в списке выше, все закрыты там же):

- `media-offscreen.spec.ts` «[CR-01] a portrait that has not answered while «Сотрудники» was minimized…» (webkit-phone), таймаут 30 с.
  → 20-25: PW-06, класс fixed.
- `media-states.spec.ts` «[STAB-MEDIA-03] a portrait that never answers…» (firefox-desktop): один раз `page.goto` не дождался `load` за 30 с, не воспроизводится.
  → 20-25: PW-07, класс waiver, вердикт «ОЖИДАЕТ ВЛАДЕЛЬЦА» (релизный гейт FAIL до решения).
- `app-states.spec.ts` «[STAB-APP-02] Сотрудники: a reload that cannot reach the roster…» (chromium-desktop, chromium-dpr125): ожидание 5 с короче чтения живой таблицы; таймауты 30 с в populated и STAB-APP-03 для «Сотрудники».
  → 20-25: PW-08 и PW-09, класс fixed.

Найдено при выполнении 20-30 (smoke в clean checkout коммита cf138fc, вне объёма плана, не исправлено):

- `lib/phase16-guard-boundary.test.ts` импортирует `.claude/hooks/guard.mjs`, а каталог `.claude/` исключён локально через `.git/info/exclude` и не отслеживается git. В clean checkout `npm.cmd test` даёт 1 fail из 1423 (1418 pass, 4 skipped), а `npm.cmd exec tsc -- --noEmit` завершается кодом 2 (`TS2307: Cannot find module '../.claude/hooks/guard.mjs'`). В основной копии оба гейта зелёные только потому, что файл лежит рядом.
  → Блокирует PASS гейтов `unit` и `typecheck` на итоговом commit в 20-13 Task 2. Варианты решения (выбор за владельцем/планировщиком, не агента-исполнителя 20-30): отслеживать `.claude/hooks/guard.mjs`, либо сделать тест и импорт устойчивыми к отсутствию файла (skip как BLOCKED (ENV) и без статического импорта в tsc), либо исключить тест из clean-прогона с записью причины. Полный lint в clean checkout при этом проходит: код 0, 0 errors, 14 warnings.
  → Решено решением владельца (807ab9f, обновлено в 20-31): `lib/phase16-guard-boundary.test.ts` пропускается как BLOCKED (ENV), если неотслеживаемого `.claude/hooks/guard.mjs` нет, поэтому clean checkout больше не падает в `unit` и `typecheck` по этой причине. Оговорка: в clean checkout граница охранника этим тестом не проверяется (пропуск не засчитывается как PASS); отслеживание самого хука решено не было.

Найдено при выполнении 20-29 (вне объёма плана, не исправлено):

- `npm.cmd test` на HEAD после db6deb1 даёт 4 fail из 1452: `lib/phase20-release-gate.test.ts` тесты «readWaivers reads the real registry: PW-07 accepted by the owner, PW-10 still awaiting», «classifyPlaywright + waivers: a failure under a waiver without the owner's verdict is FAIL», «aggregate: the registry itself is judged when Playwright gates ran» и «runGate Playwright: the e2e gate with a waiver registry marks only an owner-accepted failure as waived». Причина: db6deb1 (запись владельца о принятии PW-10 в 20-PLAYWRIGHT-WAIVERS.md) сделан после 20-30, а тесты 20-30 ждут PW-10 без вердикта в реальном реестре. 20-29 этих файлов не менял. Нужно привязать фикстуры к копии реестра, а не к живому файлу (план 20-30 или 20-13).
  → Закрыто в 74ce5c7 (проверено в 20-31): реальный реестр судится как «все waivers приняты» (PW-07 и PW-10 приняты владельцем 2026-11-04), правила для непринятого waiver доказываются на копии реестра с PW-10 без вердикта; `npm.cmd test` на HEAD: 0 fail.

Найдено при выполнении 20-46 (вне объёма плана, не исправлено):

- `accessibility.spec.ts:674` «[STAB-A11Y-02] «Информация» on a phone: the list and an article screen have no critical or serious axe violations» (chromium-phone): тест берёт первый раздел с названием из `/api/content` (id `what-is-virus`) и ищет `[data-info-id]` в списке, а на телефоне после 20-16 (D-29) список показывает только разделы верхнего уровня («01 Вирус ▸ 3»), подраздел не виден, и `click` ждёт 30 с. Правки 20-46 «Информацию» не касаются (в `portia-desktop.tsx` изменены только тексты подсказок настроек, поиска, Корзины и уведомления). Тест нужно привести к устройству списка D-29: раскрыть раздел перед выбором подраздела.
  status: open

Найдено при выполнении 20-50 (редактор, вкладка «Информация», UI-контракт на подменённых чтениях; не вызвано D-62, исправлять файл редактора запрещено D-58/D-64, не исправлено):

- axe `label-content-name-mismatch` (serious): у кнопки `.nested-editor-toggle` карточки раздела `aria-label="Развернуть раздел «…»"` не содержит видимого текста кнопки («РАЗДЕЛ 01 …»), WCAG 2.5.3. Компонент `CollapsibleCard` в `components/portia-editor.tsx` общий для «Информации», «Справочника» и других вкладок; правка текста метки — правка файла редактора вне D-62.
- axe `color-contrast` (serious, PC): надпись `.eyebrow` «УПРАВЛЕНИЕ СОДЕРЖИМЫМ» в заголовке редактора, 4,28:1 при требуемых 4,5:1 (цвет #12897a на #0b1614, 11 px). Правка — `app/portia.css`, в 20-50 не меняется.
  → `tests/e2e/specs/editor-ui-contract.spec.ts` терпит ровно эти два узла (по разметке узла, не по правилу); блок «+ ДОБАВИТЬ РАЗДЕЛ» и вкладки разделов сканируются без допусков. Обе находки нужны владельцу для решения (план или квалификация в 20-54/20-13).
  status: open


Найдено при выполнении 20-53 (блок «Видимая часть», axe по вкладкам редактора на подменённых чтениях; узлы не затронуты планом, файл редактора и общие стили менять нельзя D-58/D-64, не исправлено):

- axe `color-contrast` (serious): `small.formatted-text-field-hint` «Текст и GIF можно сочетать.» (3,53:1, #56716b на #0a1412, 10 px) во вкладке «Информация»; `small[title]` — подпись строки списка («ИЗОБРАЖЕНИЕ», код вируса, например «VIR-Δ17», 3,25:1, #627a75 на #0a2c27, 11 px) во вкладках «Корзина» и «База вирусов». Правка — цвета в `app/portia.css`, нужен выбор владельца или плана.
  → `tests/e2e/specs/editor-ui-contract.spec.ts` (`knownBeforeD63`) терпит ровно эти узлы по разметке узла, не по правилу; всё внутри блока «Видимая часть» (`.image-framing`) сканируется без допусков и чисто.
  status: open

## Найдено при выполнении 20-13 (релизная репетиция на c11adf6)

- Гейты `visual-approved` и `e2e-full` считают пропуск по условию проекта (`test.skip(project !== ...)`) как SKIPPED (в репетиции visual-approved: 54 пропуска), поэтому не смогут стать PASS даже при совпадении всех кадров. `ui-contract-offline` принимает такие пропуски по правилу «тест прошёл на другом проекте» (`projectSkips`); для визуальных гейтов и `strictSkips` правило не распространено, чтобы не менять раннер после репетиции на одном commit.
  → `scripts/phase20-release-gate.mjs`, `classifyPlaywright(..., { projectSkips })`; решение нужно до 20-14/20-15.
  → 20-59 (D-69, G4): правило перенесено с одного отчёта на прогон гейта и распространено на `visual-approved`, `visual-phase20` и `e2e-full` (у `ui-contract-offline` оно уже было). Пропуск засчитывается как «по проекту» только при двух доказательствах сразу: (1) условие доказано исходником — текст аннотации равен причине вызова `test.skip(<условие>, <причина>)` того же спека, а условие составлено только из признаков проекта по закрытому списку форм (`projectConditionSkips`); (2) тот же тест (файл и название) прошёл без повтора на другом проекте в любом шаге того же прогона того же гейта. Пропуск по данным (`editor-ui-contract.spec.ts:872`, `test.skip(!before, …)`) и пропуск с причиной BLOCKED не засчитываются никогда; живые полосы `e2e-mutation` и `staging-live` остаются строгими. В протоколе ячейка счётчиков получает суффикс `(по проекту N)`, `--verify-evidence` принимает PASS строгого гейта только когда все пропуски объяснены этим числом. Тест «approved declared device project» в `tests/e2e/visual/desktop.spec.ts` теперь пропускается по имени проекта (константа из трёх проектов), снимаемое им не менялось.
  status: closed (20-59)
- Встроенный npm 10.9.2 переносного Node 22.13.1 (`%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`) не выполняет `npm ci`: `MODULE_NOT_FOUND`, `Cannot find module 'node-gyp/bin/node-gyp.js'` (require.resolve в `@npmcli/run-script/lib/make-spawn-args.js`). Доказательство из 20-59: каталог `node_modules/npm/node_modules/node-gyp/bin` пуст (`ls -la` показывает только `.` и `..`), хотя `node-gyp/package.json` объявляет `"bin": "./bin/node-gyp.js"`. Это неполная распаковка в %TEMP% (неисправность среды), не код проекта. 20-13 обходил её обёрткой `npm.cmd` в scratchpad сессии (не воспроизводима, не видна в протоколе).
  → 20-59 (D-69, G5): релизный прогон идёт с `--npm-cli <путь к npm-cli.js>` на npm установки по умолчанию (`C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`, npm 11.19.0, `engines.node` = `^20.17.0 || >=22.9.0`, то есть Node 22.13.1 допустим); версия и источник пишутся в строку `npm: <x.y.z> (<источник>)` каждого протокола и в `receipt.json`, `--verify-evidence` отвергает протокол без неё. Контрольный прогон без флага (первым в PATH переносной Node 22.13.1) честно даёт FAIL `npm-ci` с `MODULE_NOT_FOUND` в `npm-ci-1.log` (npm 10.9.2 записан строкой `npm: 10.9.2 (PATH npm.cmd)`). Ремонт переносного Node (свежая официальная распаковка 22.13.1) — вариант владельца, агент его не выполнял и не выполняет.
  status: closed (20-59)
- `ui-contract-offline` красный на release commit (9 + 2 упавших template-builder: непредусмотренное консольное событие `Blocked script execution in 'about:srcdoc'`), хотя 20-58 на H6 давал 0 упавших; воспроизведено повторным прогоном, причина расхождения не установлена.
  → 20-60 (D-69, G1): причина установлена до исправления (матрица в 20-60-SUMMARY.md): флаг раннера `--trace=retain-on-first-failure` включает снимки DOM трассировки Playwright, и их скрипт исполняется в каждом кадре страницы, в том числе в скрытом кадре `measureCardPage` с `sandbox="allow-same-origin"`; Chromium блокирует его этим сообщением (событие = песочница работает, класс T). `--fail-on-flaky-tests` и способ получения `node_modules` ни при чём; 20-58 шёл без `--trace`. Исправление в тестах: правило `sandboxedMeasureFrameScriptBlock` (`tests/e2e/fixtures/diagnostics.ts`) зарегистрировано через `expectFault` только в пяти тестах, которые скачивают PNG; глобальный allowlist по-прежнему 11 строк; песочница кадра и порядок «проверка политики до кадра» закреплены unit-тестами, скачанный HTML проверен на отсутствие скриптов, обработчиков и `javascript:`. Код продукта не менялся. Раннер на коммите исправления: ui-contract-offline PASS 150/0/14 (по проекту 14).
  status: closed (20-60)
