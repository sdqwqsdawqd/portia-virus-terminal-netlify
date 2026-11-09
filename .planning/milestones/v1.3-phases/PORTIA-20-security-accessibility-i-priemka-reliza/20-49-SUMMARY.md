---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 49
subsystem: ui
tags: [template-builder, download, status, css, gap-closure, owner-verdict, accessibility, playwright]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: "20-43/20-44 карточка шаблона как карточка «Базы вирусов» (D-55), экспорт HTML/PNG; 20-48 решения D-59..D-64 (D-60, D-61)"
provides:
  - "Статус скачивания, совпадающий с фактом: после передачи файла браузеру никакой сбой уборки не становится ошибкой (D-61)"
  - "Значения классов в карточке шаблона и в скачанном HTML без переноса посреди слова, колонки сменяются меньшим числом при нехватке ширины (D-60)"
  - "e2e-страница с нативными таймерами (openNativeTimerPage): единственный способ увидеть ошибку D-61, общая страница подменяет setTimeout"
  - "template_fix_commit для строки template-builder-preview:pc раздела 14 ledger (пересъёмка 20-54)"
affects: [20-54, пересъёмка раздела 14 ledger]

outcome: complete
template_fix_commit: b9ff7d0ecbe470ad5bc059162bc032a33c466052

actuals:
  tokens: 4500
  tasks: 2
  commits: 5

plan_head_before: 241d4bae7476bc8b21e8723ea3f4f2301d6ff24a
plan_head_after: 2a29a48462de6885acbc0253b9f8a1c5027a0962
commits: 5

tech-stack:
  added: []
  patterns:
    - "функции окна (setTimeout) не вызываются как методы чужого объекта: окружение по умолчанию оборачивает их стрелкой, внешняя функция читается и вызывается отдельно"
    - "всё после anchor.click() не бросает наружу: уборка глушится, ссылка отзывается сразу, если таймера нет"
    - "e2e-проверка поведения нативных таймеров идёт на собственной странице браузера: фикстура page ставит поддельные часы Playwright, они подменяют window.setTimeout обычной функцией"
    - "правила карточки шаблона только под .template-card-preview и уходят в файл через templateCardCss"

key-files:
  created: []
  modified:
    - lib/portia-template-export.ts
    - lib/portia-template-export.test.ts
    - components/portia-template-builder.tsx
    - app/portia.css
    - tests/e2e/specs/template-builder.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md

key-decisions:
  - "Причина D-61 (измерена, не принята на веру): `downloadTemplateBlob` вызывал `environment.setTimeout(...)` как метод обычного объекта; нативный setTimeout бросает TypeError с чужим this во ВСЕХ трёх движках (Chromium: Illegal invocation, Firefox: does not implement interface Window, WebKit: Can only call Window.setTimeout on instances of Window). Гипотеза плана «Chromium не бросает» неверна. Файл уже передан после click, бросок шёл в catch runExport и ставил фазу error"
  - "Прежние прогоны были зелёными не из-за Chromium, а из-за поддельных часов Playwright (фикстура determinism, page.clock.install): они подменяют window.setTimeout обычной функцией, которой чужой this не страшен. Поэтому проверка D-61 идёт на отдельной странице с нативными таймерами"
  - "D-60 воспроизведён только в развёрнутом окне «Повышение» на PC (панель классификации рядом с фото, ячейка 172,6 px, «Предупреждение» в две строки); в окне обычного размера и на телефоне до правки слово не рвалось. Правка: колонки не уже 200 px (auto-fit) и overflow-wrap: normal, только под .template-card-preview"
  - "Классификация внутри карточки в развёрнутом окне теперь две колонки вместо трёх (толкование плана: «уходит в меньшее число колонок по ширине значения»); вопрос 1 владельца (колонки карточки) этим не решается и остаётся открытым"

requirements-completed: [STAB-TMPL-01, STAB-A11Y-03]

