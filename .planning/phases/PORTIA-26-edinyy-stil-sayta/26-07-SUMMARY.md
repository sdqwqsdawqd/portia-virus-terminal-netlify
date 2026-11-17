---
phase: PORTIA-26-edinyy-stil-sayta
plan: 07
subsystem: ui
tags: [editor, sticky-bar, section-nav, aria-current, tab-layout, d-21-guard, css]

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "шов portia-editor-tab-shell.tsx (EditorActionBar с nav-слотом, EditorTabBody), липкая панель .etab-bar и классы etab-* (26-06); семейство вкладок и плашек ui-unify (26-03)"
provides:
  - "«Справочник» и «Информация»: «+ ДОБАВИТЬ РАЗДЕЛ» и вкладки разделов в nav-слоте липкой панели; «Сводка»: «Новости N»/«Квесты N» там же"
  - "SectionTabs и вкладки «Сводки» с aria-current вместо aria-pressed; текущий раздел прокручивается в видимую область"
  - "раскладка A2: EditorTabBody — оглавление EditorToc слева (только при >= 5 пунктах), форма активного раздела справа — у «Справочника», «Информации», «Сводки»"
  - "«Сотрудники»: своя панель EditorActionBar (СОХРАНИТЬ ПРОФИЛЬ, ВОЙТИ СНОВА, статус saveStatusText), etab-body/etab-list/etab-detail, aria-current у выбранного сотрудника"
  - "реестр D-21: вставки PORTIA-26-07 (applySectionNavHunk), PORTIA-26-07b (applyInfoBroadcastNavHunk), PORTIA-26-07c (applyEmployeesBarHunk) с отрицательными проверками"
affects: [26-08, 26-13, 26-14]

plan_head_before: 22d3ed4df531520cbb0820ca9b7e8dde64afb3af
plan_head_after: 073b8b92423a6756292cc74b49e3f559b20a60e1

actuals:
  tokens: 19100
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "у панели один вызов на черновые вкладки; содержимое nav выбирается по вкладке тернарной цепочкой guide → info → broadcasts → undefined"
    - "тела вкладок обёрнуты в EditorTabBody без сдвига отступов внутренней формы: правка в реестре D-21 — две строки (открытие/закрытие) вместо сотен"
    - "липкая только .etab-bar; старые классы .editor-section-addbar/.editor-section-tabs остаются для локаторов, но без своего слоя"
    - "у «Сотрудников» компонент возвращает фрагмент: панель и раскладка — прямые дети .content-editor, поэтому действуют правила 26-06 для ПК и телефона"

key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - app/portia.css
    - lib/format-launch.test.ts
    - lib/editor-tab-layout.test.ts
    - lib/portia-desktop.test.ts
    - lib/editor-outline.test.ts
    - tests/e2e/specs/editor-ui-contract.spec.ts

key-decisions:
  - "Список A2 = EditorToc только при items.length >= 5 (тот же порог, что внутри компонента; тест закрепляет оба места); иначе левой колонки нет (data-detail-only)"
  - "Счётчик «Сводки» — плашка .tab-count через пробел после названия, чтобы доступное имя осталось «Новости 3», а не «Новости3»"
  - "Подпись панели «Сотрудников» берётся из tabRegistry (новых русских строк в редакторе нет, D-58)"
  - "Карточкам под липкой панелью добавлен scroll-margin-top 64px (ПК) / 148px (телефон), чтобы переход из оглавления не прятал карточку под панелью"
  - "Тест D-62 перенацелен на ветку info nav-слота с теми же сообщениями; тело «Информации» проверяется на отсутствие SectionAddBar/SectionTabs и нижней кнопки"

requirements-completed: [UI-04]

