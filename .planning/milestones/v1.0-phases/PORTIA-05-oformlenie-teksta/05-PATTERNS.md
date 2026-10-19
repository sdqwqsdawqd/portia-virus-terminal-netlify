# Phase 5: Оформление текста - Pattern Map

**Mapped:** 2026-10-19
**Files analyzed:** 8
**Analogs found:** 8 / 8 (all tracked in git)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `lib/rich-text-style.ts` (new: word bounds, toggle/clear style, row styles) | utility (pure) | transform | `applyRichTextStyle`/`resetRichTextStyle` in `components/portia-editor.tsx:368-383` (to move out) + `lib/window-geometry.ts` | role-match |
| `lib/rich-text-style.test.ts` (new) | test | transform | `lib/window-geometry.test.ts` | exact |
| `lib/panel-position.ts` (new: clamp + parse saved) | utility (pure) | transform | `lib/window-geometry.ts` (`fitGeometry`, `dragGeometry`) | exact |
| `lib/panel-position.test.ts` (new) | test | transform | `lib/window-geometry.test.ts` | exact |
| `components/portia-editor.tsx` (`FloatingTextFormatPanel` ~1872) | component | event-driven | itself; drag from `AppWindow.beginDrag` | exact |
| `components/portia-desktop.tsx` (window animation, if class logic touched) | component | event-driven | itself | exact |
| `app/portia.css` (panel, tabs, WYSIWYG areas, animations, info cards, `.content-control-entry`) | config (CSS) | n/a | `.formatted-rich-input[data-area=...]` rules (~602), `.floating-text-format` (606-609) | exact |
| localStorage key `portia-text-panel-position-v1` (in editor) | persistence | CRUD | `taskbarOrderStorageKey` effects in `portia-desktop.tsx:585-606` | exact |

## Pattern Assignments

### `lib/panel-position.ts` + test (utility, transform)

**Analog:** `lib/window-geometry.ts` (46 lines). Pure functions, no React, `.ts` imports in tests, doc comment per function, module-level `const margin = 8`.

```ts
const margin = 8;
/** Keeps a window fully inside the workspace; ... */
export function fitGeometry(geometry: WindowGeometry, bounds: Bounds, minimum: Bounds): WindowGeometry {
  const x = Math.min(Math.max(margin, geometry.x), bounds.width - width - margin);
  ...
  return { x: Math.max(0, x), y: Math.max(0, y), width, height };
}
export function dragGeometry(start, dx, dy, bounds) {
  return { x: Math.min(Math.max(0, start.x + dx), Math.max(0, bounds.width - 160)), ... };
}
```
Reuse `Bounds` type from it. For D-10 the panel must NOT leave the screen (unlike `dragGeometry`, which lets a window go off-screen except 160px): use `fitGeometry`-style clamp with `width/height` = panel size. Saved value from localStorage must be validated (finite numbers) then clamped (D-11).

**Test pattern** (`lib/window-geometry.test.ts:1-12`):
```ts
import test from "node:test";
import assert from "node:assert/strict";
import { dragGeometry, fitGeometry, resizeGeometry } from "./window-geometry.ts";
test("a window opened on a big screen shrinks into a small one", () => {
  const fitted = fitGeometry({ x: 200, y: 100, width: 1120, height: 760 }, { width: 960, height: 600 }, minimum);
  assert.deepEqual(fitted, { x: 8, y: 8, width: 944, height: 584 });
});
```
Run: `npm test` = `node --experimental-strip-types --test lib/*.test.ts` (so lib files need explicit `.ts` import extensions for relative imports, and no TS-only syntax like enums/param properties).

### `lib/rich-text-style.ts` (utility, transform)

**Analog:** current code in `components/portia-editor.tsx` (not yet in lib; types in `lib/portia-content.ts:7`).