coverage:
  - id: D1
    description: "Статус скачивания совпадает с фактом (D-61): файл получен (событие download) — только «Файл скачан на устройство.», без role=alert с ошибкой экспорта и без кнопки «Повторить скачивание»; файла нет — ошибка и кнопка повтора. HTML и PNG, chromium-desktop, chromium-dpr125, firefox-desktop, chromium-phone, webkit-phone, нативные таймеры"
    requirement: STAB-A11Y-03
    verification:
      - kind: automated_ui
        ref: "tests/e2e/specs/template-builder.spec.ts#[STAB-TMPL-01] D-61 a downloaded file never shows the export error (HTML) / (PNG), пять проектов"
        status: pass
      - kind: automated_unit
        ref: "lib/portia-template-export.test.ts#D-61 a download does not throw after the file was handed over, even if a Window function is called with a foreign this"
        status: pass
    human_judgment: false
  - id: D2
    description: "downloadTemplateBlob бросает только до передачи файла (сбой сборки якоря или click); сбой удаления якоря и постановки отзыва ссылки не бросает наружу, без таймера ссылка отзывается сразу"
    requirement: STAB-TMPL-01
    verification:
      - kind: automated_unit
        ref: "lib/portia-template-export.test.ts#a download of a Blob or HTML text releases its object URL, also when the click fails; D-61 …"
        status: pass
    human_judgment: false
  - id: D3
    description: "Значения классов в карточке шаблона (предпросмотр PC обычный и развёрнутый, phone) и в скачанном HTML при ширине 1060 и 412 px стоят одной строкой внутри своей ячейки; правило попало в файл"
    requirement: STAB-TMPL-01
    verification:
      - kind: automated_ui
        ref: "tests/e2e/specs/template-builder.spec.ts#[STAB-TMPL-01] D-60 class values stay whole in the preview and in the downloaded HTML (пять проектов)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Публичная «База вирусов» не изменилась: outerHTML .record-view .record-body вируса цели побайтно равен до и после на PC и phone, вычисленный стиль .class-cell strong равен (phone побайтно, PC после сортировки свойств по имени)"
    requirement: STAB-TMPL-01
    verification:
      - kind: command
        ref: "cmp record-{pc,phone}-before.html record-{pc,phone}-after.html (код 0); сравнение style-*-before/after.json"
        status: pass
    human_judgment: false
  - id: D5
    description: "UI E7 без регрессий: «Готовим файл…», отказ закрытой политики, отказ PNG (четыре режима) и повтор, слишком длинный PNG; trackWrites пуст"
    requirement: STAB-TMPL-01
    verification:
      - kind: automated_ui
        ref: "tests/e2e/specs/template-builder.spec.ts + accessibility.spec.ts (template builder), chromium-desktop и chromium-phone: 38 passed"
        status: pass
    human_judgment: false
  - id: D6
    description: "Толкование оркестратора D-60 («Предупреждени-е» — это тот перенос, который имел в виду владелец) и то, что расположение карточки (две колонки классов в широком окне) устраивает владельца"
    requirement: STAB-TMPL-01
    verification: []
    human_judgment: true
    rationale: "Ответ владельца «4. Да исправить» неоднозначен; подтверждает только владелец в галерее 20-54"

duration: ~50 min (Node 22.13.1 из %TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64; время старта не фиксировалось, оценка)
completed: 2026-11-07
status: complete
---

# Phase 20 Plan 49: Конструктор шаблона — честный статус скачивания и цельные значения классов Summary

**Нативный `setTimeout`, вызванный как метод объекта окружения после `anchor.click()`, бросал TypeError во всех трёх движках и превращал уже скачанный файл в «Не удалось подготовить файл» (D-61); теперь после передачи файла ничего не бросает. Значения классов в карточке шаблона не рвутся посреди слова: колонки сменяются меньшим числом (D-60), публичная «База вирусов» побайтно прежняя.**

## Accomplishments

