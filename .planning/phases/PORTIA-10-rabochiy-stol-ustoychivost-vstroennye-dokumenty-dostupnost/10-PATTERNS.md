# Phase 10: Рабочий стол - Pattern Map

**Mapped:** 2026-10-25
**Files analyzed:** 9 (all modifications except one new shared module)
**Analogs found:** 9 / 9 (all tracked in git)

## File Classification

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `lib/accent-boot.ts` (add settings-key const, custom-accent branch) | config / boot script | transform | itself (lines 1-13) | exact |
| `lib/accent-custom.ts` (NEW: hex validate + derive tokens + filters, shared TS + boot) | utility | transform | colour maths in `lib/accent-theme.test.ts` 6-70; `hexToHsv`/`hsvToHex` in `components/portia-editor.tsx` 458-490 | role-match |
| `lib/accent-theme.test.ts` (extend) | test | transform | itself | exact |
| `components/portia-desktop.tsx` (ROB-01/03, SEC-03, ZOOM, A11Y, THEME UI) | component | event-driven | itself | exact |
| `components/portia-editor.tsx` (move `CustomColorPicker` out) | component | event-driven | itself, line 2170 | exact |
| shared picker module, e.g. `components/custom-color-picker.tsx` (NEW) | component | event-driven | `CustomColorPicker` (editor 2170-2229) + `hexToHsv`/`hsvToHex` (editor 458+) | exact (move) |
| `app/portia.css` (color-options 5 cols, zoom layer, rainbow swatch) | config/style | - | `.color-options` l.292, `.swatch.*` l.296-300, `.document-app-zoom-layer` l.1574, mobile l.1194 | exact |
| `.planning/REQUIREMENTS.md`, `ROADMAP.md` (ZOOM-01, A11Y-02 wording) | docs | - | existing entries | exact |
| settings-key constant test | test | - | `lib/accent-theme.test.ts` 201-234 (`runBoot`, `desktopSource` regex checks) | exact |

Test runner: `node --experimental-strip-types --test lib/*.test.ts` (package.json l.12). New lib files must be `.ts` with relative `.ts` imports from tests (see test l.4) and no TS-only syntax that strip-types rejects (no enums, no parameter properties).

## Pattern Assignments

### `lib/accent-boot.ts` (boot script, transform)

Current whole file is the pattern (lines 3-13). Key rules to keep: string is built from constants via `JSON.stringify`, never user values.
```ts
export const accentIds = ["teal", "ice", "amber", "red"] as const;
export const bootSeenStorageKey = "portia-boot-seen-v1";
export const accentBootScript =
  `(function(){var d=document.documentElement,s={};try{s=JSON.parse(localStorage.getItem("portia-desktop-settings-v1")||"{}")||{}}catch(e){}` +
  `if(${JSON.stringify(accentIds)}.indexOf(s.accent)>-1)d.dataset.accent=s.accent;` +
  `d.dataset.motion=s.motion==="off"?"reduce":"full";` +
  `try{if(sessionStorage.getItem(${JSON.stringify(bootSeenStorageKey)}))d.dataset.boot="seen"}catch(e){}})()`;
```
TEST-01: add `export const desktopSettingsStorageKey = "portia-desktop-settings-v1"` here (the module the desktop already imports, desktop l.9) and interpolate with `${JSON.stringify(desktopSettingsStorageKey)}` exactly like `bootSeenStorageKey`. Replace the literals at desktop l.552 and l.693 with the constant. Mismatch test: read `desktopSource`, assert no remaining `"portia-desktop-settings-v1"` literal outside accent-boot.ts, and `runBoot` with a `getItem` that records the key asserts it equals the constant.
Custom accent: add a branch after the preset line; strict `/^#[0-9a-f]{6}$/i` test on `s.custom`, compute tokens from numbers, `d.style.setProperty(...)`. Embed the shared derive function by `fn.toString()` or generate numbers-only code; never concatenate the stored string. The test harness `runBoot` (test l.201-206) passes a fake `document: { documentElement: { dataset } }`; extend the fake with `style: { setProperty }` so the new branch is testable.

