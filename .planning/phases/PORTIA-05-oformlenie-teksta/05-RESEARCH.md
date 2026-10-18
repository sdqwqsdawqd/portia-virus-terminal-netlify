# Phase 5: Оформление текста - Research

**Researched:** 2026-10-19
**Domain:** Next.js 16 / React 19 client app, hand-rolled `contentEditable` rich-text editor (`components/portia-editor.tsx`), one big CSS file (`app/portia.css`). No new packages.
**Confidence:** HIGH for code findings (all read this session); MEDIUM for the phone selection-loss mechanism (code path verified, device behaviour not reproducible here); MEDIUM for the window-animation cause (CSS semantics verified, no browser run).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Ряд готовых стилей
- **D-01:** В начале панели оформления появляется ряд кнопок: **«Обычный» / «Заголовок» / «Жирный» / «Важно»**. «Маркер» и «Примечание» не нужны.
  - «Обычный» снимает всё оформление с выделения. Это уже существующий `resetRichTextStyle`, теперь он вынесен первой кнопкой ряда.
  - «Заголовок»: размер L (22) и толщина 800.
  - «Жирный»: только толщина 800, размер и цвет не трогаются.
  - «Важно»: красный `#b43632` и толщина 600.
- **D-02:** Повторное нажатие на уже применённый стиль **снимает его**, как в Word. Это меняет прежнее правило «повторный клик ничего не делает» (D-02 фазы 3) только для кнопок ряда. Снимаются только свойства этого стиля, остальное оформление остаётся. Кнопка подсвечена, когда стиль уже стоит на выделении.
- **D-03:** Все нынешние ручные настройки остаются ниже ряда: цвет текста с палитрой и своим цветом, размер S/M/L/XL, толщина в 3 ступени, фон текста со своим цветом и плотностью, фон предпросмотра БЕЛЫЙ/ЧЁРНЫЙ. Ничего не удаляется.

### На что ложится стиль
- **D-04:** Если ничего не выделено (только курсор), стиль ложится на **слово под курсором**. Если курсор между словами, ничего не меняется. Больше **никогда не применять стиль ко всему полю** только из-за того, что выделения нет. Подпись «ВЕСЬ ТЕКСТ» в шапке панели больше не нужна. Как показывать состояние «нет выделения», решает Claude.
- **D-05:** **Телефон, баг владельца:** после нажатия на стиль при выделенном тексте выделение пропадает, и следующее нажатие оформляет весь текст. Нужно, чтобы выделение (и его подсветка через Custom Highlight API) оставалось на том же куске текста после каждого нажатия, сколько бы стилей подряд ни ставилось. Вместе с D-04 это убирает случайное оформление всего поля.

### Цвета текста по умолчанию
- **D-06:** На **чёрном** фоне предпросмотра основной цвет текста **`#AEBFBA`**.
- **D-07:** На **белом** фоне основной цвет такой же, как у значений в ячейках **классификации** в базе вирусов: `.class-cell strong` → `oklch(.237 .015 var(--accent-hue))`, примерно `#1f2725` при акценте по умолчанию.
- **D-08:** «Основной» значит сразу три вещи: (а) текст без оформления показывается этим цветом в редакторе; (б) этот цвет стоит первым в палитре и заменяет «Графит» `#252827` и «Светлый» `#d4e0dd`; (в) уже покрашенный текст в сохранённом контенте не меняется (ни миграций, ни перекраски).

### Редактор выглядит как сайт (WYSIWYG)
- **D-09:** Баг владельца: у некоторых документов и приложений на сайте свой стиль (цвет, шрифт, фон), а поле в редакторе выглядит по общему шаблону и отличается от того, что видно на сайте. Нужно, чтобы каждое поле редактора выглядело так же, как место на сайте, которое оно правит: цвет текста, шрифт, размер, фон. Это продолжает решение фазы 1 (одно CSS-правило на область, `.formatted-rich-input[data-area=…]`). Исследователь проходит все области (досье вируса, записи учёных, Информация и блоки гайдов, Сводка и квесты, Корзина, помощник, рекомендации поиска) и находит расхождения.

### Панель оформления на ПК
- **D-10:** Панель перетаскивается за шапку («РЕДАКТОР ОФОРМЛЕНИЯ»), как окна рабочего стола. За край экрана не выходит.
- **D-11:** Место панели запоминается в браузере (localStorage, по образцу других ключей `portia-*-v1`) и восстанавливается при следующем открытии. Если сохранённое место не помещается на текущем экране, панель прижимается к краю.

### Панель оформления на телефоне
- **D-12:** Панель компактная, но все функции остаются. Сверху всегда виден ряд готовых стилей (D-01). Под ним вкладки **«Цвет / Размер / Фон»** (толщина и фон предпросмотра тоже распределяются по вкладкам), открыта всегда только одна.
- **D-13:** Правило «либо клавиатура, либо панель» (фаза 3, D-06) остаётся без изменений.

### Попутные правки интерфейса (просьба владельца в этом обсуждении)
- **D-14:** **Рывок окна:** при открытии окно будто растягивается, а при закрытии сдвигается, и выглядит это странно. Анимации открытия и закрытия должны идти плавно, без растяжения и смещения. Анимации описаны в `app/portia.css:1352-1356` (`window-open`, `window-close` и др.).
- **D-15:** **«Информация»:** карточки подразделов (например, «01.1 НОВЫЙ ПОДРАЗДЕЛ») занимают слишком много места. Их нужно сделать компактными, по высоте строки или кнопки. Стили: `.info-subsection-list`, `.info-subsections` в `app/portia.css` (~329-340, мобильные ~1091).
- **D-16:** **Настройки → «Содержимое сайта»:** между текстом и кнопками «ОТКРЫТЬ РЕДАКТОР» / «УПРАВЛЕНИЕ ВХОДОМ» большая пустая область. Блок должен занимать столько места, сколько нужно содержимому. Стили: `.content-control-entry` (`app/portia.css:307-310`, мобильные 1138).

### Claude's Discretion
- Как подсвечивать активный стиль в ряду и как показывать «нет выделения».
- Как найти границы «слова под курсором» (кириллица, дефисы, знаки препинания).
- Хранить цвет D-07 как фиксированный hex или следовать за акцентом (на сайте у текста без оформления цвет и так из CSS области).
- Как распределить толщину и фон предпросмотра по вкладкам на телефоне (D-12).
- Как сделать перетаскивание: можно взять механику окон рабочего стола.

### Deferred Ideas (OUT OF SCOPE)
- Горячие клавиши (Ctrl+B и др.) не обсуждались, в фазу не входят.
- Общая расстановка ярлыков (DESK-01): фаза 4 пропущена по решению владельца.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEXT-01 | Основные стили ставятся в один клик и одинаково на ПК и телефоне; редактор совпадает с сайтом | §1 (D-09 table), §2 (presets/toggle), §3 (word range), §4 (phone selection), §5 (palette), §6 (drag), §7 (phone tabs), §8 (D-14..16 causes), §9 (tests) |
</phase_requirements>

## Summary

Everything in this phase lives in three files: `components/portia-editor.tsx` (panel + fields + pure style helpers), `app/portia.css` (site and field styles), and `components/portia-desktop.tsx` (site rendering, window animation). No new dependencies are needed. All style helpers (`applyRichTextStyle`, `resetRichTextStyle`, `richTextStyleAt`, `compactRuns`, `expandStyles`, `replaceRichText`) are private functions inside `portia-editor.tsx`, so none can be unit-tested today; the `npm test` runner is `node --test lib/*.test.ts` and only sees `lib/`. First move: extract them to a new pure module `lib/rich-text-style.ts` and test it.

The "whole field when nothing is selected" behaviour lives in exactly two functions (`start === end ? 0 : …` and `start === end ? text.length : …` in `applyRichTextStyle` and `resetRichTextStyle`) plus three UI strings. D-04 is solved by resolving the target range once in the panel (`selection`, or the word under the caret via a Unicode regex, or null) and passing an explicit `[from,to)` to range-only helpers that never special-case a collapsed range.