coverage:
  - id: D1
    description: "Трассер «Справочник»: SectionAddBar + SectionTabs «Разделы справочника» в nav-слоте панели, aria-current и прокрутка текущего раздела, тело — оглавление слева / активный раздел справа"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13a: section tabs mark the current section with aria-current, not aria-pressed, and keep it in view"
        status: pass
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13a: «Справочник» switches sections in the nav slot of the bar: the add button first, then the section tabs"
        status: pass
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#A2: the «Справочник» body is the TOC on the left (only when it shows) and the active section on the right"
        status: pass
    human_judgment: false
  - id: D2
    description: "CSS: липкость старых слоёв снята, top: -28px и переходное правило 26-06 удалены; вкладки разделов в nav-слоте в одну строку с прокруткой; форма заголовка под кнопкой; scroll-margin карточек"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13b: only the action bar is sticky; the old add bar and section tabs have no sticky layer or top offset of their own"
        status: pass
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13a: in the nav slot the section tabs run in one scrolling row; the title form opens under the add button"
        status: pass
      - kind: unit
        ref: "lib/portia-desktop.test.ts#sticky and floating editor layers never cover the content: notices are in the flow, the sticky action bar sits under the panel (UI E3 overflow)"
        status: pass
    human_judgment: false
  - id: D3
    description: "«Информация» (смысл D-62 сохранён) и «Сводка» (aria-current, плашка .tab-count) — nav в панели, тела A2; D-15 перенацелен на деталь"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/format-launch.test.ts#D-62: the «Информация» tab starts with the add-section bar and has no add-section button below the columns"
        status: pass
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13a: «Сводка» switches «Новости» / «Квесты» in the nav slot: tab family, aria-current, a count plaque"
        status: pass
      - kind: unit
        ref: "lib/portia-desktop.test.ts#editor form cards keep one fixed width set by a single variable and fill columns on desktop only (D-15)"
        status: pass
    human_judgment: false
  - id: D4
    description: "«Сотрудники»: своя панель с сохранением профиля и статусом, «список — профиль», aria-current; логика сохранения и ухода не тронута"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-12: «Сотрудники» renders its own action bar with the profile save and its own status; no editor draft buttons"
        status: pass
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-12: «Сотрудники» is a list/detail body; the picked employee is the current row"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-21: три побайтные вставки, SAMPLE_COMMIT не перебазирован, D-58 и тексты h-33…h-61 на месте"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/format-launch.test.ts#D-64: portia-editor.tsx differs from 449c756 only by the approved edits"
        status: pass
      - kind: unit
        ref: "lib/format-launch.test.ts#D-64: the guard notices any other edit, a missing hunk, a changed text and an unreadable sample"
        status: pass
      - kind: unit
        ref: "lib/format-launch.test.ts#D-58: the set of Russian texts of the editor file equals the sample's after the approved edits"
        status: pass
    human_judgment: false
  - id: D6
    description: "Вид панели с разделами в браузере (ПК, телефон), прокрутка текущего раздела, раскрытие формы заголовка в панели, e2e-линии редактора"
    requirement: UI-04
    verification: []
    human_judgment: true
    rationale: "Playwright-линии редактора не запускались — BLOCKED (ENV)/(DATA); e2e только переписаны и проверены tsc/eslint. Браузер не открывался; физические устройства — Phase 27"

duration: "~22 мин активной работы (старт 09:38:55Z, коммит Task 3 11:53:16Z; между Task 2 и Task 3 ~2 ч паузы из-за лимита)"
completed: 2026-11-16
status: complete
---

# Phase 26 Plan 07: Единая раскладка вкладок редактора, часть 2 Summary

**Разделы «Справочника» и «Информации» и группы «Сводки» переключаются теперь в липкой панели действий. Текущий раздел отмечен `aria-current` и линией 3px, при смене прокручивается в видимую область. Тело вкладки — «оглавление слева, раздел справа» (A2). У «Сотрудников» своя панель с «СОХРАНИТЬ ПРОФИЛЬ» и раскладка «список — профиль». Каждая правка редактора записана побайтно в реестр D-21.**

## Performance

- **Tasks:** 3 из 3: Task 1 — трассер «Справочник», Task 2 — «Информация» и «Сводка», Task 3 — «Сотрудники» и e2e
- **Files:** 7 изменено, +440/−74
- **Duration:** ~22 мин активной работы. Старт 09:38:55Z, коммит Task 3 в 11:53:16Z; около двух часов из этого — пауза между Task 2 и Task 3 (сброс лимита).

## Accomplishments

