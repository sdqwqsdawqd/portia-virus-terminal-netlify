---
phase: PORTIA-05-oformlenie-teksta
reviewed: 2026-10-19T18:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - components/portia-editor.tsx
  - lib/rich-text-style.ts
  - lib/rich-text-style.test.ts
  - app/portia.css
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase PORTIA-05: Code Review Report (re-review after gap closure 05-06)

**Reviewed:** 2026-10-19 (pass 1: diff `435f010..HEAD`; pass 2, incremental: diff `a5c0b3f..HEAD`, see the last section)
**Depth:** standard (diff `435f010..HEAD`: commits d2d6a0c, f33d323, 76436b8, plus surrounding context)
**Files Reviewed:** 4
**Status:** issues_found

## Summary

I read the 05-06 diff and the full `FormattedTextarea` / `FloatingTextFormatPanel` flow. I also ran `npm test` (202 pass, 0 fail), `npx tsc --noEmit` (clean) and eslint on the three files (0 errors, only 3 old `<img>` warnings).

**Prior findings:**

| Finding | Status | Evidence |
|---------|--------|----------|
| CR-01 (one-shot `touchedRef`) | Resolved in code | The flag is gone. `fieldSelectionStep` opens the own-input window on pointer / key down and closes it 400 ms after `up`. `onPointerCancel` closes it, `onBlur` resets `{stored: null, ownUntil: 0}`, and a `read` never changes `ownUntil`. Path 1 (focus read spends the touch), path 2 (stale range on re-entry) and path 3 (flag never cleared) are each closed, and the nine `event order:` tests cover them. Only the pure function is tested, not the component wiring. See IN-01. |
| WR-02 (17 / 400 defaults) | Resolved for the readout | `fontSize` and `fontWeight` come straight from `style`, so unstyled text marks no size or weight button. The 14 px -> 17 px jump on "M" is untouched. This was deferred in the plan, but the disposition file records WR-02 as plain "fixed" (IN-04). |
| WR-03 (`{0,0}` fallback) | Resolved for the policy; one leak remains | `nextFieldSelection` no longer invents a caret at 0, `resolveRange(text, null)` returns null, and the panel shows "ВЫДЕЛИТЕ ТЕКСТ" with controls disabled. The ГОТОВО path can still produce a first-word target, see WR-01. |
| WR-04 (mousedown / PC highlight) | Resolved in code | `onMouseDown={keepFieldFocus}` was added next to the pointer handler, and the `portia-format` highlight is painted at every width. `::highlight(portia-format)` in `app/portia.css:516` is a global rule, not inside a phone media query, so the PC highlight really renders. Whether pointerdown + mousedown `preventDefault` keeps focus on iOS Safari and Chrome Android is a runtime question. The SUMMARY records the owner's "approved" for steps 1-6. |

No new correctness or security defect in the changed lines was found. One warning is a regression path for WR-03, and four are info.

## Warnings

### WR-01: ГОТОВО with an unknown selection lets the browser's default caret become the target (first word)

**File:** `components/portia-editor.tsx:1908-1915` (with `1759-1762`)
**Issue:** `finish()` calls `flushSync(onClose)`, so `phonePanelOpen` is already false when `field.focus()` runs. The `read` that `onFocus` sends is then `guarded: false`, which makes it "own", and the field takes whatever `selectionOffsets` reports. When the panel's `target.selection` is null (nothing known, the state WR-03 introduced), the code skips `restoreSelection`. Calling `focus()` on a contenteditable that has no selection normally puts the caret at offset 0. That `{0,0}` is stored and passed to `onActivate`. The next time ✎ is opened, `resolveRange` turns it into the first word. This is the symptom WR-03 was meant to remove ("the first word is targeted although the user pointed at nothing"), reached through a different door. The effect is limited to the phone, where `finish` runs `focus()`, and to a null selection.
**Fix:** After `focus()`, when `target.selection` is null, send nothing back to the panel. For example, give `finish` a way to skip the focus-driven activation:
```tsx
if (!target.selection) return; // nothing known: do not focus, a default caret at 0 would become the target
field.focus({ preventScroll: true });
restoreSelection(field, target.selection);
```
Or, if the keyboard must come back, mark the focus as not own for this one `read` (for example a `guarded: true` override) so a collapsed `{0,0}` is rejected.

