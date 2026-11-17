---
phase: "PORTIA-10"
slug: "rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost"
status: approved
reviewed_at: "2026-10-25"
shadcn_initialized: false
preset: none
created: "2026-10-25"
---

# Phase PORTIA-10 — UI Design Contract

> Visual and interaction contract for the desktop hardening phase. Almost everything here is behaviour on existing surfaces; the only new visible UI is the «Свой» accent option and its picker. Every value below reuses a token already in `app/portia.css`; nothing new is invented unless marked NEW.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no `components.json`, no Tailwind; hand-written CSS in `app/portia.css` + `app/globals.css`) |
| Preset | not applicable |
| Component library | none (own components in `components/portia-desktop.tsx`, `components/portia-editor.tsx`) |
| Icon library | own `components/portia-icons.tsx` (`PortiaIcon`) |
| Font | IBM Plex Mono (`--sans`/`--mono`/`--display`) for the interface; Golos Text (`--doc`) for long document text; IBM Plex Serif (`--serif`) |

Source: codebase scan (`ls components.json tailwind.config.*` found neither; `app/layout.tsx` loads the three fonts). The shadcn gate is skipped: the project is a finished custom design system and the owner did not ask to adopt one. Registry safety gate not applicable.

---

## Spacing Scale

Existing interface spacing is hand-tuned (e.g. 7/9/11/13 px gaps in `portia.css`) and is NOT rewritten in this phase. New or changed CSS in this phase uses only multiples of 4:

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Gap between picker label and field |
| sm | 8px | Gap inside `.setting-options` (existing), gap between picker rows |
| md | 16px | Swatch-to-label spacing is the existing 9px gap; picker outer margin-top is 8px, inner padding keeps the editor's existing values |
| lg | 24px | not used |
| xl | 32px | not used |
| 2xl | 48px | not used |
| 3xl | 64px | not used |

Exceptions:
- Touch target: `.setting-options button` keeps `min-height: 54px` (existing); the new «Свой» button inherits it. Picker close button stays 24x24 as in the editor (reused as-is, D-07).
- `CustomColorPicker` keeps the editor's own paddings (9px / 7px mobile) because it is reused unchanged (D-07).

---

## Typography

No new type styles. The new «Свой» button and picker reuse existing ones.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (settings button label, inherited) | 13px | 400 | 1.5 |
| Label (picker `ТОН` / `HEX`, picker title, settings h2) | 11px | 700 | 1.2 |
| Value (zoom percent, HEX field) | 13px / 11px, tabular figures | 600 existing on zoom, 700 on HEX | 1.2 |
| Display | not used in this phase | - | - |

Declared sizes: 11, 13 (2 sizes used by new/changed elements; the rest of the window keeps its existing sizes). Declared weights for new elements: 400 and 700. The existing 600 on the zoom buttons is untouched. All text stays in `--sans` (Plex Mono); no new font stack.

---

## Color

Accent is already a hue-driven system: surfaces are `oklch(L calc(C * var(--accent-chroma)) var(--accent-hue))` (amended 2026-10-26, D-23), bright tokens are `--teal*`. Presets are `html[data-accent="…"]` blocks (`portia.css` ~1035). «Свой» sets the same tokens inline on `document.documentElement` and in the boot script.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg` / `--desktop-base` (`oklch(.163 .014 var(--accent-hue))`) | Desktop background, window bodies |
| Secondary (30%) | `--panel` / `--panel-2` / `--line` (`oklch(.201…)`, `.229`, `.33`) | Settings panels, picker card (`oklch(.227 .024 hue)` existing), toast |
| Accent (10%) | `--teal` (+ `--teal-dim`, `--teal-soft`, glow/grid/filters) | see reserved list |
| Destructive | `--danger` `#d55449`; existing `.factory-reset` red | Only «СБРОСИТЬ ДО ЗАВОДСКИХ» (existing); nothing new this phase |

Accent reserved for (unchanged list, plus the one new item):
1. Selected state of a Settings option (`.setting-options button.selected` border + inset underline), including the new «Свой»
2. Keyboard focus ring (`outline: 2px solid var(--teal)`, offset 2px)
3. Status dot, caret, selection tint
4. Spider and Vivian (accent colour, dark parts take `--desktop-base`; D-02)
5. Primary controls (`.primary-control`) such as «ОТКРЫТЬ КВЕСТЫ»
6. Picker's focused HEX input border (existing)

### «Свой» derived-token contract (D-04, D-23, D-08, D-11)

