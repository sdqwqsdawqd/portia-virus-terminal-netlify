---
phase: "09"
slug: tselostnost-kontenta
status: draft
shadcn_initialized: false
preset: none
created: "2026-10-25"
---

# Phase 9 — UI Design Contract

> Visual and interaction contract for Phase 9 (Целостность контента): the animated desktop wallpapers (BG-01, plan 1) and the small editor/desktop surfaces for limits, dates and «ВАЖНО» (CONT-01, 04, 05, 06, 07). SYNC-01, CONT-02, 03, 08 have no new visuals.
> Everything below extends the existing hand-written PORTIA OS system in `app/portia.css`. Nothing here introduces a new palette, font or component family. Decisions D-01..D-22 from `09-CONTEXT.md` are locked and are cited, not re-argued.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-written CSS in `app/portia.css`; no `components.json`; Tailwind 4 is installed via `postcss.config.mjs` but there is no `tailwind.config.*` and no utility classes drive the UI) |
| Preset | not applicable |
| Component library | none (React 19 + Next 16 components in `components/portia-*.tsx`) |
| Icon library | none (inline SVG in `components/portia-icons.tsx`; Unicode glyphs such as ↶ in the editor) |
| Font | IBM Plex Mono (`--sans` / `--mono` / `--display`, all the same face) for the interface; Golos (`--doc`) only for long document text |

Note on the shadcn gate: the gate asks the user whether to initialise shadcn for a React/Next project with no `components.json`. No user channel was available in this run, and the project is a deliberately hand-styled desktop skin with a full token set already in place (`:root` in `app/portia.css`), so the answer recorded is `Tool: none`. Registry safety is therefore not applicable.

---

## Component Inventory

Omitted: `Tool: none` (no design-system package to enumerate). Reusable pieces already in the codebase are listed under "Reuse, do not rebuild" below.

### Reuse, do not rebuild

| Existing piece | Where | Used for in this phase |
|----------------|-------|------------------------|
| `.secondary-control` / `.primary-control` / `.danger-control` (+ `:disabled` at opacity .4, `cursor: not-allowed`) | `app/portia.css` ~505 | «+» add buttons, «СОХРАНИТЬ» |
| `.scientist-log-actions` (flex row, button left, 11px muted `<span>` right) | `app/portia.css` 577, `portia-editor.tsx` ~996 | Pattern for the limit counter (D-15) |
| `.editor-field` + `.editor-field > span` label + input | `app/portia.css` 550–556 | Quest date fields (D-18) |
| `.editor-savebar > p > span` status slot, `.editor-savebar-sections` (warning colour) | `app/portia.css` 460–464, 503 | Too-large warning (D-16), date block message (D-18) |
| `.employee-add-error` (11px/1.45 `--danger`, `overflow-wrap: anywhere`) | `app/portia.css` 530 | Source style for the new `.editor-field-error` |
| `ConfirmDialog` | `portia-editor.tsx` ~1279–1340 | «УДАЛИТЬ НАВСЕГДА» (copy tweak only) |
| `data-broadcast-title`, `data-broadcast-type`, `broadcastEditorTab` focus mechanism | `portia-editor.tsx` ~706 | Jump-to-card for CONT-05 and the date message |
| `.wallpaper-layer`, `html[data-motion]` gates, `seeded()`, `webPaths()` | `components/portia-wallpaper.tsx`, `app/portia.css` 1276–1346 | All wallpaper work |

---

## Spacing Scale

Declared values (new CSS written in this phase uses only these):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap between a field and its error line; icon/caption gaps |
| sm | 8px | Gap between a savebar message and its neighbour; compact stacking |
| md | 16px | Default stacking between a button row and the next control |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major breaks |
| 3xl | 64px | Page-level |

Exceptions:
- Existing editor classes keep their historical values (6, 10, 11, 13, 14, 15px in `.editor-field`, `.nested-editor-card`, `.scientist-log-actions`). They are reused as is and are not rewritten in this phase.
- Phone touch targets for the «+» buttons and the savebar message button: `min-height: 40px` (same as the existing `.editor-savebar-actions button` rule at `max-width: 900px`).
- Wallpaper geometry is in SVG user units (viewBox 1440 wide), not CSS spacing; see Wallpaper Motion Contract.