## Info

### IN-01: The `event order:` tests drive a hand-written event list, not the component wiring

**File:** `lib/rich-text-style.test.ts:162-220`; `components/portia-editor.tsx:1802-1822`
**Issue:** The tests are correct for `fieldSelectionStep`, and they pin the CR-01 policy well. Which React event sends which step event (`onPointerDown` -> `down`, `onPointerUp` / `onPointerCancel` -> `up`, `onBlur` -> `blur`, `onKeyDown` -> `down`, `onKeyUp` -> `up`, `activate` -> `read`) is checked only by the plan's string-grep step. Removing `onPointerCancel` or swapping a handler would keep every test green. There is also no test of the window boundary (`at === ownUntil`, strict `<`).
**Fix:** Keep as is for now. If a DOM test runner is ever added, replay a real pointer / focus sequence against `FormattedTextarea`. Meanwhile one boundary test (`read` exactly at `up + 400` is not own) costs three lines.

### IN-02: The own-input window can stay open or close early in uncommon sequences

**File:** `lib/rich-text-style.ts:146-151`
**Issue:** `down` sets `ownUntil: Infinity` and any `up` closes it, so (a) a mouse press in the field released outside it, or a lost keyup, leaves the window open until blur (A3 in the plan, only matters on a PC narrower than 900 px); (b) releasing one key while another key or the finger is still down closes the window early; (c) a collapsed caret moved by the Android / iOS caret handle has no pointer event in the page, so with the phone panel open it is treated as "not own" and rejected while the old stored selection stays highlighted. All of these follow from the D-05 design and the accepted assumptions, not from a coding mistake.
**Fix:** None required. If (c) shows up on a device, count `selectionchange` that happens while a touch is active on the document as own, or accept collapsed readings while the field is focused and the panel is not the active element.

### IN-03: Stale and inconsistent text around the new highlight

**File:** `app/portia.css:515`; `components/portia-editor.tsx:23-24`
**Issue:** The CSS comment still says "Phone: the stored selection stays marked ...", but the highlight is now painted at every width. The editor also imports from `@/lib/rich-text-style` twice (`import type {...}` on one line, a value import on the next), while the same file already uses inline `type` specifiers (lines 11-21).
**Update (pass 2, 05-07):** the comment half is RESOLVED by commit 7191038. The comment above `::highlight(portia-format)` now reads "Marks the text the next style changes ... shown at every width (phone: in place of the keyboard; PC: while focus is in the panel)" and matches the effect at `components/portia-editor.tsx:1878-1880`. The import-merge half is still open.
**Fix:** Change the comment to "Marks the text the next style changes (phone: in place of the keyboard; PC: when focus is in the panel)". Merge the imports: `import { applyRichTextStyle, ..., type FieldSelectionEvent, type FieldSelectionState } from "@/lib/rich-text-style";`.

### IN-04: The disposition record says WR-02 is plainly "fixed" while part of it is deferred

**File:** `.planning/phases/PORTIA-05-oformlenie-teksta/05-REVIEW-DISPOSITION.md:13-16, 53`
**Issue:** The 05-06 plan fixes the wrong "selected" marks but explicitly defers the second half of WR-02: pressing "M" on a 13-14 px area still jumps to 17 px, and a repeat click still writes explicit runs and unmarks "Обычный". The table shows `fixed` with Source `05-06` and no mention of the remainder, which exists only in the plan's "Deferred" table and the Phase 1 STATE concern.
**Fix:** Append "readout only; 17 px preset jump stays a STATE.md concern" to the WR-02 row, so a later reader does not assume the whole finding is closed.

