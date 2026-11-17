# Phase 26: Единый стиль сайта - Pattern Map

**Mapped:** 2026-11-16
**Files analyzed:** 22 (new/modified)
**Analogs found:** 21 / 22 (all analog paths verified git-tracked; no gitignored mirrors involved)

Line numbers are from the code at 2026-11-16 and shift after the first edit of `app/portia.css` / `components/portia-editor.tsx`; re-grep before use.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `app/portia.css` (radii in place + tokens + `ui-unify` block at end) | config/style | transform | `app/portia.css` `style-tokens`, `access-levels`, `users-tab` marked blocks | exact |
| `app/portia-promotion-editor.css` (6 radii, `flex:1` buttons) | config/style | transform | `app/portia.css` | exact |
| `lib/style-tokens.test.ts` (rewrite to grammar guard) | test | transform (source scan) | itself (helpers `withoutComments`, `ruleRadius`, `declarations`, `stripMarkedBlocks`) | exact |
| `lib/ui-unify.test.ts` (new) | test | source scan | `lib/style-tokens.test.ts`, `lib/portia-desktop.test.ts` | role-match |
| `lib/ui-contrast.test.ts` (new) | test | transform | `lib/accent-theme.test.ts` (`oklchToRgb` line 42, `themes` line 86) | exact |
| `lib/editor-tab-layout.test.ts` (new) | test | source scan | `lib/portia-desktop.test.ts` (uses `componentFamily`) | role-match |
| `components/portia-editor-tab-shell.tsx` (new seam: `.etab`, bar, nav, status, actions) | component | request-response / state-display | chip JSX in `components/portia-editor.tsx:1692-1725`; `lib/editor-save-status.ts` | role-match |
| `components/portia-editor.tsx` (call the shell, retire chip) | component | CRUD (draft/save) | itself; guarded by `lib/format-launch.test.ts` | exact |
| `components/portia-users-tab.tsx` (list + detail pane) | component | CRUD | itself plus the phone action window body | exact |
| `components/portia-promotion-editor*.tsx` | component | CRUD | itself, `portia-users-tab.tsx` | role-match |
| `components/portia-desktop-window.tsx` (corner close) | component | request-response | itself; test `lib/window-open.test.ts:213` | exact |
| `components/portia-access-gate.tsx`, `custom-color-picker.tsx`, `portia-editor-rich-text.tsx` (`.corner-close`) | component | request-response | `.window-controls` rule `portia.css:290-293` | role-match |
| `components/portia-desktop.tsx` (info sections bar; search grid) | component | event-driven (UI state) | itself 445-446, 1495-1522, 2002-2037 | exact |
| `lib/info-phone-nav.ts` (+ pure bar helpers) and its test | utility | transform | itself | exact |
| `lib/shortcut-layout.ts` (+ `placeShortcuts`) and its test | utility | transform | `clampShortcutPosition` in itself | exact |
| `components/portia-desktop-shortcuts.tsx` | component | event-driven | itself | exact |
| `lib/window-geometry.test.ts` (mirror clamp test) | test | transform | itself | exact |
| `lib/card-toggle-name.ts` (optional pure name) | utility | transform | `lib/info-phone-nav.ts` | role-match |
| `lib/format-launch.test.ts` (re-baseline `SAMPLE_COMMIT`) | test | source scan | itself | exact |
| `lib/level-editor.test.ts`, `lib/portia-desktop.test.ts`, `lib/phase20-hints-inventory.test.ts` (retarget) | test | source scan | themselves | exact |
| `components/portia-icons.tsx` (15 `classificationIcon` entries; BLOCKED until `26-ICON-DECISION.md`) | component | transform | itself 95-184 | exact |
| `26-ICON-DECISION.md` (owner checkpoint record) | doc | n/a | none | no analog |

## Pattern Assignments

### `lib/style-tokens.test.ts` (test, source scan) - do first (Wave 0)

**Analog:** itself. Keep helpers, replace pins.