- **D-61, причина найдена измерением.** `downloadTemplateBlob` брал окружение по умолчанию `{ document, URL, setTimeout }` и после `click()` вызывал `environment.setTimeout(...)`. Нативная функция Window с чужим `this` бросает TypeError (зонд на Playwright 1.x: Chromium 156 «Illegal invocation», Firefox 157 «does not implement interface Window», WebKit 27.2 «Can only call Window.setTimeout on instances of Window»). Бросок происходил после передачи файла браузеру, `runExport` ловил его и ставил фазу `error`: файл скачан, на экране ошибка и «Повторить скачивание». Это ровно замечание владельца A.
- **Почему тесты не видели.** Фикстура `determinism` (page.clock.install) подменяет `window.setTimeout` обычной функцией; ей чужой `this` не страшен. Все прежние прогоны и мой первый вариант D-61 на общей странице были зелёными (10 из 10 на HEAD). Гипотеза плана «Firefox/WebKit бросают, Chromium нет» неверна: бросают все.
- **Исправление.** Окружение по умолчанию собирается функцией `windowDownloadEnvironment()` (таймер обёрнут стрелкой над `window.setTimeout`); внешняя функция читается и вызывается отдельно (`const schedule = environment.setTimeout; schedule(...)`), без `this`; после `click()` удаление якоря и постановка отзыва ссылки в `try/catch`, при отсутствии таймера ссылка отзывается сразу. До передачи (сборка якоря, `click`) поведение прежнее: ссылка отзывается, ошибка летит наружу. В `runExport` добавлен комментарий контракта, логика не менялась: `downloadTemplateBlob` теперь бросает только до передачи файла, значит `error` в `runExport` означает «файла нет».
- **D-60.** Два правила под `.template-card-preview`: `.classification-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)) }` и `.class-cell strong { overflow-wrap: normal; word-break: normal; hyphens: manual }`. Правила попадают в файл через `templateCardCss` (тест ищет `.template-card-preview .class-cell strong{…overflow-wrap:normal` в скачанном HTML).
- **Новый e2e-инвариант и вспомогательная страница** `openNativeTimerPage` (своя `browser.newContext` с теми же viewport/isMobile/hasTouch/DPR/userAgent проекта и настройками рабочего стола из `deterministicContract`, без поддельных часов, без записи на сайт).

## Причина D-61: таблица «проект × формат → до правки / после правки»

«До» — тест D-61 на странице с нативными таймерами на HEAD 241d4ba (коммит RED 8986b07): файл получен браузером (событие download, имя файла верное), но статус пустой и показана ошибка («Expected substring: "Файл скачан на устройство", Received: ""»). Страница не бросала pageerror (исключение ловит React-код `runExport`).

| Проект | HTML до | HTML после | PNG до | PNG после |
|---|---|---|---|---|
| chromium-desktop | красный: файл есть, ошибка показана | зелёный | красный | зелёный |
| chromium-dpr125 | красный | зелёный | красный | зелёный |
| firefox-desktop | красный | зелёный | красный | зелёный |
| chromium-phone | красный | зелёный | красный | зелёный |
| webkit-phone | красный | зелёный | красный | зелёный |

Контрольный вариант (общая страница с поддельными часами, тот же тест, HEAD): 10 из 10 зелёных — подтверждение, что маска именно в `page.clock.install`. Это не «исправление проходит», а доказательство, почему ошибка была невидима.

Проверенные пути ожидания плана (повтор подряд HTML затем PNG, двойной клик, смена вида во время подготовки) не потребовались: причина найдена и воспроизведена на первом простом пути (один HTML/PNG на пяти проектах, DPR 1,25 входит в пять).

**PNG на webkit-phone:** файл собирается и скачивается честно (webkit-phone PNG: `file shablon-dosye.png`), отказа PNG на WebKit нет. Находка для вопросов галереи 20-54 не появилась.

## D-60: что измерено

RED (коммит 85d8e54, измерение до CSS): chromium-desktop, развёрнутое окно «Повышение»: ячейка 172,6 px, «Предупреждение» в две строки (слово рвётся). Окно обычного размера на PC и телефон до правки проходили (одна строка), как и скачанный HTML на 1060 и 412 px; поэтому утверждение плана «красный в окне обычного размера» на PC не подтвердилось, ломается развёрнутое окно (карточка рядом с фото, панель классификации узкая). После правки (коммит b9ff7d0) тест зелёный на пяти проектах: chromium-desktop, chromium-dpr125, firefox-desktop, chromium-phone, webkit-phone.

Самые длинные значения осей (по числу символов из `classificationOptions`): в тесте берутся программно; «Предупреждение» — самое длинное в оси «Угроза и риск побега» и входит в набор.

### Публичная «База вирусов» до/после (T-20-103)

Дампы вне репозитория (scratchpad), Playwright из node_modules проекта, `http://127.0.0.1:3100`, профили 1440x900 и Pixel 7, цель отдаёт один вирус (7000 знаков `.record-view .record-body`):

