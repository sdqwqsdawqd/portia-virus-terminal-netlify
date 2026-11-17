---
phase: 05
review: 05-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "ГОТОВО with an unknown selection lets the browser's default caret become the target (first word)"
  - id: IN-01
    severity: info
    disposition: skipped
    title: "The `event order:` tests drive a hand-written event list, not the component wiring"
  - id: IN-02
    severity: info
    disposition: skipped
    title: "The own-input window can stay open or close early in uncommon sequences"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "Stale and inconsistent text around the new highlight"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "The disposition record says WR-02 is plainly \"fixed\" while part of it is deferred"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "`touchedRef` is a one-shot flag; phone selection can stay stale or be dropped"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Readout and \"selected\" state disagree with what is rendered (defaults 17 / 400)"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "`selectionOffsets` null path falls back to `{0,0}`, so the first word is targeted"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "`preventDefault` on `pointerdown` may not keep focus or selection, and the editor no longer shows its selection on a PC"
  - id: WR-05
    severity: warning
    disposition: deferred
    title: "`matchMedia(\"(max-width: 900px)\")` duplicated and the dragged place is not re-clamped when storage is blocked"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "The only target cue has low contrast on the light preview field"
  - id: IN-05
    severity: info
    disposition: skipped
    title: "Thickness and no-fallback behaviour of the shorthand is unverified in the browsers that matter"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "The \"no fill in the marker\" guarantee lives only in the plan's one-off check"
open: 0
total: 13
recorded: 2026-10-19T10:54:44.000Z
---

# Phase 05: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | fixed in 73d1100 (11-01); EDIT-01; `finish` returns before focusing the field when no selection is known (grep -n "!target.selection" components/portia-editor.tsx → the null-selection guard in `finish`); test "event order: no phone panel, readings are taken as they are and nothing known is never a caret at 0" (node --experimental-strip-types --test lib/rich-text-style.test.ts); owner check 11-07 step 1 on the phone (ГОТОВО with nothing selected says «ВЫДЕЛИТЕ ТЕКСТ» and the next ✎ does not target the first word), re-checked after the fix rounds on iPhone Firefox and WebKit |
| IN-01 | info | skipped | reviewer fix: keep as is until a DOM test runner exists; grep -c jsdom package.json → 0; the boundary test is TEST-02 (Phase 11); boundary test added in 11-01: «the own-input window closes exactly 400 ms after up (05-IN-01)» (node --experimental-strip-types --test lib/rich-text-style.test.ts) |
| IN-02 | info | skipped | reviewer: no fix required, it follows the 05 D-05 own-input design; grep -n "ownUntil: Infinity" lib/rich-text-style.ts → 147 |
| IN-03 | info | fixed | fixed in 73d1100 (11-01); grep -c 'from "@/lib/rich-text-style"' components/portia-editor.tsx → 1; test "the editor imports rich-text-style once and ships no joke or empty labels (TEST-02, A11Y-03)" (node --experimental-strip-types --test lib/portia-desktop.test.ts); the comment half was already fixed by 7191038 |
| IN-04 | info | fixed | fixed in 3be593b; git show --stat 3be593b → 05-REVIEW-DISPOSITION.md, 1 file changed (the WR-02 row now names the deferred half) |
| CR-01 | critical | fixed | 05-06 (not in the current review) |
| WR-02 | warning | fixed | 05-06, readout only: the 17 px «M» preset jump and the explicit runs written on a repeat click (which unmark «Обычный») are not fixed and are PROJECT.md Out of Scope (panel size presets) (not in the current review) |
| WR-03 | warning | fixed | 05-06 (not in the current review) |
| WR-04 | warning | fixed | 05-06 (not in the current review) |
| WR-05 | warning | deferred | accepted risk: the 900 px query is repeated in components/portia-editor.tsx, the dragged panel is not re-clamped when storage is blocked, any mouse button starts a drag; no user-visible defect is reported and a refactor risks the phone panel; owner decision for v1.1, not re-checked (REQUIREMENTS.md Out of Scope) (not in the current review) |
| WR-06 | warning | fixed | fixed in 2aacbc2 (11-01); EDIT-02; test "the format mark is an underline with no fill and keeps 3:1 on every preview field" (node --experimental-strip-types --test lib/accent-theme.test.ts); harness check mark (node .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs --check mark); owner check 11-07 step 2 on the PC and the phone (the teal mark is easy to see on the light preview field and still visible on the dark one) |
| IN-05 | info | skipped | owner approved 05-07 steps 1-5 on PC and phone, so the review requires no fix; grep -n "on PC and phone" .planning/milestones/v1.0-phases/PORTIA-05-oformlenie-teksta/05-07-SUMMARY.md → 57; browser names were not recorded and Safari and Firefox were not checked |
| IN-06 | info | fixed | fixed in 2aacbc2 (11-01); TEST-02; test "the format mark is an underline with no fill and keeps 3:1 on every preview field" (node --experimental-strip-types --test lib/accent-theme.test.ts) now carries the no-fill guarantee, so it no longer lives only in a one-off plan check |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