**Keep (lines 52-95):**
```ts
function lf(text: string) { return text.replace(/\r\n/g, "\n"); }
function withoutComments(text: string) { return lf(text).replace(/\/\*[\s\S]*?\*\//g, ""); }
export function ruleRadius(css: string, selectorStart: string) {
  for (const match of withoutComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!match[1].trim().startsWith(selectorStart)) continue;
    return match[2].match(/border-radius\s*:\s*([^;]+);/)?.[1].trim() ?? "0";
  }
  assert.fail(`selector not found: ${selectorStart}`);
}
function rootBody(css: string) { return lf(css).match(/^:root\s*\{([\s\S]*?)^\}/m)?.[1] ?? ""; }
```

**Remove / rewrite (will fail on first token use):**
- line 20/22 pins `PORTIA_RADIUS_DECLARATIONS = 131`, `PROMO_RADIUS_DECLARATIONS = 6` (replace by grammar; keep `globals.css` 0 and the two-`:root` and import-order asserts from lines 115-119).
- `TOKEN_NAMES` (26-50): becomes the 8 role tokens + `--tap-target` + `--control-height`, `--control-height-compact`, `--field-max`, `--card-min`; drop `--radius-0..19`, `--radius-pill`.
- lines 158-183: `PRE_PHASE_PORTIA_CSS_SHA256` and "users-tab must stay the last block" (line 173) are re-baselined/retargeted to "ui-unify is last"; `stripMarkedBlocks` (64-79) learns marker `ui-unify`.
- lines 185-189 "declare-only" test (`/var\(--(?:radius-|tap-target)/` forbidden) is inverted: tokens must now be read.

**Grammar pattern to add (from RESEARCH Pattern 1):**
```ts
const ROLE = "var\\(--radius-(?:window|dialog|card|control|field|tab|plaque|round)\\)|0";
const GRAMMAR = new RegExp(`^(?:${ROLE})(?:\\s+(?:${ROLE})){0,3}$`);
const strip = (css: string) => css.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ""));
for (const m of text.matchAll(/border-radius\s*:\s*([^;}]+)/g)) {
  const value = m[1].replace(/\s*!important\s*$/, "").trim();
  assert.match(value, GRAMMAR, `${name}:${line} border-radius: ${value}`);
}
```
Role spot checks reuse `ruleRadius`: `.app-window`, `.portia-dialog`, `.primary-control`, `.editor-field input`, `.quest-badge`, `.editor-tabs button`, `.editor-record-list button`.

---

### `app/portia.css` (style, transform)

**Token block analog (lines 63-87), edit in place inside markers:**
```css
/* style-tokens:start — ... */
  --radius-window: 10px; /* .app-window */
  --radius-dialog: 7px; /* .portia-dialog */   -> 10px
  --radius-control: 0;
  --radius-field: 3px;   -> 0
  --radius-plaque: 0;    -> 999px
  --radius-tab: 0;
  --tap-target: 44px;
/* style-tokens:end */
```
Add `--radius-card: 7px`, `--control-height: 40px`, `--control-height-compact: 32px`, `--field-max: 640px`, `--card-min: 360px`; remove primitives. Do not put `border-radius` / `animation` / `--muted` in the block (existing test forbids it).

**Marked-block analog for the new `ui-unify` block:** `access-levels` (line 2510) and `users-tab` (2552-2607) with start/end comments; `ui-unify:start/end` goes after the users-tab block. Palette form to copy (users-tab 2562-2564): `oklch(.358 calc(.031 * var(--accent-chroma)) var(--accent-hue))`, never hex for neutrals (accent-theme.test.ts guards literals and `--accent-chroma` form).

**Plaque family analog:** `.users-plaque` (2564-2566) already has `padding: 4px 8px; border: 1px solid ...; font: 700 11px/1.35; letter-spacing: .09em`; add `border-radius: var(--radius-plaque)` and share via selector list with `.quest-badge`, `.manual-mark`, `.users-table-mark`, `.tab-count`, `.promotion-step-badge`, `.info-sub-marker`.

