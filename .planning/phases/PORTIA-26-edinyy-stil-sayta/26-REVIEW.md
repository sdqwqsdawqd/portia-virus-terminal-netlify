---
phase: PORTIA-26-edinyy-stil-sayta
reviewed: 2026-11-16T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - app/portia-promotion-editor.css
  - app/portia.css
  - components/custom-color-picker.tsx
  - components/portia-access-gate.tsx
  - components/portia-desktop-shortcuts.tsx
  - components/portia-desktop.tsx
  - components/portia-editor-dossier.tsx
  - components/portia-editor-rich-text.tsx
  - components/portia-editor-tab-shell.tsx
  - components/portia-editor.tsx
  - components/portia-icons.tsx
  - components/portia-promotion-editor-main.tsx
  - components/portia-promotion-ordinary-editor.tsx
  - components/portia-promotion-qualification-editor.tsx
  - components/portia-users-tab.tsx
  - lib/card-toggle-name.ts
  - lib/info-phone-nav.ts
  - lib/shortcut-layout.ts
  - lib/users-copy.ts
  - lib/users-view.ts
  - playwright.config.ts
  - lib/editor-tab-layout.test.ts
  - lib/ui-unify.test.ts
  - lib/ui-contrast.test.ts
  - lib/virus-classes.test.ts
  - lib/phase26-regressions.test.ts
  - lib/shortcut-layout.test.ts
  - lib/users-view.test.ts
  - lib/info-phone-nav.test.ts
  - lib/card-toggle-name.test.ts
  - tests/e2e/specs/users-tab.spec.ts
  - tests/e2e/specs/info-phone-nav.spec.ts
  - tests/e2e/specs/editor-ui-contract.spec.ts
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
  necessity: 0
status: issues_found
---

# Phase 26: Отчёт о код-ревью

**Reviewed:** 2026-11-16
**Depth:** standard (diff 312033d..HEAD)
**Files Reviewed:** 34
**Status:** issues_found

## Summary

Проверены изменения фазы 26: каркас вкладок редактора (`EditorActionBar` / `EditorTabBody`), вкладка «Пользователи» (список и деталь), панель «РАЗДЕЛЫ» в информации на телефоне, расстановка ярлыков 521–900px (`placeShortcuts` / `useShortcutPlacement`), иконки классификации, CSS липкой панели. Тесты и e2e-спеки просмотрены на корректность проверок, которые охраняют поведение.

Что подтверждено как исправное:
- Права во вкладке «Пользователи» идут только через `visibleControls` в `RowActions`. Новый `UsersActionBody` сам ничего не решает, а обработчики `approve`, `setLevel`, `requestReject`, `requestRevoke` и `clearCooldown` по-прежнему проверяют `"canDecide" in row.source`, `"canRevoke" in row.source` и `callerIsOwner`. Выбор строки в списке ничего не отправляет. Обхода гейтинга не найдено.
- `ResizeObserver` в `useShortcutPlacement` не зацикливается. `.desktop-icons` на 521–900px получает фиксированную высоту `calc(100svh - 82px)`, а выросшая `--shortcut-content-height` меняет только `min-height` у `.workspace`. Обратной связи нет. `placeShortcuts` гарантированно завершается: цикл ограничен `rows > ids.length + taken.length`.
- Порядок подключения CSS (`portia.css`, затем `portia-promotion-editor.css`) делает так, что `display: block` у `.promotion-editor-workbench` на телефоне перебивает `.etab-body { display: grid }`.
- В SVG иконок нет `id`, `url(#…)`, `mask` и `clipPath`, поэтому коллизий между экземплярами нет.

Блокеров нет. Найдено 6 предупреждений и 3 замечания.

## Warnings

### WR-01: Несохранённый черновик не виден и не сохраняется на вкладках без панели действий

**File:** `components/portia-editor.tsx:1215` (панель выводится только при `editorSections.some(section => section === tab)`)
**Issue:** Плавающая плашка сохранения (`editor-save-chip`) была видна на любой вкладке, пока `dirty || saving || saved || saveNotice`. Теперь статус, «СОХРАНИТЬ», «ОТМЕНИТЬ» и причины отказа живут только в `EditorActionBar`, а он рисуется для 7 вкладок черновика (`viruses`, `info`, `guide`, `broadcasts`, `recycle`, `search`, `assistant`).
Черновик общий для всех вкладок. Если сделать правку в «Информации» и перейти в `users`, `promo` или `access`, на экране не остаётся ни индикатора несохранённого, ни кнопки сохранения, ни `saveNotice`, ни `saveError`. Остаётся только `sr-only` статус (строка 1705). Вкладка `employees` рисует свою панель, но она относится к профилю, а не к черновику.
Прежний комментарий D-09 прямо требовал, чтобы компактная плашка никогда не скрывала несохранённую работу, и новое поведение этому противоречит. Это риск потери правок: пользователь закрывает окно, не зная, что есть несохранённое (`beforeunload` его только спросит).
**Fix:** Показывать компактную индикацию несохранённого на вкладках вне `editorSections` при `dirty || saveState !== "idle"`. Например, вызвать `EditorActionBar` без `nav` на всех вкладках, кроме тех, у которых своя панель, либо вывести ту же строку статуса и кнопки над `users`, `promo` и `access`. Минимум: строка «Не сохранено: N» с кнопкой возврата на вкладку черновика.

### WR-02: Граница телефона 520/521px оставляет щель на дробной ширине вьюпорта

**File:** `components/portia-desktop-shortcuts.tsx:187` и `:247` (`(max-width: 520px)`), `:32` (`(min-width: 521px) and (max-width: 900px)`); `app/portia.css:1507` (`@media (max-width: 520px)`) и `:1519` (`@media (min-width: 521px) and (max-width: 900px)`)
**Issue:** Раньше граница была одна (`max-width: 900px`), теперь их две, и между ними нет перекрытия. При дробной CSS-ширине (масштаб браузера 125% / 110% и т.п. даёт, например, 520.8px) не срабатывает ни `max-width: 520px`, ни `min-width: 521px`. Результат:
- CSS: блок `max-width: 900px` применяется, то есть сетка телефона с `position: relative; inset: auto`. Блок 521–900 и `inset: auto !important` из блока ≤520 не применяются.
- JS: `tablet === false`, расстановки нет. `handlePointerDown` и `handleKeyDown` проверяют только `max-width: 520px`, поэтому видят «не телефон» и разрешают перетаскивание.
Ярлык в сетке телефона визуально не двигается, а `onMove` сохраняет координаты в `shortcutPositions`. Это портит сохранённую раскладку ПК и планшета ложными позициями. Те же дробные ширины ломают и новые правила `@media (min-width: 901px)` липкой панели (`portia.css:2690`): при 900.5px не применяется ни ПК-блок, ни телефонный.
**Fix:** Задать границы без щели. Для JS: «телефон» = `!matchMedia("(min-width: 521px)").matches`, «планшет» = `(min-width: 521px) and (not (min-width: 901px))`. Для CSS: `@media (not (min-width: 521px))` или `@media (width < 521px)` вместо `max-width: 520px`, и `@media (width <= 900px)` либо `not (min-width: 901px)` вместо `max-width: 900px` в новых блоках.

### WR-03: После решения на ПК выбор и фокус пропадают, если `load()` вытеснен другим запросом

**File:** `components/portia-users-tab.tsx:569-581`
**Issue:** `postAction` делает `const refreshed = await load(); if (!refreshed) return;`. `load()` возвращает `undefined` как для устаревшего запроса (`requestId !== requestEpoch.current`), так и для ошибки или отказа (`false`). Поллинг каждые 10с и смена `debouncedQuery` запускают конкурирующий `load()` и увеличивают эпоху. Тогда запрос после действия отбрасывается, и ветка PC (выбор следующей строки, `focusPcSelection`) не выполняется.
Решённая строка при этом может исчезнуть из раздела: одобренная заявка уходит из «Заявок». `selectedKey` остаётся «висеть», `selectedContext` равен `null`, панель деталей пустеет, а фокус остаётся на удалённой кнопке «ОДОБРИТЬ» и уходит в `body`. Для клавиатурного пользователя это потеря контекста (T-26-20 как раз про это).
Список при этом обновит конкурирующий `load()`, но логика «следующая строка / кнопка раздела» к нему не привязана.
**Fix:** Не полагаться на возврат `load()` для управления фокусом. Применять пост-обработку к последнему принятому списку, то есть к `latestList.current` после `await load()`. Либо вынести подбор выбора в эффект на `[list, selectedKey]`: если `selectedKey` не найден в `activeView.rows`, выбрать соседа и сфокусировать его.

### WR-04: Сообщения «Повышения» всегда получают тон `error`, а CSS строки статуса противоречит сам себе

**File:** `components/portia-promotion-editor-main.tsx:123` (`tone={message ? "error" : ""}`), `app/portia.css:553` и `:2667`
**Issue:** `message` содержит и успехи: «Привязка … сброшена.», «Запрос отклонён и удалён из активной очереди.», «Запрос удалён.». Все они выводятся красным (`.editor-save-status.error`).
Кроме того, `.editor-save-status.error { white-space: normal }` (специфичность 0,2,0) перебивает `.etab-status { white-space: nowrap; text-overflow: ellipsis }` (0,1,0). Для любого `tone="error"` строка в панели переносится на несколько строк вместо одной с многоточием. На телефоне при `line-height: 44px` длинный текст ошибки раздувает липкую панель до нескольких строк по 44px и закрывает контент под ней.
**Fix:** Различать тон: `tone = isFailure ? "error" : "saved"`. Достаточно хранить признак ошибки отдельно от `message` либо выводить успехи через `notice`. В CSS поднять специфичность правила панели: `.etab-status.editor-save-status { white-space: nowrap; }`.

