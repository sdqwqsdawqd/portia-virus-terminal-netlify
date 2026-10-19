---
phase: 05
review: 05-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "ГОТОВО with an unknown selection lets the browser's default caret become the target (first word)"
  - id: IN-01
    severity: info
    disposition: open
    title: "The `event order:` tests drive a hand-written event list, not the component wiring"
  - id: IN-02
    severity: info
    disposition: open
    title: "The own-input window can stay open or close early in uncommon sequences"
  - id: IN-03
    severity: info
    disposition: open
    title: "Stale and inconsistent text around the new highlight"
  - id: IN-04
    severity: info
    disposition: open
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
    disposition: open
    title: "The only target cue has low contrast on the light preview field"
  - id: IN-05
    severity: info
    disposition: open
    title: "Thickness and no-fallback behaviour of the shorthand is unverified in the browsers that matter"
  - id: IN-06
    severity: info
    disposition: open
    title: "The \"no fill in the marker\" guarantee lives only in the plan's one-off check"
open: 8
total: 13
recorded: 2026-10-19T12:00:00.000Z
---

# Phase 05: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| CR-01 | critical | fixed | 05-06 (not in the current review) |
| WR-02 | warning | fixed | 05-06 (not in the current review) |
| WR-03 | warning | fixed | 05-06 (not in the current review) |
| WR-04 | warning | fixed | 05-06 (not in the current review) |
| WR-05 | warning | deferred | cleanup, no user-visible defect in the phase goal (not in the current review) |
| WR-06 | warning | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
