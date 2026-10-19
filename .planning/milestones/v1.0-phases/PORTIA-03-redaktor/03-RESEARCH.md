# Phase 3: Редактор - Research

**Researched:** 2026-10-14
**Domain:** Client-side React 19 / Next 16 editor UX (mobile layout, unsaved-state bar, undo history, reorder, tabs). No server, schema or dependency change.
**Confidence:** MEDIUM (code analysis HIGH; on-screen-keyboard behaviour on real phones LOW, needs a device check)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Мобильный режим включается при ширине **до 900px** (телефоны, планшеты, узкое окно на ПК). Это та же граница, где редактор уже переходит в одну колонку (`@media (max-width: 900px)` в `app/portia.css`).
- **D-02:** Выбор записи по схеме **«список → запись»**. Сначала на всю ширину показывается список записей (вирусы, файлы Корзины и другие разделы, где сейчас список + форма). Нажатие открывает форму записи на всю ширину с кнопкой «← К списку». Горизонтальная лента карточек над формой (`.editor-record-list` на ≤900px) заменяется этим режимом.
- **D-03:** Вкладки разделов редактора («База вирусов», «Информация», «Сообщения», «Корзина» и т.д.) на телефоне остаются **одной лентой, листаемой вбок**. Активная вкладка автоматически прокручивается в видимую область.
- **D-04:** Шапка редактора на телефоне **сжимается до одной строки**: надзаголовок «УПРАВЛЕНИЕ СОДЕРЖИМЫМ», заголовок «Редактор PORTIA» и пояснение «Изменения сохраняются в общей базе!» скрываются (в заголовке окна и так написано «Редактор»). Ниже сразу идут вкладки. Состояние сохранения переезжает в полосу сохранения (D-07).
- **D-05:** Правка текста на телефоне: главная проблема в том, что **панель оформления вместе с экранной клавиатурой закрывает текст**.
- **D-06:** На телефоне панель оформления работает по принципу **«либо клавиатура, либо панель»**. При открытии панели экранная клавиатура прячется, а выделение в поле сохраняется. Панель занимает место клавиатуры внизу экрана, а выделенный текст автоматически прокручивается так, чтобы оставаться видимым над панелью. Закрыли панель — можно снова печатать. Сам набор стилей и кнопок панели здесь не меняется (это фаза 5).
- **D-07:** Полоса несохранённых изменений **прилипает к нижнему краю окна редактора** и видна при любой прокрутке, но **только когда есть несохранённые правки**. Без правок полосы нет. На телефоне кнопка сохранения находится внизу, под пальцем. Пока идёт сохранение, после успешного сохранения и при ошибке или конфликте полоса показывает это состояние, а не исчезает молча. Как долго показывать «Сохранено» — на усмотрение Claude.
- **D-08:** Полоса показывает, **в каких разделах есть правки**, например «Не сохранено: База вирусов, Корзина». На самих вкладках разделов с несохранёнными правками стоит **маленькая точка**. Это сознательное исключение из правила «без видимых подсказок»: пользователь выбрал его сам.
- **D-09:** В полосе есть кнопки **«Отменить»** и **«Сохранить»**. «Отменить» возвращает весь черновик к последнему сохранённому состоянию, но только **после подтверждения**, чтобы не нажать случайно.
- **D-10:** **Ctrl+S** при открытом редакторе сохраняет черновик (как «Сохранить») и блокирует стандартное «Сохранить страницу» браузера. На macOS то же самое делает Cmd+S.
- **D-11:** **Ctrl+Z** отменяет **любое действие редактора** по одному шагу: правку поля, добавление и удаление записи, перетаскивание и оформление текста. История общая на весь редактор. **Ctrl+Shift+Z / Ctrl+Y** возвращают отменённое. Ввод текста склеивается в шаги примерно по словам или паузам, чтобы один шаг не был одной буквой. История работает в пределах несохранённого черновика; что делать с ней после сохранения — на усмотрение Claude. Разделы «Сотрудники» и «Доступ» сохраняются отдельно, в эту историю не входят. — **Reversibility:** costly — история затрагивает все места, которые сейчас меняют черновик через `changeDraft`/`setDraft`; убрать её потом значит снова пройтись по всем этим местам.
- **D-12:** Если редактор закрывают (крестик окна) при несохранённых правках, появляется **свой диалог в стиле PORTIA OS**: «Сохранить / Не сохранять / Отмена». При уходе со страницы или её обновлении показывается **стандартное предупреждение браузера** (`beforeunload`; его текст поменять нельзя).

### Claude's Discretion
- **EDIT-03, перетаскивание «по дорожкам»** (пользователь не стал обсуждать). Сохранить существующую механику `OrderDragHandle` (ручка ≡ в начале строки, удержание примерно 170 мс, без видимых подсказок, `aria-label` — решение D-01 фазы 1). Как именно оформить «дорожки» и место вставки — на усмотрение Claude, в духе направления «Электрофорез» (`.impeccable/surfaces/components-portia-desktop-tsx.md`). Перетаскивание должно работать и в мобильном режиме D-02 (в списке «список → запись»). Запасной способ без перетаскивания (кнопки ↑↓ и т.п.) — только если без него не обойтись для доступности, и без видимых подсказок.
- **EDIT-04, вкладки досье** (пользователь не стал обсуждать). Досье вируса сейчас состоит из шести блоков `EditorGroup`: «Основные данные», «Описание», «Характеристики PPU», «Классификация», «Мутации», «Записи учёных». Разбивка на вкладки и группировка блоков — на усмотрение Claude. То же самое применить к вирусу в Корзине (`ArchivedVirusEditor` с теми же блоками). Вкладку досье с несохранёнными правками логично отметить так же, как в D-08.
- Как полоса сохранения, панель оформления (D-06) и кнопка ✎ уживаются внизу экрана.
- Как сообщать о конфликте «КТО-ТО СОХРАНИЛ РАНЬШЕ…» внутри новой полосы. Существующий текст и поведение защиты от перезаписи сохраняются.
- Отмена шага на телефоне без клавиатуры: не обсуждалась. Если в полосе нужна кнопка «шаг назад», сделать её без лишних подсказок.
- Also discretion (from D-07 / D-11): how long «Сохранено» is shown; what happens to the undo history after a save.

