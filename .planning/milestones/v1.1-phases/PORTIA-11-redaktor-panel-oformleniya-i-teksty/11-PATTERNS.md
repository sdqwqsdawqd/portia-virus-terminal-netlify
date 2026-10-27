# Phase 11: Редактор: панель оформления и тексты - Pattern Map

**Mapped:** 2026-10-26
**Files analyzed:** 9 (all modifications; the only new files are tests)
**Analogs found:** 9 / 9 (all tracked in git)

Note: there is no CLAUDE.md. `components/portia-editor.tsx` (2322 lines) and `app/portia.css` are hot files, so phases run one at a time. All line numbers below are from the current tree.

## File Classification

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `components/portia-editor.tsx` (section collapse + TOC) | component | event-driven | `OrderDragHandle` rows in the same file (181) | exact |
| `components/portia-editor.tsx` (`FloatingTextFormatPanel` portal, drag, sheet) | component | event-driven | same component, ~2040-2085 | exact |
| `components/portia-editor.tsx` (save chip replacing `.editor-savebar`) | component | request-response | `.editor-savebar` block, 1288-1305 | exact |
| `components/portia-editor.tsx` (multi-select highlight) | component | event-driven | `CSS.highlights` effect, 1975-2005 | exact |
| `components/portia-editor.tsx` (table row/column handles) | component | CRUD | `moveArrayItem` + `editTableRows` (141-151) | exact |
| `lib/panel-position.ts` | utility | transform | itself | exact |
| `lib/editor-history.ts` | utility | transform | itself (reducer) | exact |
| `app/portia.css` | config (styles) | n/a | `.editor-savebar`, `.order-drag-handle`, `::highlight` rules | exact |
| `components/portia-desktop.tsx` | component | layer host and public render | `dl.info-ledger` at 1330 | role-match |
| `lib/panel-position.test.ts`, `lib/accent-theme.test.ts` style tests (TEST-02) | test | request-response | `lib/panel-position.test.ts`, `lib/accent-theme.test.ts:9-10` | exact |

## Pattern Assignments

### Reorder: table rows and columns (EDIT-07)

**Analog:** `components/portia-editor.tsx` 141-151, 181+

```typescript
function moveArrayItem<T>(items: T[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
}
function editTableRows(content: PortiaContent, subsectionId: string, blockId: string, edit: (rows: { key: string; value: string }[]) => void) {
  const block = findInfo(content.infoSections, subsectionId)?.subsection?.blocks.find((item) => item.id === blockId);
  if (block?.type === "table") edit(block.rows);
}
function OrderDragHandle({ index, onMove, label }: { index: number; onMove: (from: number, to: number) => void; label: string })
```

- Rows: usage is `<OrderDragHandle index={i} onMove={(from,to)=>changeDraft(c=>editTableRows(c,subId,blockId,rows=>moveArrayItem(rows,from,to)))} label="Переставить строку N"/>`. The row element must carry `data-sort-index`. The FLIP effect in the handle looks up `closest("[data-sort-index]")`.
- Columns: the handle is index-based and a swap is a move 0->1, so reuse it. Cheapest storage that stays compatible with the normalizer and `dl` (`portia-desktop.tsx:1330`, `dt`=`key`, `dd`=`value`) is swapping `key`/`value` in every row: `rows.forEach(r => { [r.key, r.value] = [r.value, r.key]; })`. No schema change. Headers "Признак"/"Значение" are then labels that follow position, not data.
- Check before choosing: `lib/portia-content-normalize.ts` does not special-case `key`/`value` order.
- Rows live in a draft that `changeDraft` clones before editing, so mutate in place inside the callback.
- Existing limit: `MAX_TABLE_ROWS` (imported at line 24). Reorder never changes the count.

### Section collapse, TOC, ellipsis (EDIT-03)

**Analog:** the existing list rows with `OrderDragHandle` (`.editor-record-row`, `.nested-editor-card`, `.recommendation-order-row`; CSS at `portia.css:539-547, 574`).

