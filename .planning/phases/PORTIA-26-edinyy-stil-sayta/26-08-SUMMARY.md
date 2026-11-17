---
phase: PORTIA-26-edinyy-stil-sayta
plan: 08
subsystem: ui
tags: [editor, promotion, sticky-bar, aria-current, tab-layout, list-detail, css]
status: complete

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "шов portia-editor-tab-shell.tsx (EditorActionBar с nav-слотом), липкая панель .etab-bar и классы etab-* (26-06, 26-07); семейства вкладок и плашек ui-unify (26-03); развёрнутое окно Повышения (26-05)"
provides:
  - "«Повышение»: EditorActionBar из шва — ветки ЗАПРОСЫ/ЗАДАНИЯ/КВАЛИФИКАЦИЯ в nav-слоте (aria-current, счётчик — плашка .tab-count), статус — прежнее сообщение очереди (role=\"status\"), кнопок черновика нет"
  - "очередь запросов: promotion-editor-workbench etab-body / promotion-request-list etab-list / promotion-request-detail etab-detail, список 280px на ПК; телефон — прежний вид «очередь или деталь»"
  - "банки обычных и квалификационных заданий: вкладки работы с aria-current, promotion-bank-layout … etab-body / etab-list / etab-detail, список 280px на ПК"
affects: [26-13, 26-14]

plan_head_before: 8e349f09da0af234404f223e87740af0e5ab316f
plan_head_after: 1b37d1f7a1b496e9fc83b1da253caa72c21c6c62

actuals:
  tokens: 15600
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "компонент вне семейства portia-editor-* вызывает шов напрямую (импорт @/components/portia-editor-tab-shell); реестр D-21 не затронут"
    - "классы etab-* добавлены к прежним элементам (а не обёртка EditorTabBody), чтобы не менять телефонную логику isPhone/requestView/bankView"
    - "ветки — разделы (aria-current), фильтры типа запроса — переключатели одного списка (aria-pressed)"

key-files:
  created: []
  modified:
    - components/portia-promotion-editor-main.tsx
    - components/portia-promotion-ordinary-editor.tsx
    - components/portia-promotion-qualification-editor.tsx
    - app/portia-promotion-editor.css
    - app/portia.css
    - lib/portia-promotion-editor.test.ts
    - lib/editor-tab-layout.test.ts

key-decisions:
  - "Сообщение очереди идёт в statusText с tone=\"error\" (красный, перенос строк), а не в notice: notice красит в «сохранено» (бирюзовый), а сообщения Повышения — в основном ошибки; прежняя рамка .promotion-editor-message тоже была красной для всех сообщений"
  - "Рабочие области — классы etab-body/etab-list/etab-detail на прежних элементах; EditorTabBody не используется (его обёртки сломали бы условный рендер списка и детали на телефоне), поэтому импортируется только EditorActionBar"
  - "Колонка списка банков — 280px на ПК, как у очереди (UI-SPEC: «workbench list 280px + detail»); прежняя minmax(180px, 230px) снята"
  - "Плашка счётчика ветки выглядит как в «Сводке»: рамка и цифры var(--warning), без фона; отступ даёт gap кнопки (margin-left 0). Счётчики фильтров «ОБЫЧНОЕ ПОВЫШЕНИЕ N» / «КВАЛИФИКАЦИЯ N» оставлены прежними (нейтральная плашка)"
  - "На ПК у .promotion-editor с панелью нет верхнего отступа (sticky отсчитывается от внутреннего края прокрутки); на телефоне overflow: clip вместо auto, чтобы панель держалась под системной полосой 48px, как у остальных вкладок"

requirements-completed: [UI-04]