### Deferred Ideas (OUT OF SCOPE)
- Внешний вид сайта, новые SVG и SVG-анимации — пользователь поднял в конце обсуждения. Это фаза 2 «Внешний вид» (LOOK-01..03), обсуждать через `/gsd-discuss-phase 2`.
- Упрощение набора стилей в панели оформления — фаза 5 (TEXT-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDIT-01 | Редактор текста удобен на телефоне | List-to-record CSS/state pattern (Pattern 1); header hide + tab auto-scroll (Pattern 2); format panel instead of keyboard (Pattern 6); 375px overflow audit (Pitfalls 3, 11, 12) |
| EDIT-02 | Понятное состояние сохранения: полоса несохранённых изменений | Reducer-held draft + baseline gives derived dirty and per-section dots (Pattern 3, 4); sticky/fixed bar placement (Pattern 5); dialog + beforeunload + Ctrl+S/Z (Patterns 7, 8, 9) |
| EDIT-03 | Порядок записей меняется перетаскиванием по «дорожкам» | Keep `OrderDragHandle`; CSS-only lane look via `:has()`; midpoint hysteresis; edge autoscroll; keyboard arrows (Pattern 10) |
| EDIT-04 | Длинные досье разбиты на вкладки | 4-tab grouping of the 6 `EditorGroup` blocks, shared by `ArchivedVirusEditor` (Pattern 11) |
</phase_requirements>

## Summary

All of this phase is client-side work in two files that already hold the whole editor: `components/portia-editor.tsx` (1372 lines) and `app/portia.css`, plus a small close-guard hook in `components/portia-desktop.tsx`. No new dependency is needed or recommended: the codebase already has pointer-event drag (`OrderDragHandle`), a draft/`dirty`/`saveState` model, a `FloatingTextFormatPanel`, and a CSS `:has()` precedent. The one structural change that unlocks D-08, D-09, D-11 and D-12 together is to replace the `useState` draft plus boolean `dirty` with a single pure reducer that holds `{present, baseline, past, future}`. `dirty` and "which sections changed" then become derived values, undo-to-clean correctly hides the bar, and every mutation still funnels through the existing `changeDraft`. This reducer and two other small pure modules (changed-sections, shortcut mapping) live in `lib/` so the existing `node --test lib/*.test.ts` runner covers them.

Three facts from the code shape the UI work. First, on `max-width: 900px` the app window is `position: relative; height: auto` inside `.app-window { overflow: hidden }`, and the fixed taskbar is 44px, so the page (document) scrolls, not `.content-editor`. A `position: sticky; bottom: 0` bar works on desktop (where `.content-editor` is the scroller) but will never stick on mobile; on mobile the bar must be `position: fixed` above the 44px taskbar. Second, `window.confirm()` is silently answered "no" in embedded browsers (project decision from Phase 2), so D-09 and D-12 both need the same in-OS dialog, not `confirm()`. Third, the project UI is Russian: with a Russian keyboard layout `event.key` for the S key is "ы", so Ctrl+S/Z/Y must be matched on `event.code`.

The riskiest item is D-06 ("keyboard or panel"): hiding the on-screen keyboard while keeping focus and selection has no verified cross-browser recipe. The recommended approach (`inputMode="none"` toggle plus re-focus) is `[ASSUMED]` and the plan must include a real-phone human-verify checkpoint, with a documented fallback (blur and paint the stored range).

**Primary recommendation:** Build in three sequential waves: (A) pure `lib/` modules with `node:test` tests, (B) editor core wiring (reducer, save bar, dialog, shortcuts, close guard), (C) mobile layout, dossier tabs, lane styling and format-panel behaviour. Do not add any package.

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists in `site/`; no `.claude/skills/`. Constraints come from `.planning/PROJECT.md` (read) and CONTEXT.md:
- Only Russian interface text; fonts must support Cyrillic. [VERIFIED: .planning/PROJECT.md "Constraints"]
- Must work on phone (narrow screens, touch). [VERIFIED: .planning/PROJECT.md]
- Deploy only locally (localhost:3123); do not create PRs unless explicitly asked. [VERIFIED: .planning/PROJECT.md]
- "Ponytail: минимальный полный дифф." (minimal complete diff) [VERIFIED: .planning/PROJECT.md]
- Phase 1 D-01: drag handle ≡ at row start, no visible hints; user dislikes extra hints. Only exception: the tab dot (D-08).
- Embedded browsers answer `confirm()` "no" without showing it (Phase 2 decision, `.planning/STATE.md`; comment at `components/portia-editor.tsx:755-756`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Draft, undo history, dirty/section diff | Browser / Client | — | Pure state in `PortiaEditor`; nothing persisted until save |
| Save bar, dialog, Ctrl+S/Z, `beforeunload` | Browser / Client | — | DOM events and UI only |
| Close-window guard | Browser / Client (`portia-desktop.tsx`) | — | Window manager owns close; editor reports dirty |
| Mobile list/record, tabs, header collapse | Browser / Client (CSS + one boolean) | — | Pure presentation at `max-width: 900px` |
| Persist content / conflict detection | API / Backend (`app/api/content/route.ts`, unchanged) | Database / Storage | 409 on revision mismatch already exists; do not touch |
| Content validation on save | API / Backend (`lib/portia-content-normalize.ts`, unchanged) | — | Server re-normalizes, so client-side changes need no new trust boundary |

## Standard Stack

### Core (all already installed; nothing to add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.2.6 | `useReducer`, `createPortal` for dialog | [VERIFIED: package.json] |
| next | 16.3.4 | App Router host; `Viewport.interactiveWidget` type exists if ever needed | [VERIFIED: package.json; node_modules/next/dist/lib/metadata/types/extra-types.d.ts:53 `interactiveWidget?: 'resizes-visual' \| 'resizes-content' \| 'overlays-content' \| undefined;`] |
| typescript | 5.9.3 | Typecheck gate | [VERIFIED: package.json] |
| eslint + eslint-plugin-react-hooks | 9.39.4 / 7.1.1 | Lint gate; v7 enforces `set-state-in-effect` and ref-in-render rules | [VERIFIED: package.json; node_modules/eslint-plugin-react-hooks/package.json] |
| node:test (Node built-in) | Node 24.21.0 local; `engines` `>=22.13.0 <23` | Unit tests via `node --experimental-strip-types --test lib/*.test.ts` | [VERIFIED: package.json scripts.test, `node --version`] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-house pointer drag (`OrderDragHandle`) | dnd-kit / SortableJS | Adds a dependency and rewrites 4 call sites; existing mechanic works on touch (`touch-action: none` on handle). Not needed. |
| In-house snapshot history reducer | `use-undo`, immer patches | Dependency for ~60 lines; snapshots of a ~10 KB document are cheap. Not needed. |
| In-house dialog | Radix Dialog / `<dialog>` element | `<dialog>` is viable but needs styling and focus handling anyway; a 30-line portal dialog matches PORTIA OS look. No dependency. |

**Installation:** none. `npm install` is not part of this phase.

**Version verification:** no package is introduced, so no registry check applies. Baseline measured this session: `npm test` 25 pass / 0 fail; `npx tsc --noEmit` clean; `npm run lint` 0 errors, 13 warnings (all `@next/next/no-img-element`, pre-existing). [VERIFIED: ran commands]

## Package Legitimacy Audit

No external packages are installed in this phase. Audit table not applicable.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 user input (keys / touch / pointer)
        |
        v
 +-----------------------------------------------------------+
 | PortiaEditor (components/portia-editor.tsx)               |
 |                                                           |
 |  window keydown (only when editor window active)          |
 |     shortcutOf(event) --> save | undo | redo               |
 |  beforeinput historyUndo/historyRedo --> undo/redo        |
 |                                                           |
 |  field onChange / buttons / OrderDragHandle / format panel|
 |        |  changeDraft(updater)                            |
 |        v                                                  |
 |  dispatch({type:"change", updater, key, now})             |
 |        v                                                  |
 |  historyReducer  { present, baseline, past, future }      |
 |        |                                                  |
 |        +--> draft = present                               |
 |        +--> changedSections(baseline, present) --> dirty, |
 |        |        tab dots, bar text "Не сохранено: ..."    |
 |        +--> canUndo / canRedo                             |
 |                                                           |
 |  SaveBar (dirty || saveState != idle)                     |
 |     Сохранить --> save() --> onSave (PUT /api/content)    |
 |     Отменить --> ConfirmDialog --> dispatch discard       |
 |                                                           |
 |  closeRequest prop --> ConfirmDialog (Сохранить /         |
 |      Не сохранять / Отмена) --> onCloseApproved           |
 +-----------------------------------------------------------+
        ^  onDirtyChange(dirty)            | onCloseApproved()
        |                                  v
 +-----------------------------------------------------------+
 | PortiaDesktop.requestExit(appId, "close")                 |
 |   editor && dirty && !approved --> bump closeRequest      |
 |   else --> existing exit animation, window unmounts       |
 +-----------------------------------------------------------+
```

### Recommended Project Structure
```
lib/
├── editor-history.ts        # NEW pure reducer: change/undo/redo/discard/saved/sync/reset
├── editor-history.test.ts   # NEW
├── editor-changes.ts        # NEW pure: changedSections(), changedDossierTabs()
├── editor-changes.test.ts   # NEW
├── editor-shortcuts.ts      # NEW pure: shortcutOf(event)
└── editor-shortcuts.test.ts # NEW
components/
├── portia-editor.tsx        # reducer wiring, SaveBar, ConfirmDialog, DossierTabs, mobile state
└── portia-desktop.tsx       # close guard (requestExit) + props to PortiaEditor
app/portia.css               # save bar, dialog, dossier tabs, mobile list/record, lanes, dots
```

### Pattern 1: List to record on mobile (D-02), CSS-driven
**What:** One boolean `recordOpen` per list+form layout; render it as `data-mobile-view="list|record"` on `.virus-editor-layout`. Desktop CSS ignores the attribute (no behaviour change above 900px); the `max-width: 900px` block shows only the list or only the form. A "← К списку" button is always rendered but `display: none` above 900px.
**When to use:** the three list+form layouts: viruses, recycle, employees (`EmployeeProfilesEditor` has its own copy of the layout at `portia-editor.tsx:942-945`, so it needs its own `recordOpen` state).
**Rules:**
- `data-mobile-view` = `"record"` only when `recordOpen` **and** a record is actually selected (otherwise a deleted/undone selection leaves an empty page); else `"list"`.
- Set `recordOpen=true` on row click, "+ ДОБАВИТЬ ВИРУС / ФАЙЛ / НАПИСАТЬ ВИРУС", and after "ВОССТАНОВИТЬ В БАЗУ"; set `false` on "← К списку", on `switchTab`, after "ПЕРЕМЕСТИТЬ В КОРЗИНУ", "УДАЛИТЬ НАВСЕГДА" and "УДАЛИТЬ ЭТОТ ФАЙЛ".
- On open/back, scroll the tab strip into view (`scrollIntoView({ block: "start" })`); the sticky system bar is 48px on mobile, so give the target `scroll-margin-top: 56px`.
- Replace the horizontal-strip rules the current mobile block uses. Existing text to be removed/overridden (verbatim, `app/portia.css:984-987`):
```css
  .editor-record-list { position: static; display: flex; overflow-x: auto; }
  .editor-record-list button { flex: 0 0 170px; }
  .editor-record-row { flex: 0 0 214px; }
  .editor-record-row > button:last-child { flex: 1 1 auto; }
```
New mobile rules: `.editor-record-list { display: grid; }` full width; `[data-mobile-view="list"] > .editor-form, [data-mobile-view="record"] > .editor-record-list { display: none; }`.

### Pattern 2: Header collapse and tab auto-scroll (D-03, D-04)
- D-04 is CSS only: inside the existing `@media (max-width: 900px)` hide `.editor-header` entirely. Its two children are the title block and `.editor-save-zone`; both go (status moves to the bar). On desktop keep the title block but **delete** `.editor-save-zone` from the header (the bar replaces it; the "СОХРАНИТЬ ВСЁ"/"БЕЗ ИЗМЕНЕНИЙ" always-on UI contradicts D-07 "без правок полосы нет").
- D-03: `.editor-tabs` is already `display: flex; overflow-x: auto` [VERIFIED: app/portia.css:402]. Add a ref on the `nav` and an effect keyed on `tab` that calls `querySelector(".active")?.scrollIntoView({ inline: "center", block: "nearest" })`. No `setState` inside the effect (see Pitfall 9).

### Pattern 3: Reducer-held draft with baseline and history (D-08, D-09, D-11)
**What:** `useReducer(historyReducer, content, init)` replaces `useState(draft)` + `useState(dirty)` (currently `portiaEditor.tsx:410` and `:416`). Everything else keeps calling `changeDraft`; only its body changes.
**State:** `{ present, baseline, past, future, source, key, at }`; `present` and the entries of `past`/`future` are never mutated after storage (each change does `clone(current)` then mutates the clone), so history stores references, no extra cloning.
**Actions (all pure; `now` and the coalesce `key` are computed outside the reducer so React StrictMode double-invocation is harmless):**
| Action | Effect |
|--------|--------|
| `change {updater, key, now, maxGap}` | `next = clone(present); updater(next)`. If `key !== null && key === state.key && now - state.at <= maxGap` replace `present` only; else push old `present` to `past` (cap 50), clear `future`. |
| `undo` / `redo` | Move one entry between `past`, `present`, `future`; reset `key` to null. |
| `discard` (D-09) | Treat as one normal step: push `present` to `past`, `present = clone(baseline)`. Ctrl+Z can bring the work back. |
| `saved {normalized, savedFrom}` | `baseline = normalized`; if `present === savedFrom` (no edits during the request) then `present = normalized` and history cleared; else keep `present`/history (see Pitfall 6). |
| `sync {content}` | Adopt prop `content` only if the draft is clean **and** `content !== state.source`; then `present = baseline = clone(content)`, history cleared, `source = content`. Idempotent (see Pitfall 5). |
**Coalescing key (computed in `changeDraft`, no call-site edits):** `document.activeElement` is a text-entry control (`textarea`, `input` of type text/url/number/range/etc., or `isContentEditable`) -> key = a per-element id (e.g. `WeakMap<Element, number>`), `maxGap` ~700 ms (pause rule; this satisfies D-11 "по словам или паузам"; word-boundary splitting is optional). During a drag (Pattern 10) key = `drag:N`, `maxGap = Infinity`. Everything else (buttons, checkboxes, selects) -> key null -> one step each.
**Derived values:** `draft = state.present`; `changed = useMemo(() => changedSections(state.baseline, state.present), [...])`; `dirty = changed.length > 0`; `canUndo = past.length > 0`. Dirty is structural, not semantic: typing then deleting back to the original can leave `dirty` true (a new `formattedText` entry exists); saving then is harmless.
**Sketch (naming only; shape is the recommendation, not a library API):**
```ts
// lib/editor-history.ts  (import type only; Node strip-types cannot handle value imports of @/ aliases)
export type EditorHistory<T> = { present: T; baseline: T; past: T[]; future: T[]; source: T; key: string | null; at: number };
export const HISTORY_LIMIT = 50;
export function historyReducer<T>(state: EditorHistory<T>, action: Action<T>, clone: (value: T) => T): EditorHistory<T>;
```
Make `clone` a parameter (or a `structuredClone` default) so the module has no dependency on React or `@/` aliases and runs under `node --test`.

### Pattern 4: Changed sections and dossier tabs (D-08, EDIT-04)
`changedSections(baseline, draft): EditorTab-like ids` in `lib/editor-changes.ts`. Compare by `JSON.stringify` per top-level key (the content type, verbatim, `lib/portia-content.ts:125-147`: `viruses`, `recycledViruses`, `infoSections`, `broadcasts`, `recycleFiles`, `recycleOrder`, `searchRecommendations`, `assistantAdvice`, `assistantOffendedPhrase`, `assistantOffendedPhrases`, `assistantPatienceSeconds`, `assistantPatienceVariants`, `assistantIdlePhrases`, `assistantActivityPhrases`, `assistantIdleEnabled`, `assistantActivityEnabled`, `assistantAutoTimingMode`, `assistantAutoIntervalSeconds`, `assistantAutoMinSeconds`, `assistantAutoMaxSeconds`, `formattedText`).
Mapping (iterate `Object.keys` of both sides so a future field is not silently ignored):
| Content key | Section id | Tab label (verbatim `portia-editor.tsx:562-569`) |
|-------------|-----------|-----------|
| `viruses` | `viruses` | База вирусов |
| `infoSections` | `info` | Информация |
| `broadcasts` | `broadcasts` | Сообщения |
| `recycledViruses`, `recycleFiles`, `recycleOrder` | `recycle` | Корзина |
| `searchRecommendations` | `search` | Рекомендации |
| any key starting `assistant` | `assistant` | Помощник |
| `formattedText` entry | by key prefix, verbatim from `portiaTextKey` (`lib/portia-content.ts:149-160`): `virus:` -> `viruses` if that id is in `viruses` (either side) else `recycle`; `info:` -> `info`; `broadcast:` -> `broadcasts`; `recycle:` -> `recycle`; `search:` -> `search`; `assistant:` -> `assistant` | |
`employees` and `access` are never in this list (saved separately, outside the draft).
Moving a virus to the Корзина changes `viruses`, `recycledViruses` and `recycleOrder`, so the bar correctly reads "Не сохранено: База вирусов, Корзина" (the example in D-08).
`changedDossierTabs(baseline, draft, virusId, list)` returns the dossier tab ids (Pattern 11) whose slice differs; a virus absent from the baseline (newly added) marks all tabs.

### Pattern 5: Save bar placement (D-07)
**Visibility:** render when `dirty || saveState !== "idle"`. Status priority: `saving` > `conflict` > `error` > dirty > `saved`. This reuses the desktop's existing state machine: `saveContent` sets `"saved"` then back to `"idle"` after 1800 ms (`portia-desktop.tsx:822-823`), so "Сохранено" shows ~1.8 s with zero new timers (recommended: keep 1800 ms). `conflict` is never auto-reset (only a new save sets `"saving"`), so the bar stays until the user acts.
**Copy (verbatim existing strings to keep):** `СОХРАНЕНИЕ…`, `СОХРАНЕНО`, `ОШИБКА`, `КТО-ТО СОХРАНИЛ РАНЬШЕ — СКОПИРУЙТЕ ПРАВКИ И ОБНОВИТЕ СТРАНИЦУ` (from `portia-editor.tsx:555`). Dirty text: `Не сохранено: <labels joined by ", ">` (D-08 example). Wrap with `role="status" aria-live="polite"` so the confirmation is announced.
**Desktop (>900px):** `.content-editor` is the scroller (`height: calc(100% - 46px); overflow-y: auto`, `app/portia.css:390`). Make it `display: flex; flex-direction: column` with `.content-editor > * { flex-shrink: 0 }` and give the bar `position: sticky; bottom: 0; margin-top: auto` so it pins to the window bottom even when the tab content is short. Use negative inline/bottom margin equal to the 28px padding so it spans the window.
**Mobile (<=900px):** sticky will not work: `.app-window` has `overflow: hidden` (`app/portia.css:192`) and is `height: auto` there (`app/portia.css:903`), so the nearest scroll container never scrolls. Use `position: fixed; left: 0; right: 0; bottom: 44px` (taskbar height `app/portia.css:95` is 44px and `.taskbar` is `position: fixed` at `:1014`). Add bottom padding to `.content-editor` while the bar exists. `.app-window` gets `transform: none !important` on mobile (`:903`), so fixed children are not trapped by a transform.
**Do not use `position: fixed` on desktop:** `.editor-window` is `transform: translate(-50%, -50%)` until the user drags/resizes it (then `transform: none`), so a fixed bar would change containing block depending on window history.
**Coexistence (Claude's discretion):** `.global-format-launch` (✎, fixed, bottom 54px at <=520px, `:1031`) sits in the same corner: lift it by the bar height (`.content-editor[data-savebar] .global-format-launch { bottom: calc(54px + var(--savebar-h)) }`). Vivian (`.desktop-assistant`) is `z-index: 4` (`:639`) and windows are above that, so the bar simply covers her; no change needed. While the format panel is open on mobile, hide the bar (`.content-editor:has(.floating-text-format) .editor-savebar { display: none }`): the panel occupies the same bottom area and has its own "ГОТОВО".

### Pattern 6: Format panel instead of keyboard (D-05, D-06) - needs device verification
Today: panel is `position: fixed; bottom: 42px` with `max-height: min(44svh, 340px)` at <=900px (`app/portia.css:990`), and the page only reserves 170px/155px of bottom padding (`:491`, `:1069`), which is less than the panel and ignores the keyboard. That is the D-05 problem.
Recommended mechanics, only when `matchMedia("(max-width: 900px)").matches` and the panel opens:
1. **Hide keyboard, keep focus/selection `[ASSUMED]`:** set `inputMode="none"` on the active `FormattedTextarea` contenteditable (new boolean prop or context flag), then `blur()` and `focus({ preventScroll: true })` and `restoreSelection(editor, formatTarget.selection)` (existing helper, `portia-editor.tsx:302`). On panel close restore `inputMode`, then `blur(); focus()` inside the click handler so the OS shows the keyboard again.
2. **Fallback if device test fails `[ASSUMED]`:** `editor.blur()` only (keyboard certainly hides). `FormatTarget.selection` already stores the offsets and `applyStyle` uses those offsets, not the DOM selection, so styling still works. Paint the stored range with the CSS Custom Highlight API (`CSS.highlights` + `::highlight()`), or accept no highlight (the style change is visible as WYSIWYG).
3. **Keep the selection above the panel:** after open and on selection change, measure `range.getBoundingClientRect()` against the panel's top (`panel.getBoundingClientRect().top`) and `window.scrollBy` by the overlap + ~16px. Raise `.content-editor:has(.floating-text-format)` bottom padding to `calc(min(44svh, 340px) + 90px)` so the last fields can scroll above the panel.
4. Reset `formatTarget`/`formatterOpen` on any dossier-tab switch (Pitfall 7).
**Not changed:** the set of styles and panel buttons (phase 5, TEXT-01).
**Android caveat:** with default `resizes-visual`, a fixed bottom bar sits under the on-screen keyboard while typing. Acceptable under D-06's spirit ("keyboard or bar/panel"); if UAT objects, `export const viewport = { interactiveWidget: "resizes-content" }` in `app/layout.tsx` is available (Chrome/Firefox Android only; iOS Safari does not support it) but it changes every window, so treat it as an Open Question, not a default.

### Pattern 7: In-OS confirm dialog (D-09, D-12)
One `ConfirmDialog({ title, text, actions })` component, rendered with `createPortal(..., document.body)` (a dialog inside the window is clipped by `.app-window { overflow: hidden }` and sits under the taskbar `z-index: 960`; `.start-panel` is 970, `.boot-screen` 999, so use ~980-990). `role="alertdialog" aria-modal="true"`, focus the safest button on open, Escape = cancel, backdrop click = cancel. Use it for: D-09 "Отменить" (labels that do not collide with the bar's own "Отменить", e.g. «Вернуть сохранённое» / «Не отменять»), D-12 close (`Сохранить` / `Не сохранять` / `Отмена`). Recommended follow-up (optional, out of required scope but nearly free): reuse it for the two existing `window.confirm` calls (`portia-editor.tsx:667` "ПЕРЕМЕСТИТЬ В КОРЗИНУ" and `:768` "УДАЛИТЬ НАВСЕГДА"), which `STATE.md` lists as a known blocker.

### Pattern 8: Close guard across editor and desktop (D-12)
Facts: `AppWindow` returns `null` when `!state.open` (`portia-desktop.tsx:1477`), so closing **unmounts the editor and discards the draft**; minimizing only sets `display: none` (inline style at `:1488`) and keeps it mounted. So guard `close`, not `minimize`. The desktop already left the hook: the comment at `portia-desktop.tsx:748` reads "Phase 3: the editor's unsaved-changes guard must run before an exit starts."
Recommended wiring (smallest that keeps save logic where the draft lives):
- `PortiaEditor` new props: `active: boolean` (editor window is the active, non-minimized window), `onDirtyChange(dirty: boolean)`, `closeRequest: number`, `onCloseApproved(): void`.
- `PortiaDesktop`: `editorDirtyRef` (written from `onDirtyChange`), `[closeRequest, setCloseRequest]`. In `requestExit`: `if (appId === "editor" && kind === "close" && editorDirtyRef.current && !force) { setCloseRequest(n => n + 1); return; }`. `onCloseApproved` calls `requestExit("editor", "close", true)`.
- `PortiaEditor`: when `closeRequest` changes (> 0) open the dialog. Сохранить -> `const ok = await save(); if (ok) onCloseApproved();` (on failure keep the window open; the bar shows the error/conflict). Не сохранять -> `onCloseApproved()`. Отмена -> close dialog.
- `save()` currently swallows errors and returns `void` (`portia-editor.tsx:502-543`); change it to return `Promise<boolean>`.
- `beforeunload`: `useEffect` keyed on `dirty`, `addEventListener("beforeunload", h)` with `event.preventDefault(); event.returnValue = ""`, removed in cleanup (the editor unmounts on close, so cleanup also runs then).

### Pattern 9: Keyboard shortcuts and native undo (D-10, D-11)
- `lib/editor-shortcuts.ts`: `shortcutOf({ code, ctrlKey, metaKey, shiftKey, altKey })` returns `"save"` for (Ctrl or Cmd)+`KeyS`, `"undo"` for +`KeyZ` without Shift, `"redo"` for +Shift+`KeyZ` or +`KeyY`, else `null`. Match **`event.code`**, never `event.key` (Pitfall 2). Standard `KeyboardEvent.code` values `[ASSUMED]` (training knowledge, MDN).
- One `window` `keydown` listener in the editor, attached only while `active`, and only for tabs that edit the draft (not `employees`/`access`, whose inputs keep native undo). Always `preventDefault()` for save (even when not dirty, to block "Сохранить страницу"); ignore save while `saveState === "saving"`.
- Mobile/Edit-menu undo bypasses `keydown`: also handle `beforeinput` with `inputType` `historyUndo` / `historyRedo` (`preventDefault` + app undo/redo). `[ASSUMED]` support on iOS/Android keyboards.
- After undo/redo, restore valid selections (fallback to first record, same logic as the sync effect at `portia-editor.tsx:421-430`) and clear `formatTarget` (Pitfalls 7, 8).
- Optional mobile step-back (CONTEXT leaves it open): a compact "↶" button in the bar, `aria-label="Отменить последнее действие"`, disabled when `!canUndo`. Recommended, because phones have no Ctrl+Z.

### Pattern 10: Lanes for reordering (EDIT-03)
Keep `OrderDragHandle` (`portia-editor.tsx:117-155`): 170 ms hold, `setPointerCapture`, target found by `[data-sort-index]`. Current snippet (verbatim, lines 142-151):
```tsx
    onPointerMove={(event) => {
      if (!active.current) return;
      const row = document.elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>("[data-sort-index]"))
        .find(Boolean);
      const target = Number(row?.dataset.sortIndex);
      if (!Number.isInteger(target) || target === indexRef.current) return;
      onMove(indexRef.current, target);
      indexRef.current = target;
    }}
```
Recommended changes, smallest first:
1. **Lane look is CSS only** via `:has()` (precedent: `.content-editor:has(.floating-text-format)` at `app/portia.css:491`): `.editor-record-row:has(.order-drag-handle[data-dragging="true"])`, `.recommendation-order-row:has(...)`, `.nested-editor-card:has(...)` get a teal solid band + `--teal-soft` background; optional CSS-counter two-digit position (mono) on the lane. The list live-reorders under the finger, so the row's own position **is** the insertion place; no extra placeholder DOM. Colours per the surface contract: teal for live/selected, amber (`--warning`, `app/portia.css:16`) for unsaved, red for destructive.
2. **Midpoint hysteresis** `[ASSUMED, reasoned from the code above]`: with unequal row heights the current rule swaps whenever the pointer is over a different row, which can swap back and forth on every `pointermove` (A=100px above B=400px; pointer 150px: swap -> pointer is over B again -> swap back). Add: when moving down require `event.clientY` below the target row's vertical midpoint; moving up, above it (`row.getBoundingClientRect()`).
3. **Edge autoscroll on touch** (viewport height < list height at 375px): while `active`, if the pointer is within ~48px of the top/bottom of the scroller, scroll it by a few px per `requestAnimationFrame`. Scroller = nearest scrollable ancestor, else `window` (on mobile the document scrolls).
4. **Keyboard reorder** (a11y fallback without visible UI, as CONTEXT allows): `onKeyDown` ArrowUp/ArrowDown on the focused handle calls `onMove(index, index ± 1)`. Rows are keyed by stable id, so DOM focus stays on the handle.
5. **Touch target:** handle column is 34px (`app/portia.css:412,414`); raise to 44px at `max-width: 900px` in both `.editor-record-row` and `.recommendation-order-row` columns.
6. **Undo grouping:** a drag emits many `onMove` calls. Provide a tiny `DragGroupContext { start(): void; end(): void }` from `PortiaEditor`; the handle calls `start()` when the hold timer fires and `end()` on pointer up/cancel; `changeDraft` then uses key `drag:N` with unbounded gap so one drag = one undo step (D-11).

### Pattern 11: Dossier tabs (EDIT-04)
Recommended grouping of the six `EditorGroup` blocks into **4 tabs** (fits a 375px strip, balances length):
| Tab id | Label | Blocks |
|--------|-------|--------|
| `main` | Основное | «Основные данные» + «Классификация» |
| `text` | Описание | «Описание» + «Характеристики PPU» |
| `mutations` | Мутации | «Мутации» |
| `logs` | Записи учёных | «Записи учёных» |
A small `DossierTabs({ tabs, active, changed, onSelect })` renders `<nav className="editor-tabs dossier-tabs">` reusing the existing tab button look. Conditional rendering (`{dossierTab === "text" && ...}`), not CSS hiding. State: `dossierTab` in `PortiaEditor` for the live virus, and a separate `useState` inside `ArchivedVirusEditor` (`portia-editor.tsx:962`), which has the same blocks with plain `<textarea>`s. Keep the chosen tab when switching viruses; reset `formatTarget`/`formatterOpen` on tab change. Dot: `<i className="tab-dot" aria-hidden="true" />` plus `aria-label="<label>, есть несохранённые правки"` on the button. Same markup/dot for the top-level tabs (`nav.editor-tabs`, `portia-editor.tsx:560`). Where the "ПЕРЕМЕСТИТЬ В КОРЗИНУ" button sits (after the groups, `:666`) put it in the `logs` tab or below all tabs; recommended: render it **outside** the tab switch so it stays reachable.

### Anti-Patterns to Avoid
- **`window.confirm()` for new prompts:** answered "no" silently in embedded browsers.
- **Side effects inside a `setState` updater** (pushing history from inside `setDraft(current => ...)`): React StrictMode runs updaters twice in development; use the reducer.
- **`e.key === "s"`:** fails on the Russian layout.
- **`position: sticky` bar on mobile / `position: fixed` bar on desktop** (see Pattern 5).
- **Keeping the boolean `dirty` state next to history:** undo back to the saved state would still show the bar.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable list | A new drag library or HTML5 DnD (`draggable`) | Existing `OrderDragHandle` + CSS `:has()` | HTML5 DnD does not fire on touch; handle already pointer-captures with `touch-action: none` |
| Unsaved-change tracking | Per-field `dirty` flags | `changedSections(baseline, present)` | One source of truth; survives undo/redo/discard |
| Per-field undo | Native `contenteditable` undo | App-level snapshot history | Field re-renders its DOM with `replaceChildren` (`renderRichTextEditor`, `portia-editor.tsx:254-274`), so the native stack is not reliable (CONTEXT) |
| Confirm prompts | `window.confirm` | `ConfirmDialog` (Pattern 7) | Embedded browsers answer "no" silently |
| Leave-page warning text | Custom unload message | `beforeunload` + empty `returnValue` | Browsers ignore custom text |
| Save-state timer | New `setTimeout` for "Сохранено" | Existing `saveState` 1800 ms cycle | Already implemented in `saveContent` |

**Key insight:** every piece this phase needs (draft, save state, drag, panel, `:has()`) already exists; the work is wiring them through one state container and presenting them for a 375px screen.

## Common Pitfalls

### Pitfall 1: `confirm()` silently fails
**What goes wrong:** "Отменить" or close appears to do nothing. **Why:** embedded browsers answer `confirm()` "no" without showing it (`portia-editor.tsx:755-756` comment; STATE.md). **How to avoid:** `ConfirmDialog` only. **Warning signs:** `window.confirm(` count in `portia-editor.tsx` rising above the current 2 (lines 667, 768).

### Pitfall 2: Russian keyboard layout
**What goes wrong:** Ctrl+S / Ctrl+Z do nothing (and the browser's "Save page" opens) for users on a Russian layout. **Why:** `event.key` is "ы" / "я" / "н"; `event.code` is layout-independent. **How to avoid:** `shortcutOf` on `event.code` plus a unit test that passes `{ code: "KeyS", key: "ы" }`.

### Pitfall 3: Sticky bar never sticks on mobile; fixed bar misplaces on desktop
See Pattern 5. **Warning signs:** on a 375px viewport the bar scrolls away with the page; or on desktop after dragging the window the bar jumps to the viewport bottom.

### Pitfall 4: History written inside a state updater
StrictMode double-invokes updaters, duplicating history entries. Compute in the reducer (pure) and pass `now`/key from the event handler. The existing `changeDraft` (`portia-editor.tsx:449-456`) already uses the updater form, so keep updaters only for pure `clone` + mutate-the-clone.

### Pitfall 5: Sync effect wipes history and redo
The effect at `portia-editor.tsx:421-430` resets the draft from `content` whenever `dirty` is false. With derived `dirty`, undoing back to the saved state flips `dirty` false and the effect would clear the redo stack. **How to avoid:** make the `sync` reducer action a no-op unless `content !== state.source` and the draft is clean. Keep the existing `window.setTimeout(..., 0)` wrapper (it exists because lint forbids synchronous `setState` in effects).

### Pitfall 6: Edits made while a save is in flight are overwritten
`save()` does `setDraft(normalized)` after `await onSave(...)` (`portia-editor.tsx:536-538`). Anything typed during the PUT is lost. Fix via the `saved {normalized, savedFrom}` action (only replace `present` when `present === savedFrom`). Related: `saveContent` schedules `setSaveState("idle")` after 1800 ms without clearing earlier timers (`portia-desktop.tsx:823`), so a second save within 1.8 s can be flipped to "idle" early; clear the previous timer when touching this code.

### Pitfall 7: Stale `formatTarget` after undo or dossier-tab switch
`FloatingTextFormatPanel` keeps its own `documentRef` from `target.document` (`portia-editor.tsx:1142-1149`); applying a style after an undo would write the pre-undo text back. **How to avoid:** on undo/redo/discard and on any dossier/top tab change call `setFormatTarget(null); setFormatterOpen(false)` (same as `switchTab`, `:480-485`).

### Pitfall 8: Selection points at a record that no longer exists
Undoing "add virus" or redoing "move to recycle bin" leaves `selectedVirusId` / `selectedRecycleFileId` / `selectedRecycledVirusId` pointing at nothing (empty state shows although the list is not empty). Re-run the fallback logic from the sync effect after undo/redo/discard, and on mobile also set `recordOpen=false` when the selection vanishes.

### Pitfall 9: Lint rules in `eslint-plugin-react-hooks` 7.1.1
New effects must not call `setState` synchronously and render code must not read/write `ref.current`. Keep refs for handlers/effects only; read `canUndo`/`dirty`/`changed` from reducer state, not from refs. The existing code shows the accepted workaround (`window.setTimeout(..., 0)` in effects). `npm run lint` is a gate (currently 0 errors).

### Pitfall 10: Reorder oscillation and no autoscroll
See Pattern 10 items 2-3. Applies most to tall `nested-editor-card[data-sort-index]` (info sections) on a phone.

### Pitfall 11: iOS Safari zooms the page when a small-font field gets focus `[ASSUMED]`
Inputs here are `font-size: 13px` (`app/portia.css:428`); contenteditable areas are 10-17px by design (`:479-487`, WYSIWYG rule from Phase 1 FIX-03, so they cannot all become 16px). A focus-zoom produces exactly the horizontal scrolling EDIT-01 forbids. Plain `input/textarea/select` can be `16px` at `max-width: 900px` without breaking WYSIWYG; the rich-text areas need a user decision (Open Question 3).

### Pitfall 12: Other 375px overflow suspects (audit during execution)
`.editor-record-row { flex: 0 0 214px }` (removed by Pattern 1), `.editor-save-status { white-space: nowrap }` (`:395`, only `.error/.conflict` reset it), `.access-editor-add` (already stacked at <=900), `.employee-editor-summary` grid (96px + 1fr), long URL/GIF text inside `.formatted-rich-input` (check `overflow-wrap`; the rule is cut off at `:473` in the listing, confirm it is `anywhere`/`break-word`), `.custom-color-picker`. There is no browser harness in the repo, so this is a manual check (Validation Architecture).

### Pitfall 13: Conflict state and "Отменить"
In conflict the user must copy their edits before reloading. "Отменить" (with confirm) would discard them; it is also an undoable step in the recommended reducer. Keep the existing behaviour (Save stays enabled; CONTEXT: "Существующий текст и поведение защиты от перезаписи сохраняются"), but do not let "Отменить" hide the conflict text.

## Code Examples

### Shortcut mapping (pure, testable; Pitfall 2)
```ts
// lib/editor-shortcuts.ts (sketch). code values: standard KeyboardEvent.code [ASSUMED]
type KeyInfo = { code: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean };
export function shortcutOf(e: KeyInfo): "save" | "undo" | "redo" | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  if (e.code === "KeyS") return e.shiftKey ? null : "save";
  if (e.code === "KeyZ") return e.shiftKey ? "redo" : "undo";
  if (e.code === "KeyY") return e.shiftKey ? null : "redo";
  return null;
}
```

### Editor effects for save, undo and leave-page (D-10, D-11, D-12)
```tsx
// inside PortiaEditor; "employees" and "access" are the EditorTab ids from portia-editor.tsx:17
useEffect(() => {
  if (!active || tab === "employees" || tab === "access") return;
  const onKey = (event: KeyboardEvent) => {
    const action = shortcutOf(event);
    if (!action) return;
    event.preventDefault();
    if (action === "save") { if (dirty && saveState !== "saving") void save(); }
    else { /* clear format target, dispatch undo/redo, repair selections */ }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [active, tab, dirty, saveState /* + stable callbacks */]);

useEffect(() => {
  if (!dirty) return;
  const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}, [dirty]);
```

### Mobile list/record and bar CSS skeleton
```css
/* inside the existing @media (max-width: 900px) block of app/portia.css */
.editor-header { display: none; }
.editor-record-list { position: static; display: grid; }
.virus-editor-layout[data-mobile-view="list"] > .editor-form { display: none; }
.virus-editor-layout[data-mobile-view="record"] > .editor-record-list { display: none; }
.editor-savebar { position: fixed; left: 0; right: 0; bottom: 44px; }          /* taskbar is 44px */
.content-editor[data-savebar] { padding-bottom: 110px; }
.content-editor:has(.floating-text-format) .editor-savebar { display: none; }
/* outside any media query */
.editor-back-to-list { display: none; }  /* shown only inside the <=900px block */
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Boolean `dirty` set in `changeDraft`, cleared on save | Derived dirty from `baseline` vs `present` | This phase | Undo-to-clean hides the bar; sections list for free |
| Header save zone (always visible "СОХРАНИТЬ ВСЁ") | Bar only when something is unsaved/saving/saved/error/conflict | This phase | Matches D-07 |
| Horizontal card strip for record choice on <=900px | List then record | This phase | Removes the horizontal scroll source |

**Deprecated/outdated:** the `.editor-save-zone` markup and its mobile CSS (`app/portia.css:394-397, 982, 1066`) become dead once the bar lands; remove them (minimal diff includes deleting what it replaces).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Setting `inputMode="none"` on an already-focused contenteditable hides the on-screen keyboard and keeps the selection (Android Chrome, iOS Safari). Web search found no verified recipe. | Pattern 6 | D-06 fails on the user's phone; fall back to blur + highlight; needs device check |
| A2 | A programmatic `focus()` inside the panel's "ГОТОВО" click handler re-opens the keyboard on iOS. | Pattern 6 | User must tap the field again to type (minor) |
| A3 | `beforeinput` with `historyUndo`/`historyRedo` fires for mobile keyboard/Edit-menu undo. | Pattern 9 | Phone users get native (broken) undo in rich fields; the optional bar button covers it |
| A4 | Standard `KeyboardEvent.code` values `KeyS`, `KeyZ`, `KeyY`. | Pattern 9, examples | None practical; trivially checked in a test |
| A5 | iOS Safari zooms on focus for fields below 16px, including contenteditable. | Pitfall 11 | EDIT-01 horizontal-scroll criterion fails on iPhone |
| A6 | Midpoint hysteresis removes swap oscillation for unequal row heights (derived by reading the handle code; not run in a browser). | Pattern 10 | Reorder jitter on info cards remains; tune threshold in UAT |
| A7 | 50 history snapshots are an acceptable memory cost. Default seed content is 9,420 JSON chars (measured); real Supabase content size unknown. | Pattern 3 | High memory on very large content; lower the cap or store JSON strings |
| A8 | `position: sticky` does not stick when the nearest overflow ancestor (`.app-window`, `overflow: hidden`) does not scroll. | Pattern 5, Pitfall 3 | Choose `fixed` on mobile anyway; low risk |
| A9 | Android hardware Back from a record view leaves the page (no `history` entries pushed). | Open Questions | Users lose place; `beforeunload` still warns if dirty |
| A10 | `beforeunload` is unreliable on mobile browsers when the tab is backgrounded. | Pattern 8 | Draft loss on phones despite the guard; nothing more to do client-side |

## Open Questions

1. **History after save:** recommended **clear it** on successful save (literal reading of D-11 "в пределах несохранённого черновика"). Alternative is to keep it so Ctrl+Z after saving re-dirties the draft; that needs the baseline logic anyway and is a two-line change in the reducer. Confirm with the user only if they care.
2. **Keep "СОХРАНИТЬ" enabled in conflict?** Current behaviour keeps it enabled; a retry returns 409 again. Recommendation: leave unchanged (CONTEXT says keep behaviour), optionally add a "ОБНОВИТЬ СТРАНИЦУ" button.
3. **iOS focus-zoom:** apply `16px` to plain inputs at <=900px (safe), but rich-text areas (10-14px by WYSIWYG rule) either keep their size (accept zoom) or the site adds `maximum-scale=1` via `export const viewport`. Needs the user's call (accessibility vs convenience). Which phone does the user use?
4. **`interactiveWidget: "resizes-content"` globally** so the bar rides above the Android keyboard: affects every window, so only if UAT demands it.
5. **Android Back** from record view: push a `history` entry on open (extra code) or accept leaving the page. Recommendation: accept for now.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, test, lint | yes | v24.21.0 (project `engines` `>=22.13.0 <23`) | none needed; tests pass |
| npm scripts (`test`, `lint`, `build`) | verification gates | yes | `npm test` 25 pass; `lint` 0 errors | — |
| `npx tsc --noEmit` | typecheck gate | yes | TS 5.9.3, clean (~2.5 s) | — |
| Microsoft Edge (headless/devtools) | manual 375px check | yes | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` | Chrome DevTools device mode in any browser |
| Playwright / Puppeteer / Vitest | automated UI tests | no | — | none; pure-logic tests via `node:test`, UI by source assertions + manual UAT |
| Real phone (iOS and/or Android) | D-06 keyboard behaviour, drag on touch | not available to the agent | — | **Human-verify checkpoint required** |
| Editor login (Supabase owner/editor account) on localhost:3123 | opening the editor in a browser | not available to the agent | — | User performs UAT; no dev auth bypass exists in the repo |

**Missing dependencies with no fallback:** a physical phone and an editor session; both are user-side UAT.
**Missing dependencies with fallback:** UI test framework (use `node:test` for pure modules and `node -e` source assertions, matching Phase 2).

## Validation Architecture

> `.planning/config.json` has `workflow.nyquist_validation: false`; this section is included because the orchestrator explicitly requested it.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` with `--experimental-strip-types` [VERIFIED: package.json `"test": "node --experimental-strip-types --test lib/*.test.ts"`] |
| Config file | none; any new `lib/*.test.ts` is picked up by the glob |
| Quick run command | `node --experimental-strip-types --test lib/editor-history.test.ts lib/editor-changes.test.ts lib/editor-shortcuts.test.ts` |
| Full suite command | `npx tsc --noEmit && npm run lint && npm test && npm run build` (Phase 2 style), followed by inline `node -e` source assertions |

Test-file constraints: relative imports with the `.ts` extension, `import type` for types, no `@/` alias, no enums/parameter properties (strip-types only erases types). Existing example: `lib/portia-content-normalize.test.ts` imports `./portia-content.ts`.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-02 | `changedSections` flags the right sections (rename virus -> `viruses`; move to bin -> `viruses`+`recycle`; `info:` key -> `info`; assistant flag -> `assistant`; identical -> none) | unit | `node --experimental-strip-types --test lib/editor-changes.test.ts` | ❌ Wave 0 |
| EDIT-02 / D-11 | Reducer: typing within gap coalesces, after gap splits, drag key merges, undo/redo, cap 50, `discard` is undoable, `saved` with concurrent edit keeps `present`, `sync` is idempotent and ignored while dirty | unit | `node --experimental-strip-types --test lib/editor-history.test.ts` | ❌ Wave 0 |
| EDIT-02 / D-10, D-11 | `shortcutOf` handles Ctrl/Cmd, Shift, Alt, and `{code:"KeyS", key:"ы"}` | unit | `node --experimental-strip-types --test lib/editor-shortcuts.test.ts` | ❌ Wave 0 |
| EDIT-04 | `changedDossierTabs` maps mutation/log/main/text slices (incl. `virus:<id>:mutation:` `formattedText` keys) | unit | same `editor-changes.test.ts` | ❌ Wave 0 |
| EDIT-02 | Editor wires `beforeunload`, `role="alertdialog"`, `event.code`-based shortcuts, no new `window.confirm(` | source assertion | `node -e` reading `components/portia-editor.tsx` (see below) | script in plan |
| EDIT-01 | CSS: inside the `@media (max-width: 900px)` blocks `.editor-header` is hidden, `[data-mobile-view="list"]`/`"record"` rules exist, bar is `position: fixed`, old `.editor-record-row { flex: 0 0 214px; }` is gone | source assertion | `node -e` strip comments, slice media blocks, test | script in plan |
| EDIT-01 | No horizontal scroll at 375px in every tab and in a dossier tab | manual | DevTools device 375x667 + console snippet below | manual UAT |
| EDIT-01 / D-06 | Keyboard hides when the panel opens, selection stays, text stays above panel | manual, real device | UAT checklist | manual UAT (human-verify) |
| EDIT-03 | Drag on touch reorders in list and info cards; autoscroll; arrows reorder; one drag = one undo step | manual + unit for the drag-group key | UAT + reducer test | manual UAT |
| EDIT-02 | Close with unsaved edits shows the PORTIA dialog; minimize does not; reload shows the browser prompt | manual | UAT | manual UAT |

Sample source assertion (same style as Phase 2 plans; adapt tokens to the final implementation):
```bash
npx tsc --noEmit && npm run lint && npm test && npm run build && node -e '
const fs=require("fs");const s=fs.readFileSync("components/portia-editor.tsx","utf8");const e=[];
for(const t of ["beforeunload","alertdialog","event.code"]) if(!s.includes(t)) e.push("missing "+t);
const n=(s.match(/window\.confirm\(/g)||[]).length; if(n>2) e.push("new confirm() calls: "+n);
if(s.includes("СОХРАНИТЬ ВСЁ")) e.push("old header save button still present");
if(e.length){console.error(e.join("\n"));process.exit(1)} console.log("editor source OK")'
```
Manual overflow snippet (DevTools console at 375px, with the editor open on each tab, a virus record open, and the format panel open):
```js
document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.content-editor *')].filter(el => !el.closest('.editor-tabs') && el.getBoundingClientRect().right > innerWidth + 1).map(el => el.className || el.tagName)
```
Expect `true` followed by an empty array.

### Sampling Rate
- **Per task commit:** the quick `node --test` command for the touched `lib/` module, plus `npx tsc --noEmit`.
- **Per wave merge:** full suite command plus the source assertions.
- **Phase gate:** full suite green, then user UAT on a real phone (375px layout, D-06, touch drag, close dialog) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `lib/editor-history.ts` and `lib/editor-history.test.ts` - covers D-08, D-09, D-11
- [ ] `lib/editor-changes.ts` and `lib/editor-changes.test.ts` - covers D-08, EDIT-04 dot logic
- [ ] `lib/editor-shortcuts.ts` and `lib/editor-shortcuts.test.ts` - covers D-10, D-11
- No framework install needed.

## Security Domain

> `security_enforcement` is enabled in config (`security_asvs_level: 1`, `security_block_on: high`). This phase adds no endpoint, storage or auth change; the surface is client-only.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Supabase session, `/api/access` |
| V3 Session Management | no (unchanged) | existing; note save may 403 if session expired (existing employee flow already tells the user to log in again) |
| V4 Access Control | no change | `PUT /api/content` requires `getEditorAccess(...).canEdit` (`app/api/content/route.ts`); client changes cannot widen it |
| V5 Input Validation | yes (unchanged) | Server `normalizePortiaContent` + 2,000,000 char limit + revision check on every PUT; history/undo only produces content the editor could already produce |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via dialog/bar text | Tampering | Render section labels and record names as React text nodes only (never `dangerouslySetInnerHTML`); labels come from a fixed map |
| Lost update / overwrite by older client | Tampering | Existing optimistic revision (409); keep the conflict path intact |
| Data loss on accidental close/discard | Denial of use | D-09 confirm, D-12 dialog, `beforeunload`, undoable discard |
| Global shortcut hijack in other windows | Spoofing/UX | Attach `keydown` only while the editor window is `active`; not for `employees`/`access` tabs |

## Sources

### Primary (HIGH confidence) - read this session
- `components/portia-editor.tsx` (full), `components/portia-desktop.tsx` (lines 20-40, 240-262, 700-835, 1000-1024, 1330-1350, 1382-1500), `app/portia.css` (media blocks, editor, window, taskbar, format panel rules), `app/layout.tsx`, `app/api/content/route.ts`, `lib/portia-content.ts` (types, `portiaTextKey`), `package.json`, `eslint.config.mjs`, `.planning/{PROJECT,STATE,REQUIREMENTS,config}.json/md`, `.impeccable/surfaces/components-portia-desktop-tsx.md`, `PRODUCT.md`, `03-CONTEXT.md`.
- Commands run: `npm test` (25 pass), `npx tsc --noEmit` (clean), `npm run lint` (0 errors, 13 warnings), `node --version`, size of `defaultPortiaContent` (9,420 chars).
- `node_modules/next/dist/lib/metadata/types/extra-types.d.ts:53` for `interactiveWidget`.

### Secondary (MEDIUM confidence)
- WebSearch on `interactive-widget` support: Safari iOS does not support `resizes-content` (caniuse via MDN-derived tables); Chrome/Firefox Android do; iOS 26 fixed-bottom-bar keyboard bugs reported. Pages: MDN viewport meta element (`developer.mozilla.org/en-US/docs/Web/HTML/Guides/Viewport_meta_element`), caniuse `mdn-html_elements_meta_name_viewport_interactive-widget_resizes-content`, WebKit bug 259770.

### Tertiary (LOW confidence)
- WebSearch on hiding the virtual keyboard while keeping focus: only the Chromium `VirtualKeyboard` API (`virtualkeyboardpolicy`, Chrome Android 94+, not iOS) is documented (MDN `VirtualKeyboard.hide()`); no verified `inputmode` toggle recipe. Marked `[ASSUMED]` (A1, A2).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - nothing new; versions read from `package.json`.
- Architecture (reducer, derived dirty, close guard, bar placement): HIGH - derived from reading every call path; sticky/fixed behaviour from CSS read, not run.
- Mobile keyboard/panel (D-06): LOW - platform behaviour unverified; device checkpoint required.
- Pitfalls: MEDIUM-HIGH - code-traced; oscillation (A6) and iOS zoom (A5) not run in a browser.

**Research date:** 2026-10-14
**Valid until:** 2026-11-13 (stable stack; revisit D-06 findings after the first device test)