### `components/portia-desktop.tsx`

**Settings restore/persist (THEME-01, TEST-01)** l.548-566 (restore, per-field whitelist via `settingValues`, l.47) and l.688-694 (apply + persist effect). `settingValues` only accepts strings from a whitelist, so a `custom` hex field needs its own regex check in the restore loop; add `accent: "custom"` to the accent whitelist (derived from `accentIds`, test l.230-232 regex-matches the `SettingGroup title="Цвет интерфейса" values={[[...]]}` literal and compares to `accentIds`; keep the test in sync if "custom" is added there or filter it explicitly).
```tsx
document.documentElement.dataset.accent = desktopSettings.accent;
try { window.localStorage.setItem("portia-desktop-settings-v1", JSON.stringify(desktopSettings)); } catch {}
```
Preset selection must remove inline custom tokens (`style.removeProperty`) and keep saved custom colour (D-09). `resetDesktopSettings` l.714-721 sets `defaultDesktopSettings`; the custom colour must reset with it (put it in the same settings object so `alreadyDefault` check covers it).

**SettingGroup** l.1873-1875: `values: [string,string][]`, `<i className=swatch ...>` when `title === "Цвет интерфейса"`. «Свой» needs inline-style swatch and the picker as last child of `.setting-options`; either extend SettingGroup with optional `extra` children / custom swatch map, or render the 5th button beside it.

**ROB-03 side effects out of updaters.** Offenders: `setWindows((state) => {...})` in openApp l.810-826 is pure (OK); look for updaters that call `localStorage.setItem`/`setX`/timers inside (grep `setWindows(` l.730, 847, 875, 892, 902, 907 and the `setDesktopSettings`/`setShortcutPositions` updaters). Existing correct model for persistence: effect keyed on state (l.585, 614):
```tsx
try { window.localStorage.setItem(shortcutPositionsStorageKey, JSON.stringify(shortcutPositions)); } catch {}
```
and the comment pattern at l.874 "Functional update only: a late timer must never act on a stale render's windows."

**ROB-01 assistant** l.1048-1062 and l.1125-1135, 1340. Current code:
```tsx
const tips = content.assistantAdvice ?? [];
const signature = tips.join("\u001f");
...
assistantAdviceBag.current = shuffledUniqueIndices(tips, assistantLastTipIndex.current);
const nextTipIndex = assistantAdviceBag.current.shift() ?? -1;
setAssistantTipIndex(nextTipIndex);
setAssistantTipVisible(true);
```
Filter first: `tips.map(t => typeof t === "string" ? t : "").map((t, i) => [t.trim(), i])` keep non-empty originals' indices (index must stay valid for `richTextLine(content.formattedText[...], content.assistantAdvice, assistantTipIndex)` l.1135). If none: skip `setAssistantTipVisible(true)`. Render side l.1125: `assistantTipIndex >= 0 ? content.assistantAdvice[assistantTipIndex]` must guard missing index (`?? ""`) and close bubble when the tip is gone (derive `assistantTipVisible && tip usable`, no effect needed).

**FormattedText** l.1800: signature `text: string`; `runs = document?.runs?.length ? document.runs : [{ text }]` then `.text.length` throws on undefined. Change to `text?: string` and `[{ text: text ?? "" }]`.

**SEC-03 sandbox.** Two iframes: YouTube l.1256 and EmbeddedDocument l.1542. Add one module-level constant next to `zoomSteps` and use on both:
```tsx
const embedSandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
<iframe src={src} title={title} loading="lazy" referrerPolicy="no-referrer" sandbox={embedSandbox} ... />
<iframe title={...} loading="lazy" allow="..." allowFullScreen sandbox={embedSandbox} referrerPolicy="strict-origin-when-cross-origin" ... />
```
Add a test that desktopSource has 2 `<iframe` and each tag contains `sandbox={embedSandbox}`.