The most important finding (D-09): the field colour/background are NOT per area. Every field gets one of two generic skins (`.preview-light` / base-dark), chosen by editor TAB, not by area, and the unfocused dark skin is a different colour (`oklch(.845 …)` = about #c1d0cc) from the active one. Per-area font is paired with the site, but per-area ink and surface are not. Seven areas visibly differ from the site; two have extra faults (caption sits on the wrong surface in the Recycle tab; assistant text on the site ignores run colour/size/weight because of `!important`). The fix is to extend the existing "pair the selectors" pattern with per-area ink/surface tokens and to derive the default surface from the area, not the tab.

**Primary recommendation:** (1) extract style helpers to `lib/rich-text-style.ts` with explicit-range semantics + `wordRangeAt` (regex) + `rangeHasStyle` + `removeRichTextStyleKeys`; (2) add per-area `--field-ink/--field-bg` tokens to the CSS and derive the default preview surface from `data-area`; (3) make the panel the owner of an "effective range" (selection or word) and keep the DOM selection in sync after every re-render (always restore, never trust a collapsed `selectionchange`); (4) drag the panel by its header using pointer capture + a pure clamp helper in `lib/`; (5) fix D-14/15/16 with the three small CSS/JS changes in §8.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Style math (apply / toggle / word range / has-style) | Browser pure module (`lib/rich-text-style.ts`) | — | No DOM, testable with `node --test`; today trapped in the component file |
| Selection tracking, Custom Highlight paint | Browser (DOM Selection + `CSS.highlights`) | — | Phone selection survives only if DOM selection and stored offsets agree |
| Field look (WYSIWYG) | CSS (`app/portia.css`) | React (default surface per area) | Site and field must share tokens; React only picks white/black override |
| Panel drag + position memory | Browser (pointer events, `localStorage`) | pure clamp helper in `lib/` | Same mechanism as window drag (`lib/window-geometry.ts`) |
| Persistence of formatted text | Existing `target.onCommit` -> `changeDraft` -> history reducer | server normaliser `portia-content-normalize.ts` | Unchanged; formatting stays one undoable step |
| Window open/close animation | CSS keyframes + one inline `transformOrigin` effect in `AppWindow` | — | Bug is the interaction of the two |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new) | — | — | Phase is codebase-only. React 19.2.6, Next 16.4.2, TS strict, `node:test` already installed [VERIFIED: package.json] |

**Test runner:** `"test": "node --experimental-strip-types --test lib/*.test.ts"` [VERIFIED: package.json scripts]. Baseline this session: `ℹ tests 154 … ℹ pass 154 ℹ fail 0` (Node v24.21.0 locally; `engines` is `>=22.13.0 <23`).

**Installation:** none.

**Package Legitimacy Audit:** no external packages are installed by this phase; audit not applicable.

## Architecture Patterns

### System Architecture Diagram

```
 tap / click / keys in contentEditable field (FormattedTextarea, editor.tsx:1775)
        |
        v
 onFocus/onSelect/onMouseUp/onKeyUp -> activate(editor)           (1795)
        |   selectionOffsets(editor) -> {start,end}
        v
 setFormatTarget(FormatTarget{key,title,value,document,selection,onCommit})   (718)
        |
        v
 FloatingTextFormatPanel (1872) ---- effective range = resolveRange(text, selection)   [NEW: selection | word | null]
        |   preset row / colour / size / weight / background clicks
        v
 lib/rich-text-style.ts  [NEW pure]: apply / toggle(remove keys) / reset on explicit [from,to)
        |
        v
 commit(doc): target.onCommit(value, doc)  -> changeFormattedText -> changeDraft -> history reducer (undo step)
        |                      + onUpdate({...target, document})
        v
 FormattedTextarea layout effect: renderRichTextEditor(replaceChildren)  (1815) -> DOM selection destroyed
        |   [NEW] always restoreSelection(selectionRef) after re-render
        v
 panel effect (phone): CSS.highlights.set("portia-format", Highlight(range))  (1900)  <- paints the effective range
```

### Recommended Project Structure
```
lib/
├── rich-text-style.ts        # NEW pure: expandStyles/compactRuns/replaceRichText/richTextStyleAt (moved), applyRichTextStyle,
│                             #   removeRichTextStyleKeys, rangeHasStyle, resolveRange, wordRangeAt, stylePresets
├── rich-text-style.test.ts   # NEW node:test
├── panel-position.ts         # NEW pure clamp for the draggable panel (pattern of window-geometry.ts)
└── panel-position.test.ts    # NEW
components/portia-editor.tsx  # imports the above; panel gets preset row, tabs, drag, effective range
app/portia.css                # per-area tokens, panel tabs/drag, D-14/15/16 fixes
```

### Pattern 1: Pure range-explicit style helpers (replaces the "collapsed = whole field" special-case)
**What:** Helpers take an explicit `[from,to)`; the panel decides what the range is. `from===to` means "do nothing".
**Example** (to be implemented; shapes are binding, bodies are the minimum):
```ts
// lib/rich-text-style.ts — type-only imports must use `import type` (node strip-types)
import type { RichTextDocument, RichTextStyle } from "./portia-content.ts";

export const stylePresets = {
  heading:   { fontSize: 22, fontWeight: 800 },            // D-01 «Заголовок»
  bold:      { fontWeight: 800 },                          // D-01 «Жирный»
  important: { color: "#b43632", fontWeight: 600 },        // D-01 «Важно»
} as const;

const WORD = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;
/** Word touching the caret, or null between words. Caret at either edge of a word counts as inside it. */
export function wordRangeAt(text: string, pos: number): { from: number; to: number } | null {
  for (const m of text.matchAll(WORD)) {
    const from = m.index ?? 0, to = from + m[0].length;
    if (pos < from) return null;           // matches are in order: nothing later can contain pos
    if (pos <= to) return { from, to };
  }
  return null;
}
export function resolveRange(text: string, sel: { start: number; end: number }) {
  const from = Math.min(sel.start, sel.end), to = Math.max(sel.start, sel.end);
  return from === to ? wordRangeAt(text, from) : { from, to };
}
export function rangeHasStyle(doc: RichTextDocument, from: number, to: number, style: RichTextStyle) {
  const styles = expandStyles(doc);
  if (to <= from) return false;
  for (let i = from; i < to; i += 1) for (const k of Object.keys(style) as (keyof RichTextStyle)[]) if (styles[i]?.[k] !== style[k]) return false;
  return true;
}
export function removeRichTextStyleKeys(doc: RichTextDocument, from: number, to: number, keys: (keyof RichTextStyle)[]) {
  const text = doc.runs.map((r) => r.text).join(""), styles = expandStyles(doc);
  for (let i = from; i < to; i += 1) for (const k of keys) delete styles[i][k];   // delete, never set undefined: compactRuns counts keys
  return compactRuns(text, styles);
}
export const togglePreset = (doc: RichTextDocument, from: number, to: number, preset: RichTextStyle) =>
  rangeHasStyle(doc, from, to, preset)
    ? removeRichTextStyleKeys(doc, from, to, Object.keys(preset) as (keyof RichTextStyle)[])
    : applyRichTextStyle(doc, from, to, preset);
```
`tsconfig` target is `ES2017` [VERIFIED: tsconfig.json:3 `"target": "ES2017"`] and the `\p{L}…/gu` regex above type-checked with `npx tsc --noEmit` (no output) and ran under `node --experimental-strip-types` this session; sample result: `Привет`, `по-русски`, `ёлка`, `it’s`, `3`, `5`, `ok`.