One input: picked `#rrggbb`. Convert to OKLCH and keep the pick's hue `H` (degrees) and chroma (amended 2026-10-26, D-23). Exact greys (chroma < 1e-4) are neutral: hue 0, chroma 0. Every token derives from these so «Свой» is indistinguishable in structure from a preset:

| Token | Derivation |
|-------|-----------|
| `--accent-hue` | measured hue of the rounded `--teal` when its chroma >= 0.02, else the pick's `H`; 0 for a neutral pick (one decimal, like presets) |
| `--accent-chroma` | `min(1, --teal chroma / 0.08)`, two decimals; 0 for a neutral pick. Scales every accent tint (`calc(C * var(--accent-chroma))`); `:root` and the presets keep 1 |
| `--teal` | `oklch(L C H)` as hex-or-rgb with `L` clamped to 0.62–0.80, `C = min(pick C, 0.17)`; gamut fitting only lowers `C` |
| `--teal-dim` | same hue, `L = teal L − 0.15` (min 0.49), `C = teal C × 0.78` |
| `--teal-soft` | `rgba(teal rgb, .13)` |
| `--desktop-glow` | teal rgb as `r, g, b` |
| `--desktop-grid` | teal rgb, lightness lowered about 0.10, chroma × 0.8, as `r, g, b` |
| `--desktop-base` | `oklch(.14 (.02 × --accent-chroma) H)` as hex (presets: `#07100f`, `#071016`, `#120e07`, `#130908`, all L about 0.14–0.16) |
| `--desktop-deep` | `oklch(.18 (.03 × --accent-chroma) H)` as hex |
| `--mark-filter`, `--assistant-filter` | `hue-rotate(H − base hue)` with the saturate factor scaled by `--accent-chroma` inside the search; a neutral pick gives `hue-rotate(0deg) saturate(0)`; computed by one function shared by TS and the boot script, verified by `lib/accent-theme.test.ts` |

Clamp ranges come from the four presets measured in OKLCH on 2026-10-25 (bright accents L 0.713 / 0.794 / 0.740 / 0.621, C 0.129 / 0.083 / 0.140 / 0.174; dim accents L 0.567 / 0.648 / 0.588 / 0.493). A neutral pick (black, grey, white) gives a grey theme, never teal: black → #868686, the darkest grey that keeps 4.5:1 on `--bg` and `--panel-2` (D-23). No warning or message is shown for a corrected pick; the swatch and live desktop show the corrected result.

Contrast target: `--teal` on `--bg` text and frames at least 4.5:1 for text, 3:1 for frames; the L clamp guarantees this for all hues (presets already pass). The executor verifies with the extended `accent-theme.test.ts` by sweeping hues 0–359 in steps of 30, plus a 432-pick HSV board (hue step 30, saturation and value step 0.2) that pins the pick's hue and strength.

Boot script rule (D-11): the stored custom colour is untrusted. Validate with a strict `/^#[0-9a-f]{6}$/i`, derive tokens from numbers only, set them via `d.style.setProperty(...)`, and never concatenate the stored string into the script source (existing rule at the top of `lib/accent-boot.ts`). Invalid value: ignore it and fall back to the preset (or default teal).

---

## Copywriting Contract

All interface copy is Russian, uppercase-label style, matching existing windows.

| Element | Copy |
|---------|------|
| Primary CTA (phase) | «Свой» (Settings → «Цвет интерфейса», 5th option, after «Тревога») |
| Picker title (`CustomColorPicker` `title`) | «Свой цвет интерфейса» |
| Picker close | existing `aria-label` «Закрыть выбор цвета» |
| Swatch when nothing saved yet | rainbow conic swatch (NEW, default); the button still reads «Свой» |
| Roblox portrait tooltip | `title` = «Профиль Roblox: {ник}», identical to its `aria-label`; no `title` when there is no Roblox ID (not a link) |
| ≡ reorder handle tooltip | none (owner decision D-18) |
| Zoom reset button accessible name | `aria-label` = `{N}%` only (e.g. «125%»); do NOT add a `title` (it would be read as a description after the name). Visible text stays `{N}%` |
| Zoom − / + | unchanged: «Уменьшить» / «Увеличить» |
| Quest notice live announcement | «Новый квест: {название квеста}» (visually hidden line) |
| Empty state: assistant, no usable tip | no bubble at all, no copy (D-12) |
| Empty state: window with missing text | empty body, no placeholder note (D-14) |
| Error state | no new visible error copy. Frames keep the existing «Открыть отдельно» link as the fallback if a sandboxed embed needs more than the shared flags (D-19) |
| Destructive confirmation | none new. Existing «СБРОСИТЬ ДО ЗАВОДСКИХ» (red `.factory-reset`, already present) now also clears the saved custom colour (D-09); its behaviour and copy are otherwise unchanged |