| Дамп | Результат |
|---|---|
| `record-pc-before.html` против `record-pc-after.html` | `cmp` код 0 |
| `record-phone-before.html` против `record-phone-after.html` | `cmp` код 0 |
| вычисленный стиль `.class-cell strong` + `.classification-grid`, phone | `cmp` код 0 |
| то же, PC | побайтно отличается только порядком перечисления трёх произвольных свойств (`--ease-in-out`, `--tw-ring-offset-color`, `--motion-slow`), значения равны; после сортировки свойств по имени равны (540 свойств в `strong`) |

`before` дважды (до и повторно) побайтно равен, дамп детерминирован. Оговорка как в 20-43: на цели один вирус без мутаций и фото.

## Task Commits

1. **Task 1 (tracer): RED** — `8986b071a08e28bdf050b310a9579ae047c689a9` (test), в теле `PLAN_BASE: 241d4bae7476bc8b21e8723ea3f4f2301d6ff24a`. Unit D-61 красный (TypeError на строгом `this`); e2e D-61 красный на пяти проектах, HTML и PNG.
2. **Task 1 (tracer): GREEN** — `6c8f37aa9cac6c55aedc0e7653305574c97a8ac1` (fix): `lib/portia-template-export.ts`, комментарий контракта в `components/portia-template-builder.tsx`, помощник вставки текста в спеке. `⚡ Tracer verified end-to-end — expanding`: 15 passed (D-61 ×2 и «downloads it and opens the HTML offline» на пяти проектах) и 39 unit-тестов.
3. **Task 2: RED** — `85d8e54b10a9624539abe0db7835328ccc4b95af` (test): D-60 e2e.
4. **Task 2: GREEN** — `b9ff7d0ecbe470ad5bc059162bc032a33c466052` (fix): два правила в `app/portia.css` — **template_fix_commit**: последний коммит плана, меняющий app, components или lib (не тесты).
5. **Task 2: документы** — `2a29a48462de6885acbc0253b9f8a1c5027a0962` (docs): пункт D-60/D-61 в `20-UI-SPEC.md`.

`template_fix_commit: b9ff7d0ecbe470ad5bc059162bc032a33c466052` (`git cat-file -e …^{commit}` — код 0). Коммит `fix(PORTIA-20-49)` 6c8f37a (D-61) раньше по времени; для 20-54 действует `template_fix_commit` как последний.

**Plan metadata:** отдельный коммит `docs(PORTIA-20-49): complete …` с этим SUMMARY, STATE.md, ROADMAP.md и REQUIREMENTS.md (в `commits:` выше его нет: измерение сделано до него).

## Проверки (все с `--retries=0`)

- `template-builder.spec.ts -g "D-61|D-60|downloads it and opens the HTML offline"`, пять проектов: **20 passed**.
- `template-builder.spec.ts` + `accessibility.spec.ts -g "STAB-TMPL-01|template builder"`, chromium-desktop и chromium-phone: **38 passed**, пропусков нет, ни одного запроса записи в `trackWrites`.
- `node --experimental-strip-types --test lib/*.test.ts`: 1547 тестов, 1543 pass, **0 fail**, 4 skipped (прежние).
- `tsc --noEmit` (`node node_modules/typescript/bin/tsc`): код 0.
- Lint: `npm.cmd run lint` не стартует (npm падает на node-gyp, как в 20-42/20-47/20-48), поэтому `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next`: **0 errors**, 17 warnings (все в артефактах `tests/e2e/visual-candidates/.runs/…`, до плана); eslint по четырём изменённым TS/TSX-файлам — 0 замечаний.
- Acceptance: `grep -c 'D-61'` спека 3 и unit 2; `grep -c 'D-60'` спека 2 и UI-SPEC 1; добавленные строки CSS (`git diff --output=<scratchpad>/20-49-css.diff 241d4ba..HEAD -- app/portia.css`, код 0): строк с `{` вне `.template-card-preview` — 0; `git diff --exit-code --stat 241d4ba -- tests/e2e/visual/__screenshots__` — код 0; сервер на 3100 остановлен (PID проверялся по командной строке `next start` проекта), `netstat` пуст; `.env*` не читались.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Помощник `pasteText` не работал на Firefox**
- **Found during:** Task 1, прогон «downloads it and opens the HTML offline» на firefox-desktop (в 20-47 спек гонялся только на Chromium).
- **Issue:** синтетический `ClipboardEvent` с `clipboardData` в Firefox отдаёт защищённый пустой `DataTransfer` (`getData` → ""), вставка не срабатывала, тест падал детерминированно (3 из 3) до всякого скачивания, к D-61 отношения не имеет.
- **Fix:** помощник диспетчеризует обычный `Event("paste")` со своим свойством `clipboardData` (зонд: работает в Chromium, Firefox, WebKit).
- **Files modified:** `tests/e2e/specs/template-builder.spec.ts`
- **Verification:** 15 passed на пяти проектах, 38 passed на двух остальных прогонах.
- **Commit:** 6c8f37a

