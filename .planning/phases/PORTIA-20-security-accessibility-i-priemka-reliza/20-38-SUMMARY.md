---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 38
subsystem: ui
tags: [template-builder, dossier-model, html-export, png-export, rich-text, gap-closure, tdd]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: 20-34 решение владельца D-52 (конструктор шаблона повторяет карточку вируса редактора), D-23/D-24 (локальный экспорт без сети)
provides:
  - lib/portia-template-dossier.ts - модель TemplateDossier по форме карточки вируса редактора без записей учёных, чистые правки, проверка содержимого, ключ снимка, безопасный стиль фрагмента
  - lib/portia-template-export.ts - createTemplateDossierHtml, layoutTemplateDossierCard, createTemplateDossierPng, wrapTemplateRuns рядом с прежним плоским API (прежний API не тронут)
  - тесты модели и экспорта с ловушками ввода-вывода, паритетом с редактором и двумя fail-first фикстурами
affects: [20-39, 20-37]

actuals:
  tokens: 21017
  tasks: 2
  commits: 4

plan_head_before: 82dd0962a6783ae826005afa3f3cd6a2fb4be144
plan_head_after: 077580754962b4828dc17a47e9d74adfeb90dd91

tech-stack:
  added: []
  patterns:
    - "Чистая модель с правками на копии (structuredClone частей записи, неизменяемые изображения общие) и восстановлением инвариантов после каждой правки"
    - "Паритет с редактором доказывается тестом, который читает исходник components/portia-editor.tsx (blankVirus, литерал новой мутации) и сравнивает removeTemplateMutation с removeMutation из lib/editor-items.ts на одних данных"
    - "Статическая проверка исходника (без комментариев) с белым списком импортов и переопределением GSD_PROHIB_SUBJECT для fail-first"

key-files:
  created:
    - lib/portia-template-dossier.ts
    - lib/portia-template-dossier.test.ts
    - lib/fixtures/template-io-violation.txt
    - lib/fixtures/template-export-violation.txt
  modified:
    - lib/portia-template-export.ts
    - lib/portia-template-export.test.ts

key-decisions:
  - "Правка, меняющая число мутаций (editTemplateVirus и editTemplateText), отклоняется целиком: возвращается тот же черновик. Остальные инварианты (id «template», пустые записи учёных, пустые адреса картинок, слоты изображений только локальные data URL, ключи оформления только из допустимого набора) восстанавливаются после правки. Тест фиксирует выбор."
  - "editTemplateText принимает только ключи шаблона (пять полей карточки и описание существующей мутации); чужой ключ или документ неверной формы возвращают черновик без изменений."
  - "Экспорт читает изображения только из слотов images и повторно проверяет их (data URL png/jpeg/webp, размеры в границах 20-02); слот, обойдённый мимо функций правки, молча не рисуется. Адреса в virus.infectedImage и mutation.image экспортом не читаются."
  - "dossier импортирует из export только тип (import type), поэтому цикла во время выполнения нет; export импортирует значения dossier."
  - "Пустое поле в HTML и PNG показано «Не заполнено»; для пустого списка мутаций тоже «Не заполнено»."

patterns-established:
  - "RED-коммит содержит скелет экспортов с заведомо неверными значениями, чтобы тесты загружались и падали на утверждениях, а не на импорте"
  - "Проверка безопасности экспорта - одна функция теста над готовым HTML (exportViolations), её же гоняет fail-first фикстура"

requirements-completed: [STAB-TMPL-01]

