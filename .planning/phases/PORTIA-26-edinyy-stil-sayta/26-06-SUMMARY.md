---
phase: PORTIA-26-edinyy-stil-sayta
plan: 06
subsystem: ui
tags: [editor, sticky-bar, tab-layout, d-21-guard, css]

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: блок ui-unify и семейства кнопок/строк (26-03), правила развёрнутого окна под .app-window.is-maximized (26-05)
provides:
  - "components/portia-editor-tab-shell.tsx — шов раскладки вкладок: EditorActionBar (nav · status · actions + строки причин role=alert), EditorTabBody, EditorEmptyDetail, emptyDetailCopy"
  - "липкая панель .etab-bar вместо плавающего чипа сохранения во всех черновых вкладках (editorSections)"
  - "«список — деталь» (etab-body / etab-list / etab-detail) у Базы вирусов и Корзины, только деталь у Рекомендаций, Помощника и Доступа; aria-current у выбранной строки; пустая деталь «Выберите запись»"
  - "реестр D-21: вставки PORTIA-26-06 (applyTabShellHunk) и PORTIA-26-06b (applyTabBodiesHunk) с отрицательными проверками"
  - "lib/editor-tab-layout.test.ts — контракт панели и раскладки через componentFamily"
affects: [26-07, 26-08, 26-13, 26-14]

plan_head_before: ae4b10e12978e8b165a3e8f184902d2e96a77fac
plan_head_after: 049b2961543b3bab7e1a76181e69bf5803e01c7c

actuals:
  tokens: 19600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "тексты раскладки вкладок живут в шве portia-editor-tab-shell.tsx; файл редактора только вызывает шов (D-21/D-58), новых русских строк в нём нет"
    - "цвета и шрифты панели (.etab-bar background, .etab-message, .etab-empty) — вне блока ui-unify; раскладка — в блоке"
    - "на ПК липкость от края: у .content-editor:has(> .etab-bar) верхний отступ 28px перенесён в margin-top шапки, поэтому top: 0 прилегает к краю без коррекции -28px"
    - "старые классы (virus-editor-layout, recycle-editor-layout, editor-record-list, flat-editor-form) остаются рядом с etab-*, правила 26-05 продолжают действовать"

key-files:
  created:
    - components/portia-editor-tab-shell.tsx
    - lib/editor-tab-layout.test.ts
  modified:
    - components/portia-editor.tsx
    - components/portia-editor-dossier.tsx
    - app/portia.css
    - lib/format-launch.test.ts
    - lib/level-editor.test.ts
    - lib/portia-desktop.test.ts
    - tests/e2e/specs/editor-journeys.spec.ts
    - tests/e2e/specs/editor-layout.spec.ts
    - tests/e2e/specs/editor-ui-contract.spec.ts

key-decisions:
  - "z-index панели 4, а не 3 из плана: оглавление .editor-toc (z-index 3) стоит в DOM позже и при прокрутке рисовалось бы поверх панели того же уровня; 4 всё ещё ниже панели оформления (950), диалогов и уведомлений"
  - "Причины отказа (saveError при ошибке, oversize, bodyMessage, исправление даты квеста) показываются строками под панелью только пока есть несохранённые правки — как во всплывающем окне чипа; иначе предупреждение о невидимом лимите висело бы постоянно"
  - "До 26-07 старые липкие слои «Справочника»/«Информации» (.editor-section-addbar, .editor-section-tabs) под панелью стоят в потоке (position: static через .etab-bar ~ *), чтобы не перекрывать её; 26-07 переносит их в слот nav"
  - "ArchivedVirusEditor (деталь Корзины) получил класс etab-detail в portia-editor-dossier.tsx (файла нет в списке плана; файл не под охраной D-21)"
  - "EditorTabBody экспортирован и проверен тестом, но редактор пока его не вызывает: вкладки со списком получили классы на существующих элементах (ref, data-mobile-view и кнопка «← К списку» сохранены); шов готов для 26-07 («Сотрудники», «Пользователи»)"

requirements-completed: [UI-04]