### Anti-Patterns to Avoid
- **Re-introducing `start === end ? whole field`** anywhere (D-04): grep `start === end` after the change must return nothing in `portia-editor.tsx`.
- **`style.color = undefined` to "clear"**: `compactRuns` writes `style` whenever `Object.keys(style).length` is non-zero (editor.tsx:308 `...(Object.keys(style).length ? { style: { ...style } } : {})`), so an undefined key creates a bogus empty-valued style run. Use `delete`.
- **Trusting `selectionchange`/`onSelect` after a re-render** (see §4).
- **`window.confirm`** etc. — not relevant here, but CONTEXT/prior phases ban it; none needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Word boundaries | Hand char loops with a punctuation list | The `\p{L}\p{N}` regex above | Handles Cyrillic, ё, digits, hyphen compounds, apostrophes; one line; testable |
| Window/panel clamping | New ad-hoc math | A tiny `lib/panel-position.ts` modelled on `dragGeometry`/`fitGeometry` (`lib/window-geometry.ts`) | Existing, tested pattern; keeps drag testable |
| Selection painting on phones | Custom overlay divs | `CSS.highlights` already used (`::highlight(portia-format)`, css:505) | Already wired; only needs to paint the effective range |
| Colour validation | New regex | Existing `/^#[0-9A-F]{6}$/` in `CustomColorPicker` (editor.tsx:2033) and server `normalizeHexColor` (`portia-content-normalize.ts:50`) | Keeps stored colours hex-only |

**Key insight:** every missing capability is either a pure function (testable in `lib/`) or a CSS token. There is nothing here that needs a dependency.

## 1. D-09 WYSIWYG: area-by-area comparison (most important deliverable)

### How the field is skinned today [VERIFIED: app/portia.css:586-602, components/portia-editor.tsx:754,1829]
Quotes (verbatim):
- base field: `.formatted-rich-input { … background: oklch(.168 .014 var(--accent-hue)); color: oklch(.845 .017 var(--accent-hue)); …}` (css:586)
- `.formatted-rich-input.preview-light { background: #f3f1e9; color: #252827; }` (588)
- `.formatted-rich-input.is-editor-active.preview-dark { … background: oklch(.168 .014 var(--accent-hue)); color: oklch(.79 .02 var(--accent-hue)); … }` (590)
- Surface is chosen per TAB: `setPreviewSurface(id === "viruses" || id === "recycle" ? "light" : "dark");` (editor.tsx:754); the field class is `preview-${activeFormat.surface}` (1829). So: viruses + recycle tabs = light; info, broadcasts, search, assistant = dark.
- Only the FONT is paired per area (css:593-602, e.g. `.lead-copy, .formatted-rich-input[data-area="lead"] { font: 16px/1.75 var(--doc); }`). Colour and background are never paired.
- Rule order trap: `.preview-light`/area rules are specificity (0,2,0); `:focus:not(.preview-dark)`/`.is-editor-active.*` (589, 590) are (0,3,0) and force a second colour. Hence the dark field is `oklch(.845 …)` ≈ #c1d0cc unfocused but `oklch(.79 …)` ≈ #aebfbb when active — the dark text visibly changes colour on focus.

### Converted colours (oklch at `--accent-hue: 180.4` [VERIFIED: css:19], computed this session with the Ottosson matrices; sanity check: `oklch(.79 .02)` -> `#aebfbb`, matching the project's own `#aebfba`)
| token | hex |
|-------|-----|
| `.class-cell strong` `oklch(.237 .015)` (css:872) | **#17211f** (CONTEXT says "около #1f2725": the computed value is darker; the oklch value is the source of truth) |
| lead `oklch(.363 .017)` (882) | #34413e |
| metric `oklch(.364 .015)` (887) | #36413e |
| mutation `oklch(.452 .016)` (903) | #4d5956 |
| info `oklch(.79 .02)` (350) | #aebfbb |
| broadcast `oklch(.76 .022)` (439) | #a3b6b2 |
| caption `oklch(.793 .021)` (755) | #aec0bc |
| search pill `oklch(.612 .03)` (276) | #718a84 |
| assistant `oklch(.97 .012)` (795) | #edf8f5 (then dimmed by `filter: brightness(.7)` on the bubble, css:791, to about #a6aeab) |
| dark surface `oklch(.168 .014)` | #08110f |
| caption surface `oklch(.196 .018)` (753) | #0c1815 |
| `--paper` | #f3f0e6 (css:11) vs field light `#f3f1e9` |

### Area table
| Area (editor tab -> field surface today) | Site selector (file:line) and look | Editor rule today | Mismatch | Concrete fix |
|---|---|---|---|---|
| **lead** (virus Внешние/Физиологические; viruses -> light) | `.lead-copy` css:882 `color: oklch(.363 .017 …)` on `.record-view` bg `var(--paper)` (839); font 16px/1.75 `--doc`, mobile 15/1.7 (1058); `max-width: 86ch` | light skin `#f3f1e9` / `#252827`; font paired (593) | ink #252827 vs #34413e; bg #f3f1e9 vs #f3f0e6 | pair ink + bg: `--field-ink: oklch(.363 .017 var(--accent-hue)); --field-bg: var(--paper)` for `[data-area="lead"].preview-light` |
| **metric** (PPU Здоровье/Скорость/Способности; viruses -> light) | `.metric-grid > div > .formatted-content` css:887 `color: oklch(.364 .015 …)`, bg paper, `max-height: 180px; overflow-y: auto; padding-right: 6px`; font 14px/1.6 | light skin | ink #252827 vs #36413e; bg | same pattern, ink `oklch(.364 .015 …)` |
| **mutation** (Описание; viruses -> light) | `.mutation-copy > .formatted-content` css:903 `color: oklch(.452 .016 …)`; card bg `rgba(255,255,255,.2)` over paper (893); font 14px/1.65 | light skin | ink #252827 vs #4d5956 (visibly lighter on site); bg slightly whiter | ink `oklch(.452 .016 …)`, bg `color-mix(in srgb, var(--paper) 80%, #fff)` (about #f5f3eb) |
| **scientist** (Текст записи; viruses -> light) | `.scientist-rich-text` css:651 `color: #252827`, inside `.archive-document-paper` bg `#f5f5f1` (928), font 17px/1.78 `--serif` (596) | light skin | ink matches; bg #f3f1e9 vs #f5f5f1 | `--field-bg: #f5f5f1` |
| **info** (Текст раздела + текстовые блоки подразделов; info -> dark) | `.info-document-copy` css:350 `color: oklch(.79 .02 …)` on `.info-library` gradient `oklch(.192 .018)`..`oklch(.221 .02)` (316); font 16px/1.78 `--doc`, mobile 15 (1095); `max-width: 82ch` | dark skin: unfocused `oklch(.845 .017)` #c1d0cc, active `oklch(.79 .02)` | **unfocused ink is brighter than the site** (#c1d0cc vs #aebfbb); ink changes on focus | one ink for dark = `#aebfba` (D-06 matches this site colour exactly); remove colour from the 590 rule |
| **broadcast** (Сводка + Квесты, Текст карточки; broadcasts -> dark) | `.broadcast-card-copy` css:439 `color: oklch(.76 .022 …)`, card bg `rgba(255,255,255,.018)` (416); `.broadcast-card.important` bg `var(--teal-soft)` (436); font 15px/1.7 `--doc`. Quest toast shows the same body at 14px/1.6, 3-line clamp (`.quest-toast-body`, css:475) | dark skin | ink #c1d0cc/#aebfbb vs #a3b6b2 | ink `oklch(.76 .022 …)`; note: D-06 `#AEBFBA` is not exactly the site colour here (see Open Question 1) |
| **trash** (Корзина: текстовый файл и текст вируса; recycle -> light) | `.trash-formatted-text` css:752 `color: #1c211f` inside `.trash-text-document` bg `#eeeee9` (749); font 14px/1.75, mobile 12px/1.65 (1155) | light skin | ink #252827 vs #1c211f; bg #f3f1e9 vs #eeeee9 | ink `#1c211f`, bg `#eeeee9` |
| **caption** (Корзина: описание фото; **recycle -> LIGHT, wrong**) | `.trash-image-document figcaption` css:755 `color: oklch(.793 .021 …)` on `.trash-image-document` bg `oklch(.196 .018)` (753) -> a DARK surface; font 14px/1.65; `padding: 10px 6px 2px` | light skin (tab default) | **wrong surface**: black text on light vs light text on dark | derive native surface from area (`caption` = dark); ink `oklch(.793 .021 …)`, bg `oklch(.196 .018 …)` |
| **search** (Рекомендации поиска; search -> dark) | `.search-recommendations button` css:276 pill: `color: oklch(.612 .03 …)`, bg `rgba(255,255,255,.015)`, border, `padding: 5px 8px`, on `.global-search-app` gradient (246); font `11px var(--sans)` | dark skin, font paired | ink #c1d0cc vs #718a84 (much brighter); no pill | ink `oklch(.612 .03 …)`, bg = global-search gradient colour `oklch(.206 .019 …)`. Pill chrome per line is not reproducible in one contenteditable: accept as documented limit |
| **assistant** (4 fields: советы / обида / бездействие / активность; assistant -> dark) | `.assistant-formatted-text` css:795 `color: oklch(.97 .012 …)`, `text-shadow`, bg `rgba(0,0,0,.34)` on bubble `oklch(.179 .019 …/.98)` with `filter: brightness(.7)` (791); font 700 10px Segoe/Arial, `letter-spacing: .099em`, `line-height: 1.4` (798); **spans' colour, font-size and font-weight are `!important`-overridden** (796, 798), only background survives | `font: 700 10px/1.5 var(--assistant-font)` (602), dark skin | ink; line-height 1.5 vs 1.4; no letter-spacing; **editor shows run colour/size/weight that the site discards** | pair font incl. `letter-spacing: .099em; line-height: 1.4`; ink `oklch(.97 .012 …)`; bg `#050d0c`; add `[data-area="assistant"] span { color: inherit !important; font-size: inherit !important; font-weight: inherit !important }` so the field shows what the site shows (and tell the owner those three controls do nothing for the assistant; background still works) |