coverage:
  - id: D1
    description: "Трассер: «Повышение» рендерит EditorActionBar — ветки в nav-слоте с aria-current и плашкой .tab-count, aria-label «{ветка}: N» и стрелки moveButtonTab сохранены, статус — сообщение очереди, кнопок черновика нет, состояние «Доступ закрыт» рисуется до панели"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13b: «Повышение» renders the shared action bar: the branches in the nav slot, the queue message in the status slot, no draft buttons"
        status: pass
      - kind: unit
        ref: "lib/portia-promotion-editor.test.ts#actual branch and queue controls expose button-tab semantics and arrow navigation"
        status: pass
      - kind: unit
        ref: "lib/portia-promotion-editor.test.ts#bank actions use the established control hierarchy and announce results"
        status: pass
    human_judgment: false
  - id: D2
    description: "Очередь запросов — «список — деталь» под фильтрами и формой сброса привязки; телефонный вид «очередь или деталь» и «← НАЗАД К ЗАПРОСАМ» без изменений"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-12: the request queue is a list/detail body under the filters; a phone keeps the queue-or-detail switch"
        status: pass
      - kind: unit
        ref: "lib/portia-promotion-editor.test.ts#promotion reviewer layout has desktop workbench and phone sequential view"
        status: pass
    human_judgment: false
  - id: D3
    description: "CSS Повышения: панель прилегает к верху на ПК, clip на телефоне, ветки без отступа в nav, список запросов и банков 280px на ПК, вкладки по ширине подписи, телефон — блоки"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-12/D-13: «Повышение» styles — the bar flush on top, the branches flush in the nav, the request list 280px on a PC"
        status: pass
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-12: the banks are list/detail with the same 280px list on a PC; the workflow tabs are as wide as their labels; a phone is unchanged"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts (весь файл: семейства вкладок/плашек, аудит растяжения, развёрнутое окно promotion)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Банки: вкладки работы «1. СОЗДАТЬ …» / «2. ВЫДАТЬ …» с aria-current, раскладка etab-body/etab-list/etab-detail, bankView и «← НАЗАД К БАНКАМ» без изменений"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/portia-promotion-editor.test.ts#bank workflow tabs mark the current step with aria-current; the banks are a list/detail body beside the old classes"
        status: pass
    human_judgment: false
  - id: D5
    description: "Вид экрана «Повышение» в браузере (ПК, развёрнутое окно, телефон): липкость панели, ширина колонок, цвет плашек"
    requirement: UI-04
    human_judgment: true
    rationale: "Playwright/устройства BLOCKED (ENV); вид проверяется владельцем, не тестами"

duration: 9 min
completed: 2026-11-16
---

# Phase 26 Plan 08: «Повышение» в общей раскладке вкладок редактора Summary

**Вкладка «Повышение» получила общую липкую панель из шва (ветки ЗАПРОСЫ/ЗАДАНИЯ/КВАЛИФИКАЦИЯ с `aria-current` и плашками `.tab-count`, статус очереди в слоте статуса), а очередь запросов и оба банка стали «список — деталь» со списком 280px на ПК; телефон и всё поведение Повышения прежние.**

## Performance

- **Duration:** ~9 мин
- **Started:** 2026-11-16T11:56:31Z
- **Completed:** 2026-11-16T12:05:22Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `PromotionEditorMain` рисует `EditorActionBar` с `label="Разделы повышения"`: nav — ветки (текущая `aria-current="true"`, `className="active"` оставлен для линии 3px из ui-unify), счётчик — `<span className="tab-count" aria-hidden="true">`; статус — `statusText={message}`, `tone={message ? "error" : ""}`; кнопок СОХРАНИТЬ/ОТМЕНИТЬ нет.
- Конфликт-панель «Данные изменились…» осталась под панелью; фильтры `role="group"` с `aria-pressed` и форма сброса привязки — в `.promotion-requests-toolbar` над рабочей областью.
- Очередь: `promotion-editor-workbench etab-body`, `promotion-request-list etab-list`, `promotion-request-detail etab-detail`.
- Банки (оба редактора): `aria-current={mode === "create" | "issue" ? "true" : undefined}` у вкладок работы; `promotion-bank-layout … etab-body`, `promotion-bank-list etab-list`, `promotion-bank-editor etab-detail`, `promotion-preview etab-detail`.
- CSS (`app/portia-promotion-editor.css`, новый блок 26-08): `.etab-nav > .promotion-editor-branches { margin: 0 }`; плашка ветки в цветах «Сводки»; ПК: `.promotion-editor:has(> .etab-bar) { padding-top: 0 }`, список очереди и банков 280px; телефон: `overflow: clip`. В `app/portia.css` удалено мёртвое правило `.promotion-editor-message`.

## Task Commits

1. **Task 1: Трассер — ветки в липкой панели, очередь «список — деталь»** — `56f0a10` (feat)
2. **Task 2: Банки — вкладки работы с `aria-current`, «список — деталь»** — `1b37d1f` (feat)