---

## Incremental pass 2: plan 05-07 (diff `a5c0b3f..HEAD`, `app/portia.css`)

**Scope:** commit 7191038 only. `::highlight(portia-format)` changed from `background-color: rgba(var(--desktop-glow), .35)` to `text-decoration: underline solid rgba(var(--desktop-glow), .9) 3px;`, and its comment was rewritten. `components/portia-editor.tsx` is untouched (wiring at 1878-1905 still sets the same `portia-format` name).

**What I checked:** the diff is 2 lines; no background declaration remains; the only property is `text-decoration`, which is allowed in `::highlight`; the selector and registry name match `CSS.highlights.set("portia-format", ...)`; `::selection` (line 69) and `.formatted-rich-input::selection` (line 71) are unchanged; the file has LF endings before and after (no mixed endings; line count 1549 both sides); no site code or editor style produces an underline (grep of `lib/rich-text-style.ts` and the editor), so the marker cannot be confused with an applied style, and no author underline collides with it. No correctness or security defect in the change.

### WR-05: The only target cue has low contrast on the light preview field

**File:** `app/portia.css:516` (field background `--field-bg: #f3f1e9` at `app/portia.css:599`)
**Issue:** `rgba(0,188,166,.9)` over `#f3f1e9` is about 2.1:1 (relative luminance of the teal about 0.39, of the field about 0.88), below the 3:1 that WCAG 1.4.11 asks of a non-text cue. The underline is now the marker's only visual (the fill, which was the stronger signal on a light field, is gone), and the field has a `preview-light` mode that the format panel can target. A thin 3px line in this pale teal can be easy to miss on a light field, which brings back the "what will the next style change" uncertainty the gap was meant to close. On the dark field (`oklch(.168 ...)`) the contrast is fine. The plan's device check does not say which preview mode the owner used.
**Fix:** Confirm in the device check with `preview-light` on. If the line is faint, use one darker teal that works on both fields, still with no fill, for example `::highlight(portia-format) { text-decoration: underline solid rgba(0, 150, 132, .95) 3px; }`. `::highlight` cannot read a custom property from the field, so a per-mode colour would need a second highlight name.

### IN-05: Thickness and no-fallback behaviour of the shorthand is unverified in the browsers that matter

**File:** `app/portia.css:516`
**Issue:** The plan flags it as an assumption: `text-decoration` with a `3px` thickness inside `::highlight` is painted in current Chromium, WebKit and Firefox. I could not run a browser here. Support for the thickness part of the shorthand in highlight pseudo-elements has been uneven, and if a browser ignores the thickness it falls back to the default (about 1px) hairline, which is much weaker than the old fill. The editor code at line 1888 also sets no marker at all where the Custom Highlight API is missing (older Firefox, Android WebView), so those users get no cue, as before this change. The owner's step 1-3 device check is the only proof of the shape.
**Fix:** None required if the owner's approval of 05-07 steps 1-5 covers PC Chrome, a real phone and ideally Safari / Firefox. Otherwise record which browsers were seen in the SUMMARY.

### IN-06: The "no fill in the marker" guarantee lives only in the plan's one-off check

**File:** `app/portia.css:516`; `.planning/phases/PORTIA-05-oformlenie-teksta/05-07-PLAN.md` (Task 1 verify)
**Issue:** The node check that rejects a `background*` declaration on `::highlight(portia-format)` runs once as a plan step. It is not in `npm test`, so a later edit that puts a fill back (the exact G-05-2 regression) would stay green.
**Fix:** Optional, cheap: add a small test in `lib/` that reads `app/portia.css` and asserts the single `::highlight(portia-format)` rule has no `background` property and contains `underline`.

---

_Reviewed: 2026-10-19 (pass 2 appended)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