**Window controls (lines 290-293, to rework for corner cross):**
```css
.window-controls { display: flex; gap: 6px; }
.window-controls button { width: 28px; height: 28px; ... border-radius: 8px; ... }
.window-controls button:last-child:hover { border-color: #a65750; background: #5d2d29; }
.window-edge { position: absolute; z-index: 9; touch-action: none; }
```
Target: `.window-controls { gap:0; position: relative; z-index: 10 }`, buttons 46x46, radius control; `.window-titlebar` (269-282) `padding-right: 0`. Phone block ~2485-2498 (`::before` frame, 44px) wins the cascade over 1349-1352; rework it too.

**Maximized hook (line 260):** `.app-window.is-maximized { inset: 8px !important; ... }` is the only hook; write R1-R5 as `.app-window.is-maximized <selector>` rules. No `container-type`.

**Sticky bar analog (lines 922-934):**
```css
.editor-section-addbar { position: sticky; top: 0; z-index: 4; ... border-bottom: 1px solid var(--line); background: var(--panel); }
@media (min-width: 901px) { .editor-section-addbar { top: -28px; } }
@media (max-width: 900px) {
  .app-window:has(.editor-section-addbar), .content-editor:has(.editor-section-addbar) { overflow: clip; }
  .editor-section-addbar { top: 48px; padding-inline: 0; }
}
```
New `.etab-bar` copies this with `:has(.etab-bar)`; `top: 48px` on phone, `0` on PC.

**Shortcut media rule to replace (1539-1549):** per-icon absolute `left/top/right/bottom: var(--shortcut-*)` with `.workspace { overflow: hidden }`; size rules for `html[data-icon-size="compact|large"]` stay, positioning moves to JS.

**Chip CSS to retire (580-584, 1473-1477, 1535):** `.editor-save-chip` family; update `lib/portia-desktop.test.ts:1013-1030` (z-index/bottom pins) in the same task.

**Anti-patterns:** no `width: 100%` / `flex: 1` on buttons; no `var(--muted)` in new CSS; keep `.class-cell.level-1..3` selectors.

---

### `components/portia-editor-tab-shell.tsx` (new seam, component)

**Analog:** chip block in `components/portia-editor.tsx:1692-1725` plus `lib/editor-save-status.ts`.

**Naming rule:** `portia-editor-*.tsx` is auto-included by `componentFamily("portia-editor")` (`lib/component-source.ts`) and passes the family-import test (`lib/portia-desktop.test.ts:107-139`) without list edits (existing seams: `portia-editor-dossier.tsx`, `portia-editor-rich-text.tsx`). Put all bar/layout code here so the byte-guarded `portia-editor.tsx` gets only call sites.

**Status vocabulary (editor-save-status.ts 5-20), reuse verbatim:**
```ts
export type SaveStatus = "clean" | "dirty" | "saving" | "saved" | "partial" | "error" | "conflict";
export function saveStatusText(status: SaveStatus, counts?: { saved: number; total: number }): string
```

**Actions to move into the bar (editor.tsx 1718-1720, keep handlers and disabled logic):**
```tsx
<button type="button" className="secondary-control editor-undo-step" aria-label="Отменить последнее действие" disabled={!history.past.length} onClick={() => step("undo")}>↶</button>
<button type="button" className="secondary-control" disabled={!dirty} aria-disabled={saveState === "saving" || undefined} onClick={() => { if (saveState !== "saving") setDialog("discard"); }}>ОТМЕНИТЬ</button>
<button type="button" className="primary-control" disabled={!dirty || saveBlocked} aria-disabled={saveState === "saving" || undefined} onClick={() => { if (saveState !== "saving") void save(); }}>СОХРАНИТЬ</button>
```
Slots are props (nav / status / actions), not `draft` (one shared `draft`; Pitfall 4). Move `saveNotice` into the status slot and `saveError`/oversize/`bodyMessage`/`badQuest` (1713-1716) into `role="alert"` `.etab-message` under the bar. Keep the sr-only live region (1691) and `ConfirmDialog` discard (1726-1745) unchanged. Retarget `lib/level-editor.test.ts:233-240`.