Documentation copy to update (record owner decisions): REQUIREMENTS.md ZOOM-01 → «Масштаб реагирует на Ctrl (на Mac и на Cmd), не реагирует на клавишу Windows; оверлей не залипает и не перехватывает клики»; A11Y-02 and ROADMAP criterion 4 → drop «и ручки ≡» (D-18).

---

## Interaction Contracts

### «Свой» accent (THEME-01)
- Row `Цвет интерфейса` becomes 5 options: `.color-options` grid `repeat(5, minmax(0, 1fr))` on desktop. At the existing mobile breakpoint (2 columns) «Свой» takes `grid-column: 1 / -1` so it is not orphaned.
- «Свой» button: same `.setting-options button` style; leading `<i class="swatch">` with `background-color` = saved custom colour (inline style). `aria-pressed` reflects selected like the other options (follow the existing pattern in `SettingGroup`).
- Click «Свой»: selects the custom accent (restores the saved custom colour, or the current accent colour if none was ever saved) and opens the picker. Clicking it again while open closes the picker (colour stays selected).
- Picker: the editor's `CustomColorPicker`, moved to a shared module, no added controls. Rendered as the last grid child of `.setting-options` so its existing `grid-column: 1 / -1` places it below the row. Its `group` prop type is widened (the value is only a `data-tab-group` hook for editor focus handling; use a distinct value such as `"accent"`).
- Live preview: `onChange` applies tokens to `document.documentElement` immediately (no transition, regardless of motion setting; instant recolour is not motion). Persist to `portia-desktop-settings-v1` on pointer-up / close, not on every move.
- Selecting any preset: `data-accent` is set, the inline custom tokens are removed, the saved custom colour is kept (D-09).
- Keyboard: Tab order is row buttons, then picker (close, board, ТОН slider, HEX). Escape closes the picker only when focus is inside it; it must not close the Settings window or interfere with the quest-notice Escape handler.
- Reduced motion (D-01): no new animation added. The picker appears without transition.

### Embedded documents (SEC-03, D-19, D-20)
- One shared sandbox constant used by both `EmbeddedDocument` iframes («Таблица», «Устав») and the YouTube iframe. Start set: `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox`. Add only a specific flag that a real-device check proves is missing; never drop `sandbox`.
- YouTube keeps `allowFullScreen` (and a matching `allow="fullscreen"`-compatible setting if the browser check needs it).
- Visual appearance of frames is unchanged (`.document-app` `#f6f7f6`, loading state, bar).

### Document zoom (ZOOM-01, ZOOM-02, D-21, D-22)
- Zoom modifier: `event.ctrlKey` everywhere, plus `event.metaKey` only on Mac (detect via `navigator.userAgentData?.platform` or `navigator.platform`). Meta on Windows/Linux (Windows key) never zooms and never shows the layer.
- The zoom layer (`.document-app-zoom-layer`, `cursor: zoom-in`) exists only while the modifier is physically held. It clears on keyup of that modifier, on window `blur`, and on `visibilitychange` to hidden. It must never intercept clicks or scrolling inside the document when the modifier is not held: use `pointer-events: none` on the layer for everything except `wheel` handling (the wheel listener on `.document-app` keeps working through its own handler), or remove the layer in the same tick the modifier releases.
- Wheel with the modifier steps through the existing `zoomSteps`; `preventDefault` stays (non-passive).
- Reset button: visible `{N}%`, accessible name `{N}%`; the group keeps `aria-label="Масштаб документа"`. Updating percent should not move focus.

### Quest notice (A11Y-01, D-01)
- Container stays `aside.portia-dialog.quest-toast` (non-blocking, never traps focus). Remove `role="status"` from the container (it wraps a button and long content). The aside's implicit `complementary` role plus `aria-labelledby={titleId}` is the landmark. Add a visually hidden `<span role="status" class="sr-only">Новый квест: {название}</span>` for the one-time announcement.
- Escape closes the notice without focus: a `document`-level `keydown` listener registered while the toast is mounted, skipped when `event.defaultPrevented` is true or when a text input / contenteditable is focused so it never steals Escape from editing. The existing element-level `onKeyDown` is removed to avoid double-dismiss.
- Close button keeps `aria-label="Закрыть уведомление"`, 40x40 minimum hit area (existing).
- Entrance animation stays gated by `html[data-motion="full"]` (existing).