coverage:
  - id: D1
    description: "Модель шаблона повторяет карточку вируса редактора без записей учёных, с оформлением по ключам portiaTextKey с id «template», классификацией как у blankVirus"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-dossier.test.ts#a new template classification equals the classification of a new editor virus and uses known values"
        status: pass
    human_judgment: false
  - id: D2
    description: "Добавление и удаление мутации ведут себя как в редакторе (НОВАЯ МУТАЦИЯ, сдвиг оформления как removeMutation), слоты изображений сдвигаются так же"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-dossier.test.ts#deleting a mutation shifts the descriptions' formatting exactly like the editor's removeMutation"
        status: pass
    human_judgment: false
  - id: D3
    description: "HTML и PNG показывают разделы 01-05 с оформлением каждого фрагмента, без раздела записей учёных; пустое поле - «Не заполнено»"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-export.test.ts#dossier HTML has sections 01-05 in order with the site's labels and no scientist records"
        status: pass
      - kind: unit
        ref: "lib/portia-template-export.test.ts#dossier PNG draws every visible character, the fragment background, bounded images and only slot data URLs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Стиль фрагмента только из белого списка normalizeRichText; текст экранирован; CSP прежний; нет скриптов, ссылок, внешних URL"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-export.test.ts#the export stays inside the closed policy: no address, script, link, url(), handler, foreign image or scientist section"
        status: pass
    human_judgment: false
  - id: D5
    description: "Весь путь правок, HTML, PNG и скачивания проходит с ловушками на сеть и хранилище браузера с нулём срабатываний; статическая проверка исходников ловит нарушение"
    requirement: STAB-TMPL-01
    verification:
      - kind: unit
        ref: "lib/portia-template-dossier.test.ts#a whole editing session with every edit function and both exports makes no request and uses no storage"
        status: pass
      - kind: unit
        ref: "GSD_PROHIB_SUBJECT=lib/fixtures/template-io-violation.txt node --experimental-strip-types --test lib/portia-template-dossier.test.ts (exit 1, pass 11, fail 1)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-11-06
status: complete
---

# Phase 20 Plan 38: Модель шаблона досье и её экспорт Summary

**Нижний слой конструктора шаблона по D-52: модель `TemplateDossier` с полями карточки вируса редактора (без записей учёных) и экспорт в самодостаточные HTML и PNG с оформлением каждого фрагмента и локальными изображениями, доказанно без сети и без хранилища браузера.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-06T16:03:02Z
- **Completed:** 2026-11-06T16:17:00Z
- **Tasks:** 2 (tracer + auto, оба TDD)
- **Files modified:** 6 (4 новых)

## Accomplishments

- Модель: `emptyTemplateDossier`, `editTemplateText` (аналог `changeFormattedText` на копии), `editTemplateVirus`, `addTemplateMutation`, `removeTemplateMutation`, `setTemplateImage`, `hasTemplateDossierContent`, `templateDossierSnapshotKey`, `safeTemplateRunStyle`, `templateRunBackground`, `templateFieldRuns`. `virus.id` всегда «template», `scientistLogs` пуст, строки адресов картинок пусты.
- Экспорт: `createTemplateDossierHtml` и `layoutTemplateDossierCard` / `createTemplateDossierPng` дают разделы 01-05 в порядке и с подписями `VirusRecord`; `wrapTemplateRuns` переносит слова через границы фрагментов, измеряя шрифт каждого фрагмента; фон фрагмента - отдельный прямоугольник; изображения вписаны в ширину страницы и не выше 520.
- Паритет с редактором доказан тестами: классификация нового шаблона равна `blankVirus` (тест читает исходник редактора), литерал новой мутации равен литералу редактора, `removeTemplateMutation` даёт тот же `formattedText` и список мутаций, что `removeMutation`, для удаления первой, средней и последней мутации.
- Ловушки на fetch, XMLHttpRequest, navigator.sendBeacon, WebSocket, EventSource, localStorage, sessionStorage, indexedDB: ноль срабатываний на путях «правка - HTML - PNG - скачивание» (Task 1) и «полная сессия со всеми правками» (Task 2); отдельный тест доказывает, что ловушки срабатывают.
- Прежний плоский API (`createStandaloneHtml`, `createTemplatePng`, `layoutTemplateCard`, ...) не менялся; единственное добавление к прежним типам - необязательное поле `slot` у операции `image` в `PngOp`.

## Task Commits

1. **Task 1 RED:** `17714f8` (test) - тесты модели, паритета, ловушек, статической проверки + скелет экспортов + фикстура `template-io-violation.txt`
2. **Task 1 GREEN:** `37a3c41` (feat) - модель, безопасный стиль, HTML и PNG для шапки и раздела 02
3. **Task 2 RED:** `e847a09` (test) - тесты правок как в редакторе, разделов 01-05, проверки безопасности экспорта + скелет правок + фикстура `template-export-violation.txt`
4. **Task 2 GREEN:** `0775807` (feat) - правки, слоты изображений, ключ снимка, HTML и PNG разделов 01-05