- Collapse state is local `useState<Set<string>>` of expanded ids, empty at mount (D-01). It is not persisted.
- Reuse: `data-sort-index` on rows; `[data-dragging="true"]` styles (`portia.css:540,543,544`). Force-collapse while dragging via the `:has(.order-drag-handle[data-dragging="true"])` selector.
- Ellipsis: copy the technique from `.editor-savebar-fix` (`portia.css:468`): `min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;` plus a `title` attribute.
- Touch target: `portia.css:1592` already sets the handle to 44px at the phone breakpoint. Copy that rule for the toggle and TOC items.
- Focus ring: `.editor-savebar-fix:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }` (`portia.css:469`).

### Floating format panel (EDIT-04, EDIT-01)

**Analog:** `FloatingTextFormatPanel`, `components/portia-editor.tsx` ~1960-2140.

Drag:
```typescript
const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
  const panel = panelRef.current; const parent = panel?.offsetParent;
  if (!panel || !parent || window.matchMedia("(max-width: 900px)").matches) return;
  if ((event.target as HTMLElement).closest("button")) return;   // × stays clickable
  event.currentTarget.setPointerCapture(event.pointerId);
  dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
    right: parent.clientWidth - panel.offsetLeft - panel.offsetWidth, bottom: parent.clientHeight - panel.offsetTop - panel.offsetHeight, last: null };
};
// moveDrag -> paintPanelOffset(panel, parent, {right: drag.right - dx, bottom: drag.bottom - dy})  (no React render per move)
// endDrag -> try { localStorage.setItem(formatPanelStorageKey, JSON.stringify(drag.last)); } catch { /* ignore */ }
```
Storage and paint (2132-2140):
```typescript
const formatPanelStorageKey = "portia-format-panel-v1";
function paintPanelOffset(panel: HTMLElement, parent: Element, offset: { right: number; bottom: number }) {
  const next = clampPanelOffset(offset, { width: panel.offsetWidth, height: panel.offsetHeight }, { width: parent.clientWidth, height: parent.clientHeight });
  panel.style.right = `${next.right}px`; panel.style.bottom = `${next.bottom}px`; return next;
}
```
Restore on mount (2040-2056) uses `parsePanelOffset(localStorage.getItem(...))` inside try/catch, then a `ResizeObserver` on the parent; on phone it clears `right`/`bottom`.

Changes for the portal:
- Render with `createPortal` into the desktop layer. The parent for clamping becomes the viewport (`document.documentElement.clientWidth/Height`). `panel.offsetParent` is `null` for `position: fixed`, so the `parent` guards at 2040/2065/2076 must change to the viewport size.
- Mount point: the `{formatterOpen && formatTarget && <FloatingTextFormatPanel ... />}` line at ~1286. Pass a host element from `portia-desktop.tsx`.
- Phone: keep the existing `(max-width: 900px)` early return, no stored offset.
- EDIT-01: ГОТОВО handler and `rangeFromOffsets(field, {start: paintFrom, end: paintTo})` (1983). When no selection is known, `paintFrom`/`paintTo` must stay `undefined` so `painted` is null. This is what the effect already supports; the fix is in the code that sets the target and places the caret at offset 0. Grep `finish-format` to find it.

### `lib/panel-position.ts` (utility, transform)

**Analog:** itself (32 lines). Currently clamps `{right,bottom}` to the editor window with `sideMargin = 8`, `minimumBottom = 72`, `topInset = 54`.
```typescript
export function clampPanelOffset(offset: PanelOffset, panel: Bounds, bounds: Bounds): PanelOffset {
  const maxRight = Math.max(sideMargin, bounds.width - panel.width - sideMargin);
  const maxBottom = Math.max(minimumBottom, bounds.height - panel.height - topInset);
  return { right: Math.round(Math.min(Math.max(sideMargin, offset.right), maxRight)),
           bottom: Math.round(Math.min(Math.max(minimumBottom, offset.bottom), maxBottom)) };
}
export function parsePanelOffset(raw: string | null): PanelOffset | null { /* JSON.parse in try/catch; both fields finite numbers, else null */ }
```
Extend it, do not fork it. Desktop spec: keep at least 64px of the header on screen on every side. That means the panel may go partly off-screen, so the min/max become `-(panel - 64)` to `bounds - 64`. Keep `parsePanelOffset` unchanged (legacy values pass through the clamp, never throw). Update `lib/panel-position.test.ts` expectations (lines 15-21 assert the old 8px and 72/54 behaviour).

