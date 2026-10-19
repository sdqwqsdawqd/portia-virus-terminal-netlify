---
phase: PORTIA-05-oformlenie-teksta
reviewed: 2026-10-19T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - components/portia-editor.tsx
  - lib/rich-text-style.ts
  - lib/rich-text-style.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase PORTIA-05: Code Review Report (re-review after gap closure 05-06)

**Reviewed:** 2026-10-19
**Depth:** standard (diff `435f010..HEAD`: commits d2d6a0c, f33d323, 76436b8, plus surrounding context)
**Files Reviewed:** 3
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
**Fix:** Change the comment to "Marks the text the next style changes (phone: in place of the keyboard; PC: when focus is in the panel)". Merge the imports: `import { applyRichTextStyle, ..., type FieldSelectionEvent, type FieldSelectionState } from "@/lib/rich-text-style";`.

### IN-04: The disposition record says WR-02 is plainly "fixed" while part of it is deferred

**File:** `.planning/phases/PORTIA-05-oformlenie-teksta/05-REVIEW-DISPOSITION.md:13-16, 53`
**Issue:** The 05-06 plan fixes the wrong "selected" marks but explicitly defers the second half of WR-02: pressing "M" on a 13-14 px area still jumps to 17 px, and a repeat click still writes explicit runs and unmarks "Обычный". The table shows `fixed` with Source `05-06` and no mention of the remainder, which exists only in the plan's "Deferred" table and the Phase 1 STATE concern.
**Fix:** Append "readout only; 17 px preset jump stays a STATE.md concern" to the WR-02 row, so a later reader does not assume the whole finding is closed.

---

_Reviewed: 2026-10-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
