| IN-03 |  | deferred | cosmetic, faded by the cell mask (02-REVIEW-FIX.md) || IN-02 |  | deferred | info, no behaviour risk (02-REVIEW-FIX.md) || IN-01 |  | deferred | info, no behaviour risk (02-REVIEW-FIX.md) || WR-03 |  | fixed | 3d4cc21 || WR-02 |  | fixed | 3d4cc21 || WR-01 |  | fixed | 3d4cc21 |---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Gel bands drift away from the ladder labels"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Editor restore leaves a stale text-format target and panel"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Early pointer capture makes a drag-out release click the taskbar button"
  - id: IN-01
    severity: info
    disposition: deferred
    title: "The motion-fallback test can pass without checking anything"
  - id: IN-02
    severity: info
    disposition: deferred
    title: "The wallpaper and icon-size id lists are duplicated and unchecked"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "Cell clipping ignores neighbours between 180 and about 254 px away"
open: 0
total: 6
recorded: 2026-10-13T22:01:11.688Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 3d4cc21 |
| WR-02 | warning | fixed | 3d4cc21 |
| WR-03 | warning | fixed | 3d4cc21 |
| IN-01 | info | deferred | info, no behaviour risk (02-REVIEW-FIX.md) |
| IN-02 | info | deferred | info, no behaviour risk (02-REVIEW-FIX.md) |
| IN-03 | info | deferred | cosmetic, faded by the cell mask (02-REVIEW-FIX.md) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