- **Task 1 (`c936807`), трассер «Справочник»:**
  - `SectionTabs`: `aria-current={section.id === activeId ? "true" : undefined}` вместо `aria-pressed`.
  - У `nav` появился ref. Эффект по `activeId` прокручивает текущую кнопку: `scrollIntoView({ block: "nearest", inline: "nearest" })`, плавно только при `data-motion="full"`.
  - `SectionAddBar` (тот же `onCreate`) и `SectionTabs label="Разделы справочника"` (те же пропы) перенесены в `nav={tab === "guide" ? …}` единственного вызова `EditorActionBar`.
  - Тело — `<EditorTabBody list={guideTocItems.length >= 5 && <EditorToc …/>} detail={<div className="editor-form flat-editor-form editor-card-columns">…}/>`. Подсказка h-41, пустое состояние h-43 и карточки не тронуты.
- **CSS (Task 1–2):**
  - У `.editor-section-tabs` и `.editor-section-addbar` больше нет своего липкого слоя: `position: sticky`, `top`, `z-index` и рамка/фон сняты.
  - Удалены `.editor-section-addbar + .editor-section-tabs`, ПК-коррекция `top: -28px`, телефонные `top: 48px/108px` и `overflow: clip` для `:has(.editor-section-addbar)`, переходное правило 26-06 `.etab-bar ~ * …`.
  - Цвет текущего раздела теперь по `[aria-current="true"]`.
  - В блоке ui-unify (без цветов): `.etab-nav > .editor-section-addbar { flex: none }`, вкладки разделов `flex: 1 1 auto` в одну строку с прокруткой, форма заголовка шириной `min(320px, 70vw)` раскрывается под кнопкой, `.etab-nav > .dossier-tabs { margin: 0 }`, `scroll-margin-top` карточек 64px / 148px.
- **Task 2 (`29e4ae6`), «Информация» и «Сводка»:**
  - Ветка `tab === "info"` nav-слота: «+ ДОБАВИТЬ РАЗДЕЛ» перед «Разделы информации».
  - Ветка `tab === "broadcasts"`: `<nav className="editor-tabs dossier-tabs" aria-label="Разделы сводки">` с `aria-current` и `{label} <span className="tab-count">N</span>`.
  - Оба тела — `EditorTabBody`, у каждого своё оглавление. Тексты h-38/h-39/h-44, «+ НОВАЯ НОВОСТЬ/+ НОВЫЙ КВЕСТ» и `.broadcast-entry-list` не менялись.
- **Task 3 (`073b8b9`), «Сотрудники»:**
  - `EmployeeProfilesEditor` возвращает фрагмент: сначала `EditorActionBar`, затем раскладка.
  - Панель: подпись из `tabRegistry`; статус — прежнее выражение `saveStatusText`/`errorMessage`/«ТОЛЬКО ДЛЯ РЕДАКТОРОВ», тон `saveStatus`; действия — «ВОЙТИ СНОВА» (после истёкшей сессии) и «СОХРАНИТЬ ПРОФИЛЬ» с прежними `disabled`/`save()`. Кнопок ↶ и «ОТМЕНИТЬ» нет.
  - Классы `etab-body`, `etab-list`, `etab-detail` добавлены рядом с прежними, у выбранного сотрудника `aria-current`.
  - Строка `.employee-editor-save` и её два правила CSS удалены. `leaving`/`onLeave`, диалоги удаления и ухода не тронуты.
- **Реестр D-21:**
  - `applySectionNavHunk` (`PORTIA-26-07`), `applyInfoBroadcastNavHunk` (`PORTIA-26-07b`), `applyEmployeesBarHunk` (`PORTIA-26-07c`).
  - Отрицательные проверки на каждую вставку: «без вставки — разница» и «повторно не применяется».
  - Фильтры старых отрицательных проверок исключают зависимые вставки 26-07.
  - `SAMPLE_COMMIT` не менялся.
- **E2E (`editor-ui-contract.spec.ts`):**
  - Четыре `aria-pressed` у разделов заменены на `aria-current`.
  - Проверка D-62 теперь требует, чтобы кнопка и «Разделы информации» были внутри `.etab-bar .etab-nav` и кнопка стояла левее вкладок в той же строке (раньше: выше).

## TDD

План типа `execute`, у всех трёх задач `tdd="true"`. RED и GREEN в одном коммите на задачу, как в 26-03…26-06.