---

## Typography

New text in this phase is only captions, counters and error lines in the editor. Sizes and weights are taken from what the editor already uses.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (guidance, field input) | 13px | 400 | 1.55 |
| Label / caption / counter / error line | 11px | 400 (counter, caption) and 700 (the «МАКСИМУМ N» caption, button labels) | 1.45 |
| Heading (card head, e.g. «ЗАПИСЬ 01») | 15px | 700 | 1.2 |
| Display | not used in this phase (existing 18px/600 callsign is untouched) | n/a | n/a |

Declared sizes: 11, 13, 15 (three). Declared weights: 400, 700 (two). New rules must not introduce 500 or 600; existing 500/600 rules elsewhere are left alone. Letter-spacing on uppercase captions: `.04em`, same as the existing buttons. Interface text stays uppercase Russian for captions and buttons; error and guidance sentences stay sentence case, as D-18 specifies «Окончание раньше начала».

---

## Color

Existing tokens only (`:root` and `html[data-accent=…]`). The accent follows the user's accent setting, so nothing below may be hard-coded.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg` / `--desktop-base` (`#07100f` on teal; changes per accent) | Desktop background; editor page surface |
| Secondary (30%) | `--panel`, `--panel-2`, `.nested-editor-card` fill `rgba(0,0,0,.11)` | Editor cards, savebar, fields |
| Accent (10%) | `--teal` (`#00bca6` on default; `--teal-dim`, `--teal-soft`, `--desktop-glow` follow the accent) | See reserved list |
| Warning | `--warning` `#efb84e` | Limit caption «МАКСИМУМ N», too-large message (matches `.editor-savebar-sections`) |
| Destructive / invalid | border `--danger` `#d55449`; text `#e07d74` (the colour `.editor-save-status.error` already uses, better contrast on the dark panel) | Invalid end-date field and its error line; the save-block message |

Accent reserved for (this phase):
1. The spider's teal parts (`cls-1`) and every web thread, dew drop and thread-wave pulse (all `currentColor` of `.desktop-wallpaper`, which is `var(--teal)`).
2. DNA helix strands and rungs, gel bands and their glow, cell walls, nuclei and virions (already `currentColor`).
3. The pale spider highlights (`cls-3`): `color-mix(in oklab, var(--teal) 30%, white)`.
4. Existing focus rings (`button:focus-visible` uses `--teal`).

Accent is NOT used for: the limit counter, the caption, the date error, the savebar messages (those use muted text, `--warning`, `#e07d74`).

Spider colour mapping (D-07), no hard-coded colour may remain in the SVG:

| SVG class | Original | Becomes |
|-----------|----------|---------|
| `cls-1` | `#00b396` | `fill: currentColor` |
| `cls-2` | `#070707` | `fill: var(--desktop-base)` (follows the desktop colour when accent or, later in Phase 10, a custom colour changes it) |
| `cls-3` | `#fdfdfd` | `fill: color-mix(in oklab, var(--teal) 30%, white)` |

Gotcha: `.desktop-wallpaper` sets `fill: none; stroke: currentColor`. Every spider path must set `stroke: none` and its own `fill`, or the silhouette gets outlined and goes muddy. Rename the SVG's `<style>` classes to namespaced ones (`.wallpaper-spider-teal` etc.) when inlining so they cannot leak into the page.

Spider overall opacity: `.85` (web threads sit at `.26`, so the spider reads as the foreground figure without glaring). Its dark parts are the desktop colour on purpose: they hide the threads under the body and give a clean silhouette.

---

## Wallpaper Motion Contract (BG-01 — first plan of the phase)

Global rules (D-03, D-12, D-13) that every wallpaper below obeys:

| Rule | Value |
|------|-------|
| Visible within | 2–3 s of looking (target: a cell, band or strand moves at least 3 px in 3 s) |
| Feel | slow, calm, no sudden direction changes, no flashing; text on top stays readable |
| Reduced motion (`html[data-motion="reduce"]`) | every wallpaper still and fully drawn. The spider is drawn at its rest point with legs in neutral pose; no waves; no JS loop runs; web is at `stroke-dashoffset: 0` |
| Devices | identical animation on PC and phone; no reduced phone variant (D-13) |
| Pause when hidden | JS loops stop on `document.visibilityState !== "visible"`, on unmount, and when the wallpaper kind is not the owning one |
| Cost ceiling | one `requestAnimationFrame` loop in total for the spider; no layout reads inside the loop; only `transform`/`translate`/`opacity` changes. Owner's phone must hold 60 fps (success criterion 6) |

Units: positions below are SVG user units of the 1440-wide viewBox (about 1 px at 1440 px width).

### «Паутина» (`radar`): spider on the web (D-04, D-05, D-06, D-08)

| Aspect | Contract |
|--------|----------|
| Replaced | `web-sway` (the rotation keyframes and its `html[data-motion="full"] .wallpaper-web` rule) is deleted. The web itself stays still. `web-draw` (spinning in over about 2.5 s) and the dew twinkle (`web-dew`) stay as is |
| Artwork | the owner's `09-spider.svg`, inlined as a React component in `portia-wallpaper.tsx` (the SVG is ~650×768 units and has 8 leg groups, `Body`, and an empty `Virus` group, which is dropped). Same silhouette as the boot spider |
| Size | scale `0.15` of the SVG, so about 97 × 115 units (about 140 px tall at 1920 px width; about 108 px at 390 px phone width) |
| Orientation | the "front" of the artwork is identified from the render during implementation; the body is rotated so that front faces the travel direction. Turns at thread crossings take 300 ms with ease-in-out, never a snap |
| Where it walks | exactly on the drawn threads (spokes and ring arcs from `webPaths()`), feet on thread within 2 units. Path = a walk on the graph of spoke×ring crossings; position along a ring arc or spoke is sampled from the real `<path>` (`getPointAtLength`), so the sagging ring curves are followed, not cut across |
| Target choice | a crossing 2–4 hops away, inside the visible area (viewBox mapped through `xMaxYMin slice`) with a 40-unit margin; never back to the node it just left; if fewer than 6 crossings are visible (narrow phone), use all visible ones |
| Walk speed | 36 units/s (about one body length in 3 s); eases in and out over 400 ms at start and end of each walk |
| Pause | stops for a random 3–6 s between walks («ходит и замирает»). While paused: legs return to neutral in 300 ms and nothing moves (no idle twitch) |
| First appearance | appears at its rest crossing with a 600 ms fade-in once the web has been spun (about 1.8 s after the web starts drawing), takes its first walk about 1.2 s after that, so something moves within 3 s |
| Rest crossing | the crossing used for the still pose under reduced motion: ring 5, spoke index 3 (hub-side upper area, always inside the visible area on PC and phone) |
| Legs (D-06) | the 8 groups swing as whole pieces from their base. Pivot = the point of each leg group nearest the body centre, measured from the SVG. Alternating gait: group A = `Left_leg_1`, `Right_leg_2`, `Left_leg_3`, `Right_leg_4`; group B = `Right_leg_1`, `Left_leg_2`, `Right_leg_3`, `Left_leg_4`. B runs 180 degrees out of phase with A. Swing amplitude ±12 degrees (mirrored sign on the right side so all legs push the same way relative to travel). One full step cycle 0.8 s while walking. Legs animate only while walking (animation paused, not removed, when stopped) |
| Thread waves (D-05) | while walking, every step (about every 0.4 s) a pulse is emitted at the contact point and travels outward both ways along the thread under the spider at about 260 units/s, 120 units long; thread under the pulse goes from opacity `.26` to `.6` and from stroke width 1 to 1.8, fading out over 1.2 s. On reaching a crossing, the pulse continues into every thread meeting there at half strength. On arrival at a new crossing the spider emits one stronger pulse (peak `.75`) into all threads of that crossing. A last decaying pulse plays when it stops. Max 8 pulses alive at once (pool, no allocation per step) |
| Pulse colour | `currentColor` (accent). No glow filter, no blur (cost) |
| Pointer | none. The wallpaper frame is `pointer-events: none` and `aria-hidden`; the spider is decoration only |
| Boot spider | stays a PNG (D-08 makes the swap optional). Not part of this phase |