Current whole-field fallback to REMOVE (D-04), lines 368-383:
```ts
function applyRichTextStyle(document: RichTextDocument, start: number, end: number, style: RichTextStyle) {
  const text = document.runs.map((run) => run.text).join("");
  const from = start === end ? 0 : Math.min(start, end);
  const to = start === end ? text.length : Math.max(start, end);
  const styles = expandStyles(document);
  for (let index = from; index < to; index += 1) styles[index] = { ...styles[index], ...style };
  return compactRuns(text, styles);
}
function resetRichTextStyle(...)  // same shape, styles[index] = {}
function richTextStyleAt(document, position) { const styles = expandStyles(document); return styles[clamp] ?? {}; }
```
Planner note: `expandStyles` / `compactRuns` are private to the editor file (grep before moving; if moving, export them or keep new helpers in the editor). Toggle (D-02): "active" = every char in range has all of the style's props equal; clearing = delete only those keys (D-18: Основной swatch = delete `color`). Word under caret (D-04): scan left/right from caret over `[\p{L}\p{N}_-]`-like chars (Cyrillic needs the `u` flag, `\p{L}`); caret between words returns empty range = no-op.

### `components/portia-editor.tsx` — `FloatingTextFormatPanel` (component, event-driven)

**Analog:** the existing component, lines 1872-1985.

Key hooks to extend:
- `defaultTextColor` (1879) and `textColorPalette` (~85-100): palette first cell becomes "Основной" that clears color (D-18); drop "Графит"/"Светлый".
- Commit path (keep as is, D-11 of phase 3 undo):
```tsx
const commit = (document: RichTextDocument) => {
  documentRef.current = document;
  target.onCommit(target.value, document);
  onUpdate({ ...target, document });
};
const applyStyle = (style: RichTextStyle) => commit(applyRichTextStyle(documentRef.current, target.selection.start, target.selection.end, style));
```
- `selectionLabel` (1941-1943) "ВЕСЬ ТЕКСТ" to be replaced (D-04).
- Footer text "Без выделения меняется весь текст." (last line) must be rewritten.
- Phone highlight effect (1895-1920) re-paints `CSS.highlights.set("portia-format", new Highlight(range))` from `selectionStart/End`; dependency `formatDocument` is there because a style change re-renders text nodes. D-05 fix: after each commit the selection offsets in `target` must be preserved (`onUpdate({ ...target, document })` already keeps `selection`, so look for where the field loses it: blur / `restoreSelection` guard `if (window.document.activeElement !== root) return;` at 484-490 and `findFormatField` at 492). Do not widen the whole-field fallback.
- Toolbar markup is a flat `<div className="rich-text-toolbar">` of `<div className="format-control">` groups; add the style-row as the first child, and for phone (D-12) wrap groups by tab state (`useState<"color"|"size"|"background">`), mobile check pattern: `window.matchMedia("(max-width: 900px)").matches`.
- Selected-state pattern: `className={fontSize === size ? "selected" : ""}` on buttons in `.format-choice-row`.

**Drag (D-10) analog:** `AppWindow.beginDrag/moveDrag/endDrag`, `components/portia-desktop.tsx:1584-1608`:
```tsx
const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
  if ((event.target as HTMLElement).closest("button")) return;   // do not start drag from the × button
  event.currentTarget.setPointerCapture(event.pointerId);
  dragRef.current = { ...geometry, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
};
const moveDrag = (event) => {
  const operation = dragRef.current;
  if (!operation || operation.pointerId !== event.pointerId) return;
  paint(dragGeometry(operation, event.clientX - operation.startX, event.clientY - operation.startY, {...}));
};
const endDrag = (event) => {
  if (dragRef.current?.pointerId !== event.pointerId) return;
  dragRef.current = null; /* persist final geometry */
};
```
Bound to header: `onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}`. Desktop only: skip when `matchMedia("(max-width: 900px)")` matches (panel is docked there, CSS at portia.css:480). Paint live via ref/style (`left/top`) and persist only on `endDrag`. The panel currently positions by `right: 14px; bottom: 50px` (portia.css:606): when a saved position exists switch to `left/top` with `right/bottom: auto`. Add `touch-action: none` on the header.

