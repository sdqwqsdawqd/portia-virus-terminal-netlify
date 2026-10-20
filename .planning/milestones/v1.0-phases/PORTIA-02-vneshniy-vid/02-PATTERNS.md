# Phase 2: Внешний вид - Pattern Map

**Mapped:** 2026-10-13
**Files analyzed:** 5 modified + 1-2 new (all tracked in git: `git ls-files` checked for app/ and components/)
**Analogs found:** 6 / 6 (the project is one CSS file + 4 components, so analogs live in the same files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `app/layout.tsx` (IBM Plex Mono, drop Unbounded/JetBrains) | config | build-time | itself, lines 2-10 | exact |
| `app/portia.css` (tokens, recolor, keyframes, reduced-motion) | config/style | transform | itself: `:root` 21-24, `html[data-accent]` 846-848, 1073-1110 | exact |
| `components/portia-wallpaper.tsx` (gel lanes, cells) | component | transform (pure SVG) | `DesktopWallpaper` + `helixColumn` | exact |
| `components/portia-icons.tsx` (classification badges, access locks) | component | transform | `iconPaths` record, `PortiaIcon` | exact |
| `components/portia-desktop.tsx` (BootScreen, wallpaper settings, Vivian states) | component | event-driven | `BootScreen` 998-1000, assistant 971-973 | exact |
| `lib/portia-content.ts` (read only: classification values) | model | - | - | - |

## Pattern Assignments

### `app/layout.tsx` (config)

Current (lines 2-10): all fonts are `next/font/google` with a CSS variable, the variables are attached to `<html className>`:
```tsx
import { Golos_Text, IBM_Plex_Serif, JetBrains_Mono, Unbounded } from "next/font/google";
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["500", "700"], variable: "--font-unbounded", display: "swap" });
const plexSerif = IBM_Plex_Serif({ subsets: ["latin", "cyrillic"], weight: ["400", "600", "700"], variable: "--font-plex-serif", display: "swap" });
...
<html lang="ru" className={`${golos.variable} ${unbounded.variable} ${jetbrains.variable} ${plexSerif.variable}`} suppressHydrationWarning>
```
Copy: add `const plexMono = IBM_Plex_Mono({ subsets: ["latin","cyrillic"], weight: [...], variable: "--font-plex-mono", display: "swap" })`; remove `unbounded` (and `jetbrains` if mono is unified, D-07 discretion) from import, consts and className. Weights used by CSS for sans are 400/500/600/700/800 (e.g. `font: 800 25px var(--sans)`); IBM Plex Mono ships 400/500/600/700 only, so 800 will fall back to 700 (check visually). Keep Golos (needed for `--doc`).

### `app/portia.css` (style)

**Font tokens** (lines 21-24), edit here only:
```css
--mono: var(--font-jetbrains), "Cascadia Code", Consolas, monospace;
--sans: var(--font-golos), system-ui, -apple-system, "Segoe UI", sans-serif;
--display: var(--font-unbounded), var(--font-golos), sans-serif;
--serif: var(--font-plex-serif), serif;
```
Plan: `--mono`/`--sans`/`--display` -> `var(--font-plex-mono), ...monospace`; add `--doc: var(--font-golos), system-ui, ...` and point document areas (dossier description/PPU/mutations, scientist records, Info, mailings, trash text files) at `var(--doc)` instead of `var(--sans)`. Scientist record already uses `--serif`. Editor fields: do NOT add separate rules; they share the area rule (`.formatted-rich-input[data-area=...]` in the same selector list as the area), so change the font in that one rule only.

**Accent variables** (lines 846-848 are the model; `:root` defines the defaults):
```css
html[data-accent="ice"] { --teal: #7ec8e3; --teal-dim: #4b9ab8; --teal-soft: rgba(126,200,227,.13); --desktop-base: #071016; --desktop-deep: #0b1820; --desktop-glow: 126, 200, 227; --desktop-grid: 105, 170, 196; }
```
Recolor (D-01): 25 hardcoded matches of `00bca6|0,188,166|12897a` in portia.css, none in TSX (grep confirmed). Examples: line 199 `rgba(0,188,166,.5)` in `focus-flash`, 653-654 bubble border `rgba(0,188,166,.42)`, 1111-area `.start-panel > button:hover { border-color: rgba(0,188,166,.22) }`. Pattern: replace `rgba(0,188,166,A)` with `rgb(var(--desktop-glow) / A)` (the triple `--desktop-glow: 126, 200, 227` is comma-separated, so use `rgba(var(--desktop-glow), A)`), or `color-mix(in srgb, var(--teal) A%, transparent)`; `#00bca6` -> `var(--teal)`, `#12897a` -> `var(--teal-dim)`. Re-grep after to confirm zero left (`grep -n "00bca6\|0,188,166\|12897a" app/portia.css`). Also check inline SVG/stroke attributes in components and `public/assets/*.svg` if any. D-03: leave `#efb84e`/`#d55449` semantic colors; in amber/red themes `--teal` (#e8ae45, #d85f58) is close to them, so adjust the theme values, not the semantic ones.

**PNG recolor (D-02)**: no analog; filter on `<img>` e.g. `hue-rotate` per `html[data-accent]`; existing precedent for filtering the assistant image is `.desktop-assistant.is-offended .assistant-button img { filter: brightness(.7) grayscale(.65) saturate(.5); }` (line 648). Pure hue-rotate also shifts any non-teal hues, so the planner should test or use a mask/layer approach.

**Reduced-motion pattern** (three existing blocks; copy the style, add new selectors to them):
```css
@media (prefers-reduced-motion: reduce) {   /* 1073: global safety net */
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
@media (prefers-reduced-motion: reduce) {   /* 1093: wallpapers */
  .wallpaper-web path { animation: none; stroke-dashoffset: 0; }
  .wallpaper-helix { animation: none; }
}
@media (prefers-reduced-motion: reduce) {   /* 1108: boot + windows */
  .boot-core > .portia-mark, .boot-thread, .app-window { animation: none; }
}
```
Note: the global net only shortens animations; it does not cover `transition` and `scale`/`transform` states set by hover. New hover transitions must be listed with `transition: none` inside a block like these.

**Window/transition keyframes model** (D-12/13, line 1102-1103; also `record-enter` 700, `personnel-profile-enter` 336):
```css
.app-window { animation: window-open 220ms cubic-bezier(.16, 1, .3, 1); }
@keyframes window-open { from { opacity: 0; scale: .96; } to { opacity: 1; scale: 1; } }
```
Uses individual `scale` property (not `transform`) so it does not collide with window positioning transforms. Reuse for close/minimize (needs a state in desktop.tsx to delay unmount; see editor unsaved dialog, phase 3).

**Vivian/bubble model** (lines 647-661):
```css
.desktop-assistant.is-offended .assistant-button img { transform: translateY(3px) rotate(-3deg); filter: brightness(.7) grayscale(.65) saturate(.5); opacity: .78; }
.assistant-bubble { ... animation: assistant-bubble-in 160ms ease-out both; ... }
@keyframes assistant-bubble-in { from { opacity: 0; transform: translate(8px, 8px) scale(.96); } to { opacity: 1; transform: none; } }
```
Extend with: `.is-speaking` jump (class already toggled), springy bubble (cubic-bezier overshoot), click squish, offended shake -> `scaleX(-1)` + grayscale + crouch, un-mirror on end. Click-annoyance level needs a new state/class (or `data-` attribute) set from `activateAssistant` in desktop.tsx.

**Boot screen CSS (D-10)** lines 586, 1099-1101: `.boot-core > .portia-mark { animation: spider-descend 900ms ... both }`, `.boot-thread` with `thread-spin`, `.boot-progress i { animation: boot-load 1.45s ... }`. Diagnose spider: (1) `prefers-reduced-motion` blocks at 1073/1108 disable it on purpose; (2) `.boot-core > .portia-mark` selector requires img to be a direct child of `.boot-core` (it is); (3) PNG load timing. Total boot ~1650 ms must not grow.

### `components/portia-wallpaper.tsx` (component, pure transform)

**Analog:** same file. Pattern: module-level pure generator computed once, `currentColor` via CSS (`.desktop-wallpaper { color: var(--teal); fill: none; stroke: currentColor }`, portia.css 1085), `round()` helper, per-element `style={{ animationDelay }}`, `kind` switch:
```tsx
const round = (value: number) => Math.round(value * 10) / 10;
...
export function DesktopWallpaper({ kind }: { kind: string }) {
  if (kind === "quiet") return null;
  return <svg className={`desktop-wallpaper desktop-wallpaper-${kind}`} viewBox="0 0 1440 900" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">
    {kind === "grid" ? helices.map(...) : <g className="wallpaper-web">...</g>}
  </svg>;
}
```
Copy: add `kind === "gel"` and `kind === "cells"` branches (change the binary ternary into per-kind branches), generators as module consts like `helices`, CSS classes `.wallpaper-gel`/`.wallpaper-cells` next to `.wallpaper-helix` (portia.css ~1089) and their reduced-motion lines in block 1093. Register options in desktop.tsx line 959: `values={[['radar','Паутина'],['grid','Спирали ДНК'],['quiet','Чистый']]}`; stored in `DesktopSettings.wallpaper` (line 25, default 29), applied at 510 `document.documentElement.dataset.wallpaper`. Check any validation of saved `wallpaper` value on load (grep `wallpaper` in desktop.tsx ~lines 480-510) so new ids are accepted. Mobile dimming exists: `.desktop-wallpaper { opacity: .55 }` at <=900px.

### `components/portia-icons.tsx` (component)

**Analog:** same file. Record-of-paths on a 24px grid, shared stroke:
```tsx
export type PortiaIconName = | "search" | "virus" | ... | "editor";
// One 24px grid, one stroke weight; colour comes from the theme through currentColor.
const iconPaths: Record<PortiaIconName, React.ReactNode> = {
  search: <> <circle cx="10.5" cy="10.5" r="6.5" /> <path d="m15.4 15.4 5.1 5.1" /> ... </>,
```
Copy: new badge names (e.g. `PortiaBadgeName` for Гефест/Протей/Апейрон, Номос/Тезей/Абраксас, Предупреждение/Риск/Эснов, `lock-open`/`lock-closed`) following the same Record + exported component shape (read lines 30-94 of the file for the `PortiaIcon` wrapper's svg attributes before writing; not re-read here). Exact classification string values come from `lib/portia-content.ts` (grep before planning). Add as a decision checkpoint first (D-11): sketches before drawing.

### `components/portia-desktop.tsx` (component, event-driven)

**BootScreen** (998-1000), the only component to change for D-10:
```tsx
function BootScreen({ visible }: { visible: boolean }) {
  return <div className={`boot-screen${visible ? "" : " boot-complete"}`} aria-hidden={!visible}><div className="boot-core"><span className="boot-thread" /><img className="portia-mark" src="/assets/portia-logo.png" alt="" /><span>PORTIA OS</span><strong>Запуск лабораторного терминала</strong><div className="boot-progress"><i /></div></div></div>;
}
```
Copy: replace/augment `.boot-progress` with 3-4 `<p>` lines with staggered `animation-delay` (CSS-only typing, like `web-draw` delays driven by `style={{ animationDelay }}`), no new timers so duration stays ~1650 ms. Host: `<BootScreen visible={booting} />` line 810.

**Assistant markup** (971-973): `<div className={`desktop-assistant${assistantTipVisible ? " is-speaking" : ""}${assistantOffended ? " is-offended" : ""}`}> ... <button className="assistant-button" onClick={activateAssistant} aria-disabled={assistantOffended}><img src="/assets/portia-assistant.png" .../>`. State: `assistantOffended` (251), `assistantOffendedRef` (274), `activateAssistant` ~677-724 (offence is triggered and cleared with a timeout at ~723). For a click-count mood add a state/ref next to these and a class/data attribute on the wrapper; for "turn back after offence" use the same place where `setAssistantOffended(false)` runs (line 724).

## Shared Patterns

- **Colour via `currentColor` / CSS variables only**; accents switch with `html[data-accent=...]` (846-848). No colour literals in TSX.
- **Motion**: CSS `@keyframes` + `animation` on classes, never JS animation; each addition gets a line in a `prefers-reduced-motion: reduce` block (see above); durations 150-250 ms per D-13.
- **Stagger via inline `style={{ animationDelay }}`** (wallpaper, boot).
- **Fonts**: only through tokens `--sans/--display/--mono/--serif` (+ new `--doc`); never `font-family` literals; editor fields share the area rule.

## No Analog Found

| File/feature | Reason |
|---|---|
| Hover animations on app icons (D-12) | no existing hover animation on `PortiaIcon`; use `stroke-dasharray` draw trick from `.wallpaper-web path` (portia.css 1086) as the closest model |
| Window close/minimize animation | only open exists (`window-open`); needs an exit state in `portia-desktop.tsx` before unmount |
| PNG recolor | no existing technique, see filter note above |
| Tabs/dossier transition | closest: `record-enter` (700) and `personnel-profile-enter` (336) keyframes, reuse them |

## Metadata

**Analog search scope:** `app/`, `components/` (whole app is 5 files)
**Files scanned:** layout.tsx, portia-wallpaper.tsx, portia-icons.tsx (head), portia.css (targeted), portia-desktop.tsx (targeted)
**Not read:** portia-editor.tsx, lib/portia-content.ts, portia-icons.tsx lines 30-94
**Pattern extraction date:** 2026-10-13