**Plan metadata:** отдельный docs-коммит (SUMMARY, STATE, ROADMAP) следует за этими четырьмя.

## RED evidence (#3770)

Узел 22.13.1, TAP-репортёр (stdout отдельно от stderr), записи прогнаны через `gsd-tools check tdd-red-evidence` до GREEN.

- **Task 1:** `node --experimental-strip-types --test --test-reporter=tap lib/portia-template-dossier.test.ts lib/portia-template-export.test.ts` -> exit 1, tests 36, pass 21, fail 15. Целевой тест «a text edit returns a new draft with the plain text and the formatting document, and leaves the input alone» -> вердикт `RED_EVIDENCE_OK` (`target_test_failed`). Семантическая оценка: все 15 падений - `AssertionError` (`ERR_ASSERTION`, `testCodeFailure`), ни одной ошибки загрузки, синтаксиса или фикстуры; 6 тестов проходят на скелете намеренно (охранные: чужой ключ не меняет черновик, ловушки действительно срабатывают, самопроверка статического охранника, прежний API).
- **Task 2:** та же команда -> exit 1, tests 52, pass 41, fail 11. Целевой тест «deleting a mutation shifts the descriptions' formatting exactly like the editor's removeMutation» -> `RED_EVIDENCE_OK`. Семантическая оценка: 10 падений - `AssertionError`; 1 нецелевой (`dossier HTML embeds exactly the filled image slots...`) упал `TypeError` при подготовке данных, потому что скелет `addTemplateMutation` не добавляет мутацию; целевой тест падает на утверждении (число мутаций 0 вместо 2).

## Fail-first (второй verify каждой задачи)

- `GSD_PROHIB_SUBJECT=lib/fixtures/template-io-violation.txt node --experimental-strip-types --test lib/portia-template-dossier.test.ts` -> exit 1, `# pass 11`, `# fail 1` (падает «the template modules import only their allowed neighbours...»; нарушения: токены fetch и sessionStorage, импорт `@/lib/upload-image`, маршрут `/api/`).
- `GSD_PROHIB_SUBJECT=lib/fixtures/template-export-violation.txt node --experimental-strip-types --test lib/portia-template-export.test.ts` -> exit 1, `# pass 31`, `# fail 1` (падает «the export stays inside the closed policy...»; нарушения: внешний адрес, скрипт, обработчик события, картинка вне data:, раздел «ЗАПИСИ УЧЁНЫХ»).

## Verification

Среда: Node v22.13.1 (из `%TEMP%\portia-node-v22.13.1\...`), пакеты не ставились, сборка, сервер и Playwright не запускались.

- `node --experimental-strip-types --test lib/portia-template-dossier.test.ts lib/portia-template-export.test.ts lib/editor-items.test.ts` -> tests 70, pass 70, fail 0.
- `npm test` -> exit 0, tests 1503, pass 1499, fail 0, cancelled 0, skipped 4 (пропуски были до плана).
- `npm exec tsc -- --noEmit` -> exit 0.
- `npm run lint` -> exit 0, 17 предупреждений, 0 ошибок (все предупреждения в чужих файлах, в файлах плана предупреждений нет: `eslint` по четырём файлам плана - 0).
- `node --experimental-strip-types --test lib/security-matrix.test.ts` -> pass 45, fail 0.
- Приёмка: `grep -c '^export function createTemplateDossierHtml'` = 1; `createStandaloneHtml` = 1; `removeTemplateMutation` = 1; `layoutTemplateDossierCard|createTemplateDossierPng` = 2; `git log --grep=20-38 $PLAN_BASE..HEAD -- components app tests supabase next.config.ts proxy.ts` пусто; `-- lib/editor-items.ts components/portia-editor.tsx` пусто; `git status --porcelain -- components/portia-editor.tsx` пусто. Файлы коммитов плана: ровно шесть из `files_modified`.
- Параллельный 20-35 не мешал: `npm test`, tsc и lint прошли целиком.

