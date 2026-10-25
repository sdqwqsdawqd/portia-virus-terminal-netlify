# Phase 10 — UI Review (re-audit after 10-08 and 10-09)

**Audited:** 2026-10-26
**Baseline:** 10-UI-SPEC.md (approved 2026-10-25, amended 2026-10-26 for D-23)
**Screenshots:** not captured (code-only audit; no server was built or started)
**Interaction captures:** off (workflow.ui_interaction_capture is false). Interaction findings are code-derived. The 10-08/10-09 SUMMARY files report headless-Edge harness runs (steps j-n) and owner confirmation on PC and phone; this audit did not re-run them.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract strings present; bare «Свой»; invented «БЕЗ НАЗВАНИЯ» fallback in the sr-only quest line |
| 2. Visuals | 3/4 | Picker × is now a clean 24x24 box; «Свой» swatch still shows the derived --teal, not the raw pick |
| 3. Color | 3/4 | `--accent-chroma` now scales the chrome tints (315 oklch uses, none unscaled); rainbow swatch hex hardcoded; contrast not re-run here |
| 4. Typography | 3/4 | No new styles except `.color-options > button` 13px override; `line-height: 1` on × is a legitimate fix |
| 5. Spacing | 3/4 | New rules use 4px/8px; `padding-inline: 4px` on colour buttons is thin |
| 6. Experience Design | 3/4 | State coverage good; zoom layer still lacks `pointer-events: none`; sandbox keeps scripts + same-origin |

**Overall: 18/24** (unchanged from the first review; gap-closure fixed real defects but did not clear the carried warnings, so no pillar moves up)

No pillar is at 1, so there is no BLOCKER. All findings are WARNINGs.

---

## Gap-closure verification (10-08, 10-09)

- D-23 / neutral picks: `:root` sets `--accent-chroma: 1` (app/portia.css:22). Every `oklch(` in the stylesheet that uses the accent hue is written `calc(C * var(--accent-chroma))`; a grep for `oklch(` lines without `accent-chroma` returned none. A neutral pick therefore greys the chrome, as D-23 requires. Spec token table matches shipped behaviour.
- Combinator fix (G-10-2): base, hover and selected rules are `.setting-options > button` (portia.css:294, 297, 298); no bare `.setting-options button` remains. The picker's nested buttons no longer inherit `min-height: 54px` and the column layout.
- Picker ×: `.custom-color-picker-head button { width: 24px; height: 24px; line-height: 1 }` (portia.css:678) matches the spec exception of a 24x24 close button.
- WARNING (carried): 24x24 is below the 40x40 target the spec gives the quest-toast close button and below the 44px WCAG 2.5.5 guideline; it is spec-sanctioned (D-07, reuse) but small for touch on the phone, where the owner confirmed it visually only.
- WARNING (new, minor): `.color-options > button:last-of-type` (portia.css:1199) relies on the picker being a non-button element and on «Свой» being the last button. If the picker head or any button is ever added as a sibling it silently breaks the full-width span.

---

## Top 3 Priority Fixes

1. **Zoom layer has no `pointer-events: none`** — `.document-app-zoom-layer` (portia.css:1579) is `position:absolute; inset:0`; the spec requires `pointer-events: none` for events when the modifier is not held. The layer only clears on a pointer event without the modifier (portia-desktop.tsx:1636), so the first click while Ctrl is held is swallowed. Fix: add `pointer-events: none` and keep the wheel handler on the frame container, or document the exception in the spec.
2. **Embed sandbox pairs `allow-scripts` with `allow-same-origin`** (portia-desktop.tsx:31) — acceptable only for third-party origins; if any frame is same-origin the page can remove its own sandbox. Spec-mandated start set; fix: confirm per-frame origin during the owner device check and drop `allow-same-origin` where the viewer works without it.
3. **Invented fallback copy «БЕЗ НАЗВАНИЯ»** (portia-desktop.tsx:1887, 1893) — a screen reader announces «Новый квест: БЕЗ НАЗВАНИЯ» for an untitled quest, copy that is not in the contract. Fix: omit the title clause or add an agreed string to the Copywriting Contract.