coverage:
  - id: D1
    description: "Трассер: одна липкая панель .etab-bar из шва под строкой вкладок во всех черновых вкладках; «↶», «ОТМЕНИТЬ» (диалог «Отменить несохранённые правки?»), «СОХРАНИТЬ» с прежней логикой; статус saveStatusText + «Не сохранено: N», role=status; saveNotice в слоте статуса; причины — role=alert под панелью; чип и всплывающее окно удалены"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13b: the editor renders one action bar under the tab strip for the draft tabs, with the old buttons"
        status: pass
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13b: the bar has a nav slot only when given, a polite status slot and an actions slot; reasons are alert lines under it"
        status: pass
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13b: the floating save chip and its popover are gone; the sr-only live region and the discard dialog stay"
        status: pass
      - kind: unit
        ref: "lib/level-editor.test.ts#D-17 the notice of the server's lift is the status line of the action bar, not hidden in a popover"
        status: pass
    human_judgment: false
  - id: D2
    description: "Липкость: sticky, top 0, непрозрачный var(--panel), граница var(--line), 48px, 0 16px, зазор 8px; телефон — overflow: clip, top 48px, две строки в одном элементе; правил чипа в CSS нет"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13b: the bar is sticky, opaque and above the content; the chip rules are gone from the stylesheet"
        status: pass
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13b phone: one sticky bar in two rows under the 48px system bar, held by overflow: clip"
        status: pass
      - kind: unit
        ref: "lib/portia-desktop.test.ts#sticky and floating editor layers never cover the content: notices are in the flow, the sticky action bar sits under the panel (UI E3 overflow)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-12: Base вирусов и Корзина — etab-body/etab-list/etab-detail рядом с прежними классами, aria-current у выбранной строки, пустая деталь «Выберите запись»; Рекомендации, Помощник, Доступ — только деталь; список clamp(240px, 24%, 320px), деталь 24px/16px, телефон — список или запись"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-12 (5 тестов: вирусы, корзина, только деталь, пустая деталь, CSS)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-21: все правки редактора — побайтные вставки PORTIA-26-06/26-06b в реестре, отрицательные проверки, SAMPLE_COMMIT не перебазирован, D-58 и тексты h-33…h-61 на месте"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/format-launch.test.ts#D-64: portia-editor.tsx differs from 449c756 only by the approved edits"
        status: pass
      - kind: unit
        ref: "lib/format-launch.test.ts#D-58: the set of Russian texts of the editor file equals the sample's after the approved edits"
        status: pass
      - kind: unit
        ref: "lib/format-launch.test.ts#D-64: the guard notices any other edit, a missing hunk, a changed text and an unreadable sample"
        status: pass
      - kind: unit
        ref: "lib/phase20-hints-inventory.test.ts (полный файл)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Вид панели и раскладки в браузере (ПК и телефон), липкость при прокрутке длинной формы, e2e-линии редактора"
    requirement: UI-04
    verification: []
    human_judgment: true
    rationale: "Playwright-линии редактора не запускались — BLOCKED (ENV)/(DATA), препфлайт требует окружения; e2e только переписаны и проверены tsc/eslint. Браузер не открывался; физические устройства — Phase 27"

duration: ~13 мин (09:19:49Z старт — 09:32:56Z коммит Task 3)
completed: 2026-11-16
status: complete
---

# Phase 26 Plan 06: Единая раскладка вкладок редактора, часть 1 Summary

**Плавающий чип сохранения заменён липкой панелью `.etab-bar` из нового шва `portia-editor-tab-shell.tsx` (статус, «↶», «ОТМЕНИТЬ», «СОХРАНИТЬ», причины отказа строками под ней) во всех черновых вкладках, а База вирусов и Корзина стали «список слева — деталь справа» с пустым состоянием «Выберите запись»; каждая правка редактора записана побайтно в реестр D-21.**

## Performance

- **Tasks:** 3 из 3 (Task 1 — трассер панели, Task 2 — тела вкладок, Task 3 — e2e-локаторы)
- **Files:** 11 (2 создано, 9 изменено), +561/−113
- **Duration:** ~13 мин от записи старта (09:19:49Z) до коммита Task 3 (09:32:56Z); чтение контекста до старта не учтено

## Accomplishments