**Guard:** `lib/format-launch.test.ts` (`SAMPLE_COMMIT = "449c756..."`) fails on any `portia-editor.tsx` edit; per RESEARCH rebase after the last editor edit in the same task. `lib/phase20-hints-inventory.test.ts` fails on new Russian text of 7+ words in `components/*.tsx` (split "Она откроется справа. Выберите строку в списке слева." into two literals).

---

### `components/portia-desktop.tsx` (info sections bar) + `lib/info-phone-nav.ts`

**Analog:** itself. Existing state (445-446):
```ts
const infoPhone = useSyncExternalStore(subscribeInfoPhone, infoPhoneSnapshot, infoPhoneServerSnapshot);
const [infoScreen, setInfoScreen] = useState<"list" | "article">("list");
```
Replace the two-screen model (`data-info-screen` at 2002, `.info-phone-back`, `closeInfoArticle/openInfoArticle`, focus return 1516-1522) with `sectionsOpen`. Keep `hitClass("info", id)`, `hitAttrs`, `infoNextTarget`, `data-info-id` focus lookups (2018-2021), `revealInfoForSearch`.

**Pure helper style to copy (`lib/info-phone-nav.ts` 1-45):** small exported functions with `D-nn` doc comments, `import type { InfoSection } from "./portia-content.ts"`, constant `const untitled = "БЕЗ НАЗВАНИЯ";` (UI-SPEC fallback copy is «Без названия»; decide casing consciously). Add: hit count of sections, current section name, button aria-label. Extend `lib/info-phone-nav.test.ts`; update `tests/e2e/specs/info-phone-nav.spec.ts`, `accessibility.spec.ts:690`, `visual-candidates/info-phone.spec.ts:63-65` locators.

**Search grid (D-01):** `.global-search-results { display: grid; gap: 8px }` (portia.css ~317), `.global-result { width: 100% }`; R1 only under `.is-maximized`.

---

### `lib/shortcut-layout.ts` (+ `placeShortcuts`) and `components/portia-desktop-shortcuts.tsx`

