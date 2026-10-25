# Phase 10 — UI Review

**Audited:** 2026-10-26
**Baseline:** 10-UI-SPEC.md (approved 2026-10-25)
**Screenshots:** not captured (no dev server on 3000, 5173 or 8080; code-only audit)
**Interaction captures:** off (workflow.ui_interaction_capture is false). Interaction findings are code-derived; the SUMMARY files report headless-Edge harness runs (10-desktop-check.mjs) that this audit did not re-run.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract strings present; «Свой» has no noun; sr-only quest line fallback copy is invented |
| 2. Visuals | 3/4 | «Свой» rainbow swatch and spanning layout match; swatch shows --teal only, not the picked colour exactly |
| 3. Color | 3/4 | Accent tokens derived and kept on the declared elements; rainbow swatch uses hardcoded hexes; contrast not re-verified here |
| 4. Typography | 3/4 | No new styles; color row forced to 13px font with column layout, a deviation from the "no new styles" claim |
| 5. Spacing | 3/4 | New rules use 4px gap; 4px inline padding on color buttons shrinks hit width |
| 6. Experience Design | 3/4 | State coverage good; zoom layer lacks the contracted pointer-events: none; sandbox keeps allow-scripts + allow-same-origin |

**Overall: 18/24**

No pillar is at 1, so no BLOCKER. All findings below are WARNINGs.

---

## Top 3 Priority Fixes

1. **Zoom layer does not use `pointer-events: none`** — `.document-app-zoom-layer` (app/portia.css:1579) is `position:absolute; inset:0` with pointer handlers (components/portia-desktop.tsx:1636). While Ctrl is held it swallows every click and scroll over the document. It clears on the first unmodified pointer event, but a stale held state (missed keyup) still blocks the first click. UI-SPEC says the layer must never intercept clicks. Fix: `pointer-events: none` on the layer and drive the clear from the `.document-app` wheel/key handlers, or keep the layer but verify `blur`/`visibilitychange` clearing on a real device.
2. **Embed sandbox pairs `allow-scripts` with `allow-same-origin`** (portia-desktop.tsx:31) — for same-origin content this lets the framed page remove its own sandbox. Spec's start set mandates it, so it is a contract-accepted risk. Fix: confirm that Таблица, Устав and YouTube are all cross-origin (they appear to be) and record that in the ledger; drop `allow-same-origin` for any embed that proves not to need it.
3. **Color row visual deviation** — `.color-options > button` (portia.css:296) changes the row to stacked column layout, 13px font and 4px inline padding, which the spec did not declare. Fix: add the exception to UI-SPEC or re-check "Холодный" at 520px and 375px with a screenshot (not captured in this audit).

Further minor items: «Настройки сохранены» uses `role="status"` plus `aria-live="polite"` redundantly (portia-desktop.tsx:1416); `LoadingState` carries its own `role="status"`, so the quest notice's hidden status and the loading status can announce together; `zoomModifier` detects Mac with deprecated `navigator.platform` only, while the spec allows `userAgentData?.platform` first.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Present as contracted: «Свой» (portia-desktop.tsx:1403), picker title «Свой цвет интерфейса» (:1409), «Новый квест: {название}» in a hidden status span (:1887), Roblox tooltip `title` equal to `aria-label` (:1283), no `title` on the non-link figure.
- WARNING: the status line falls back to «БЕЗ НАЗВАНИЯ» (:1887) when a quest has no title. Not in the contract; the announcement then reads «Новый квест: БЕЗ НАЗВАНИЯ».
- WARNING: bare «Свой» has no noun (spec checker already flagged it, non-blocking); the picker title is the only context.

### Pillar 2: Visuals (3/4)
- Rainbow conic swatch for the no-saved-colour state exists (portia.css:304). Picker is the last grid child spanning `1 / -1` (:293). Phone layout spans «Свой» across both columns (:1199).
- WARNING: swatch background is `customTokens["--teal"]`, the clamped derived accent, not the raw pick; a grey or very dark pick shows a different colour than the swatch the user chose. Intended per D-05, but the picker's own swatch and this one can disagree.
- No icon-only button lacks an accessible name in the audited sections (close button has `aria-label`).

### Pillar 3: Color (3/4)
- Accent use stays on the reserved list: `.setting-options button.selected` border and inset underline (:297-298), «Свой» included.
- WARNING: `.swatch.*` fixed hex values (:300-304) are hardcoded; acceptable for swatches that must not follow the live accent.
- Not re-verified in this audit: contrast of `--teal` on `--bg` across the hue sweep (reported as covered by lib/accent-theme.test.ts in 10-01).

### Pillar 4: Typography (3/4)
- No new font stacks or weights in the audited code. Sizes 11 and 13 as declared.
- WARNING: `.color-options > button { font-size: 13px }` (:296) changes the label size of the preset buttons for the whole row, outside the "no new type styles" statement.

### Pillar 5: Spacing (3/4)
- New values: 4px gap (:296). Existing 9px/54px exceptions are respected (min-height 54px kept, :294).
- WARNING: `padding-inline: 4px` on a button whose neighbour spec reserved `padding: 10px` leaves thin side padding; at 375px with 2 columns this is fine, at the 520px window it is the tightest case (SUMMARY 04 notes «Холодный» was 2px over before the fix).

### Pillar 6: Experience Design (3/4)
- Covered: assistant bubble visibility derived from usable text (`assistantSpeaking`), Escape inside the accent picker preventDefault-marked then ignored by the quest-notice document listener (:1875-1880) which also skips inputs, contenteditable and open `dialog`; virus list is a listbox only while rows exist, with `role="option"` and `aria-selected` (:1244-1248); loading state sits outside the listbox; factory reset clears the custom colour; picker keeps `aria-pressed` on «Свой».
- WARNING: zoom layer behaviour (Top fix 1).
- WARNING: Escape handler skips only `input, textarea, select` and contenteditable; a focused `button` in another window does not block it, so Escape dismisses the notice from any focused control. This matches the spec text but means Escape in an unrelated widget (for example a custom menu) is also consumed unless that widget calls `preventDefault`.
- Not verified here: real-device load of the sandboxed «Таблица», «Устав» and YouTube frames (owner check, backstop in the spec).

---

## Files Audited
- components/portia-desktop.tsx (lines 31, 1242-1283, 1403-1426, 1588-1636, 1870-1897, 1971-1980)
- app/portia.css (lines 78-90, 292-304, 1198-1199, 1579)
- 10-UI-SPEC.md, 10-01 to 10-07 SUMMARY files (07 not opened in detail)