## Files Created/Modified

- `lib/portia-template-dossier.ts` - модель и чистые правки (новый)
- `lib/portia-template-dossier.test.ts` - модель, паритет с редактором, ловушки, статическая проверка (новый)
- `lib/portia-template-export.ts` - добавлены HTML, раскладка и PNG новой модели, `wrapTemplateRuns`; прежний API не тронут
- `lib/portia-template-export.test.ts` - проверки HTML, PNG, переноса и закрытой политики экспорта рядом с прежними
- `lib/fixtures/template-io-violation.txt`, `lib/fixtures/template-export-violation.txt` - данные для fail-first (не код проекта)

## Decisions Made

См. `key-decisions` выше. Главное для 20-39: интерфейс должен менять число мутаций только через `addTemplateMutation` / `removeTemplateMutation`, изображения класть через `setTemplateImage` после `decodeLocalTemplateImage`, а состояние «скачано» сравнивать по `templateDossierSnapshotKey`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Две ошибки в моих же тестах Task 1, исправлены до GREEN**
- **Found during:** Task 1 (первый GREEN-прогон)
- **Issue:** (а) проверка «в HTML нет `background:`» срабатывала на собственный CSS страницы (`body{...background:#e9e5d8}`); (б) тест внедрения разметки правил поле физиологии, которого в Task 1 в HTML ещё нет (по плану Task 1 - шапка и раздел 02).
- **Fix:** (а) вместо подстроки проверяются значения всех атрибутов `style` (остаётся только `font-size:48px`); (б) разметка кладётся в название вируса. Смысл проверок (стиль только из белого списка, текст экранирован) сохранён.
- **Files modified:** lib/portia-template-export.test.ts
- **Verification:** 36 из 36 тестов проходят
- **Committed in:** 37a3c41

**2. [Process] Скелет экспортов в RED-коммитах**
- Тест на отсутствующий модуль падает на загрузке, это `INVALID_RED`. Поэтому RED-коммиты содержат скелет с заведомо неверными значениями (временный код, заменён в GREEN-коммитах). Это не отклонение от результата плана, но фиксируется здесь как часть истории коммитов.

---

**Total deviations:** 1 auto-fixed (Rule 1, тестовая), 1 процессная заметка.
**Impact on plan:** на результат не влияет; production-код не менялся из-за отклонений.

## Issues Encountered

- Оболочка инструмента падала на длинных heredoc с кавычками (`unexpected EOF`); большие блоки кода записывались через Write во временную папку сеанса и добавлялись в файлы. Ни один файл проекта не остался в промежуточном состоянии (проверено `git status`).
- Временные файлы RED-evidence (`.red-20-38-*.tap/json`) лежали в папке фазы только на время классификации и удалены до коммитов.

## TDD Gate Compliance

RED-коммиты `17714f8` и `e847a09` предшествуют GREEN-коммитам `37a3c41` и `0775807`; REFACTOR-коммитов нет (не требовались).

## Known Stubs

None. Скелеты RED-коммитов полностью заменены реализацией; в итоговых файлах нет заглушек, пустых данных, ведущих в интерфейс, и TODO.

## Threat Flags

None. Новых сетевых точек, путей авторизации или обращений к файлам нет; модель и экспорт - чистые модули `lib`. Митигации плана: T-20-67 (белый список стиля, экранирование, CSP - тесты внедрения), T-20-68 (статический охранник + ловушки + fail-first), T-20-69 (изображения только из проверенных слотов, `http:/https:` в HTML отсутствуют). T-20-70 принят (холст 8000 px с `TemplatePngTooLargeError`).

## Self-Check: PASSED

- Файлы существуют: lib/portia-template-dossier.ts, lib/portia-template-dossier.test.ts, lib/portia-template-export.ts, lib/portia-template-export.test.ts, lib/fixtures/template-io-violation.txt, lib/fixtures/template-export-violation.txt.
- Коммиты есть в истории ветки: 17714f8, 37a3c41, e847a09, 0775807.