**ZOOM-01/02 EmbeddedDocument** l.1502-1560. Current (buggy) logic:
```tsx
const key = (event: KeyboardEvent) => setCtrlHeld(event.ctrlKey || event.metaKey);
const release = () => setCtrlHeld(false);
window.addEventListener("keydown", key); window.addEventListener("keyup", key); window.addEventListener("blur", release);
...
const wheel = (event: WheelEvent) => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); step(event.deltaY < 0 ? 1 : -1); };
frame.addEventListener("wheel", wheel, { passive: false });
...
{ctrlHeld && <div className="document-app-zoom-layer" aria-hidden="true" />}
<button type="button" onClick={() => setZoom(1)} aria-label="Сбросить масштаб">{Math.round(zoom * 100)}%</button>
```
Change: module helper `zoomKey = (e) => e.ctrlKey || (isMac && e.metaKey)`; add `visibilitychange` (hidden) to the clear listeners (same add/remove pairing as blur); reset button `aria-label={`${Math.round(zoom*100)}%`}`, no `title`. CSS l.1574 `.document-app-zoom-layer { position: absolute; inset: 0; cursor: zoom-in; }`: the layer is what swallows clicks; wheel is on `frame` (listener already bubbling from layer), so `pointer-events` must stay on while held but layer must disappear on release (the keyup/blur/visibility clearing). Note layer is needed because iframe eats wheel events.

**A11Y-01 quest toast** l.1781:
```tsx
<aside className="portia-dialog quest-toast" role="status" aria-labelledby={titleId} onKeyDown={(event) => { if (event.key === "Escape") onDismiss(false); }}>
```
Remove `role="status"` and `onKeyDown`; add `useEffect` with `document.addEventListener("keydown", ...)` skipping `event.defaultPrevented` and focused input/textarea/contenteditable; note `document` is shadowed by the `document` prop in this component (rename the prop use or use `window.document`). Add `<span role="status" className="sr-only">Новый квест: {quest.title}</span>` (`.sr-only` exists at portia.css l.80; already used desktop l.1166). Live-region/cleanup pattern to copy: effects at l.673-678 that add/remove listeners in pairs.

**A11Y-01 virus list** l.1168-1172: `role="listbox"` wrapper; `!contentReady ? <LoadingState/>` is a non-option child inside it. Add to each `<button className="virus-row...">`: `role="option" aria-selected={virus.id === activeVirus?.id}`; move `LoadingState` out of the listbox or add `aria-busy={!contentReady}`. LoadingState itself (l.1865) is `role="status"`.

**A11Y-02 portrait** l.1206: add `title={`Профиль Roblox: ${selectedEmployee.nickname}`}` to the `<a className="personnel-portrait" ... aria-label=...>` only (not the `<figure>` branch). No change to the ≡ handle.

### Shared picker (D-07) — move `CustomColorPicker` (editor l.2170-2229) and `hexToHsv`/`hsvToHex` (editor l.458, 472) into a shared component file; import it back in the editor (editor imports are at l.3-27; style `@/…` alias). Widen prop: `group: "color" | "background" | "accent"`. Its HEX handler already enforces strict `/^#[0-9A-F]{6}$/` before `onChange` (l.2214-2222); the picker calls `onChange` per move (no pointer-up hook), so desktop persists on `onClose` and on pointer-up/`onPointerUp` wrapper, applying live tokens in `onChange`. Editor use site for call shape: editor l.2139-2150 (`key`, `group`, `title`, `color`, `onChange`, `onClose`). `hexToHsv` is not exported today: check its other editor callers before moving.