### Virus list (A11Y-01)
- Keep `role="listbox"` with `aria-label="Записи вирусов"`. Each `.virus-row` gets `role="option"` and `aria-selected={isActive}`. Rows stay focusable buttons in the natural Tab order (no new arrow-key navigation; out of scope).
- `LoadingState` and any non-option child must not sit directly inside the `listbox`: render it as a sibling, or set `aria-busy` on the listbox while loading.
- Active row visuals unchanged (`.virus-row.active`).

### Assistant robustness (ROB-01, D-12, D-13, D-15)
- No usable tip (empty list, whitespace-only entries only): the assistant button stays, clicking shows no bubble, no console error.
- Open bubble whose tip vanishes after a content poll: bubble closes quietly, no animation, no message. Next click picks from the remaining non-empty tips.
- Missing `text`/`body` in any window renders an empty `FormattedText` container with its normal spacing; the rest of the window works.

---

## UI Considerations

Applicable state considerations resolved: 12 covered, 3 backstop, 0 unresolved (probe: 32 applicable across 8 surfaces; remainder dismissed below)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | assistant tips list | ✅ covered | Empty or whitespace-only tips are skipped; with none left no bubble renders and nothing throws (see Copywriting: no copy) |
| partial | open assistant bubble whose tip is deleted by the 10 s poll | ✅ covered | Bubble closes quietly; next click picks an existing tip |
| partial | any window with missing `text` | ✅ covered | `FormattedText` accepts missing text and renders an empty body; no placeholder |
| empty | «Свой» swatch before any custom colour is saved | ✅ covered | Rainbow conic swatch; clicking opens the picker seeded with the current accent colour |
| partial | stored custom colour invalid or tampered in localStorage | ✅ covered | Strict `#rrggbb` check in boot script and in the desktop; invalid value ignored, preset or default teal applies |
| overflow | 5 options in `Цвет интерфейса` at narrow widths | ✅ covered | 5 columns on desktop; 2 columns on mobile with «Свой» spanning both |
| long-text | Roblox nickname in `title` | ✅ covered | Native tooltip wraps/truncates by the browser; no layout impact |
| zero-one-many | virus list with 0 / 1 / many rows | ✅ covered | `option` roles apply per row; zero rows keeps whatever empty/search-empty rendering exists today, unchanged |
| overflow | grey, near-black or near-white custom pick | 🧪 backstop | Neutral pick → neutral grey theme (D-23): unit tests for #000/#0d0d0d/#808080/#fff in `lib/accent-theme.test.ts` (contrast of `--teal` on `--bg` at least 4.5:1); owner device check 10-09 |
| partial | sandboxed frame blocked by missing `allow-*` flag on a device | 🧪 backstop | Owner checks «Таблица», «Устав», YouTube on PC and phone (success criterion 2); «Открыть отдельно» remains as fallback |
| loading / error | embedded document iframe | 🧪 backstop | Same owner device check as the row above; «Открыть отдельно» is the error path; no new loading UI |
| overflow / long-text | quest notice with a long quest title | ✅ covered | Existing `.quest-toast` CSS: `width: min(360px, …)`, `max-height: calc(100svh - 160px)`, `overflow-y: auto` |
| error | assistant tips with malformed content | ✅ covered | ROB-01: non-string or malformed tips are skipped like empty ones; nothing throws |
| populated | «Свой» after a colour is saved | ✅ covered | Swatch shows the saved colour (D-06); option shows the selected state |
| error | invalid hex typed into the picker | ✅ covered | Not saved; same strict `#rrggbb` check as the stored-value row |

**Dismissed (N/A, reason):**
- loading / error / zero-one-many / partial on the «Свой» option, picker and zoom controls: static or client-only state with no async load.
- long-text on «Свой» and the zoom reset `{N}%`: fixed, bounded labels.
- loading / error / populated / partial / overflow on the virus list: existing behaviour, unchanged this phase (only roles change; see Virus list contract for `LoadingState` placement).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (project does not use shadcn) | not applicable |
| third-party | none | not applicable |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (non-blocking: «Свой» has no noun; picker title supplies it)
- [x] Dimension 2 Visuals: FLAG (non-blocking: no declared focal point for Settings)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: FLAG (non-blocking: existing 600 weight listed; `.sr-only` line not tabled)
- [x] Dimension 5 Spacing: FLAG (non-blocking: existing 9px/7px/54px exceptions; `md` row usage text mismatch)
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved 2026-10-25