### Other differences worth knowing
- Site `FormattedText` (portia-desktop.tsx:1779) applies exactly `color`, `fontSize`, `fontWeight`, `backgroundColor` (via `documentBackground`); the editor's `renderRichTextEditor` (editor.tsx:392-412) applies the same four props. Run styling is therefore equivalent; only the surroundings differ.
- Site turns `https://…` into an `<img>` (GIF); the editor shows the URL text. Not a style issue; leave.
- Mobile font overrides exist for lead (1058), info (1095), trash (1155) and are already paired. Nothing else changes size on mobile.

### Recommended mechanism (extends the existing "one rule per area" decision of phase 1)
1. In `:root` (or the paired rules) define per-area tokens once and use them from BOTH the site selector and the field: e.g. `--ink-lead: oklch(.363 .017 var(--accent-hue));` then `.lead-copy { color: var(--ink-lead) }` and `.formatted-rich-input[data-area="lead"] { --field-ink: var(--ink-lead) }`. One edit then moves site and editor together (no drift).
2. Make the field read two variables: `.formatted-rich-input { color: var(--field-ink); background: var(--field-bg); }` with defaults per surface: dark `--field-ink: #aebfba; --field-bg: oklch(.168 .014 var(--accent-hue))`, light `--field-ink: oklch(.237 .015 var(--accent-hue)); --field-bg: #f3f1e9` (D-06/D-07 generic colours). Delete `color`/`background` from the focus/active rules (589-590, keep border and box-shadow) so the ink no longer changes on focus.
3. Area overrides apply only on the area's native surface: `.formatted-rich-input[data-area="lead"].preview-light { --field-ink: …; --field-bg: …; }` (specificity (0,3,0) > surface rule (0,2,0), no order dependence). If the owner toggles to the opposite surface, the field falls back to the generic D-06/D-07 colours — the BELЫЙ/ЧЁРНЫЙ toggle keeps its meaning ("what does this text look like on white/black").
4. Default surface from the area, not the tab: `const nativeSurface: Record<DisplayArea, EditorPreviewSurface> = { lead:"light", metric:"light", mutation:"light", scientist:"light", trash:"light", info:"dark", broadcast:"dark", caption:"dark", search:"dark", assistant:"dark" }`. Change `previewSurface` state to `EditorPreviewSurface | null` (null = each field's own), have `FormattedTextarea` use `activeFormat.surface ?? nativeSurface[area]`, set it to `null` in `showTab` (editor.tsx:754) instead of the tab rule, and carry `area` on `FormatTarget` so the panel buttons show the effective surface. This also fixes caption inside the Recycle tab.

## 2. D-01/D-02: how the style helpers work, detect "already applied", toggle off

[VERIFIED: components/portia-editor.tsx:368-384, 421-424] verbatim:
- `function applyRichTextStyle(document, start, end, style) { … const from = start === end ? 0 : Math.min(start, end); const to = start === end ? text.length : Math.max(start, end); const styles = expandStyles(document); for (let index = from; index < to; index += 1) styles[index] = { ...styles[index], ...style }; return compactRuns(text, styles); }`
- `resetRichTextStyle` is identical but sets `styles[index] = {}`.
- `richTextStyleAt(document, position)` returns the per-character style at `position` (clamped), i.e. only the FIRST character of a selection (panel passes `target.selection.start`, editor.tsx:1883).
- Storage model: per-character `RichTextStyle[]` expanded from runs, re-compacted by `compactRuns` (301-311). `sameStyle` compares by `JSON.stringify` (editor.tsx:~293), so key ORDER matters: `{color,fontWeight}` and `{fontWeight,color}` are "different" styles and split runs needlessly. Not a correctness bug, but a toggle that deletes and re-adds keys can reorder them; canonicalise key order in `compactRuns` (sort keys) when extracting.

Panel wiring (editor.tsx:1939-1954): `commit(document)` = `documentRef.current = document; target.onCommit(target.value, document); onUpdate({ ...target, document })`. `applyStyle(style)` and `reset()` call it with the CURRENT `target.selection`. Because the readout and checkmarks come from `richTextStyleAt(target.document, target.selection.start)` (1883), they reflect the committed document.

Implement D-01/D-02:
- Preset row buttons call `commit(togglePreset(documentRef.current, from, to, stylePresets.x))`; «Обычный» calls `commit(resetRichTextStyle(doc, from, to))` and is never "active" (or is active when the range has no style at all: `rangeHasNoStyle`).
- Active highlight: `rangeHasStyle(target.document, from, to, preset)` (true only when EVERY character in the range has EVERY property of the preset; mixed selections show off and the click applies, like Word). Add `.format-choice-row > button.selected` already exists (css:629) — reuse class `selected`, plus `aria-pressed`.
- Toggle-off removes only the preset's keys (`removeRichTextStyleKeys`). Consequences to accept: removing «Жирный» (fontWeight 800) also removes the weight that «Заголовок» set; removing «Заголовок» removes fontSize AND fontWeight. This follows D-02 literally ("свойства этого стиля").
- Undo (D-11 phase 3): nothing special. `commit` -> `target.onCommit` -> `changeFormattedText` -> `changeDraft` -> `dispatch({type:"change", key: editKeyFor(document.activeElement)})` [VERIFIED: editor.tsx:645-647, 106-125; lib/editor-history.ts]. `editKeyFor` returns `field:N` keyed on the `.floating-text-format` ancestor of the active element, else on the active contenteditable; the reducer folds changes with the same key within 700 ms (`TYPING_PAUSE_MS`) and 1500 ms (`TYPING_SPAN_MS`) into ONE undo step. Therefore apply-then-remove inside 700 ms becomes a single undo step that undoes both (net zero) — acceptable; but if the panel buttons keep focus in the contenteditable (see §4 `mousedown` preventDefault), quick clicks also fold into the preceding typing step. Low severity; note for UAT, no code needed. `step()` (undo/redo) closes the panel (editor.tsx:649-657), so no stale-document issue.
- Redundant UI to remove: footer `СБРОСИТЬ` (`reset-format`, editor.tsx:1984) duplicates «Обычный»; the footer sentence "Изменения применяются сразу. Без выделения меняется весь текст." (1984) and the launcher hint "оставьте курсор без выделения, чтобы изменить весь текст." (957) must change with D-04.

## 3. D-04: no selection -> word under the caret

Where the old behaviour lives [VERIFIED: grep]: `components/portia-editor.tsx:370-371` and `379-380` (the two `start === end` ternaries), label `"ВЕСЬ ТЕКСТ"` at line 1936 (`selectionLabel`), footer text line 1984, launcher hint line 957. Nothing else (no other file mentions it).

Recommendation: **regex, not `Intl.Segmenter`.** Verified this session in Node: `new Intl.Segmenter("ru",{granularity:"word"}).segment("по-русски, ёлка")` yields `["по","-","русски",","," ","ёлка"]` — it splits hyphenated compounds, and results depend on ICU data per engine. The regex `/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu` keeps `по-русски`, handles `ё`, digits and apostrophes, and is deterministic across browsers and Node (code in Pattern 1). Behaviour: caret inside a word or touching either edge -> that word; caret after trailing punctuation or between spaces -> `null` -> no change (D-04). `3,5` becomes two words (comma not a joiner) — acceptable.

UI for "no selection" (discretion): header `small` shows `СЛОВО: «привет»` (truncate to ~12 chars) when a word resolves, `ВЫДЕЛИТЕ ТЕКСТ` when null; preset and style buttons get `disabled`/`aria-disabled` and the existing `.format-choice-row > button` dimming when `range === null` (add a `:disabled { opacity:.4 }` rule; css:628 has none). Highlight the resolved word on the phone too: the panel effect currently paints only when `!collapsed` (editor.tsx:1905-1907); change it to paint the effective range.

## 4. D-05: why the phone selection disappears and the fix

What the code does [VERIFIED: portia-editor.tsx]:
- `selectionOffsets(root)` returns `{ start: 0, end: 0 }` both when there is no selection and when the selection is outside the field: `if (!selection?.rangeCount) return { start: 0, end: 0 }; … if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return { start: 0, end: 0 };` (426-430). Zero-zero is indistinguishable from a real caret at the start.
- `activate` writes whatever that returns into the panel's target unconditionally (1795-1799); it is bound to `onFocus`, `onSelect`, `onMouseUp`, `onKeyUp` (1836-1850).
- A style commit changes the document, so `useLayoutEffect` calls `renderRichTextEditor(editor, currentDocument)` (1815-1821), whose last line is `root.replaceChildren(fragment)` (411): every text node is replaced and the DOM selection collapses to the field root. It then calls `restoreSelection`, which returns immediately unless `window.document.activeElement === root` (484-485).
- Phone mode deliberately blurs the field once on open (`findFormatField(...).blur()`, 949), and the field has `inputMode="none"` while the panel is open (1831).

Mechanism (hypothesis, MEDIUM confidence — code paths are verified, device event order is [ASSUMED]): after the first tap the DOM selection is gone or collapsed at the root. React's `onSelect` for a contentEditable fires from `selectionchange`/`mouseup` while it still tracks the field as the active element; `selectionOffsets` then reads the collapsed/absent selection as `{0,0}`; `activate` stores it; the next tap sees `start === end` and (today) formats the whole field. The stored `target.selection` is only ever overwritten through `activate`, which is why the first tap works and the second does not. The CSS highlight disappears because the panel effect rebuilds the painted range from that now-collapsed selection (and paints nothing when collapsed, 1907).

Fix (all four, small; the first two alone are probably sufficient, the others are belt and braces):
1. `selectionOffsets` returns `null` when `rangeCount === 0` or the range is outside the root; `activate` ignores `null` (keeps the previous target). Keeps `{0,0}` only for a genuine caret.
2. After `renderRichTextEditor` in the re-render effect, ALWAYS restore the DOM selection from `selectionRef.current`, not only when the field is focused (add a `force` argument to `restoreSelection`, or inline `getSelection().removeAllRanges(); addRange(rangeFromOffsets(...))` in that effect). Setting a Selection does not focus, so there is no keyboard side effect; afterwards any `selectionchange` reads back the same offsets.
3. Panel-side: `onMouseDown={(e) => e.preventDefault()}` on the panel `<section>` for everything that is not an `<input>` (range slider, HEX field) so a tap on a style button does not move focus or collapse the selection (the launcher already does `onPointerDown={(event) => event.preventDefault()}`, editor.tsx:~948; use `mousedown`, which is the event whose default action moves focus).
4. Make the panel own its range for the duration of a session: hold `rangeRef = useRef(resolveRange(...))` updated only from `target.selection` changes that are non-collapsed or come from a new `formatKey`; a collapsed `{0,0}` arriving without a preceding pointer/key event in the field is ignored. (Only if 1-3 fail on device.)
Verification requires a phone (or the headless-Edge CDP touch harness that the earlier debug session used, `.planning/debug/resolved/format-panel-select-closes.md`). Add a manual UAT item: select a word, tap «Жирный», «Важно», «Заголовок» three times in a row; the highlight must stay on the same word each time.

The panel effect (1900-1922) already depends on `formatDocument`, so after every commit it recreates `new Highlight(range)` on the fresh text nodes — keep that, and feed it the effective range (word or selection).

## 5. D-06..D-08: palette, defaults, fixed hex vs accent

Current [VERIFIED: portia-editor.tsx:85-93, 1879]:
```
const textColorPalette = [ { value: "#252827", label: "Графит" }, { value: "#d4e0dd", label: "Светлый" }, { value: "#0b7568", label: "Portia" }, { value: "#167a4d", label: "Зелёный" }, { value: "#a06f00", label: "Янтарный" }, { value: "#b43632", label: "Красный" }, { value: "#316e9b", label: "Синий" } ];
const defaultTextColor = previewSurface === "dark" ? "#aebfba" : "#252827";
```
`defaultTextColor` only feeds the readout and swatch "selected" state (1884, 1964); the real unstyled colour in the field is CSS (css:586/588/589/590, quoted in §1). So D-08(a) is a CSS change (§1 step 2), not a React change.

Recommendation for «Основной» (D-08 b): make it the first swatch with semantics **"remove the colour property"**, not "store a hex". Reasons: (i) D-08(c) keeps existing stored colours untouched; (ii) the CONTEXT discretion note says unstyled text already takes its colour from the area's CSS on the site; (iii) a stored `#17211f` painted into an info/broadcast/assistant text would be near-invisible on the dark site (those areas are `#aebfbb`/`#a3b6b2`/`#edf8f5`), and a stored `#aebfba` would be washed out on the light dossier — the palette is surface-dependent but the site area is not. Implementation: item `{ value: null, label: "Основной" }`; its click does `removeRichTextStyleKeys(doc, from, to, ["color"])`; it is `selected` when `style.color === undefined`; the swatch shows the surface colour (dark `#aebfba`, light `oklch(.237 .015 var(--accent-hue))` via inline `backgroundColor`), the readout shows `ОСНОВНОЙ`. Drop «Графит» and «Светлый» from the palette; already-saved runs with those hexes keep rendering and show as custom colours.

D-07 fixed hex vs accent: use the accent-following `oklch(.237 .015 var(--accent-hue))` in CSS for the field (single source with `.class-cell strong`, css:872); a hex is only needed where a swatch shows a literal, and there the inline `oklch()` is accepted by the browsers this app already targets (the CSS is full of `oklch`). D-06 stays a fixed hex `#aebfba` (it already equals `oklch(.79 .02 …)` at the default accent). Note the computed value of the D-07 colour is `#17211f`, not `#1f2725` (see §1).

## 6. D-10/D-11: dragging the panel

Desktop window drag [VERIFIED: portia-desktop.tsx:1579-1610]: title bar `onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}`; `beginDrag` returns early when `state.maximized || window.matchMedia("(max-width: 900px)").matches` or the target is inside a `button`; then `event.currentTarget.setPointerCapture(event.pointerId)`, stores `{x,y,startX,startY,parentWidth,parentHeight}`; `moveDrag` calls `paint(dragGeometry(...))` which writes `style.left/top` directly on the element (no React render during the drag); `endDrag` commits the final geometry. `dragGeometry`/`fitGeometry` live in `lib/window-geometry.ts` (with tests in `lib/window-geometry.test.ts`).

Where the panel lives [VERIFIED: css:480, 606]: `.floating-text-format { position: fixed; z-index: 130; right: 14px; bottom: 50px; … }` and at `min-width: 901px` `.content-editor > .floating-text-format { position: absolute; right: 14px; bottom: 72px; max-height: min(390px, calc(100% - 46px - 72px - 14px)); }`. `.content-editor` itself is not positioned (css:444 sets only `overflow-y:auto; display:flex …`), so the panel's containing block is `.app-window` (`position: absolute`, css:188). It does not scroll with the editor content and its drag area is the editor window. The panel is mounted as `<FloatingTextFormatPanel key={formatTarget.key} …>` (editor.tsx:1304) — it REMOUNTS whenever the target field changes, so position state must be read from storage on mount (a lazy `useState` initialiser is safe: the editor only renders client-side, it already calls `window.matchMedia` during render, editor.tsx:914).

Recommended design:
- Handle = the existing `<header>` (`РЕДАКТОР ОФОРМЛЕНИЯ`). Add `onPointerDown/Move/Up/Cancel` identical in shape to `beginDrag/moveDrag/endDrag`, skipping `button` targets and the phone layout (`matchMedia("(max-width: 900px)")`: on phone the panel is fixed above the taskbar, not draggable). CSS: `header { cursor: grab; touch-action: none; user-select: none }` on desktop only.
- Position model: offsets from the window's bottom-right (`{right, bottom}`, defaults 14/72), because that is how the panel is anchored today and it survives window resize/maximise better than absolute x/y. During drag set `style.right/bottom` directly via ref; persist on pointer up.
- Pure helper (new `lib/panel-position.ts`): `clampPanelOffset(offset, panel:{width,height}, bounds:{width,height}, top = 46, margin = 8)` -> `{right,bottom}` keeping the panel fully inside `bounds` (window `clientWidth/clientHeight`) below the 46px title bar (the same 46px used in css:480 `calc(100% - 46px …)`). Also use it on mount and on `window` `resize` so a saved position that no longer fits is pressed to the nearest edge (D-11). Must handle bounds smaller than the panel (return margin).
- Storage: key `portia-format-panel-v1` (pattern: `portia-taskbar-order-v1`, `portia-desktop-shortcuts-v2`, `portia-broadcasts-read-signature-v1` — portia-desktop.tsx:131-137). Value `{"right":n,"bottom":n}`. Every access in try/catch; on read validate `typeof === "number" && Number.isFinite` (untrusted storage) before use, as the existing `parseSeenQuestIds`/settings readers do.
- Side effects to check: `.editor-window .content-editor:has(> .floating-text-format) > .editor-savebar { margin-top: 400px }` (css:484) reserves scroll room assuming the panel is at the bottom; leaving it is harmless when the panel is moved up.

## 7. D-12: phone layout and tab split «Цвет / Размер / Фон»

Current phone layout [VERIFIED: css:1126-1136, 1215-1226]: `.floating-text-format { right: 8px; bottom: 108px; width: min(620px, calc(100% - 16px)); max-height: min(34svh, 270px); display: flex; flex-direction: column; overflow: hidden; }`, header/footer `flex: none`, `.rich-text-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); flex: 1 1 auto; min-height: 0; overflow-y: auto; }`. At ≤520px header `small` is hidden and the footer sentence is hidden. All seven controls (surface, text colour, size, weight, background, opacity, plus the picker) share a 2-column scroller of about 34svh -> the controls are tiny and require scrolling.

Current control order (editor.tsx:1963-1982): surface toggle, Цвет текста, Размер, Толщина, Фон текста, Плотность фона, optional `CustomColorPicker`.

Recommended split (matches D-12; discretion on weight/surface):
- Always visible (above the tabs): preset row (4 buttons, D-01).
- «Цвет»: Цвет текста (swatches incl. «Основной», custom colour picker).
- «Размер»: Размер + Толщина.
- «Фон»: Фон текста + Плотность фона + Фон предпросмотра БЕЛЫЙ/ЧЁРНЫЙ (it is a background choice and sits with the other background controls).
Implementation with no `matchMedia` state: put `data-tab-group="color|size|background"` on each `.format-control`, keep `const [tab, setTab] = useState<"color"|"size"|"background">("color")` and set `data-tab={tab}` on `.rich-text-toolbar`; CSS `.format-tabs { display: none }` by default and inside `@media (max-width: 900px)` show it and hide controls not in the active group: `.rich-text-toolbar[data-tab="color"] .format-control:not([data-tab-group="color"]) { display: none }` (x3). Desktop keeps showing everything. Use `role="tablist"`/`role="tab"`/`aria-selected`. The tab state resets when the panel remounts for another field (acceptable; lift it to the parent only if the owner minds). Heights: header about 40 + presets about 40 + tabs about 36 + one control about 80 + footer about 44 fits `min(34svh, 270px)` on a 667px phone (227px) only if footer padding is kept tight — check at 375x667.
D-13 is unaffected: keep `phonePanelOpen`, the one-time `blur()` from ✎ (editor.tsx:949) and `inputMode="none"` (1831).

## 8. D-14 / D-15 / D-16: causes

### D-14 window animation [VERIFIED: css:1344-1356; portia-desktop.tsx:1633-1648, 1661, 847-865]
Verbatim keyframes: `.app-window { animation: window-open 280ms var(--ease-out); }`, `html[data-motion="full"] .app-window.from-icon { animation: window-zoom 340ms var(--ease-out); }`, `… .is-closing { animation: window-close 180ms var(--ease-in) forwards; }`, `@keyframes window-open { from { opacity: 0; scale: .93; translate: 0 18px; } }`, `@keyframes window-zoom { from { opacity: 0; scale: .3; } 55% { opacity: 1; } }`, `@keyframes window-close { to { opacity: 0; scale: .92; } }`.

`AppWindow`'s `useLayoutEffect` sets `element.style.transformOrigin = \`${Math.round(x)}px ${Math.round(target.y - box.top)}px\`` to the icon/taskbar button centre, but only when a `target` exists: `let target = state.openOrigin?.kind === "icon" && !state.exiting ? state.openOrigin : undefined; if (towardTaskbar) {…} if (!target) return;`. On a normal CLOSE, `state.exiting === "close"` makes `target` undefined and the effect returns WITHOUT resetting the origin, so the inline `transform-origin` still points at the desktop icon while `window-close` runs `scale: .92`. Scaling a big window by 8% around a point far from its centre translates the whole window toward/away from that point -> the visible "сдвигается при закрытии". On open from an icon, `window-zoom` scales from `.3` around the same far-away point on a 800-1100px window, which reads as the window being stretched out from a corner. The default `window-open` (`scale .93` + `translate 0 18px`, start menu/search) is also a visible scale of the whole content. Confidence: HIGH for the stale-origin close drift (follows from the code), MEDIUM that open "stretch" is the owner's description of zoom (cannot view a browser here).

Recommended fix (minimum): (1) in that effect, when `state.exiting === "close"` (or `!target`) do `element.style.transformOrigin = ""` before returning, so close scales around the window centre; (2) soften: `window-open` `from { opacity: 0; scale: .985; translate: 0 8px }`, `window-close` `to { opacity: 0; scale: .985 }`, and make `window-zoom` start at about `.86` with opacity (no `.3`); keep minimise/restore-to-taskbar (`window-minimize`, `window-restore`) as they are, since D-14 names only open and close and their origin is correct (`towardTaskbar`). The reduced-motion branch (`fade-in`/`fade-out`) already has no scale. Keep `WINDOW_CLOSE_MS = 180` in sync with the CSS duration (portia-desktop.tsx:35 comment). Owner should eyeball the result.

### D-15 «Информация» sub-section cards [VERIFIED: css:318-334, 1088-1092; portia-desktop.tsx:1234]
JSX: `<div className="info-subsections">…<button …><small>01.1</small><span>НОВЫЙ ПОДРАЗДЕЛ</span></button></div>` inside `<aside className="info-index">`. Rules: `.info-index button { display: grid; grid-template-columns: 30px minmax(0,1fr); align-items: start; gap: 9px; padding: 12px 9px; border: 1px solid transparent; … }` (320), `.info-subsections { margin: 2px 0 6px 20px; padding-left: 8px; border-left: 1px solid … }` (329), `.info-index .info-subsections button { padding: 8px 9px; }` (333), `… span { font-size: 12px; }` (334). The index column is `minmax(210px, 28%)` (316) with `padding: 25px 14px` (318); after the sub-list indent (20+8), button padding (18) and the 30px+9px grid columns only about 95-100px remains for the title, so a 15-character title wraps to two lines, and the `small` "01.1" (11px mono, 4 chars) is wider than its 30px column. Result: tall, narrow, multi-line cards. Phone: `.info-index button { flex: 0 0 190px }` (1090) applies to the sub-buttons too.
Fix: `.info-subsections { margin-left: 10px; padding-left: 6px; }`; `.info-index .info-subsections button { grid-template-columns: auto minmax(0,1fr); gap: 6px; align-items: center; padding: 5px 8px; min-height: 0; }`; `.info-index .info-subsections button span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; line-height: 1.3; }` + `title={sub.title}` on the button; `small { white-space: nowrap }`. Result: one text line, about 28-30px high.
(The editor's own `.info-subsection-list` (css:339) is a different thing: the editor's nested cards; D-15's screenshot is the site window `PORTIA://INFORMATION`, path from portia-desktop.tsx:58.)

### D-16 Настройки -> «Содержимое сайта» [VERIFIED: css:307-311, 1138-1140; portia-desktop.tsx:1316]
Desktop rule: `.content-control-entry { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px 24px; … }`, `.content-control-entry > div:first-child { flex: 1 1 260px; min-width: 0; }`. Phone rule (inside `@media (max-width: 900px)`, css:1138): `.content-control-entry { align-items: stretch; flex-direction: column; }`. Cause: switching to `flex-direction: column` turns the first child's `flex-basis: 260px` into a 260px HEIGHT, so the text block is forced to 260px tall with the buttons pushed below -> the big empty area. HIGH confidence (CSS flexbox semantics). Fix: inside the same media rule add `.content-control-entry > div:first-child { flex: 0 0 auto; }` (or `flex: none`). On desktop the block wraps by content and is unaffected.

## 9. Existing tests and verification commands

- Runner: `node --experimental-strip-types --test lib/*.test.ts` (`node:test`, `assert/strict`); tests import with relative `.ts` extensions (`import … from "./window-geometry.ts"`); `allowImportingTsExtensions` is on [VERIFIED: tsconfig.json:30]. Library files must use `import type` for types. 154 tests pass today.
- Gate used by previous phases [VERIFIED: 03.3-01-PLAN.md:259]: `npm test && npx tsc --noEmit && npm run lint && npm run build`. `npm run check` = `npm test && npm run build && npm run lint`.
- Pure helpers that deserve unit tests (all new/moved into `lib/`):
  - `wordRangeAt`: `"привет мир"` caret 0/3/6 -> `{0,6}`; caret 7 (after the space) -> `{7,10}`; `"по-русски"` -> whole; `"ёлка, мир"` caret 5 (after comma) -> null; `""` -> null; caret at text end touching a word -> that word; digits `"v2 test"`.
  - `resolveRange`: selection returned as ordered `[from,to)` even when reversed; collapsed delegates to `wordRangeAt`.
  - `rangeHasStyle` / `togglePreset`: preset applied -> second toggle removes only its keys and leaves colour/background; mixed selection -> applies; removing leaves `style` absent on runs (no empty `style: {}`); run merging after removal.
  - `applyRichTextStyle`/`resetRichTextStyle` with explicit range: `from===to` is a no-op (the D-04 regression test); text never changes.
  - `removeRichTextStyleKeys(["color"])` for «Основной».
  - `clampPanelOffset`: inside bounds unchanged; beyond each edge pressed to the margin; bounds smaller than the panel; below the 46px title bar.
- Not unit-testable (manual UAT): CSS tokens/WYSIWYG, phone selection persistence, animations, tabs. Use the existing headless-Edge CDP touch harness idea (debug note above) or a device.
- Nyquist validation: `.planning/config.json` has `"nyquist_validation": false`, so no formal Validation Architecture section is produced.

## Common Pitfalls

### Pitfall 1: Setting a style key to `undefined`
**What goes wrong:** `compactRuns` emits a `style` object for any run whose style has keys, even `{color: undefined}`; `JSON.stringify` then drops it on save, but `sameStyle` and history diffs see churn.
**How to avoid:** `delete styles[i][key]`. Test: toggling off leaves the document `deepEqual` to the original.

### Pitfall 2: `selectionOffsets` conflating "no selection" with "caret at 0"
**What goes wrong:** the phone bug of §4; also any future code reading it after a re-render.
**How to avoid:** return `null` for absent/outside; callers decide.

### Pitfall 3: Panel remount per field
**What goes wrong:** `key={formatTarget.key}` (editor.tsx:1304) resets any `useState` inside the panel (tab, colour picker, position) when the user taps another field.
**How to avoid:** read position from storage in the initialiser; accept tab reset or lift it to `ContentEditor`.

### Pitfall 4: CSS specificity between surface and area rules
**What goes wrong:** the existing focus/active rules (0,3,0) beat the area rules (0,2,0), producing the unfocused/active colour jump.
**How to avoid:** variables (`--field-ink/--field-bg`), set in rules of specificity ≥ (0,3,0) for area+surface, and delete `color`/`background` from the focus/active rules.

### Pitfall 5: Assistant overrides are `!important` on the site
**What goes wrong:** the owner colours/sizes assistant text and nothing changes on the site (`.assistant-formatted-text > span { color … !important }`, `… * { font-size: 10px !important; font-weight: 700 !important }`).
**How to avoid:** mirror the override in the field CSS, or hide the three controls for that area; confirm with the owner (Open Question 3). The offended state also recolours spans to `#ffd98c !important` (css:800); mention in the field hint rather than simulate.

### Pitfall 6: «M» size is an explicit 17px
**What goes wrong:** `fontSize = style.fontSize ?? 17` (editor.tsx:1885) shows «M» as selected for unstyled text, but areas default to 14, 15, 16 or 17px; pressing «M» on a 14px metric block makes it bigger. Not in D-01..D-16; flag only if the owner reports unpredictability.

### Pitfall 7: Window-origin effect leaves inline `transform-origin`
Covered in §8 D-14. Always reset on close.

## Code Examples

### Panel: effective range and preset row (shape)
```tsx
// inside FloatingTextFormatPanel (editor.tsx:1872)
const text = target.document.runs.map((run) => run.text).join("");
const range = resolveRange(text, target.selection);            // {from,to} | null
const apply = (style: RichTextStyle) => range && commit(applyRichTextStyle(documentRef.current, range.from, range.to, style));
const presetActive = (preset: RichTextStyle) => range ? rangeHasStyle(target.document, range.from, range.to, preset) : false;
const togglePresetClick = (preset: RichTextStyle) => range && commit(togglePreset(documentRef.current, range.from, range.to, preset));
// «Обычный»: range && commit(resetRichTextStyle(documentRef.current, range.from, range.to))
// phone highlight: paint `range` (word or selection), not only non-collapsed selections
```

### Draggable header (shape; mirrors AppWindow.beginDrag/moveDrag/endDrag)
```tsx
const dragRef = useRef<{ pointerId: number; startX: number; startY: number; right: number; bottom: number } | null>(null);
const begin = (e: React.PointerEvent<HTMLElement>) => {
  if (window.matchMedia("(max-width: 900px)").matches || (e.target as HTMLElement).closest("button")) return;
  const panel = panelRef.current, parent = panel?.offsetParent as HTMLElement | null;
  if (!panel || !parent) return;
  e.currentTarget.setPointerCapture(e.pointerId);
  dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
    right: parent.clientWidth - panel.offsetLeft - panel.offsetWidth, bottom: parent.clientHeight - panel.offsetTop - panel.offsetHeight };
};
// move: offset = clampPanelOffset({ right: d.right - dx, bottom: d.bottom - dy }, { width: panel.offsetWidth, height: panel.offsetHeight }, { width: parent.clientWidth, height: parent.clientHeight });
//       panel.style.right = `${offset.right}px`; panel.style.bottom = `${offset.bottom}px`;
// end:  try { localStorage.setItem("portia-format-panel-v1", JSON.stringify(offset)); } catch {}
```

### D-14/D-16 CSS (shape)
```css
/* D-16, inside the existing @media (max-width: 900px) block near css:1138 */
.content-control-entry > div:first-child { flex: 0 0 auto; }
/* D-14 */
@keyframes window-open { from { opacity: 0; scale: .985; translate: 0 8px; } }
@keyframes window-close { to { opacity: 0; scale: .985; } }
```
```ts
// D-14 in AppWindow's layout effect, before `if (!target) return;`
if (!target) { element.style.transformOrigin = ""; return; }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Highlight a selection with DOM `<mark>` overlays | CSS Custom Highlight API (`CSS.highlights`, `::highlight()`) | Chrome 105, Safari 17.2, Firefox 140 [ASSUMED: training knowledge, not re-checked this session] | Already adopted by this repo (css:505); guard with `"highlights" in CSS` as the panel already does (editor.tsx:1907) |
| `Intl.Segmenter` for words | Still fine, but splits hyphen compounds | n/a | Use regex for this app (verified in Node) |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | On the owner's phone, the selection is lost because React's `onSelect` fires from `selectionchange`/`mouseup` after `replaceChildren` and `selectionOffsets` reads the empty selection as `{0,0}` | §4 | Fix 1+2 may not be sufficient; fixes 3+4 and a device UAT cover it |
| A2 | «Основной» should REMOVE the colour property rather than store a hex | §5 | If the owner wants a literal stored colour, text could be invisible on the opposite-surface site area; the change is one line (store hex instead) |
| A3 | Per-area ink/background (WYSIWYG, D-09) takes precedence over the generic D-06/D-07 colours on an area's native surface; D-06/D-07 apply as the generic skins and when the toggle flips to the opposite surface | §1, Open Q1 | Owner may expect D-06/D-07 exactly in every field (then broadcast #a3b6b2 and lead #34413e would not match the site) |
| A4 | The 8% close scale around a stale icon-origin is what the owner sees as "сдвигается", and `window-zoom` .3 as "растягивается" | §8 | Visual cause could differ; owner must eyeball after the fix |
| A5 | D-15's offending view is the site window `PORTIA://INFORMATION` (`.info-index .info-subsections button`), cause = narrow wrapped column plus padding | §8 | If the owner meant the editor's nested cards (`.info-subsection-list`), the target CSS is `.nested-editor-card` (css:546) instead |
| A6 | Custom Highlight API support ranges (Chrome 105 / Safari 17.2 / Firefox 140) | State of the Art | Only affects the `"highlights" in CSS` fallback, which already exists |
| A7 | Mouse-down `preventDefault` keeps focus and selection on iOS/Android Chrome taps | §4 fix 3 | If a platform ignores it, fixes 1+2 still hold |

## Open Questions

1. **D-06/D-07 vs D-09 conflict on the dark/light "основной" colour.**
   - Known: site ink differs per area (#34413e lead, #36413e metric, #4d5956 mutation, #252827 scientist, #1c211f trash on light; #aebfbb info, #a3b6b2 broadcast, #aec0bc caption, #718a84 search, #edf8f5 assistant on dark). D-07 says white = classification colour (#17211f computed).
   - Unclear: whether the owner wants the generic D-06/D-07 colours in every field, or the area's own colour on the area's own surface.
   - Recommendation: area colour on native surface, D-06/D-07 generic otherwise; state this in the plan and confirm at UAT.
2. **Is «Основной» a stored hex or "no colour"?** Recommendation: no colour (A2).
3. **Assistant controls that the site ignores (colour, size, weight).** Recommendation: mirror the override in the field (WYSIWYG) and add a one-line hint; do not remove controls (D-03 says nothing is removed).
4. **Mobile weight / surface placement** (discretion): recommended «Размер» = size + weight, «Фон» = background + opacity + preview surface.
5. **Does the owner want a pill look for «Рекомендации поиска» in the field?** Recommendation: no (one contenteditable, cannot render per-line pills); match ink and background only.

## Environment Availability

Skipped: no external services or tools beyond Node/npm already in use (Node v24.21.0 locally, `engines` `>=22.13.0 <23`; `npx tsc` and `eslint` present via devDependencies). A phone or the Edge/CDP harness is needed only for manual UAT of D-05.

## Security Domain

`security_enforcement` is on (ASVS level 1, block on high).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2/V3/V4 Auth, session, access | no | No change; editor access stays as is |
| V5 Input Validation | yes | Colours stay `#RRGGBB`: client picker regex `/^#[0-9A-F]{6}$/` (editor.tsx:2033) and server `normalizeHexColor` (`portia-content-normalize.ts:50`); `fontSize` clamped 10-48 and `fontWeight` allow-list `[400,500,600,700,800,900]` (`portia-content-normalize.ts:54-55`) — presets use 22/800/600, all valid |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered `localStorage` (`portia-format-panel-v1`) | Tampering | `try/catch`, `JSON.parse` result checked with `Number.isFinite`, clamped by `clampPanelOffset`; value only used as CSS pixels, never as HTML |
| Rich text injected via paste | Tampering/XSS | Existing: paste handler takes `text/plain` only and rendering uses `textContent`/`style` properties, never `innerHTML` (editor.tsx:397-405, 1852-1861); keep it that way |
| Unsanitised style values reaching the site | Tampering | Server normaliser already drops non-hex colours and clamps sizes; do not widen `RichTextStyle` |

## Sources

### Primary (HIGH confidence — files read this session)
- `components/portia-editor.tsx` (lines 36-105, 278-512, 575-600, 700-760, 905-962, 1300-1306, 1775-2043)
- `components/portia-desktop.tsx` (25-62, 785-872, 1205-1330, 1560-1670, 1745-1830)
- `app/portia.css` (1-72, 186-205, 246-345, 416-496, 500-512, 574-660, 723-760, 782-801, 862-945, 1006-1230, 1335-1372)
- `lib/portia-content.ts`, `lib/portia-content-normalize.ts` (style fields), `lib/window-geometry.ts`, `lib/editor-history.ts`, `package.json`, `tsconfig.json`, `.planning/config.json`
- `.planning/debug/resolved/format-panel-select-closes.md`, `.planning/phases/PORTIA-03-redaktor/03-07-SUMMARY.md` (phone panel history)
- Runs: `npm test` (154 pass), `npx tsc --noEmit` (clean, with the regex probe), `node --experimental-strip-types` regex probe, `Intl.Segmenter` probe, oklch -> hex conversion script.

### Secondary / Tertiary
- No web research was needed; Custom Highlight API support versions are training knowledge ([ASSUMED], A6).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nothing new to install.
- Architecture / D-09 table / D-04 / D-06..D-08 / D-10..D-12 / D-15 / D-16: HIGH — read from source.
- D-05 mechanism: MEDIUM — verified code path, device order assumed.
- D-14 cause: MEDIUM-HIGH — CSS/JS semantics verified, no browser run.
- Pitfalls: HIGH.

**Research date:** 2026-10-19
**Valid until:** 2026-11-18 (stable codebase; re-check line numbers if `portia-editor.tsx` or `portia.css` change before planning)
