---
phase: 03-redaktor
plan: 03
subsystem: ui
tags: [react, css, mobile, contenteditable, custom-highlight-api, visualviewport]

requires:
  - phase: 03-redaktor
    provides: "plan 03-01: save bar (fixed above the taskbar at 900px and below, hidden while the format panel is open), switchTab, repairSelections; plan 03-02: ConfirmDialog flows for bin and delete"
provides:
  - "List-to-record mode at 900px and below for the virus, recycle-bin and employee layouts (data-mobile-view list | record, «← К списку»)"
  - "Editor header hidden on phones; tab strip scrolls the active tab into view"
  - "16px plain inputs / textareas / selects on phones (no iOS focus zoom); 375px overflow audit fixes"
  - "Phone format panel replaces the keyboard: field blurred, selection kept and painted with the CSS Custom Highlight API, scrolled above the panel; ГОТОВО / × / touching the text close it"
affects: [03-04]

plan_head_before: 6e5fc7853a53b7ae68a4cacb0dee13ca09a48a9d
plan_head_after: 6583baf550472123ca38617e65b5ec39d43be794

actuals:
  tokens: 2740
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "CSS-only view switch: one data-mobile-view attribute on the shared .virus-editor-layout, rules in the 900px block hide the other half; PC rules untouched"
    - "revealOnPhone(ref): matchMedia guard + rAF scrollIntoView, so the DOM that replaced the old layout is the one measured"
    - "Phone panel effect keyed on primitives (key, selection start/end, document) with the latest onClose read through a ref"

key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - app/portia.css

key-decisions:
  - "Keyboard is hidden by blurring the field (certain on every phone browser) instead of the RESEARCH Pattern 6 inputmode toggle (A1, unverified); selection survives as stored offsets and is painted with ::highlight(portia-format)"
  - "The phone effect also depends on target.document: a style change re-renders the field's text nodes and would orphan the painted Range, so the highlight is rebuilt after every applied style"
  - "Site-wide viewport settings (maximum-scale, user-scalable, interactive-widget) were not touched; rich-text field fonts unchanged (prohibitions)"

requirements-completed: [EDIT-01]

coverage:
  - id: D1
    description: "Viruses, recycle bin and employees: full-width list, tap opens the record full width with «← К списку»; back button, tab switch, move to bin, delete and restore return or open correctly; horizontal record strip removed"
    requirement: EDIT-01
    verification:
      - kind: other
        ref: "node structural checks 'list to record tracer OK' and 'phone layout OK' + tsc + lint + npm test (62/62) + build"
        status: pass
    human_judgment: true
    rationale: "Real list/record navigation at 375px needs the logged-in editor, which only the owner has"
  - id: D2
    description: "Editor header hidden at 900px and below, tabs first, active tab scrolled into view; plain fields 16px; employee save row wraps; no sideways scroll on any editor screen at 375px"
    requirement: EDIT-01
    verification:
      - kind: other
        ref: "node structural check 'phone layout OK' (header, 16px, wrap rules) + static overflow audit below"
        status: pass
    human_judgment: true
    rationale: "Absence of horizontal scroll at 375px and iOS zoom behaviour are only measurable in a browser inside the editor (ROADMAP Phase 3 criterion 1); RESEARCH A5 (rich-text fields may still zoom on iOS) is an open question for the owner"
  - id: D3
    description: "Format panel on a phone replaces the keyboard, keeps the selection marked above the panel, ГОТОВО / × / tapping the text close it; PC behaviour unchanged"
    requirement: EDIT-01
    verification:
      - kind: other
        ref: "node structural check 'panel instead of keyboard OK' + tsc + lint + build"
        status: pass
    human_judgment: true
    rationale: "On-screen keyboard behaviour of iOS and Android (RESEARCH A1, A2) cannot be exercised without a real phone"

duration: 21min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 03: Editor on a phone Summary

**At 900px and below every list + form section of the editor becomes list then full-width record with «← К списку», the header collapses so the tabs come first, and the format panel takes the keyboard's place with the selected text kept marked above it.**

## Performance