**localStorage pattern (D-11):** `portia-desktop.tsx:585-606` (and 541, 682):
```tsx
const taskbarOrderStorageKey = "portia-taskbar-order-v1";   // module const near line 131-137
let saved: unknown = [];
try { saved = JSON.parse(window.localStorage.getItem(taskbarOrderStorageKey) ?? "[]"); } catch {}
const restored = Array.isArray(saved) ? ... : [];            // validate shape, never trust
...
try { window.localStorage.setItem(taskbarOrderStorageKey, JSON.stringify(taskbarOrder)); } catch {}
```
Reading is done in an effect (SSR-safe, `window.setTimeout(..., 0)` to satisfy the lint rule on setState-in-effect, with `clearTimeout` cleanup), with a `*Loaded` flag so the write effect does not overwrite before restore. New key suggestion: `portia-format-panel-position-v1`.

### `app/portia.css` (CSS)

- WYSIWYG (D-09/D-17): one rule per area, e.g. `app/portia.css:602` `.formatted-rich-input[data-area="assistant"] { font: 700 10px/1.5 var(--assistant-font); }` (13 `data-area=` rules; grep `data-area=`). Add `color`/`background` to each rule from the matching display class. Reference color for D-07: `.class-cell strong` (oklch(.237 .015 var(--accent-hue))). Assistant ignores color/size/weight on site via `!important` (D-19): mirror with `!important` on the assistant field's spans plus a hint element in the panel.
- Panel: `.floating-text-format` (606-609) position fixed; mobile overrides at ~480-484 (`.content-editor > .floating-text-format`, bottom-docked, `margin-top: 400px` on savebar: must be revisited when mobile panel shrinks to tabs, D-12).
- Animations (D-14): `app/portia.css:1352-1356` keyframes (`window-open { from { opacity:0; scale:.93; translate:0 18px } }`, `window-close { to { opacity:0; scale:.92 } }`). Stretch/jump likely comes from `scale`/`translate` combined with geometry/transform-origin set inline; check the rule that applies `animation:` and `transform-origin` before editing, and the inline geometry painted by `AppWindow.paint`.
- Info cards (D-15/D-20): `.info-subsection-list`, `.info-subsections` (~329-340, mobile ~1091), `.nested-editor-card` (~546). Settings (D-16): `.content-control-entry` (307-310, mobile ~1138).

## Shared Patterns

### Pure logic in `lib/`, UI in components
New testable logic goes into `lib/*.ts` with `lib/*.test.ts` (node:test, `assert/strict`, relative import with `.ts`). Source: `lib/window-geometry.ts`.

### localStorage
Keys `portia-*-vN`; every access in `try/catch`; validate parsed shape. Source: `components/portia-desktop.tsx:131-137, 585-606`.

### Mobile detection
`window.matchMedia("(max-width: 900px)").matches` (used in editor 1897, 1925 and desktop 1585).

### Undo
All style changes go through `target.onCommit(value, document)` so the shared history captures them (phase 3 D-11).

## No Analog Found

| File | Role | Reason |
|---|---|---|
| Tabs "Цвет / Размер / Фон" in panel | component | No tab strip exists in the panel; closest are the editor's section tabs (grep `dossierTabs` in `portia-editor.tsx`, imported from `lib/editor-changes`) for markup/CSS class style |
| Word-boundary finder (Cyrillic) | utility | No existing word-scan code; use RESEARCH.md guidance |

## Metadata

**Analog search scope:** `lib/`, `components/`, `app/portia.css`
**Files scanned:** about 12 (targeted reads and greps)
**Tracked check:** all named paths are in `git ls-files` (lib, components, app are tracked source; none under `.gsd/capabilities`).
**Pattern extraction date:** 2026-10-19