Further minor items: «Свой» swatch uses the clamped `--teal`, so a pick like #0D0D0D shows #868686 (intended per D-23, but the picker's board shows the raw pick); `.color-options > button` 13px and column layout is an undeclared deviation from "no new type styles"; `LoadingState` carries its own `role="status"` (portia-desktop.tsx:1971) alongside the quest status span, so they can announce together; `zoomModifier` reads `navigator.platform` (deprecated) rather than `userAgentData` first as the spec suggests.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Present as contracted: «Свой» (portia-desktop.tsx ~1403), picker title «Свой цвет интерфейса» (:1409), `aria-label="Закрыть выбор цвета"` (custom-color-picker.tsx:65), sr-only «Новый квест: {название}» (:1887).
- WARNING: «БЕЗ НАЗВАНИЯ» fallback (see fix 3). Same string also used as heading fallback at :1306, :1327, :1893.
- WARNING: bare «Свой» has no noun; the picker title is the only context.

### Pillar 2: Visuals (3/4)
- Rainbow conic swatch for the empty state (portia.css:304); «Свой» spans both columns at the mobile breakpoint (:1199); picker spans `1 / -1` below the row.
- Picker × now a defined 24x24 square with `line-height: 1`, resolving the clipped-glyph defect from G-10-2.
- WARNING: swatch background is the derived accent, not the raw pick; for grey or muted picks it differs from the board the user just chose.
- Icon-only controls audited all have accessible names.

### Pillar 3: Color (3/4)
- Accent reserved list respected: selected option border and inset underline use `var(--teal)` (:297-298).
- `--accent-chroma` coverage is complete in portia.css (315 oklch uses, all scaled). Remaining non-scaled literals: error colours `#754b46`/`#e0aaa3` (portia.css:46), `#fff` hover text, and `.swatch.*` hexes (:300-304). The swatches are fixed by design; the owner-login alert colours stay chromatic on a grey theme, a minor inconsistency.
- WARNING: contrast of `--teal` on `--bg` for neutral and muted picks is claimed by lib/accent-theme.test.ts (304 tests pass per 10-09 summary) but was not re-verified here.

### Pillar 4: Typography (3/4)
- Sizes 11 and 13 as declared; no new fonts or weights in the gap-closure CSS.
- WARNING: `.color-options > button { font-size: 13px }` (:296) is outside the "no new type styles" claim.

### Pillar 5: Spacing (3/4)
- New values: `gap: 4px` (:296), grid gap 8px (:291), 24x24 close box. `min-height: 54px` exception kept on direct children.
- WARNING: `padding-inline: 4px` is thin at the 520px window with five columns (SUMMARY 04 noted «Холодный» overflowed by 2px before this fix); not screenshot-verified.

### Pillar 6: Experience Design (3/4)
- State coverage matches the spec table: empty/whitespace tips, missing text, invalid stored colour (strict `#rrggbb`), preset round trip keeps saved custom colour, factory reset clears it.
- WARNING: zoom layer behaviour (fix 1). Layer is `aria-hidden` and clears on pointer events without the modifier, a partial mitigation only.
- WARNING: sandbox flags (fix 2). `sandbox` is never dropped, and «Открыть отдельно» remains the fallback.
- Registry audit: not applicable (no components.json).

---

## Files Audited
- app/portia.css (settings, picker head, zoom layer, accent-chroma coverage)
- components/portia-desktop.tsx (sandbox, zoom, quest notice, loading state)
- components/custom-color-picker.tsx
- 10-UI-SPEC.md, 10-CONTEXT.md, 10-01..10-09 SUMMARY/PLAN, previous 10-UI-REVIEW.md