### `lib/editor-history.ts` (EDIT-06, D-16)

**Analog:** itself. A `change` action takes an `updater` that mutates a clone, so one multi-field style application is a single `{type:"change", updater, key:null, now}` whose updater edits every field. No reducer change is needed. Pass `key: null`, because a non-null key coalesces typing within `TYPING_PAUSE_MS`/`TYPING_SPAN_MS` and would merge steps.
```typescript
| { type: "change"; updater: (next: T) => void; key: string | null; now: number }
```

### Multi-selection highlight (EDIT-06, D-17)

**Analog:** `components/portia-editor.tsx` 1988-2001.
```typescript
const painted = paintFrom !== undefined && paintTo !== undefined ? rangeFromOffsets(field, { start: paintFrom, end: paintTo }) : null;
const paints = painted !== null && typeof Highlight !== "undefined" && "highlights" in CSS;
if (paints) CSS.highlights.set("portia-format", new Highlight(painted));
// cleanup: if (paints) CSS.highlights.delete("portia-format");
```
`Highlight` takes a variable number of ranges: `new Highlight(...ranges)`. Build one range per stored `(fieldKey, start, end)` via `findFormatField(key)` and `rangeFromOffsets`. Merging overlapping or adjacent fragments is a pure function: put it in `lib/` next to `rich-text-style.ts` so it can be unit-tested with `node:test`. Applying the style reuses `applyRichTextStyle` (imported line 26) per field.
Existing effect dependency: `formatDocument`, since a style change re-renders text nodes and orphans ranges.

### Save chip (EDIT-05)

**Analog:** `.editor-savebar` JSX, `portia-editor.tsx` 1288-1305.
```tsx
<div className="editor-savebar" data-dirty={dirty || undefined}>
  <p role="status" aria-live="polite">
    {statusText && <span className={`editor-save-status ${saveState}`}>{statusText}</span>}
    {dirty && <span className="editor-savebar-sections">{`Не сохранено: ${changed.map((id) => sectionLabels[id]).join(", ")}`}</span>}
    {dirty && oversize.length > 0 && <span ...>{oversizeMessage(oversize)}</span>}
    {dirty && bodyMessage && <span className="editor-save-status error">{bodyMessage}</span>}
    {dirty && badQuest && <button type="button" className="editor-savebar-fix" onClick={() => revealCard(badQuest.id, "endsAt", "quests")}>{dateMessage}</button>}
  </p>
  <div className="editor-savebar-actions"> ↶ (step("undo")) / ОТМЕНИТЬ (setDialog("discard")) / СОХРАНИТЬ (void save(), disabled when saveBlocked) </div>
</div>
```
Keep the logic and the `ConfirmDialog` (`dialog === "discard"`, line 1305). Replace only the wrapper with a chip button (`aria-expanded`, `aria-haspopup="dialog"`) and a popover holding this same content. Count is `changed.length`. Keep `role="status" aria-live="polite"` on a node that is always mounted.
CSS to delete or replace: `portia.css:464-470, 501, 509-510, 1180-1185, 1232` (the `:has(.floating-text-format)` hacks). Phone chip offset is `bottom: 52px`, and `calc(44px + sheet + 8px)` when the sheet is open.
Popover outside-click and Esc: copy the listener style from `ConfirmDialog`; check how it closes before writing.

### A11Y-03 text fixes (exact lines)

