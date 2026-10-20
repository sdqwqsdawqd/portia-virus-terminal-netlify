# Phase 3: Редактор - Pattern Map

**Mapped:** 2026-10-14
**Files analyzed:** 10 (6 new `lib/` files, 2 modified TSX, 1 modified CSS, plus new in-file components)
**Analogs found:** 10 / 10 (all git-tracked; verified with `git ls-files`)

Project has no CLAUDE.md or skills. Ponytail rule: minimal complete diff. No new dependency.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/editor-history.ts` | utility (pure reducer) | transform | `lib/window-geometry.ts` | role-match |
| `lib/editor-history.test.ts` | test | transform | `lib/window-geometry.test.ts` | exact |
| `lib/editor-changes.ts` | utility (pure diff) | transform | `lib/portia-content-normalize.ts` | role-match |
| `lib/editor-changes.test.ts` | test | transform | `lib/portia-content-normalize.test.ts` | exact |
| `lib/editor-shortcuts.ts` | utility (pure) | transform | `lib/window-geometry.ts` | role-match |
| `lib/editor-shortcuts.test.ts` | test | transform | `lib/window-geometry.test.ts` | exact |
| `components/portia-editor.tsx` (reducer wiring, SaveBar, ConfirmDialog, DossierTabs, mobile `recordOpen`, shortcuts, beforeunload) | component | event-driven / CRUD | itself (`PortiaEditor`, `OrderDragHandle`, `EditorGroup`, `switchTab`) | exact (in-file) |
| `components/portia-desktop.tsx` (close guard in `requestExit`, props to editor) | component | event-driven | itself (`requestExit`, `<PortiaEditor>` at line 1167) | exact (in-file) |
| `app/portia.css` (savebar, dialog, dossier tabs, tab-dot, lanes, mobile list/record) | config (styles) | n/a | itself (`.editor-tabs`, `.order-drag-handle`, `:has()` at 491, media blocks 888/1103/1336) | exact (in-file) |

## Pattern Assignments

### `lib/editor-history.ts`, `lib/editor-changes.ts`, `lib/editor-shortcuts.ts` (pure utilities)

**Analog:** `lib/window-geometry.ts` (pure, no React, no `@/` alias).
Constraint for node strip-types: relative imports with the `.ts` extension, `import type` for types, no enums or parameter properties, no `@/` alias. Make `clone` a reducer parameter (or `structuredClone`), so there is no React dependency. `editor-changes.ts` needs `PortiaContent`: use `import type { PortiaContent } from "./portia-content.ts"`. Existing `lib/portia-content-normalize.test.ts` imports `./portia-content.ts` this way, so relative `.ts` imports work.

Copy the reducer shape, the section map and the shortcut function from RESEARCH.md (Pattern 3, Pattern 4 table, "Shortcut mapping" code example). Match `event.code` (`KeyS`/`KeyZ`/`KeyY`), never `event.key` (Russian layout).

### `lib/*.test.ts` (3 new tests)

**Analog:** `lib/window-geometry.test.ts` lines 1-9 and `lib/portia-content-normalize.test.ts` lines 1-9.

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { defaultPortiaContent } from "./portia-content.ts";
import { normalizePortiaContent } from "./portia-content-normalize.ts";

test("a save round-trip keeps every field", () => {
  const once = normalizePortiaContent(structuredClone(defaultPortiaContent));
  assert.ok(once);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
```
Use `structuredClone(defaultPortiaContent)` as the baseline fixture for `changedSections`. Test names are plain-English sentences. Run: `node --experimental-strip-types --test lib/*.test.ts` (`npm test`). Include the `{ code: "KeyS", key: "ы" }` case.

---

### `components/portia-editor.tsx` (component, event-driven)

**Imports** (lines 1-16): React hooks imported as one named list; project types from `@/lib/portia-content`. Add `createPortal` from `react-dom`, new `@/lib/editor-history`, `@/lib/editor-changes`, `@/lib/editor-shortcuts` in the same style (alias `@/lib/...` is fine inside TSX).

**Draft state to replace** (lines 410-416, 449-456) is what the reducer swaps in:
```tsx
const [draft, setDraft] = useState(() => clone(content));
...
const [dirty, setDirty] = useState(false);
...
const changeDraft = (updater: (next: PortiaContent) => void) => {
  setDraft((current) => {
    const next = clone(current);
    updater(next);
    return next;
  });
  setDirty(true);
};
```
Keep the `changeDraft(updater)` signature unchanged; only its body becomes `dispatch({type:"change", updater, key, now})`. `draft = state.present`; `dirty` derived from `changedSections`.

**Sync effect to keep (setTimeout wrapper required by the lint rule)** (lines 418-430):
```tsx
useEffect(() => {
  if (dirty) return;
  const syncTimer = window.setTimeout(() => {
    setDraft(clone(content));
    setSelectedVirusId((current) => (content.viruses.some((virus) => virus.id === current) ? current : content.viruses[0]?.id ?? ""));
    ...
  }, 0);
  return () => window.clearTimeout(syncTimer);
}, [content, dirty]);
```
Turn `setDraft(clone(content))` into `dispatch({type:"sync", content})` (no-op unless clean and `content !== state.source`). The selection fallback lines are reused after undo/redo/discard.

**Save function** (lines 502-543): change to return `Promise<boolean>`; replace the tail:
```tsx
await onSave(normalized);
setDraft(normalized);
setDirty(false);
} catch {
  // Keep the local draft marked as changed ...
}
```
with `dispatch({type:"saved", normalized, savedFrom: draft})` and `return true` / `return false`.

**Tab switch / format reset** (lines 480-485), call the same two resets on undo/redo/discard and dossier-tab change:
```tsx
const switchTab = (id: EditorTab) => {
  setTab(id);
  setPreviewSurface(id === "viruses" || id === "recycle" ? "light" : "dark");
  setFormatTarget(null);
  setFormatterOpen(false);
};
```
Also reset `recordOpen` here.

**Header and save zone to delete/replace** (lines 545-558): remove `.editor-save-zone` and keep its strings for the bar (`СОХРАНЕНИЕ…`, `СОХРАНЕНО`, `ОШИБКА`, `КТО-ТО СОХРАНИЛ РАНЬШЕ — СКОПИРУЙТЕ ПРАВКИ И ОБНОВИТЕ СТРАНИЦУ`). Class names `editor-save-status ${saveState}` and `primary-control` are reusable on the bar.

**Top tabs with dot** (lines 560-573): add `<i className="tab-dot" aria-hidden="true" />` and `aria-label` inside the existing `.map(([id, label]) => <button ...>)`; add a ref + effect on `tab` that calls `scrollIntoView({ inline: "center", block: "nearest" })` on `.active`.

**Drag handle** (lines 117-155, quoted in RESEARCH.md Pattern 10): keep the 170 ms hold and `setPointerCapture` mechanics; add `onKeyDown` ArrowUp/Down calling `onMove(index, index ± 1)`, midpoint check using `row.getBoundingClientRect()` inside `onPointerMove`, edge autoscroll in rAF, and `DragGroupContext` start/end for one-step undo. Lane look is CSS only.

**Dossier tabs:** wrap the six `EditorGroup` blocks (definition at line 1322-1324):
```tsx
function EditorGroup({ title, children, stack = false }: { title: string; children: React.ReactNode; stack?: boolean }) {
  return <section className={`editor-group${stack ? " stack" : ""}`}><h2>{title}</h2><div className="editor-field-grid">{children}</div></section>;
}
```
in conditional `{dossierTab === "main" && <>...</>}`; `DossierTabs` renders `<nav className="editor-tabs dossier-tabs">` (reuses the existing tab CSS). Same markup in `ArchivedVirusEditor` (~line 962) with its own `useState`.

**Dialog:** no existing dialog component. Replace the two `window.confirm` calls (lines 667, 768) with the new `ConfirmDialog` (optional but recommended; embedded browsers answer `confirm()` "no"). Use `createPortal(..., document.body)`, z-index ~980-990 (taskbar 960, start panel 970, boot 999).

**Effects (shortcuts, beforeunload):** copy "Editor effects" example from RESEARCH.md; follow the lint rule in this codebase: no synchronous `setState` in effects (use `window.setTimeout(..., 0)` like line 421), no `ref.current` reads in render.

---

### `components/portia-desktop.tsx` (close guard)

**Hook point** (lines 748-754): the comment "Phase 3: the editor's unsaved-changes guard must run before an exit starts." sits on `requestExit`:
```tsx
const requestExit = (appId: AppId, kind: "close" | "minimize") => {
  const exiting = windows[appId].exiting;
  if (exiting === kind || exiting === "close") return;
```
Add an optional third param `force = false`, then before the rest: `if (appId === "editor" && kind === "close" && editorDirtyRef.current && !force) { setCloseRequest((n) => n + 1); return; }`. `closeApp` (line 773) stays `requestExit(appId, "close")`.

**Editor mount** (line 1167): extend props:
```tsx
<PortiaEditor content={content} saveState={saveState} canManageEditors={canManageEditors} onSave={saveContent} onEmployeeSaved={updateEmployee} />
```
with `active`, `onDirtyChange`, `closeRequest`, `onCloseApproved={() => requestExit("editor", "close", true)}`. Update the `Props` type in `portia-editor.tsx`.

**Save state timer** (lines 822-823): `setSaveState("saved"); window.setTimeout(() => setSaveState("idle"), 1800);` keep 1800 ms for "Сохранено"; optionally store and clear the timer ref (Pitfall 6).

---

### `app/portia.css`

**Tab and button look to reuse** (lines 402-405): `.editor-tabs`, `.editor-tabs button`, `.editor-tabs button:hover, .editor-tabs button.active { border-color: var(--teal-dim); background: var(--teal-soft); ... }`. `.tab-dot` and `.dossier-tabs` extend these. Buttons: `.primary-control`, `.secondary-control`, `.danger-control` (lines 398-401) for bar and dialog.

**Save status colours** (lines 395-397): `.editor-save-status.saved { color: var(--teal); }`, `.error, .conflict { color: #e07d74; white-space: normal; }`. Warning amber is `--warning` (line 16) for the unsaved text/dot. Delete the dead `.editor-save-zone` rules at 394-397 plus mobile copies (~982, ~1066) when the markup goes.

**Drag handle and lane** (lines 412-415): `.order-drag-handle[data-dragging="true"]` exists. Lane band uses `:has()`, precedent: `.content-editor:has(.floating-text-format) { padding-bottom: 170px; }` (line 491). Add `.editor-record-row:has(.order-drag-handle[data-dragging="true"])`, same for `.recommendation-order-row` and `.nested-editor-card`.

**Mobile block** (`@media (max-width: 900px)` at lines 888, 1103, 1336; verify which one holds the editor rules around 984-990 before editing): replace the horizontal strip rules (verbatim in RESEARCH.md Pattern 1), add `.editor-header { display: none; }`, `[data-mobile-view]` rules, fixed savebar at `bottom: 44px`, handle column 44px. Outside any media query: `.editor-back-to-list { display: none; }`.

**Layout facts for the bar:** `.content-editor { height: calc(100% - 46px); overflow-y: auto; padding: 28px; ... }` (line 390). Desktop: sticky bottom bar in flex column; mobile: `position: fixed` (document scrolls, `.app-window` has `overflow: hidden`).

## Shared Patterns

### Pure logic goes in `lib/`, tested with `node:test`
**Source:** `lib/window-geometry.ts` + `lib/window-geometry.test.ts`
**Apply to:** the three new `lib/editor-*.ts` modules. Relative `.ts` imports, `import type`, `assert/strict`.

### Single funnel for draft changes
**Source:** `changeDraft` in `components/portia-editor.tsx:449-456`
**Apply to:** every mutation (history, dirty, dossier dots). Do not add new `setDraft` call sites.

### Reset format target on any context switch
**Source:** `switchTab`, `components/portia-editor.tsx:480-485`
**Apply to:** dossier tab change, undo/redo/discard, mobile back-to-list.

### No `window.confirm`
**Source:** comment near `components/portia-editor.tsx:755-756`
**Apply to:** D-09 discard, D-12 close, optionally the two existing calls.

### Effects without synchronous setState
**Source:** sync effect, `components/portia-editor.tsx:418-430` (`window.setTimeout(..., 0)`)
**Apply to:** every new `useEffect` (eslint-plugin-react-hooks 7).

### Russian-only strings, no extra hints
Reuse existing verbatim strings (listed above). Only visible hint exception: the tab dot (D-08).

## No Analog Found

| File / feature | Role | Data Flow | Reason |
|---|---|---|---|
| `ConfirmDialog` (portal modal) | component | event-driven | No dialog or portal exists in `components/`. Use RESEARCH.md Pattern 7; style from `.primary-control`/`.secondary-control`/`.danger-control`. |
| Undo history reducer | utility | transform | No `useReducer` or history in the codebase. Use RESEARCH.md Pattern 3. |
| Format panel "keyboard or panel" (D-06) | component | event-driven | Assumed mechanics (`inputMode="none"`); needs real-phone check. Existing `restoreSelection` (`portia-editor.tsx:302`) and `FloatingTextFormatPanel` (~1120) are the base. |

## Metadata

**Analog search scope:** `lib/`, `components/`, `app/portia.css` (all git-tracked per `git ls-files`)
**Files scanned:** ~19 tracked source files listed; 5 read in targeted ranges
**Pattern extraction date:** 2026-10-14