**Analog:** `clampShortcutPosition` (shortcut-layout.ts 6-33): pure, typed `Rect`, `inset = 8` default, no mutation of args, tests in `lib/shortcut-layout.test.ts`.
```ts
export type Rect = { x: number; y: number; width: number; height: number };
export function clampShortcutPosition(position, size, area, obstacles: Rect[] = [], inset = 8)
```
Add `placeShortcuts(ids, area, cell, gap, inset = 8, reserveBottom = 56)` returning `{ positions, contentHeight }` (RESEARCH signature, `[ASSUMED]`). Cell sizes from CSS: compact 80x72, default 94x86, large 110x98. Applied in `DesktopIcons` at width >= 521 with `ResizeObserver`; localStorage key `portia-desktop-shortcuts-v3` unchanged; remove the `max-width: 900px` early returns only if drag is meant to return (planner's call).

---

### `components/portia-desktop-window.tsx` and other cross sites

**Analog:** `.window-controls` JSX (line ~185) and rule above. Markup must keep `{!locked && <div className="window-controls">` (pinned by `lib/window-open.test.ts:213`) and `aria-label` `Закрыть {app}` last. Other crosses use shared `.corner-close`: `.access-close` (portia.css 17; `portia-access-gate.tsx:136`), `.quest-toast-close` (608; `portia-access-gate.tsx:186`, `portia-desktop.tsx:2236, 2266`), `custom-color-picker.tsx:65`, `portia-editor-rich-text.tsx:635`.

---

### `lib/ui-contrast.test.ts` (new)

**Analog:** `lib/accent-theme.test.ts`: `oklchToRgb(L, C, hue)` (line 42), `themes` (86, presets ice/amber/red via `themeBlock`), `PORTIA_CONTRAST_REPORT=1` mode. Copy helpers, do not export from the test. Test only pairs actually present in CSS (red `--teal` on `--panel-2` ~4.30 is unfixable by CSS; see RESEARCH Open Question 3). Pitfall 7: new CSS must not add turquoise hex literals or `--accent-hue` outside `calc(N * var(--accent-chroma)) var(--accent-hue)`.

---

### `lib/window-geometry.test.ts` (mirror clamp, UI-11)

**Analog:** itself (test style, lines 1-30): `minimum = { width: 680, height: 320 }`, `dragGeometry/fitGeometry/resizeGeometry` from `./window-geometry.ts`, plain `assert.equal(next.x + next.width, ...)`. Add start x=8 and x = parent - width - 8 with +/-delta; expect equal 8px inset. Expected outcome per RESEARCH: NOT REPRODUCED in lib; DOM/device BLOCKED (DEVICE).

---

### `components/portia-icons.tsx` (UI-07) - gated

**Analog:** itself, `classificationIcon` map (~131-146), `PortiaIcon` 24x24, `currentColor`, stroke 1.75. Do not edit until `26-ICON-DECISION.md` exists (blocking owner checkpoint). Keys, `classificationIconFor`, `route-*`, behaviour icons untouched; `lib/virus-classes.test.ts` pins `iconMapBlock`.

---

### `components/portia-users-tab.tsx` (PC detail pane)

**Analog:** itself; users CSS block `portia.css:2552-2607` (`.users-row`, `.users-plaque`, `.users-list`) and the phone action window body (`.users-action-dialog-body`). Keep server-driven permissions, masked deciders, Moscow time, `already-decided`. Retarget `lib/users-component.test.ts:76` ("users CSS is one sharp marked block at the end").

## Shared Patterns

### Tests-first guard rebasing
**Source:** `lib/style-tokens.test.ts`, `lib/format-launch.test.ts`, `lib/portia-desktop.test.ts` (D-43/D-15 at 313-357; sticky layers 1013-1030).
**Apply to:** every plan; retarget (never delete) tests in the same commit as the source change.

### Source tests read via `componentFamily`
**Source:** `lib/component-source.ts` (`componentFamily`, `lf`). **Apply to:** `ui-unify`, `editor-tab-layout` tests.

### Save status and discard
**Source:** `lib/editor-save-status.ts` `saveStatusText`; `ConfirmDialog` at `portia-editor.tsx:1726-1745`. **Apply to:** shell bar; no new vocabulary.

### Phone sticky via `overflow: clip`
**Source:** `portia.css:927-930`. **Apply to:** `.etab-bar` (and any sticky bar inside `.app-window`).

### Marked CSS blocks
**Source:** `access-levels` and `users-tab` markers. **Apply to:** `ui-unify` block; update `stripMarkedBlocks`.

### Access gating of project rules
No `--verify` of the visual manifest; no `.env*`; owner paths untouched; BLOCKED never PASS; direct node commands instead of broken portable `npm`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `26-ICON-DECISION.md` | doc | n/a | Owner checkpoint record; format is given in UI-SPEC (letter, date, owner's words) |
| `.etab` list+detail layout for accordion tabs (Информация/Справочник/Сводка) | component | display | Today these are `SectionTabs` + `EditorToc` + `CollapsibleCard` accordions (`portia-editor.tsx` 1341-1370); use RESEARCH mapping A2 (list=EditorToc, nav=SectionTabs, detail=active card) |

## Metadata

**Analog search scope:** `app/*.css`, `lib/*.ts(x)`, `components/*.tsx`
**Files read:** CONTEXT, RESEARCH, UI-SPEC (first 478 of 568 lines), `lib/style-tokens.test.ts`, `lib/info-phone-nav.ts`, `lib/shortcut-layout.ts`, `lib/editor-save-status.ts`, `lib/window-geometry.test.ts` (head), `app/portia.css` (selected ranges), `components/portia-editor.tsx` 1686-1747
**Pattern extraction date:** 2026-11-16