- **Duration:** about 21 min
- **Started:** 2026-10-14T07:19:00Z (approx.)
- **Completed:** 2026-10-14T07:41:00Z
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files modified:** 2

## Accomplishments

- `data-mobile-view` on the viruses, recycle and employees layouts (`recordOpen && selected… ? "record" : "list"`), `.editor-back-to-list` first child, one visibility rule in the 900px block; the old horizontal record strip (flex-basis 170/214, overflow-x) is gone, the list is a `minmax(0, 1fr)` grid.
- `showRecord`/`revealOnPhone`: row taps and the add buttons open the record, back / move-to-bin / delete / «УДАЛИТЬ ЭТОТ ФАЙЛ» close it, «ВОССТАНОВИТЬ В БАЗУ» opens the restored virus, `switchTab` resets to the list. A vanished selection falls back to the list by construction.
- `tabsRef` effect keyed on `tab` shifts the strip's `scrollLeft` by (active centre - strip centre); no setState.
- 900px block: `.editor-header { display: none }`, `.editor-tabs { margin-top: 0 }`, plain `.editor-field` controls at 16px, `.employee-editor-save` wraps.
- Phone format panel: `rangeFromOffsets` split out of `restoreSelection` (behaviour identical), `data-format-key` on the rich-text div, `findFormatField` helper, `FloatingTextFormatPanel` phone effect (blur, `CSS.highlights` "portia-format", keep-visible scroll on frame and `visualViewport` resize, `focusin` on the field closes the panel, full cleanup), `finish()` for × and ГОТОВО refocuses the field and restores the selection. CSS: `::highlight(portia-format)` and phone panel padding `calc(min(44svh, 340px) + 90px)`; the 430px 155px copy removed.

## Task Commits

1. **Task 1 (tracer): list to record for the virus editor** - `85a2e97` (feat)
2. **Task 2: recycle bin and employees, header, tab strip, 16px fields, overflow audit** - `ca1d7a5` (feat)
3. **Task 3: format panel replaces the keyboard on phones** - `6583baf` (feat)

**Plan metadata:** committed separately (docs: complete plan)

Tracer gate: Task 1 `<verify>` is automated-only and `HUMAN_VERIFY_MODE` is `end-of-phase`, so it was re-run end to end (tsc, lint 0 errors, 62/62 tests, build, node check "list to record tracer OK"); it passed and expansion continued.

## 375px overflow audit (static, Pitfall 12)

Checked every editor rule that can be wider than 345px (viewport 375 minus 2 x 15px page padding) inside `.content-editor`, excluding the intentionally scrolling `.editor-tabs`:

| Rule | Finding | Action |
|---|---|---|
| `.virus-editor-layout` `grid-template-columns: 1fr` (auto minimum) | min-content of the record list or an empty-state card could widen the track | changed to `minmax(0, 1fr)` in the 900px block |
| `.editor-record-list` (new grid) and its buttons | long unbroken name or code could overflow the button | `grid-template-columns: minmax(0, 1fr)`, `overflow-wrap: anywhere` on strong / small |
| `.editor-upload-control input[type="file"]` `flex: 1 1 280px` | basis 280px exceeds a nested card's inner width (about 275px) and a file input has a wide min-content | `flex-basis: 200px; min-width: 0` at 900px and below |
| `.employee-editor-save` non-wrapping flex row | status text (error message) plus content could exceed the width | `flex-wrap: wrap` |
| `.employee-editor-summary` (96px + 18px gap + minmax(0, 1fr)) | fits, name uses `overflow-wrap: anywhere` | none |
| `.editor-field-grid` | already `1fr` at 900px; inputs `width: 100%`, global `border-box` | none |
| `.classification-select-wrap` (`minmax(0,1fr) auto`, strong min-width 92px) | fits | none |
| `.recommendation-order-row > span` | `min-width: 0` plus ellipsis | none |
| `.editor-savebar` | fixed, left/right 0, `> p min-width: 0`, actions `flex: 0 0 auto` | none |
| `.access-editor-add` | `1fr` at 900px | none |
| `.custom-color-picker` (180 + 145 + gap, wider than 345 on 520px screens) | lives in the fixed format panel, not in `.content-editor`; 430px block already narrows it to 130 / 110 | none |
| `.editor-image-preview` | `width: 100%`, image `max-width: 100%` | none |