- **Шов (Task 1, `ef8d47a`):** `components/portia-editor-tab-shell.tsx` — `EditorActionBar({ label, nav, statusText, tone, unsavedCount, notice, actions, messages })`: `<section className="etab-bar" aria-label>` со слотами `.etab-nav` (только если передан), `.etab-status` (`role="status" aria-live="polite"`, `notice || statusText` и « · Не сохранено: N», полный текст в `title`), `.etab-actions`; строки `messages` — `<p className="etab-message" role="alert">` под панелью, пустой слот ничего не рисует. `EditorTabBody`, `EditorEmptyDetail`, `emptyDetailCopy`. Всё через React, без `dangerouslySetInnerHTML`.
- **Редактор (Task 1):** панель стоит сразу после `</nav>` строки вкладок для `editorSections`; три кнопки перенесены из чипа побайтно; `label` — `sectionLabels[tab]`, `statusText`/`tone` — существующие `saveStatusText`/`status`; причины — пока есть правки. Удалены `popoverOpen`, `chipRef`, `popoverId`, эффект закрытия, `chipVisible`/`alarm`/`chipLabel`/`chipText` и весь блок чипа. `sr-only`-область и `ConfirmDialog` не тронуты.
- **CSS (Task 1):** правила чипа и всплывающего окна (ПК и телефон, `bottom`-смещения, `padding-bottom: 110px`) удалены. Блок ui-unify: `.etab-bar { position: sticky; top: 0; z-index: 4; min-height: 48px; padding: 0 16px; gap: 8px; border-bottom: 1px solid var(--line) }`, слоты nav/status/actions, кнопка «↶» 40×40 (44×44 на телефоне); на ПК верхний отступ панели редактора перенесён в шапку, чтобы панель прилегала к краю; телефон — `overflow: clip`, `top: 48px`, перенос в две строки (nav — вторая строка, `flex-basis: 100%`). Вне блока — `background: var(--panel)`, цвет и шрифт строк причин.
- **Тела вкладок (Task 2, `85d5f72`):** `virus-editor-layout etab-body`, `editor-record-list etab-list`, `editor-form virus-editor-form etab-detail`; `aria-current="true"` у выбранной строки вирусов и Корзины; без выбранного вируса при непустом списке — `<EditorEmptyDetail />`, при пустом — прежнее «Добавьте первую запись вируса.». Корзина: `recycle-editor-layout etab-body`, форма файла и `ArchivedVirusEditor` — `etab-detail`; «Корзина пуста…» (h-46) не тронута. Рекомендации, Помощник, Доступ — класс `etab-detail` на корне, без левой колонки. CSS: `.etab-body` `clamp(240px, 24%, 320px) minmax(0, 1fr)`, `[data-detail-only]` — одна колонка, `.etab-detail` 24px/16px, `.etab-empty` (16px 700 / 13px 400, 48px по вертикали), телефон — одна колонка и `[data-mobile-view="list"] > .etab-detail { display: none }`.
- **Реестр D-21:** `applyTabShellHunk` (`PORTIA-26-06`: импорт, состояние, эффект, значения чипа → строка комментария, панель после `</nav>`, удаление блока чипа литералами) и `applyTabBodiesHunk` (`PORTIA-26-06b`: 13 замен классов/атрибутов); отрицательные проверки «без вставки — разница» и «повторно не применяется»; исключение 26-06 там, где отключается 24-08 (вставка опирается на его строку `saveNotice`). `SAMPLE_COMMIT` прежний.
- **E2E (Task 3, `049b296`):** `save()`/`saveEditor()` берут «СОХРАНИТЬ» из `.etab-bar`; четыре проверки «черновик не изменён» — новый хелпер `expectDraftUnchanged` («СОХРАНИТЬ» disabled, статус без «Есть несохранённые изменения»).

## TDD

План типа `execute`, задачи 1–2 с `tdd="true"`; RED и GREEN в одном коммите на задачу (как в 26-03…26-05).

- **Task 1 RED:** 11 из 201 тестов `<verify>` упали до реализации — 6 новых в `editor-tab-layout` (шва нет, панели нет, чип на месте, CSS панели нет), D-64/D-58/«guard notices» (вставка PORTIA-26-06 в реестре, файл ещё старый), перенацеленные D-17 и «липкие слои». Причины — целевые проверки, не ошибки загрузки. GREEN — 201/201.
- **Task 2 RED:** 5 из 166 упали (4 новых D-12 и D-64 с вставкой PORTIA-26-06b); тест пустой детали шва прошёл сразу (шов создан в Task 1). GREEN — 166/166.
- **Tracer gate:** авто-режим выключен, `human_verify_mode` по умолчанию `end-of-phase`, `<verify>` трассера только автоматический — перезапущен после коммита: 201/201, 0 fail; расширение продолжено.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] z-index панели 4 вместо 3**
- **Found during:** Task 1
- **Issue:** `.editor-toc` (`position: relative; z-index: 3`) идёт в DOM после панели; при равном z-index оглавление при прокрутке рисовалось бы поверх липкой панели.
- **Fix:** `z-index: 4` (ниже панели оформления 950, диалогов и уведомлений); тесты проверяют «выше оглавления и ниже 10».
- **Commit:** `ef8d47a`