- `portia-editor.tsx:1889`: `<div className="formatted-text-field-head"><span>{label}</span><small></small></div>` -> remove `<small></small>`.
- `:1939`: `Текст и GIF можно использовать вместе, не добавляй всякой фигни ок?` -> `Текст и GIF можно использовать вместе. Не добавляйте лишних элементов.`
- `:1279`: `дружок пирожок` -> `пользователь`.
- Verify with `grep -nE "фигни|пирожок|<small></small>|<small />" components/`.

### CSS: EDIT-02 mark colour

`app/portia.css:522`:
```css
::highlight(portia-format) { text-decoration: underline solid rgba(var(--desktop-glow), .9) 3px; }
```
-> `rgba(0, 150, 132, .95)`.

### TEST-02 tests

**Analog:** `lib/accent-theme.test.ts:3-10` reads source with `readFileSync(new URL("../app/portia.css", import.meta.url), "utf8")` and strips comments with `.replace(/\/\*[\s\S]*?\*\//g, "")`.
```typescript
import { readdirSync, readFileSync } from "node:fs";
const css = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const desktopSource = readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url), "utf8");
```
Test skeleton from `lib/panel-position.test.ts`: `import test from "node:test"; import assert from "node:assert/strict";` and import under test with an explicit `.ts` extension (`"./panel-position.ts"`). Run with node `--experimental-strip-types`.
- `::highlight(portia-format)` test: match the rule with a regex, then assert `underline`, no `background`, and colour equal to `rgba(0, 150, 132, .95)`.
- Own-input window edge: a panel-position test (clamp keeps 64px of header). Put it in `lib/panel-position.test.ts`.
- Import merge: `portia-editor.tsx` lines 25 (`import type { FieldSelectionEvent, FieldSelectionState }`) and 26 (value import) from `@/lib/rich-text-style`. Merge into one statement using inline `type` modifiers, e.g. `import { type FieldSelectionEvent, type FieldSelectionState, applyRichTextStyle, ... }`. This is the same style as line 20 (`type RichTextStyle,` inside a braces import). Test it by counting matches of `from "@/lib/rich-text-style"` in the source (expect 1).

## Shared Patterns

### Storage access
Always try/catch, never throw; failure means "position not remembered" (`portia-editor.tsx` 2046-2050, 2085).

### Phone vs desktop switch
`window.matchMedia("(max-width: 900px)").matches` in JS and `@media (max-width: 900px)` in CSS (Known Limitation 05-WR-05: repeated query is accepted). For multi-select also check `pointer: coarse`.

### Reduced motion
`document.documentElement.dataset.motion` and `matchMedia("(prefers-reduced-motion: reduce)")` (inside `OrderDragHandle`, FLIP effect). Use the same switch for `scrollIntoView` behavior.

### Accent theming
Use `oklch(L calc(C * var(--accent-chroma)) var(--accent-hue))` or existing vars (`--teal`, `--teal-soft`, `--warning`, `--danger`). `lib/accent-theme.test.ts` scans CSS and components for violations, so run it after CSS edits. Do not add raw colours except the single `::highlight` value, and check whether the scanner allows it.

### History
Every content edit goes through `changeDraft` -> history `change`. Do not edit state outside it.

## No Analog Found

| File / Feature | Reason |
|----------------|--------|
| Portal into the desktop layer | No existing `createPortal` use was checked in `portia-desktop.tsx`; grep before planning. Use the React docs pattern. |
| TOC with `scrollIntoView` | No existing TOC component. Compose from the row and button styles above. |
| Fragment merge utility | New pure function; put in `lib/` with a `node:test` file. |
| Arrow-key panel move (a11y) | New; the header needs `tabindex=0` and a keydown handler calling `paintPanelOffset`. |

## Metadata

**Analog search scope:** `components/portia-editor.tsx`, `components/portia-desktop.tsx`, `app/portia.css`, `lib/*.ts`, `lib/*.test.ts`
**Tracked-source check:** `git ls-files` confirmed `lib/panel-position.ts`, `lib/panel-position.test.ts`, `lib/editor-history.ts` are tracked. The other files are the standard app sources, and no mirror or capability paths are used.
**Pattern extraction date:** 2026-10-26
