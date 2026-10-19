---
phase: 05
review: 05-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "`touchedRef` is a one-shot flag; phone selection can stay stale or be dropped"
  - id: WR-01
    severity: warning
    disposition: deferred
    title: "Enabled controls that do nothing for the `assistant` area"
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
  - id: IN-01
    severity: info
    disposition: deferred
    title: "Readout and \"selected\" use only the first character of a range"
  - id: IN-02
    severity: info
    disposition: deferred
    title: "Rarely-hit input cases"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "`editor-field-look.test.ts` is a CSS text parser"
open: 0
total: 9
recorded: 2026-10-19T07:42:20.000Z
---

# Phase 05: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | 05-06 |
| WR-01 | warning | deferred | D-19 (locked): hint, buttons kept; disabling needs the owner |
| WR-02 | warning | fixed | 05-06 |
| WR-03 | warning | fixed | 05-06 |
| WR-04 | warning | fixed | 05-06 |
| WR-05 | warning | deferred | cleanup, no user-visible defect in the phase goal |
| IN-01 | info | deferred | info, accepted |
| IN-02 | info | deferred | info, accepted |
| IN-03 | info | deferred | info, accepted |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
