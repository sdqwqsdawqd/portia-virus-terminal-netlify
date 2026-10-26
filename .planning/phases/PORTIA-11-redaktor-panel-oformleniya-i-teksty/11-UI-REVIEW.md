# Phase 11 — UI Review

**Audited:** 2026-10-26
**Baseline:** 11-UI-SPEC.md (approved, with planner amendments)
**Screenshots:** not captured (no server started; the owner already approved on PC Firefox and iPhone WebKit; code-only audit)
**Interaction captures:** off

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All contract strings are in the code; forbidden phrases and the empty `<small>` are gone |
| 2. Visuals | 3/4 | Structure matches the contract; the TOC and phone touch targets were not verified visually |
| 3. Color | 3/4 | Highlight uses the amended oklch value; chip colours follow the contract; hardcoded `#e07d74` is a spec-sanctioned exception |
| 4. Typography | 3/4 | Not fully verified: legacy 9/12/13px sizes remain; no new sizes were checked against the table |
| 5. Spacing | 3/4 | The 44px phone chip and sheet offsets are in the CSS; the TOC item `padding: 4px 0` on phone was not verified at 44px |
| 6. Experience Design | 3/4 | State coverage is good; reduced-motion handling is by `data-motion` rather than a CSS media query |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **TOC item touch target on phone (WARNING)** — `app/portia.css:602` sets `.editor-toc button` to `padding: 4px 0`; the spec requires 44x44 for TOC items at <= 900px. I did not find an override in the lines I read. Impact: mis-taps in long lists on a phone. Fix: add `min-height: 44px` inside the `(max-width: 900px)` block.
2. **Reduced-motion is not CSS-driven (WARNING)** — The spec says animations are disabled under `prefers-reduced-motion`. `portia.css` has one such media query. Elsewhere the code relies on `html[data-motion]` and `jumpToCard` (`portia-editor.tsx:889`). `portia-editor.tsx:478` calls `scrollIntoView({ block: "start" })` with no behavior set, so it follows the CSS default. Fix: confirm `data-motion` is derived from the media query, and make line 478 consistent with line 889.
3. **Typography drift not proven (WARNING)** — New chrome should use only 13/11/10/17px at weights 400/700. The stylesheet still has 9px, 12px (`.editor-record-list strong`) and other legacy sizes. The spec allows legacy ones, but I did not diff the new selectors against the table. Fix: grep the new selectors (`.editor-toc`, `.editor-save-chip`, `.floating-text-format`) for sizes and weights outside the table.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Every contract string was found in `components/` or `app/`: `ВЫДЕЛИТЕ ТЕКСТ`, `ВЫБРАНО`, `СБРОСИТЬ`, `ОГЛАВЛЕНИЕ`, `СВЕРНУТЬ ВСЕ`, `РАЗВЕРНУТЬ ВСЕ`, `Строк пока нет`, `Разделов пока нет`, `Закрыть панель оформления`, `Свернуть панель оформления`, `НЕ СОХРАНЕНО`, `Переставить столбец`, and the `Ctrl (Cmd …` hint.
- The A11Y-03 rule holds: `grep "фигни|пирожок|<small></small>|<small />"` over `components/` returns nothing.
- `99+` is absent; this is correct under the amendment, since the count is at most 6.

### Pillar 2: Visuals (3/4)
- The save chip replaces the full-width strip as specified: `.editor-save-chip` (`portia.css:474`) is sticky at the bottom right, with `aria-haspopup`.
- The TOC is sticky with `max-height: 40svh` and an `ol` that scrolls (`portia.css:600-606`).
- No screenshots, so focal point and overlap (long title against row actions) are code-derived. The owner has approved on device.

### Pillar 3: Color (3/4)
- `::highlight(portia-format)` (`portia.css:531`) matches the amended value: underline only, no background, accent-derived oklch.
- Chip states: dirty uses `--warning`, blocked uses `--danger` with text `#e07d74`, as the spec says (`portia.css:476-477`). The hardcoded hex is the spec's own value.
- Active TOC item accent and `aria-current` were not re-verified in the CSS.

### Pillar 4: Typography (3/4)
- The chip uses `font: 700 11px/1.35 var(--sans)` with `.04em` tracking, which matches the Label role.
- Legacy sizes remain by design. I did not exhaustively check new selectors, so this is a 3 and not a 4.

### Pillar 5: Spacing (3/4)
- Phone chip: `min 44x44`, `bottom: 52px`, plus `calc(52px + min(34svh, 270px))` with the sheet open and `96px` with it folded (`portia.css:1244-1247`). All match the amended spec.
- At <= 520px the chip uses `right: 54px` (`portia.css:1300`), as amended.
- The `:has(.floating-text-format)` padding hacks were replaced by `.content-editor:has(> .editor-save-chip) { padding-bottom: 110px }`. This is a new magic number; it is acceptable.
- The TOC item padding gap is in Priority Fix 1.

### Pillar 6: Experience Design (3/4)
- Panel z-index is 950, as amended (`portia.css:688`). The panel has focus-visible rings on the header, the sheet toggle and the reset button (`portia.css:695-743`). The TOC and chip have rings too (`portia.css:478`, `605`).
- Empty states exist for the section list and the table. The save chip covers dirty, blocked, saving and saved states. The chip is hidden when clean.
- The remaining gap is reduced-motion handling (Priority Fix 2). Dragging and multi-select feel were left to the owner by the spec and were approved on Firefox and iPhone.

---

## Registry Safety
Skipped: `components.json` is absent and the spec declares no third-party registries.

## Files Audited
- `app/portia.css` (selected rules: highlight, save chip, TOC, floating panel, phone overrides)
- `components/portia-editor.tsx`, `components/portia-desktop.tsx` (string and behaviour greps only)
- `11-UI-SPEC.md`, `11-CONTEXT.md`, and the 11-0x PLAN and SUMMARY files named in the request (the UI-SPEC was read in full; the others were not re-read in full)