### «Спирали ДНК» (`grid`): remove the judder (D-09)

| Aspect | Contract |
|--------|----------|
| Perceptual target | continuous glide with no visible stepping on PC and on phone, over the whole loop and at the seam |
| Speed | one 720-unit loop in 60 s (12 units/s), changed from 90 s so it is visible within 2–3 s (36 units, about 36 px, in 3 s). Strand drawing and opacities unchanged |
| Cause to confirm first (researcher hypotheses, in order of suspicion; the planner's first task is a 10 s Performance trace on PC and on the owner's phone to see which holds) | (1) At about 8 px/s, a translated layer moves by less than one device pixel per frame; if the compositor snaps it to whole pixels, the 1.5-unit strokes step visibly every ~125 ms. (2) `.system-bar` has `backdrop-filter: blur(16px)` (and the start panel `blur(14px)`) and re-samples the moving wallpaper every frame. (3) The SVG layer is `100% + 720*scale` tall; on a high-DPR phone that is a very large raster that may be re-rastered or evicted |
| Acceptable fixes (apply the one the trace supports; combine only if needed) | for (1) animate with `transform: translate3d` and verify sub-pixel interpolation, or raise the step to whole device pixels by choosing a speed whose per-frame move is an integer at the device pixel ratio; for (2) give the bar an opaque enough fill and drop its blur, or keep blur but only on the top 44 px with `contain: paint`; for (3) tile the helix at one period (720 units tall) and repeat, instead of one tall layer |
| Acceptance | in a 10 s trace on 60 Hz: no frame longer than 20 ms, no main-thread work attributable to the wallpaper, no visible seam. Verified by the owner on PC and phone |

### «Гель» (`gel`): bands creep, glow is visible (D-10)

| Aspect | Contract |
|--------|----------|
| Bands | in lanes 1–8 each band drifts down its lane at 6 units/s, linear (about 18 units in 3 s: visible, calm). At the bottom it leaves through the existing `wp-gel-mask` fade, and re-enters at the top of the lane (just under the wells) fading in over 3 s. Each band is phased independently (negative `animation-delay`) so lanes never reset in step |
| Ladder (lane 0) | stays still, together with its size labels. The labels must always match the ladder bands |
| Replicates | lanes 3 and 4 keep identical fragments but move with different phases, so they do not read as a copy |
| Glow | `.wallpaper-gel-glow` band opacity factor raised from `0.08` to `0.16`; glow stroke width factor from `2.2` to `3`; breathing cycle shortened from 12 s to 8 s, opacity range `.5 → 1`, `ease-in-out alternate` |
| Cost | animate `translate` and `opacity` only, on the band `<path>`s (about 50). No new filters |

### «Клетки» (`cells`): alive tissue (D-11)

`cellField()` currently emits one merged `<path>` for all walls and one for all nuclei. To move cells, emit one element group per cell. Contract:

| Aspect | Contract |
|--------|----------|
| Structure | each cell is one `<g>` containing its wall path and its nucleus; infected cells keep `.is-infected` styling. Group is `transform-box: fill-box; transform-origin: center` |
| Drift | each cell translates ±12 units along its own fixed seeded direction, half-period 14 s, `ease-in-out alternate`, random phase |
| Shape change | each cell scales between `1 − 0.05` and `1 + 0.05` (the two axes in anti-phase: wider/shorter then taller/narrower) and rotates ±2 degrees, half-period 8 s |
| Pushing neighbours apart | phases are assigned so that neighbouring cells are in anti-phase: when one swells toward a neighbour, that neighbour contracts and drifts away. A cell's phase comes from the parity of its seeded-position angle, not from independent random numbers, so the effect reads as pushing, not as noise |
| Nucleus | moves with the cell, plus its own extra ±2 unit offset (it drifts inside the cell) |
| Virions | float between cells: each virion drifts ±18 units over a half-period of 18 s on its own path and still tumbles (`particle-tumble`, 20 s), replacing the single group-level `cells-drift` (36 s, ±8 px) |
| Budget | only cells inside the sharp zone are animated (distance from `(cx, cy)` under 0.8 of the radius, about 60% of the cells; the rim is already masked to opacity `.12`); the rest are static. If the owner's phone cannot hold 60 fps with this, reduce the animated count first, never the amplitude |
| Gaps | the 16% wall shrink stays; neighbouring walls must not visibly overlap at peak swell (scale cap ±5% on a gap of at least 8% keeps this true) |

Verification (all four): the owner watches each of the four wallpapers on the PC and on the phone, and with «Анимации: Выключены» every wallpaper is still and complete (spider drawn at rest).

---

## Limits UI (CONT-01: D-14, D-15, D-16, D-17)