- **Task 1 RED:** 11 из 172 упали — новые D-13a/A2/CSS, перенацеленные D-15 и «липкие слои», D-64 с новой вставкой, телефонный тест 26-06 про `top` старой полосы. При первом запуске «guard notices» упал из-за зависимости вставок; это исправлено фильтрами (см. отклонение 3). GREEN: 172/172, затем полный набор (с исправлением `editor-outline`): 2292 / 0 fail.
- **Task 2 RED:** 6 из 179 (4 новых, D-62, D-64). GREEN: полный набор 2296 / 0 fail.
- **Task 3 RED:** 4 из 116 («один вызов панели», 2 новых про «Сотрудников», D-64). GREEN: 2298 / 0 fail.
- **Tracer gate:** авто-режим выключен, `human_verify_mode` — end-of-phase, `<verify>` только автоматический. После коммита трассера перезапущен: 0 fail, расширение продолжено.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Переход из оглавления прятал карточку под липкой панелью**
- **Found during:** Task 1
- **Issue:** `scroll-margin-top: 12px` у `.nested-editor-card`/`.editor-record-row` меньше высоты панели (48px; на телефоне ещё системная полоса 48px и вторая строка 44px). Оглавление теперь — левая колонка A2, после перехода заголовок карточки оказывался под панелью.
- **Fix:** `.content-editor:has(> .etab-bar) .nested-editor-card, … .editor-record-row { scroll-margin-top: 64px }`, на телефоне 148px.
- **Files modified:** app/portia.css, lib/editor-tab-layout.test.ts
- **Commit:** `c936807`

**2. [Rule 3 - Blocking] Закрепление D-41 в `lib/editor-outline.test.ts` (файла нет в списке плана)**
- **Found during:** Task 1 и Task 2 (полный набор)
- **Issue:** тест «D-41 section editing stays in Справочник» искал `<SectionAddBar` в теле вкладок «Справочник» и «Информация».
- **Fix:** тест перенацелен на ветки `guide`/`info` nav-слота (ровно одна кнопка добавления раздела там, ноль в теле); общее число `<SectionAddBar` в файле, 2, не изменилось.
- **Files modified:** lib/editor-outline.test.ts
- **Commits:** `c936807`, `29e4ae6`

**3. [Rule 3 - Blocking] Отрицательные проверки реестра и зависимые вставки**
- **Found during:** Task 1 (RED: «tab body import: exactly one approved anchor»)
- **Issue:** проверки «без PORTIA-24/24-08/26-06/26-06b» применяли остальные вставки, а вставка 26-07 опирается на импорт из 26-06b, вставка 26-07b — на nav-ветку 26-07.
- **Fix:** фильтры этих проверок исключают `PORTIA-26*` или `PORTIA-26-07*`, по тому же образцу, что 26-06 сделал с PORTIA-25.
- **Files modified:** lib/format-launch.test.ts
- **Commit:** `c936807`, `29e4ae6`

**4. [Rule 1 - Bug] Позиционная e2e-проверка D-62 устарела**
- **Found during:** Task 3
- **Issue:** спека требовала, чтобы кнопка «+ ДОБАВИТЬ РАЗДЕЛ» стояла **выше** вкладок разделов. В nav-слоте они в одной строке, кнопка левее.
- **Fix:** проверка «кнопка левее вкладок в той же строке» плюс оба элемента внутри `.etab-bar .etab-nav`. Смысл D-62 (кнопка перед вкладками, нижней кнопки нет) сохранён.
- **Files modified:** tests/e2e/specs/editor-ui-contract.spec.ts
- **Commit:** `073b8b9`

**Total deviations:** 4 auto-fixed (2 × Rule 1, 2 × Rule 3). **Impact:** в границах UI-04; логика сохранения, черновика, Ctrl+Z/Y, диалоги и тексты h-33…h-61 не менялись; `--editor-card-width: 340px` и D-19 не тронуты.

## Допущения, сообщаемые владельцу (edge-probe UI-04: unclassified / unresolved)

- **A2:** в «Справочнике», «Информации» и «Сводке» «список слева» — это существующее оглавление, а не новый список разделов. Разделы переключаются вкладками в панели, справа — карточка выбранного раздела. Оглавление появляется только при 5 и более пунктах; иначе левой колонки нет. Каждая из трёх вкладок — отдельный экран (D-10): жалоба переделывает только свой экран.
- **Селектор `[aria-pressed="true"]` у вкладок разделов** в блоке ui-unify и в его тесте (26-03) оставлен. Он больше ничего не находит, но его удаление — правка теста 26-03 вне этого плана.
- **Отступ детали 24px** теперь есть и у форм «Справочника», «Информации», «Сводки» и у профиля сотрудника.

