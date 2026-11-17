---
phase: PORTIA-26-edinyy-stil-sayta
fixed_at: 2026-11-16T00:00:00Z
review_path: C:/Users/User/code/portia-site/.planning/phases/PORTIA-26-edinyy-stil-sayta/26-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 26: отчёт об исправлениях по код-ревью

**Исправлено:** 2026-11-16
**Источник:** `C:/Users/User/code/portia-site/.planning/phases/PORTIA-26-edinyy-stil-sayta/26-REVIEW.md`
**Итерация:** 1

**Итого:**
- Замечаний в области (critical_warning): 6 (CR/BL нет, WR-01…WR-06)
- Исправлено: 6
- Пропущено: 0
- Замечания IN-01…IN-03 вне области `critical_warning` и не тронуты.

**Где выполнены проверки:** в основном рабочем дереве (`workflow.use_worktrees: false`, отдельный worktree не создавался). Node 22.13.1.
**Проверки после каждого исправления и в конце:** `node --experimental-strip-types --test lib/*.test.ts` — 2358 pass / 0 fail (3 skipped, как и до правок); `node node_modules/typescript/bin/tsc --noEmit` — без ошибок; ESLint по изменённым компонентам — 0 ошибок (остались прежние предупреждения `no-img-element`). Парсинг обоих CSS-файлов через lightningcss (синтаксис диапазонов) — без ошибок.
**BLOCKED (не доказано, не засчитано как пройденное):** поведение в браузере и на устройстве — липкая панель, строка черновика, плашка, расстановка ярлыков на дробной ширине, объявления скринридера, фокус после решения. Проверено только строковыми/CSS-контрактами и типами.

## Fixed Issues

### WR-01: Несохранённый черновик не виден и не сохраняется на вкладках без панели действий

**Статус:** fixed: requires human verification (логика показа и состояний)
**Файлы:** `components/portia-editor-tab-shell.tsx`, `components/portia-editor.tsx`, `components/portia-users-tab.tsx`, `app/portia.css`, `lib/editor-tab-layout.test.ts`, `lib/format-launch.test.ts`
**Коммит:** 16d2a05
**Что сделано:**
- Общий черновик доходит до вкладок вне `editorSections` через `EditorDraftBarContext`. Показывается при `!draftTab && (dirty || saveState !== "idle")`.
- **Выбор, чтобы панели не стояли двумя липкими слоями у одного края:** на «Пользователи», «Повышение» и «Сотрудники» отдельная вторая панель не рисуется. `EditorActionBar` читает контекст и добавляет в свою же секцию `.etab-bar` ещё одну строку `.etab-draft`: метка «ЧЕРНОВИК», статус с «Не сохранено: N», кнопки ↶ / ОТМЕНИТЬ / СОХРАНИТЬ. Причины отказа идут строками `role="alert"` под панелью.
- Вкладка «Доступ» собственной панели не имеет, поэтому рисует `EditorDraftBar` (та же строка в отдельной `.etab-bar`). Телефонный список «Пользователей» тоже без панели, поэтому там `<EditorDraftBar />`.
- Кнопки и причины панели вынесены в `draftActions` / `draftMessages` и используются и панелью вкладок черновика, и контекстом, поэтому разошедшихся копий нет. Русский текст лишь метка и подписи в шве (D-58 соблюдён: в `portia-editor.tsx` новых строк нет).
- CSS (в блоке ui-unify без цветов и шрифтов): `.etab-bar:has(> .etab-draft) { flex-wrap: wrap }`, `.etab-draft { flex: 0 0 100%; order: 2; min-height: 44px }`. Цвет и шрифт метки лежат вне блока.
- Реестр D-21: добавлен hunk `PORTIA-26-R01` (`applyReviewDraftBarHunk`) с отрицательными проверками. Три фильтра в тесте D-64 исключают его там, где нет якорей более ранних hunk. Тесты кнопок и причин панели переведены на константы.
**Не охвачено:** ранние возвраты `UsersTab` (скелет, фатальная ошибка, отказ) и «Повышения» (отказ) рисуются без панели, и черновик там не виден. Они заменяют всю вкладку и недостижимы при обычной работе.

### WR-02: Граница телефона 520/521px оставляет щель на дробной ширине