### `app/portia.css`
- l.292 `.color-options { grid-template-columns: repeat(4, minmax(0, 1fr)); }` -> `repeat(5, ...)`; mobile l.1194 `.color-options, .setting-options { grid-template-columns: repeat(2, ...) }` add «Свой» `grid-column: 1 / -1` rule. Check the Settings «Цвет интерфейса» row uses `.color-options` class on the `.setting-options` element in `SettingGroup` (l.1874 truncated; read full line before editing).
- Swatches l.296-300: `.swatch.custom { background: conic-gradient(...) }` for the unsaved state. Test `theme swatches match their themes` (test l.152-155) only checks teal/ice/amber/red; the `no turquoise literal` test skips selectors containing `.swatch.` and `.custom-hue input`; a new rainbow conic is not in the 150-195 hue range check problem only if it avoids a turquoise-hue literal under 6 chroma: verify by running tests.
- Theme block format to mirror in derived tokens (l.1035): `--teal; --teal-dim; --teal-soft: rgba(r,g,b,.13); --desktop-base; --desktop-deep; --desktop-glow: r, g, b; --desktop-grid: r, g, b; --accent-hue: 223.3; --mark-filter: hue-rotate(20deg) saturate(1.8); --assistant-filter: hue-rotate(20deg) saturate(.6)`. Note filter format `hue-rotate(Ndeg) saturate(x)` with integer degrees is what `parseFilter` (test l.65-70) accepts; derived filters must match `/^hue-rotate\((-?\d+)deg\)(?:\s+saturate\(([\d.]+)\))?$/`.
- Zoom layer l.1574 (see above).

### `lib/accent-theme.test.ts` extension
Reuse its helpers (`hex`, `oklch`, `oklchToRgb`, `hueDistance`, `parseFilter`, `runBoot` l.201). New tests to copy shape from `"spider and Vivian land on the accent hue"` (l.128-138) and `"the boot script applies only a whitelisted saved accent"` (l.221-234):
```ts
for (const [label, rgb] of [["logo", mark(hex(LOGO_TEAL))], ...]) {
  const distance = hueDistance(oklch(rgb)[2], target);
  assert.ok(distance <= 10, `${id} ${label} ends ${distance.toFixed(1)} deg from the accent`);
}
```
Loop hues 0..330 step 30 plus a grey and near-black/white pick: derived `--teal` contrast >= 4.5:1 against derived base; hostile stored values (`"\"><script>"`, `#12345`, `#gggggg`, non-string) leave `style.setProperty` uncalled. `runBoot`'s fake document needs `style: { setProperty, removeProperty }`. The `Function(...)` call signature at l.204 passes `localStorage, sessionStorage, document, matchMedia` only; keep it.

## Shared Patterns

### localStorage access
Always `try { ... } catch {}` (desktop l.147-149, 380, 434, 524, 693). Apply to custom-accent save/restore.

### Untrusted stored values
Restore loop l.550-562 validates field by field (typeof string + whitelist). Custom colour: `typeof === "string" && /^#[0-9a-f]{6}$/i.test(v)`. Same rule in boot script and in picker HEX input.

### Effects with paired add/remove listeners
```tsx
window.addEventListener("keydown", key);
return () => { window.removeEventListener("keydown", key); };
```
(desktop l.1517-1524). Use for toast Escape and visibilitychange.

### Motion
`html[data-motion="reduce"]` rule (accent-boot l.4; test l.236-254 enforces that any `prefers-reduced-motion` CSS is scoped `html:not([data-motion])`). New CSS must not add unscoped media rules or animation.

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| OKLCH-from-hex to token derivation in production code | utility | Colour maths exists only in the test file (l.6-70) and as HSV helpers in the editor; production code has no OKLCH. Port the test helpers into `lib/` (pure TS, strip-types safe) and make both desktop and the boot script use the one function; boot script needs it as serialised source (e.g. `Function.prototype.toString`) or a hand-written ES5 mirror guarded by a parity test. |

## Metadata

**Analog search scope:** `lib/`, `components/`, `app/portia.css`
**Tracked-source check:** all named files appear in `git ls-files`; no `.gsd` capability mirrors involved.
**Not read in full (planner should):** `components/portia-desktop.tsx` is large; line 1874 SettingGroup full line, `defaultDesktopSettings`/`DesktopSettings` type (~l.40-60), and updaters l.847-907 for ROB-03 offenders.
**Pattern extraction date:** 2026-10-25