**2. [Rule 1 - Bug] Первый вариант e2e D-61 не мог увидеть ошибку**
- **Found during:** Task 1, первый прогон RED: 10 из 10 зелёных на HEAD.
- **Issue:** общая страница с поддельными часами подменяет `window.setTimeout`; ошибка невидима.
- **Fix:** тест переведён на собственную страницу с нативными таймерами (`openNativeTimerPage`), в тест добавлено пояснение; прежняя гипотеза плана отвергнута измерением (таблица выше).
- **Files modified:** `tests/e2e/specs/template-builder.spec.ts`
- **Commit:** 8986b07

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug в собственном тесте). **Impact:** без изменения объёма; все решения в границах файлов плана. Расхождение с планом по D-60: красный на PC только в развёрнутом окне (в окне обычного размера на HEAD слово не рвётся), записано выше.

## Issues Encountered

- Один раз на firefox-desktop при прогоне первого (общая страница) варианта D-61 оба теста были помечены `unexpected` из-за `browserContext.close: Protocol error (Browser.removeBrowserContext): can't access property "_maybeDontRestoreTabs"` (разрыв Firefox при закрытии контекста, тело теста прошло); не воспроизводится в последующих прогонах (шесть полных прогонов Firefox-варианта зелёные). Записано как наблюдение, не как закрытая причина.
- Не видел `[PORTIA_E2E_DIAGNOSTICS] unexpected runtime event(s)` (наблюдалось в 20-48) ни разу.
- `npm run lint` и `npx` недоступны из-за node-gyp (как в 20-48), использованы прямые вызовы.

## Authentication Gates

None.

## Known Stubs

None — заглушек и пустых источников данных в изменённых файлах нет.

## Threat Flags

None — клиентский экспорт без сети и записи; тест открывает дополнительные локальные контексты браузера (офлайн для файла), на сайт ничего не пишется (`trackWrites` пуст).

## Next Phase Readiness

- Для 20-54: `template_fix_commit: b9ff7d0ecbe470ad5bc059162bc032a33c466052` — по нему пересъёмка строки `template-builder-preview:pc` раздела 14 ledger; в галерее показать владельцу: (1) скачивание HTML и PNG без ошибки в обычном браузере (D-61), (2) «Предупреждение» цельное в развёрнутом окне «Повышение» и в скачанном файле (D-60, толкование оркестратора), (3) классификация карточки в развёрнутом окне теперь в две колонки вместо трёх (последствие правки; вопрос 1 владельца про колонки карточки не решён).
- Предел реального устройства и реальный браузер владельца (какой именно) остаются за 20-54: в этом плане D-61 доказан на Chromium, Firefox и WebKit Playwright, не на устройстве владельца.

## Self-Check: PASSED

- Файлы изменены и существуют: `lib/portia-template-export.ts`, `lib/portia-template-export.test.ts`, `components/portia-template-builder.tsx`, `app/portia.css`, `tests/e2e/specs/template-builder.spec.ts`, `20-UI-SPEC.md` — FOUND.
- Коммиты — предки HEAD: 8986b07, 6c8f37a, 85d8e54, b9ff7d0, 2a29a48 — FOUND; `git rev-list --count 241d4ba..HEAD` = 5; `git cat-file -e b9ff7d0ecbe470ad5bc059162bc032a33c466052^{commit}` — код 0.
- Acceptance Task 1 и Task 2 (grep D-61 ≥ 1, D-60 ≥ 1, diff CSS только `.template-card-preview`, дампы `cmp` 0, `__screenshots__` без изменений, порт 3100 свободен) — PASS.

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*