Not measured live: the owner login is required for the editor, so the console snippet from the Task 2 human-check (scrollWidth minus innerWidth and the list of elements whose right edge exceeds the viewport) is left to the phase UAT. Nothing outside `.content-editor` was found or changed. The phone or browser the owner tests on is not known yet; it goes into the UAT report.

## Files Created/Modified

- `components/portia-editor.tsx` - `revealOnPhone`, `recordOpen`/`showRecord`/`layoutRef`/`tabsRef`, three `data-mobile-view` layouts with back buttons, `rangeFromOffsets`, `findFormatField`, `data-format-key`, panel phone effect and `finish`
- `app/portia.css` - phone list / record / back-button rules, hidden header, 16px fields, wrap and overflow fixes, `::highlight(portia-format)`, panel padding

## Decisions Made

- Blur-based keyboard hiding with a Custom Highlight paint (see key-decisions); browsers without the Highlight API still style the stored selection but do not paint the mark.
- `.editor-back-to-list` is hidden at base and only shown in the 900px block, so the grid on PC never sees it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Painted highlight would be orphaned after a style change**
- **Found during:** Task 3
- **Issue:** The plan keys the phone effect on `target.key` and the selection offsets. Applying a style calls `onCommit`, the field re-renders its text nodes, and because the field is blurred `restoreSelection` is a no-op; a Range built earlier would point at detached nodes and the mark would vanish after the first style.
- **Fix:** `target.document` joins the dependency list (as `formatDocument`); the effect re-runs after the field's layout effect, rebuilds the range and re-sets the highlight. Cleanup deletes the old one.
- **Files modified:** components/portia-editor.tsx
- **Verification:** structural check, tsc, lint (13 pre-existing warnings, no new), build
- **Committed in:** 6583baf

**2. [Rule 2 - Missing critical] Two extra 375px overflow guards**
- **Found during:** Task 2 audit
- **Issue:** `grid-template-columns: 1fr` has an auto minimum, and the file input's 280px flex basis exceeds a nested card's inner width.
- **Fix:** `minmax(0, 1fr)` on the layout and the list, `flex-basis: 200px; min-width: 0` on the file input, `overflow-wrap: anywhere` on list texts (listed in the audit table).
- **Files modified:** app/portia.css
- **Committed in:** ca1d7a5

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing-critical). **Impact on plan:** none on scope; both strengthen the planned behaviour.

## Issues Encountered

- Human-checks were not run: the editor needs the owner login and a real phone. Recorded as `human_judgment: true` for the phase UAT: (a) the 375px console snippet on every screen, (b) iOS zoom on tapping «Название» and the big text field (open question A5), (c) the real-phone keyboard-or-panel test with phone model and browser (A1, A2).
- Known limits accepted in the plan: Android hardware Back leaves the page from a record view; the fixed save bar sits under the keyboard on Android while typing; iOS may need one tap after ГОТОВО to bring the keyboard back.

## Known Stubs

None.

## Threat Flags

None. T-03-10 and T-03-11 are mitigated as planned (styles keep going through the unchanged `applyRichTextStyle` offsets; the effect cleanup removes both listeners, cancels the frame and deletes the highlight); T-03-12 accepted: `app/layout.tsx` was not touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ROADMAP Phase 3 criterion 1 is implemented; only the live 375px and real-phone confirmation remains for the phase UAT.
- 03-04 can build on the unchanged desktop layout.

## Self-Check: PASSED

- Modified files exist: components/portia-editor.tsx, app/portia.css (FOUND).
- Commits 85a2e97, ca1d7a5, 6583baf are ancestors of HEAD.
- Verification: tsc 0, lint 0 errors (13 pre-existing warnings), npm test 62/62, build 0, structural checks "list to record tracer OK", "phone layout OK", "panel instead of keyboard OK".

---
*Phase: 03-redaktor*
*Completed: 2026-10-14*