**2. [Rule 1 - Bug] Полоса 28px над панелью на ПК**
- **Found during:** Task 1
- **Issue:** sticky отсчитывается от внутреннего края `.content-editor` с отступом 28px; при `top: 0` между краем окна и панелью прокручивалось бы содержимое (у старой полосы для этого была коррекция `top: -28px`, которую 26-07 удаляет).
- **Fix:** в `@media (min-width: 901px)` у `.content-editor:has(> .etab-bar)` `padding-top: 0`, у шапки `margin-top: 28px` — без прокрутки вид прежний, при прокрутке панель у самого края; `top` остаётся 0.
- **Commit:** `ef8d47a`

**3. [Rule 1 - Bug] Старые липкие слои перекрыли бы панель до 26-07**
- **Found during:** Task 1
- **Issue:** `.editor-section-addbar` (z-index 4, `top: -28px`/`48px`) и `.editor-section-tabs` во «Справочнике» и «Информации» залипали бы в той же точке, что и новая панель.
- **Fix:** `.etab-bar ~ * .editor-section-addbar, .etab-bar ~ * .editor-section-tabs { position: static; }` — переходное правило с комментарием; 26-07 переносит их в слот nav и снимает их липкость.
- **Commit:** `ef8d47a`

**4. [Rule 2 - Missing critical] Причины отказа только при несохранённых правках**
- **Found during:** Task 1
- **Issue:** без условия предупреждение о невидимом лимите (oversize, D-16 «только предупреждает») висело бы под панелью постоянно, даже на чистом черновике; во всплывающем окне эти строки были видны только при `dirty`.
- **Fix:** `messages={dirty ? [...] : []}`.
- **Commit:** `ef8d47a`

**5. [Rule 3 - Blocking] Отрицательные проверки 24/24-08 и вставка 26-06**
- **Found during:** Task 1 (RED: «chip values: exactly one approved anchor»)
- **Issue:** проверки «файл без PORTIA-24/24-08» применяли все остальные вставки, а вставка 26-06 опирается на строку `chipVisible … || !!saveNotice` из 24-08.
- **Fix:** в эти две проверки добавлено исключение `PORTIA-26-06*` (как уже было с PORTIA-25).
- **Commit:** `ef8d47a`

**6. [Rule 3 - Blocking] Деталь Корзины в другом файле**
- **Found during:** Task 2
- **Issue:** корень `ArchivedVirusEditor` (`editor-form virus-editor-form`) живёт в `components/portia-editor-dossier.tsx`, которого нет в списке файлов плана.
- **Fix:** добавлен класс `etab-detail` к корню (одна правка класса; файл не под охраной D-21, тесты framing/hints зелёные). Обёртка в редакторе сломала бы телефонное правило `> .editor-form`.
- **Commit:** `85d5f72`

**Total deviations:** 6 auto-fixed (3 × Rule 1, 1 × Rule 2, 2 × Rule 3). **Impact:** в границах UI-04; логика `save()`, Ctrl+Z/Y, диалоги и тексты h-33…h-61 не менялись.

Примечание по `<verify>` Task 2: литерал «unrecorded explanation» встречается в выводе только как название проходящего теста `ok 54 - D-56 (20-37): … an unrecorded explanation`; отказа нет.

## Допущения, сообщаемые владельцу (edge-probe UI-04: unclassified / unresolved)

- **A8 UI-SPEC:** всплывающий список несохранённых разделов убран; сведения — в строке статуса («Не сохранено: N»), точках на вкладках и скрытой живой области. Если владельцу не хватит списка — самый дешёвый возврат: подсказка `title` у статуса.
- **Один черновик на редактор (Pitfall 4):** «СОХРАНИТЬ» сохраняет все изменённые разделы, статус пишет «Не сохранено: N», а не «в этой вкладке».
- **Отступ детали 24px (ПК) / 16px (телефон)** добавлен и к формам Рекомендаций, Помощника и Доступа — на телефоне поля стали уже на 32px.
- **До 26-07** «+ ДОБАВИТЬ РАЗДЕЛ» и вкладки разделов «Справочника»/«Информации» больше не прилипают сами — они уезжают при прокрутке, прилипает только новая панель (26-07 переносит их внутрь панели).