Suggested numbers (Claude's choice per D-14, sized from the 2026-10-19 backup of `portia_content`: the largest run list is 50 runs, the longest run is 23 096 characters, 24 formatted-text keys, 2 blocks and 2 subsections at most). The planner may adjust; constants live once in `lib/portia-content-normalize.ts` and are imported by the editor and the server.

| Limit | Now | New | Visible to the user? |
|-------|-----|-----|---------------------|
| Rich-text runs per text | 500 | 5 000 | no |
| Characters per run | 100 000 | 1 000 000 | no |
| Formatted-text keys | 1 000 | 10 000 | no |
| Quest conditions length | 4 000 | 40 000 | no |
| Table rows per table | 100 | 500 | yes |
| Blocks per subsection | 100 | 300 | yes |
| Subsections per section | 50 | 150 | yes |

### Visible limits: counter and caption (D-15)

Pattern: the existing `.scientist-log-actions` row (button(s) on the left, 11px `<span>` on the right).

| State | Add button(s) | Right-hand text |
|-------|---------------|-----------------|
| Under 80% of the limit | enabled | nothing (no counter) |
| From 80% up to the limit (for example 400 of 500 rows) | enabled | `{n} / {max}`, 11px 400, muted (`oklch(.596 .029 var(--accent-hue))`, the colour `.scientist-log-actions > span` already uses) |
| At the limit | `disabled` (opacity .4, `cursor: not-allowed`, as the existing `:disabled` rule) | `МАКСИМУМ {max}`, 11px 700, `--warning` |

Rules:
- Applies to: «+ СТРОКА» (rows), the block buttons «+ ТЕКСТ», «+ ТАБЛИЦА», «+ ВИДЕО», «+ ФОТО» (blocks) and «+ ПОДРАЗДЕЛ» (subsections). The four block buttons are disabled together and share one counter or caption at the end of their row; the caption is not repeated per button.
- The text span is always in the DOM with `aria-live="polite"` (empty below 80%), so the change to «МАКСИМУМ N» is announced. Each disabled button references it with `aria-describedby`, so a screen reader hears the reason for the disabled state.
- Changing the count by undo or by deleting a row moves the state back immediately (derived from the draft, not stored).
- Phone: the row may wrap; the caption goes under the buttons with a `4px` gap; buttons `min-height: 40px`.

### Invisible limits: nothing cut, warning near «СОХРАНИТЬ» (D-16, D-17)

- No counter and no input `maxlength` for invisible limits. The save sends everything whole.
- If any invisible limit is exceeded in the draft, one extra `<span>` in the savebar status line (`.editor-savebar > p`, same slot as `.editor-savebar-sections`, `--warning` colour, 11px) shows:
  - `ТЕКСТ ОЧЕНЬ БОЛЬШОЙ: {ПОЛЕ}. СОХРАНЯЕТСЯ ЦЕЛИКОМ.` for one field;
  - `ТЕКСТ ОЧЕНЬ БОЛЬШОЙ: {ПОЛЕ} И ЕЩЁ {N}. СОХРАНЯЕТСЯ ЦЕЛИКОМ.` for several (the first by document order is named).
- It does not disable «СОХРАНИТЬ» and does not use `role="alert"`; it sits in the existing `role="status"` polite region.
- While the formatting panel is open the status line is one truncated line (existing rule at `app/portia.css` 503); this span follows that rule (ellipsis), so the savebar height and the panel offset do not change. Phase 11 (EDIT-05) will rework the unsaved plate; keep the message inside the status slot so it moves with it.

---

## Quest Dates and «ВАЖНО» (CONT-04, CONT-06, CONT-07)

### End date before start (D-18)

| Element | Contract |
|---------|----------|
| Field | the existing «Дата окончания» `.editor-field` gets `.is-invalid` when `endsAt < startsAt` (ISO `YYYY-MM-DD` strings compare correctly). Computed from the draft on every render, so an already-stored bad quest is flagged as soon as it is opened |
| Input | `border-color: var(--danger)`; `aria-invalid="true"`; `aria-describedby` points to the error line |
| Error line | `.editor-field-error` under the input, `margin-top: 4px`, 11px/1.45 weight 400, colour `#e07d74`, text `Окончание раньше начала` |
| Native `min` | the existing `min={startsAt}` stays; it only helps the picker, the check above is the real one |
| No auto-swap | the editor never changes either date for the user |
| Save blocked | while any quest in the draft is invalid, «СОХРАНИТЬ» is `disabled` and the savebar status shows a button-styled message in `#e07d74`, 11px 700: `ИСПРАВЬТЕ ДАТЫ КВЕСТА: «{НАЗВАНИЕ}»`. Activating it switches to the «Сводка» tab, scrolls that card into view and focuses its «Дата окончания» input (reuses the `broadcastEditorTab` mechanism). The message is always visible when the button is disabled for this reason, so the disabled state is never a mystery |
| Server | does not reject (D-01); only the editor blocks |
| Desktop | an already-stored bad quest is shown as is (both dates printed), no extra error on the visitor side |

Interpretation to confirm in planning: D-18 says "saving is blocked", so one old bad quest blocks saving anything until its date is fixed (one edit away, reachable from the message). If the owner would rather allow saving other changes, scope the block to quests changed in the current draft. Default in this contract: block while any quest in the draft is invalid.

### «ВАЖНО» (D-19)

- The editor already shows the «ВАЖНО» checkbox only for `type === "news"` (`portia-editor.tsx` 1094); no new control.
- Changing news to quest clears `important`. Changing back does not restore it. Undo of the type change restores the previous card in full, including `important`.
- Desktop (`portia-desktop.tsx` 1283): the `important` class and the ` · ВАЖНО` suffix render only when `item.type === "news" && item.important`. A quest never shows «ВАЖНО», even if stored data has `important: true`.

### Undo/redo of a type change (CONT-05)

No new visuals. After undo or redo that changes a card between news and quest: the tab switches to «Сводка», the card is scrolled into view with `block: "nearest"` (instant under reduced motion, smooth only under `data-motion="full"`), and focus moves to that card's type select (`[data-broadcast-type]`). No toast.

### Status from the first render (CONT-07)

No new visuals. The status badge (`.quest-badge`, states such as `state-*`) must have its final text on the first painted frame. Contract: no badge text or class change between first paint and the second render (no «ИДЁТ» becoming «ЗАВЕРШЁН» a frame later). Initialise `today` lazily; keep hydration consistent with the server render (planner decides how).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | «СОХРАНИТЬ» (existing; unchanged). This phase adds no new primary CTA |
| Limit counter (80%..limit) | `{n} / {max}` (example `400 / 500`) |
| Limit caption (at the limit) | `МАКСИМУМ {max}` (example `МАКСИМУМ 500`) |
| Too-large warning (savebar) | `ТЕКСТ ОЧЕНЬ БОЛЬШОЙ: {ПОЛЕ}. СОХРАНЯЕТСЯ ЦЕЛИКОМ.` / `ТЕКСТ ОЧЕНЬ БОЛЬШОЙ: {ПОЛЕ} И ЕЩЁ {N}. СОХРАНЯЕТСЯ ЦЕЛИКОМ.` |
| Empty state heading | no new empty states. Existing copy stays: «Записей учёных пока нет.», «Добавьте первую запись вируса.» |
| Empty state body | not applicable. A card with a missing or non-text title keeps showing the existing «БЕЗ НАЗВАНИЯ» on the desktop (a title of the wrong type becomes an empty string, D-20) |
| Error state (end before start) | field line: `Окончание раньше начала`. Savebar message: `ИСПРАВЬТЕ ДАТЫ КВЕСТА: «{НАЗВАНИЕ}»` (names the problem, the quest, and the way out: it jumps to the field) |
| Destructive confirmation | `УДАЛИТЬ НАВСЕГДА`: «Удалить «{название}» навсегда вместе с оформлением? Это действие нельзя отменить.» (existing dialog; only the words «вместе с оформлением» are new, because CONT-03 now removes the formatting too). Buttons stay «УДАЛИТЬ НАВСЕГДА» (danger) and «ОТМЕНА» (secondary, autofocus). Restoring from the Корзина keeps formatting and needs no confirmation |
| Wallpaper | no text. The spider and waves are decoration with no label or tooltip |

---

## UI Considerations

Applicable state considerations resolved: 8 covered, 2 backstop, 1 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | list-collection (table rows, blocks, subsections) | ✅ covered | At zero items the counter is hidden (under 80%) and «+» is enabled; the existing editor empty copy is unchanged |
| zero-one-many | list-collection (table rows, blocks, subsections) | ✅ covered | Below 80% no counter; from 80% `{n} / {max}`; at the limit `МАКСИМУМ {max}` and the add buttons are disabled; undo or delete re-enables them at once |
| overflow | list-collection (rows/blocks/subsections at the limit) | ✅ covered | At the limit the add buttons are disabled with a visible reason and `aria-describedby`; the server never truncates, so existing documents over a limit still open and save whole |
| long-text | static-content (invisible limits) | ✅ covered | An over-limit text is kept whole; the savebar names the field once with `ТЕКСТ ОЧЕНЬ БОЛЬШОЙ: {ПОЛЕ}. СОХРАНЯЕТСЯ ЦЕЛИКОМ.`; no truncation, no input `maxlength` |
| partial | form (quest dates) | ✅ covered | A quest with only a start or only an end date is valid (no error); the error only shows when both dates exist and the end is earlier |
| error | form (quest dates) | ✅ covered | Invalid end date: red field, `Окончание раньше начала`, «СОХРАНИТЬ» disabled, savebar message that jumps to the field |
| error | list-collection (cards with wrong-type fields) | ✅ covered | Wrong-typed fields are coerced (number or boolean to text, object or array to an empty string); an empty title shows «БЕЗ НАЗВАНИЯ»; nothing crashes and no error UI is shown to the visitor |
| partial | list-collection (cards with missing or empty id) | ✅ covered | The card is kept and gets a deterministic id; nothing visible changes |
| loading | nav / interactive-control (quest badge on first paint) | 🧪 backstop | Badge text identical on first and second render; to be confirmed by a held-out render test (no flicker) |
| error | media (wallpaper animation frame rate) | 🧪 backstop | 60 fps on the owner's PC and phone, no stepping on the helix; confirmed by the owner in the browser and by a performance trace, not by unit tests |
| long-text | interactive-control (savebar message with a very long quest title or field name) | ⚠ unresolved | Planner treats as assumption: ellipsis inside the single-line status slot on desktop, wrapping on phone (`display: block`); the full name is available in the field's own card |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable (`Tool: none`) |
| third-party | none | not applicable (none declared, no vetting run) |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending
