---
phase: PORTIA-26-edinyy-stil-sayta
reviewed: 2026-11-17T03:10:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - components/portia-level-picker.tsx
  - lib/classification-fit.test.ts
  - lib/editor-tab-layout.test.ts
  - lib/format-launch.test.ts
  - lib/level-copy.ts
  - lib/level-editor.test.ts
  - lib/portia-desktop.test.ts
  - lib/search-index.test.ts
  - lib/search-index.ts
  - lib/start-menu.test.ts
  - lib/start-menu.ts
  - lib/ui-unify.test.ts
  - tests/e2e/specs/access-levels.spec.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
  necessity: 1
status: issues_found
---

# Phase 26: Code Review Report (incremental, plans 26-15..26-20)

**Reviewed:** 2026-11-17
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Это инкрементальное ревью gap-closure планов 26-15..26-20 (коммиты 28fdbce..HEAD, hunks из `git diff 28fdbce HEAD`). Оно заменяет прежний 26-REVIEW.md (ревью 26-01..26-14, исправлено в 26-REVIEW-FIX.md).

Проверено: меню PORTIA (lib/start-menu.ts + эффект в portia-desktop.tsx), «Доступные записи» (search-index.ts), LevelPicker-кнопка (portia-level-picker.tsx, level-copy.ts), вкладки разделов с ручкой и обёртка `editor-section-single` (portia-editor.tsx), кнопка корзины в `virus-editor-head`, CSS-блоки gap 2/3/4/5/6/7/8/9/10/11, новые и изменённые тесты.

Прогон: `node --experimental-strip-types --test` по 8 затронутым test-файлам — 242/242 pass; `tsc --noEmit` (через node_modules/typescript, Node 22.13.1) — без ошибок. BLOCKER-уровня дефектов (потеря данных, безопасность, краш) не найдено: новый код не трогает сеть, данные и RLS, а пользовательский ввод в нём не интерпретируется. Остались три дефекта поведения в UX-путях, которые тесты исходного кода (в основном grep по исходникам и CSS) не ловят.

Structural findings (fallow) не передавались.

## Warnings

### WR-01: ручка перетаскивания в карточке активного раздела («Информация», «Справочник») больше не перетаскивает

**File:** `components/portia-editor.tsx:1390` и `components/portia-editor.tsx:1448` (обёртки — строки 1387 и 1445)
**Issue:** План 26-18 заменил `SectionColumns` на `<div className="editor-section-single">`, где отрисована ровно одна карточка (остальные `false`). В `OrderDragHandle.moveTo` (components/portia-editor-dossier.tsx:104-123) целью свопа считается только строка с `data-sort-index`, у которой `parentElement === parent` (родитель — `.editor-section-single`). Единственный кандидат — сама карточка, поэтому `target === indexRef.current` и функция выходит. `moveAcross` тоже выходит: у обёртки нет `data-sort-group`. Итог: в шапке карточки по-прежнему стоит заметная ручка `≡` с `aria-label="Изменить порядок: …"`, но перетаскивание мышью/пальцем у неё не работает (работают только ArrowUp/ArrowDown). Владелец жаловался именно на «перетаскивание пропало» (gap 5); ручка, которая выглядит рабочей и молчит, повторяет ту же жалобу. Тест `editor-tab-layout.test.ts` проверяет только строку разметки, а не поведение.
**Fix:** убрать `handle={...}` из `CollapsibleCard` обоих разделов (порядок разделов теперь меняется только ручками вкладок), либо оставить её, но явно прокинуть то же `onMove` и не выдавать за drag. Если handle удаляется, удалить и неиспользуемый `keepSectionHandleFocus` из этих двух мест:
```tsx
<CollapsibleCard key={section.id} id={section.id} sortIndex={index} label={...} title={section.title} open={isOpen(section.id)} onToggle={() => toggleCard(section.id)}
  actions={...}>
```

### WR-02: ручка вкладки раздела — клавиатурный порядок и перетаскивание неудобно/некорректно ложатся на горизонтальную полосу

**File:** `components/portia-editor.tsx:288-291` (использует `OrderDragHandle` из `components/portia-editor-dossier.tsx:187-212`)
**Issue:** Три связанных проблемы после удаления кнопок `←/→` (gap 5):
1. Клавиатура: ручка слушает только `ArrowUp`/`ArrowDown` (`aria-keyshortcuts="ArrowUp ArrowDown"`), а полоса вкладок горизонтальная. Прежние кнопки «Переместить раздел левее/правее» были единственным ожидаемым способом (←/→); теперь пользователь с клавиатурой или скринридером должен знать, что на горизонтальной ленте порядок меняют вертикальными стрелками. Тест это закрепляет (`assert.ok(!tabs.includes("Переместить раздел"))`).
2. Автоскролл: `autoscroll` прокручивает только `.content-editor`/window по вертикали (`scroller.scrollBy(0, …)`). `nav` — `overflow-x: auto` (portia.css `.editor-section-tabs nav`, `.etab-nav .editor-section-tabs nav`); при перетаскивании вкладки к краю полосы лента не едет, поэтому при числе разделов, не помещающихся в полосу, вкладку нельзя перетащить на позицию за видимой частью.
3. Два tab-стопа на раздел (ручка + кнопка вкладки) удваивают проход Tab по полосе.
**Fix:** добавить в `OrderDragHandle` необязательный `orientation` (или определять по `getComputedStyle(row.parentElement).flexDirection`), чтобы для горизонтального родителя слушать `ArrowLeft/ArrowRight` и автоскроллить `scrollLeft` у `nav`; обновить `aria-keyshortcuts`. Минимально — слушать оба набора стрелок и поставить `tabIndex={-1}` на ручку вкладки, оставив порядок через стрелки с фокуса вкладки.

### WR-03: LevelPicker закрывается/не закрывается по blur, который не приходит от мыши в Safari и Firefox на macOS

**File:** `components/portia-level-picker.tsx:25-28`, `:35-37`, `:46-48`
**Issue:** `closeOnLeave` решает «ушёл ли пользователь» по `relatedTarget` события blur. В Chrome (Windows) это работает, потому что невидимый `<input>` занимает всю пластину (`.access-level-option input { position:absolute; inset:0 }`), mousedown приходит на input, и `relatedTarget` внутри fieldset. В Safari (macOS) и Firefox (macOS) мышь не ставит фокус на radio и button:
- пользователь открыл список мышью, кликнул в любое другое место страницы — blur не приходит, список остаётся раскрытым (в отличие от меню PORTIA, где добавлен pointerdown вне);
- если фокус уже внутри fieldset (открыли с клавиатуры, потом кликнули по пластине мышью), mousedown по пластине порождает blur с `relatedTarget === null`, `setOpen(false)` срабатывает на mousedown, блок получает `hidden`, и клик по пластине теряется: уровень не меняется.
Тесты проверяют только наличие строк `onBlur=`/`relatedTarget`, не поведение.
**Fix:** закрывать по pointerdown вне fieldset (как в `lib/start-menu.ts`) и не опираться на blur для мышиных нажатий. Например, эффект при `open`: `document.addEventListener("pointerdown", e => { if (!fieldsetRef.current?.contains(e.target as Node)) setOpen(false); }, true)`; blur оставить только для клавиатурного ухода (`event.relatedTarget` не null или нет недавнего pointerdown).

## Info

### IN-01: `100cqw` уже считается от content-box, а формула вычитает padding ещё раз — названия классов мельчают без причины

**File:** `app/portia.css:1169`, `:1367` (и прежние `:2449`, `:2451`); модель повторена в `lib/classification-fit.test.ts:114-120`
**Issue:** `.class-cell` — контейнер (`container-type: inline-size`), а `100cqw` — ширина content-box контейнера, то есть padding (24px / 20px) и рамка уже вычтены. Формула `clamp(12px, calc((100cqw - 24px) / 8.6), 15px)` вычитает padding второй раз. Следствие: слово 14 глифов не переполняет ячейку (поэтому тест зелёный и безопасность «не рвать слово» соблюдена), но 15px достигается только при ячейке ≈178px вместо ≈151px, и в средних ячейках (например, 3 колонки в панели ~500px) имя рисуется ≈13.6px там, где вошло бы 15px. Тест моделирует то же двойное вычитание, поэтому расхождение не обнаруживает. Это то же правило, что уже стоит в карточке шаблона (D-65), поэтому исправление затрагивает оба места и тест.
**Fix:** `font-size: clamp(12px, calc(100cqw / 8.6), 15px)` (и `13px` на телефоне), в тесте `content` подставлять без `Number(pc[1])`; либо оставить как сознательный запас и поправить комментарий, чтобы он не утверждал «размер следует за ячейкой» без оговорки.

### IN-02: мёртвые и дублирующие объявления в CSS

**File:** `app/portia.css:1169`, `:251`, `:2448-2451`
**Issue:**
- `:1169` — в одном правиле `.class-cell strong` подряд `gap: 6px` и `gap: 2px 6px`; первое мёртвое.
- `:251` — `.app-window.is-active { border-color: … }` после gap 2 не действует (`.app-window { border: 0 }`); тест `ui-unify.test.ts` намеренно держит его «как историю».
- `:2448-2451` — **Category:** necessity (already-defended-elsewhere). Правила `.template-card-preview .class-cell { container-type }` и `.template-card-preview .class-cell strong {...}` теперь полностью дублируют базовые `.class-cell` / `.class-cell strong` (те же `flex-wrap`, `overflow-wrap`, `word-break`, `hyphens`, `font-size`, `container-type`), так как 26-20 сделал их общими для архива и шаблона. Доказательство: сравнение объявлений на `:1169`, `:1181` и `:2448-2451`; тест `classification-fit.test.ts:176-188` их фиксирует, но поведение страницы они не меняют. Единственный возможный довод оставить — экспортёр шаблона (`lib/portia-template-export.ts`, `cardClasses`) копирует правила по списку классов, и оба набора попадут в файл, так что дубль только раздувает вывод. Решение остаётся за человеком, поэтому Info.
**Fix:** удалить первый `gap`, убрать мёртвое правило активной рамки (и его пин в тесте); дубли `.template-card-preview .class-cell*` удалить вместе с пинами в `classification-fit.test.ts`, проверив, что экспорт шаблона всё ещё содержит базовые правила.

### IN-03: абзац загрузки «Проверяем доступ к повышению…» уходит в колонку 2 в развёрнутом окне

**File:** `app/portia.css:2688-2689` (правило `.app-window.is-maximized .promotion-gate:not(:has(> form)) > p { grid-column: 2 / -1 }`)
**Issue:** `<div className="promotion-gate" role="status"><p>Проверяем доступ к повышению…</p></div>` не имеет знака (колонка 1) и шапки; в развёрнутом окне сетка `72px 1fr 1fr`, а абзац помещается в колонки 2..-1, оставляя пустую колонку 72px слева. Визуально текст загрузки сдвинут относительно рамки. Подтвердить скриншотом не удалось (не запускалось приложение), поэтому Info.
**Fix:** для абзаца без соседнего `.promotion-gate-mark` использовать `grid-column: 1 / -1`, например `.promotion-gate:not(:has(> header)) > p { grid-column: 1 / -1; }` в том же блоке.

---

_Reviewed: 2026-11-17T03:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