## Known Stubs

Нет.

## Для владельца

Что изменилось в редакторе. В браузере не открывалось — суждение по коду и тестам.

- **Справочник.** Полоса с «Сохранить» наверху вкладки теперь содержит и разделы: слева кнопка «+ ДОБАВИТЬ РАЗДЕЛ», за ней вкладки разделов в одну строку (длинный ряд прокручивается вбок), рядом стрелки «← →» для порядка. Полоса не уезжает при прокрутке. Текущий раздел подсвечен и подчёркнут линией, а при переключении сам прокручивается в видимую часть ряда. Форма «Заголовок раздела» раскрывается прямо в полосе, под кнопкой. Ниже полосы слева оглавление (если в разделах 5 и больше пунктов), справа карточка выбранного раздела.
- **Информация.** То же самое: «+ ДОБАВИТЬ РАЗДЕЛ» перед вкладками разделов в полосе, нижней кнопки добавления раздела нет, «+ ПОДРАЗДЕЛ» внизу карточки раздела. Выбор уровней приложений и подсказка — справа, как раньше.
- **Сводка.** «Новости» и «Квесты» переехали в полосу, рядом с каждой — число записей в рамке. Справа подсказка, кнопка «+ НОВАЯ НОВОСТЬ / + НОВЫЙ КВЕСТ» и записи; слева оглавление, если записей 5 и больше.
- **Сотрудники.** Сверху появилась такая же полоса со статусом («ТОЛЬКО ДЛЯ РЕДАКТОРОВ», «Сохраняем…», «Сохранено» или текст ошибки) и кнопкой «СОХРАНИТЬ ПРОФИЛЬ»; кнопки внизу профиля больше нет. Список сотрудников слева, профиль справа; выбранный сотрудник отмечен и для экранного диктора. Вопрос «Несохранённые правки сотрудника» при уходе — как раньше.
- **Переход по оглавлению** теперь не прячет карточку под полосой.
- Проверки в браузере и на устройствах (Playwright, ПК, телефон) не запускались. Они BLOCKED до окружения и Phase 27, а не «пройдено».

## Проверка

- `node --experimental-strip-types --test lib/*.test.ts`: 2298 тестов, 2295 pass, 3 skipped, 0 fail (база 26-06: 2286/2283/3/0).
- `<verify>` Task 1 (6 файлов): 172/172, без строки «may differ from the sample only by the approved edits».
- `node node_modules/typescript/bin/tsc --noEmit`: без ошибок, e2e-спеки включены.
- ESLint по редактору, изменённым тестам и спеке: 0 ошибок (3 старых предупреждения `no-img-element` в редакторе, не от этого плана).
- Критерии приёмки:
  - Task 1: `aria-current={section.id === activeId` — 1; `applySectionNavHunk` — 4; `top: -28px` в CSS — 0.
  - Task 2: `aria-pressed={broadcastEditorTab === id}` — 0, `aria-current={broadcastEditorTab === id` — 1; `applyInfoBroadcastNavHunk` — 4.
  - Task 3: `applyEmployeesBarHunk` — 4; `employee-editor-layout etab-body` — 1; `aria-current` в ui-contract — 4.
- Playwright-линии редактора **BLOCKED (ENV)/(DATA)**: не запускались, не записаны как пройденные.

## Next

Ready for 26-08 («Повышение» в общей раскладке).
- `EditorActionBar` теперь вызывается дважды: черновые вкладки и «Сотрудники».
- Своё содержимое nav удобно добавлять веткой в тернарную цепочку `nav={tab === … }` либо отдельным вызовом панели внутри компонента вкладки, как у «Сотрудников».
- Вставки 26-07 зависят от импорта 26-06b и друг от друга. Новые отрицательные проверки должны исключать зависимые вставки.

## Self-Check: PASSED

- FOUND: .planning/phases/PORTIA-26-edinyy-stil-sayta/26-07-SUMMARY.md, components/portia-editor.tsx, lib/editor-tab-layout.test.ts, lib/format-launch.test.ts
- FOUND: c936807, 29e4ae6, 073b8b9 (предки HEAD)