## Known Stubs

Нет. `EditorTabBody` экспортирован, но пока не вызывается редактором — зарезервирован для 26-07 («Сотрудники», «Пользователи»); это не заглушка данных.

## Для владельца

Что изменилось в редакторе (в браузере не открывалось — суждение по коду и тестам):

- **Кнопки сохранения теперь всегда видны.** Вместо маленького плавающего значка с числом в углу под строкой вкладок стоит полоса: слева — состояние («Есть несохранённые изменения · Не сохранено: 2», «Сохраняем…», «Сохранено», «Не удалось сохранить»), справа — «↶» (отменить последнее действие), «ОТМЕНИТЬ» и «СОХРАНИТЬ». Полоса не уезжает при прокрутке длинной формы. Так во всех вкладках с черновиком: База вирусов, Информация, Справочник, Сводка, Корзина, Рекомендации, Помощник.
- **«ОТМЕНИТЬ»** спрашивает «Отменить несохранённые правки?», как раньше. Ctrl+Z / Ctrl+Y работают как раньше.
- **Почему не сохраняется** — теперь видно сразу строкой под полосой (ошибка сервера, слишком большой текст, ссылка «ИСПРАВЬТЕ ДАТЫ КВЕСТА»), без открытия окна.
- **Сообщение сервера о поднятых уровнях** показывается в той же строке состояния.
- **База вирусов и Корзина:** список слева (240–320px), запись справа с отступом. Выбранная строка отмечена и для экранного диктора. Если запись не выбрана, справа написано «Выберите запись — Она откроется справа. Выберите строку в списке слева.».
- **Рекомендации, Помощник, Доступ:** только форма, пустой левой колонки нет.
- **Телефон:** та же полоса прилипает под верхней системной полосой; список или запись — как раньше, кнопка «← К списку» на месте.
- **Сотрудники, Пользователи, Повышение** пока без полосы — следующий план 26-07 (Сотрудники) и дальше.
- Проверки в браузере и на устройствах (Playwright, ПК, телефон) не запускались — они BLOCKED до окружения и Phase 27, не «пройдено».

## Проверка

- `node --experimental-strip-types --test lib/*.test.ts` — 2286 тестов, 2283 pass, 3 skipped, 0 fail (база 26-05: 2275/2272/3/0).
- `<verify>` Task 1 (7 файлов) — 201/201; `<verify>` Task 2 (6 файлов) — 166/166.
- `node node_modules/typescript/bin/tsc --noEmit` — без ошибок (включая e2e-спеки); ESLint по изменённым компонентам, тестам и трём спекам — 0 ошибок (3 старых предупреждения `no-img-element` в редакторе, 1 в dossier — не от этого плана).
- Критерии приёмки: `EditorActionBar` в редакторе — 2; `applyTabShellHunk` — 4; `etab-bar` в CSS — 7; `SAMPLE_COMMIT = "449c756…"` — 1; `etab-body` — 2; `EditorEmptyDetail` — 2; «Выберите запись» в шве — 1; `PORTIA-26-06b` — 5; `etab-bar` в ui-contract — 2; `editor-save-chip` в трёх спеках — 0/0/0.
- Playwright-линии редактора — **BLOCKED (ENV)/(DATA)**, не запускались, не записаны как пройденные.

## Next

Ready for 26-07 (nav разделов в панели, раскладка A2, панель «Сотрудников»). Для 26-07: переходное правило `.etab-bar ~ * .editor-section-addbar, .etab-bar ~ * .editor-section-tabs { position: static }` снять вместе с липкостью старых слоёв; у `.etab-bar` z-index 4 (не 3); ПК-коррекция сделана через `padding-top: 0` у `.content-editor:has(> .etab-bar)`, литерала `top: -28px` у панели нет.

## Self-Check: PASSED

- FOUND: components/portia-editor-tab-shell.tsx, lib/editor-tab-layout.test.ts, .planning/phases/PORTIA-26-edinyy-stil-sayta/26-06-SUMMARY.md
- FOUND: ef8d47a, 85d5f72, 049b296 (предки HEAD)