### WR-05: Дублирование живых областей: статус сохранения читается дважды

**File:** `components/portia-editor.tsx:1705` и `components/portia-editor-tab-shell.tsx:458`
**Issue:** `EditorActionBar` теперь содержит `<p role="status" aria-live="polite">` с текстом статуса и числом несохранённого, а прежний `sr-only` `<p role="status" aria-live="polite">` с тем же `statusText` и списком секций остался. Скринридер объявляет каждое изменение статуса дважды в разных формулировках («Сохранение…» и «Не сохранено: 3 · …»). Для обычного пользователя панель видна, и вторая область лишняя.
**Fix:** Оставить одну область. Либо убрать `sr-only` абзац на вкладках, где панель видна, либо сделать видимый `etab-status` не-live (`role="status"` без `aria-live`), если нужна именно расширенная формулировка со списком секций.

### WR-06: Липкая плашка «данные устарели» во вкладке «Пользователи» уходит под панель действий

**File:** `components/portia-users-tab.tsx:719`, `app/portia.css:2122` (`.app-stale-banner { position: sticky; top: 0; z-index: 1 }`) против `:2665` (`.etab-bar { position: sticky; top: 0; z-index: 4 }`)
**Issue:** Панель и плашка лежат в одном контейнере `.users-tab` и прилипают к одному краю (`top: 0` на ПК). При прокрутке `.etab-bar` (z-index 4) перекрывает плашку (z-index 1). Предупреждение об устаревших данных и кнопка «повторить» пропадают, когда список прокручен. На телефоне плашка прилипает к `top: 0` под системной полосой, а панель к `top: 48px`, и порядок слоёв там другой. Вывод по ПК сделан по CSS, без проверки в браузере.
**Fix:** Либо вывести плашку внутри панели (`messages`/отдельный слот `EditorActionBar`), либо задать ей `top: calc(var(--etab-bar-height, 48px))` в `.users-tab` и больший z-index относительно панели. Проще: в `.users-tab > .app-stale-banner { top: 56px; }` для ПК и `top: 104px` для телефона.

## Info

### IN-01: Вложенный `.etab-detail` в «Пользователях» даёт двойной отступ

**File:** `components/portia-users-tab.tsx:762` и `components/portia-editor-tab-shell.tsx:467-484`
**Issue:** `EditorTabBody` сам оборачивает `detail` в `div.etab-detail`, а `EditorEmptyDetail` рисует `div.etab-detail.etab-empty`. Во вкладке «Пользователи» пустая деталь получается вложенной: padding 24px внешнего блока плюс 48px 24px внутреннего. Во вкладке вирусов `EditorEmptyDetail` кладётся напрямую в `.etab-body`, и там всё верно. Селектор `.etab-body[data-mobile-view="list"] > .etab-detail` рассчитан именно на прямого потомка.
**Fix:** Убрать класс `etab-detail` из корня `EditorEmptyDetail` и оставить `etab-empty`, либо не оборачивать в `EditorTabBody`, если `detail` сам уже `.etab-detail`.

### IN-02: Одинаковые подписи у `<section>` и вложенного `<nav>` в панели действий

**File:** `components/portia-users-tab.tsx:706-712`, `components/portia-promotion-editor-main.tsx:123`, `components/portia-editor-tab-shell.tsx:456`
**Issue:** `EditorActionBar` рисует `<section aria-label={label}>`. Во «Пользователях» и «Повышении» внутри лежит `<nav aria-label>` с тем же текстом («Разделы пользователей», «Разделы повышения»). Скринридер перечисляет два ориентира с одним именем подряд.
**Fix:** Дать `section` другое имя (например, «Панель действий: …») или убрать `aria-label` у вложенного `nav`.

### IN-03: Расстановка ярлыков 521–900px не учитывает помощника и кнопку формата, а касание смешивает прокрутку и перетаскивание

**File:** `lib/shortcut-layout.ts:526-565`, `components/portia-desktop-shortcuts.tsx:184-206`, `app/portia.css:1524`
**Issue:**
- `placeShortcuts` обходит только уже сохранённые ярлыки. Помощник (`.desktop-assistant`) и `.global-format-launch` учитываются лишь в момент перетаскивания (`shortcutObstacles`), но не при расстановке и не после поворота экрана. Сохранённый ярлык после смены ориентации может оказаться под помощником.
- В 521–900px у иконки `touch-action: pan-y pinch-zoom`, а `handlePointerDown` по-прежнему захватывает указатель. Касание по вертикали прокручивает страницу, а горизонтальное (плюс вертикальная составляющая) работает как перетаскивание. Поведение зависит от угла жеста и нигде не зафиксировано.
**Fix:** Передавать `shortcutObstacles` в `placeShortcuts` для сохранённых позиций. Для касания (`event.pointerType === "touch"`) на планшете либо вовсе не начинать перетаскивание, либо оставить только Alt+стрелки.

---

_Reviewed: 2026-11-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