**Статус:** fixed: requires human verification (поведение на дробных ширинах в браузере)
**Файлы:** `app/portia.css`, `app/portia-promotion-editor.css`, `components/portia-desktop-shortcuts.tsx`, `lib/shortcut-layout.test.ts`, `lib/portia-desktop.test.ts`, `lib/ui-unify.test.ts`, `lib/editor-tab-layout.test.ts`
**Коммит:** b537777
**Что сделано:** три диапазона без щелей. Телефон `(max-width: 520px)`, планшет `(520px < width <= 900px)`, ПК `(width > 900px)`.
- CSS: блок планшета теперь `@media (520px < width <= 900px)`. Все `@media (min-width: 901px)` в двух CSS-файлах заменены на `(width > 900px)`, потому что парные телефонные блоки остались `max-width: 900px`, как и весь JS. Это дополняет щель 900/901, в том числе у липкой панели.
- JS: `phoneShortcutQuery = "(max-width: 520px)"` и `tabletShortcutQuery = "(520px < width <= 900px)"`. Обработчики `handlePointerDown` и `handleKeyDown` берут общую константу, а `matchMedia` получает те же строки, что и CSS.
- Тесты: новый тест сверяет, что строки JS совпадают с блоками CSS и что значения 520, 520.5, 520.98, 521, 900, 900.5, 901 попадают ровно в один диапазон. Константы `DESKTOP` в трёх тестах и регексы переведены на новый синтаксис.
**Оговорка:** старые блоки `@media (max-width: 520px)` и `(max-width: 900px)` не менялись, это дополнения. Диапазонный синтаксис поддерживают Chrome 104+, Firefox 63+, Safari 16.4+.

### WR-03: После решения на ПК выбор и фокус пропадают, если `load()` вытеснен другим запросом

**Статус:** fixed: requires human verification (асинхронная логика, выбор и фокус)
**Файлы:** `components/portia-users-tab.tsx`, `lib/users-component.test.ts`
**Коммит:** d3848e7
**Что сделано:** след решения привязан к следующему принятому списку, а не к возврату `load()`. `postAction` кладёт замыкание в `afterDecision` (строки до решения, ключ решённой строки, телефон или ПК). `load()` сразу после `setList(parsed)` берёт и обнуляет его и вызывает с принятым списком, от какого бы запроса он ни пришёл. Устаревший ответ (`requestId !== requestEpoch.current`) до этого места не доходит. Если свой `load()` вернул `false`, след отменяется. Клик по строке (`selectRow`) и смена раздела (`switchSection`) тоже отменяют его: выбор пользователя главнее. Старый `if (!refreshed) return` убран.
**Не охвачено:** поведение гонки в браузере не воспроизводилось, проверен только контракт исходника.

### WR-04: Сообщения «Повышения» всегда получают тон `error`, CSS строки статуса противоречит сам себе

**Статус:** fixed
**Файлы:** `components/portia-promotion-editor-main.tsx`, `app/portia.css`, `lib/editor-tab-layout.test.ts`
**Коммит:** 084a37a
**Что сделано:**
- `message` стал производным от `note = { text, ok }`, а `setMessage(text, ok = false)` через `useCallback`. Успехи («Привязка … сброшена.», «Запрос отклонён…», «Запрос удалён.») передают `true`, остальное остаётся ошибкой. Тон: `message ? (note.ok ? "saved" : "error") : ""`. `saved` даёт нейтральный бирюзовый цвет `.editor-save-status.saved`.
- CSS: в блоке ui-unify добавлено `.etab-bar .etab-status.editor-save-status { white-space: nowrap }` (специфичность 0,3,0 против 0,2,0 у `.editor-save-status.error`). Строка панели остаётся одной с многоточием, полный текст в `title`.
- Зависимости `useCallback` обновлены (`deny`, `loadQueue`, `loadBanks`).

### WR-05: Дублирование живых областей

**Статус:** fixed: requires human verification (поведение скринридера не проверялось)
**Файлы:** `components/portia-editor.tsx`, `lib/editor-tab-layout.test.ts`, `lib/format-launch.test.ts`
**Коммит:** edea8f9
**Что сделано:** одна живая область на любой вкладке. На вкладках черновика скрытый `sr-only` абзац не выводится, объявляет статус `etab-status` панели. На остальных вкладках строка черновика (WR-01) не живая (без `role` и `aria-live`), живой остаётся скрытый абзац (условие `!editorSections.some(...)`). Реестр D-21: hunk `PORTIA-26-R05` (`applyReviewLiveRegionHunk`) с отрицательными проверками.
**Оговорка:** на вкладках черновика скринридер теперь не получает список названий несохранённых секций, только число. Названия остаются в `aria-label` кнопок вкладок.

### WR-06: Липкая плашка «данные устарели» в «Пользователях» уходит под панель

**Статус:** fixed: requires human verification (расположение на экране не проверялось)
**Файлы:** `components/portia-editor-tab-shell.tsx`, `components/portia-users-tab.tsx`, `app/portia.css`, `lib/editor-tab-layout.test.ts`
**Коммит:** cd4a0f4
**Что сделано:** плашка вынесена внутрь панели. `EditorActionBar` и `EditorDraftBar` получили проп `banner` и рисуют его последней строкой `.etab-banner` (`order: 3`, после строки черновика). Вложенная `.app-stale-banner` становится `position: static`, на ПК с `margin: 0 -16px`, на телефоне `margin: 0`. Отдельного липкого слоя у того же края больше нет. Если панели нет вовсе (телефон без черновика), плашка выводится как раньше отдельно.

## Skipped Issues

Нет.

---

_Fixed: 2026-11-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