## Files Created/Modified

- `components/portia-promotion-editor-main.tsx` — импорт шва, панель с ветками, классы etab-* очереди.
- `components/portia-promotion-ordinary-editor.tsx`, `components/portia-promotion-qualification-editor.tsx` — `aria-current` у вкладок работы, классы etab-*.
- `app/portia-promotion-editor.css` — блок 26-08; снята колонка `minmax(180px, 230px)` банков.
- `app/portia.css` — удалено правило `.promotion-editor-message` (и его имя из списка `overflow-wrap`).
- `lib/portia-promotion-editor.test.ts` — перенацелены две проверки (ветки → `aria-current`, сообщение → статус панели), новая проверка банков.
- `lib/editor-tab-layout.test.ts` — `declaredIn` для второго файла стилей; четыре проверки «Повышения».

## TDD

План типа `execute`, у обеих задач `tdd="true"`. RED и GREEN в одном коммите на задачу, как в 26-03…26-07.

- **Task 1 RED:** 5 из 56 упали (3 новых в editor-tab-layout, 2 перенацеленных в portia-promotion-editor). GREEN: verify 173/173.
- **Task 2 RED:** 2 из 58 (по одной новой в каждом файле). GREEN: verify 101/101, полный набор 2303 / 0 fail.
- **Tracer gate:** авто-режим выключен, `human_verify_mode` — end-of-phase, `<verify>` только автоматический; после коммита трассера перезапущен — 0 fail, расширение продолжено.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Мёртвое правило `.promotion-editor-message`**
- **Found during:** Task 1
- **Issue:** после переноса сообщения в статус панели класс нигде не используется.
- **Fix:** правило и имя из списка `overflow-wrap` удалены; тест закрепляет отсутствие.
- **Files modified:** app/portia.css, lib/editor-tab-layout.test.ts
- **Commit:** `56f0a10`

**2. [Rule 1 - Bug] Липкость панели внутри `.promotion-editor`**
- **Found during:** Task 1
- **Issue:** `.promotion-editor` — свой контейнер прокрутки (ПК) и `overflow: auto` на телефоне. На ПК панель липла бы с зазором 16px (верхний отступ); на телефоне `top: 48px` внутри непрокручиваемого контейнера сдвинул бы панель вниз поверх содержимого.
- **Fix:** ПК — `padding-top: 0` у `.promotion-editor:has(> .etab-bar)`; телефон — `overflow: clip` (как `.content-editor:has(.etab-bar)` в 26-06).
- **Files modified:** app/portia-promotion-editor.css, lib/editor-tab-layout.test.ts
- **Commit:** `56f0a10`

**3. [План] Импорт только `EditorActionBar`**
- **Found during:** Task 1
- **Issue:** key_link плана называет `import { EditorActionBar, EditorTabBody }`; `EditorTabBody` не используется (выбраны классы, план это допускает), и неиспользуемый импорт нарушил бы ESLint.
- **Fix:** импортируется только `EditorActionBar`; шаблон key_link `portia-editor-tab-shell` выполнен.
- **Commit:** `56f0a10`

**Total deviations:** 3 (2 × Rule 1, 1 уточнение плана). **Impact:** в границах UI-04; опрос очереди, захват, подтверждения, предпросмотр, сохранения банков, сброс привязки, 403-закрытие, экспорт шаблона и тексты подсказок v1.3 не менялись.

## Допущения, сообщаемые владельцу (edge-probe UI-04: unclassified / unresolved)

- **Фильтры типа запроса** «ОБЫЧНОЕ ПОВЫШЕНИЕ N» / «КВАЛИФИКАЦИЯ N» — переключатели одного списка, поэтому остались с `aria-pressed`; ветки — разделы, у них `aria-current`.
- **Сообщение в панели** — красное для всех сообщений, как раньше в рамке (включая «Запрос удалён.» и «Привязка … сброшена.»). На ПК длинная ошибка переносится в панели (у `.editor-save-status.error` `white-space: normal`).
- **Подпись панели** для экранного диктора совпадает с подписью навигации — «Разделы повышения» (новых русских строк нет).
- **Счётчики фильтров** остались нейтральными плашками, а счётчики веток стали жёлтыми, как в «Сводке». Если на экране это выглядит разнобоем — правка одной строки CSS.
- **Селектор `[aria-pressed="true"]` у вкладок разделов** в блоке ui-unify и в `lib/ui-unify.test.ts` (26-03) оставлен: ничего не находит, но удаление — правка теста 26-03 вне файлов этого плана.

## Threat Model

- **T-26-16:** `if (denied) return …` стоит до панели и не менялся; тест «a 403 without an error code closes the workspace…» зелёный, новая проверка закрепляет порядок.
- **T-26-17:** `PromotionConfirmDialog` и формулировки подтверждений не менялись; тесты подтверждений зелёные.
- Новой поверхности (сеть, доступ, файлы) нет — только разметка и стили.

## Known Stubs

Нет.

## Для владельца

Что изменилось во вкладке «Повышение» редактора. В браузере не открывалось — суждение по коду и тестам.

- **Полоса наверху.** Как в «Справочнике» и «Сводке», сверху вкладки теперь одна полоса, которая не уезжает при прокрутке. В ней слева три ветки: «ЗАПРОСЫ», «ЗАДАНИЯ», «КВАЛИФИКАЦИЯ». Рядом с каждой — число в жёлтой рамке, как у «Новостей» и «Квестов» в «Сводке». Текущая ветка подсвечена и подчёркнута линией, экранный диктор называет её текущей. Стрелки влево/вправо по-прежнему переключают ветки.
- **Сообщения** («Нет связи с сервером…», «Запрос удалён.» и другие) теперь стоят справа в этой полосе, а не отдельной красной рамкой. Цвет прежний, красный. Кнопок «Сохранить/Отменить» у «Повышения» нет: здесь каждое действие сохраняется сразу.
- **Запросы.** Под полосой, как раньше, — кнопки «ОБЫЧНОЕ ПОВЫШЕНИЕ / КВАЛИФИКАЦИЯ» и форма сброса привязки по нику. Ниже — список запросов слева (280px) и выбранный запрос справа.
- **Задания и Квалификация.** Кнопки «1. СОЗДАТЬ …» и «2. ВЫДАТЬ …» по ширине подписи, текущая отмечена. Список званий/переходов слева теперь той же ширины, что и список запросов (280px, раньше 180–230px). Справа — редактор банка или сборка набора.
- **Телефон** — как раньше: сначала список, потом запрос или банк с кнопкой «← НАЗАД…». Полоса держится под верхней системной полосой.
- Проверки в браузере и на устройствах (Playwright, ПК, телефон, staging) не запускались. Они BLOCKED до окружения, а не «пройдено».

## Проверка

- `node --experimental-strip-types --test lib/*.test.ts`: 2303 теста, 2300 pass, 3 skipped, 0 fail (база 26-07: 2298/2295/3/0).
- `<verify>` Task 1 (5 файлов): 173/173. `<verify>` Task 2 (4 файла): 101/101.
- `node node_modules/typescript/bin/tsc --noEmit`: без ошибок.
- ESLint по трём компонентам и двум тестам: 0 ошибок, 0 предупреждений.
- Критерии приёмки (grep считает строки):
  - Task 1: `EditorActionBar` в main — 2 (≥ 2); `aria-pressed={branch === id}` — 0; `aria-pressed={kind === "ordinary"}` — 1.
  - Task 2: `aria-current={mode ===` — 1 в обычном и 1 в квалификационном редакторе; `etab-body` в обычном — 1.
- E2E Повышения (staging) — **BLOCKED (ENV)**: не запускалось, не записано как пройденное.

## Next

Ready for 26-09.
- `EditorActionBar` теперь вызывается в трёх местах: черновые вкладки и «Сотрудники» (`portia-editor.tsx`), «Повышение» (`portia-promotion-editor-main.tsx`, вне реестра D-21).
- В `editor-tab-layout.test.ts` есть `declaredIn(list, …)`: проверка правил второго файла стилей (`promotionRules`).

## Self-Check: PASSED

- FOUND: .planning/phases/PORTIA-26-edinyy-stil-sayta/26-08-SUMMARY.md, components/portia-promotion-editor-main.tsx, lib/editor-tab-layout.test.ts
- FOUND: 56f0a10, 1b37d1f (предки HEAD)
