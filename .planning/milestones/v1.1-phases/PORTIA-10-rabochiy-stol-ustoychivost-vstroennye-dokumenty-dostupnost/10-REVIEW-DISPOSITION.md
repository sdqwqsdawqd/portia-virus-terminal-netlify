---
phase: 10
review: 10-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Loop variable `k` shadows the new accent-strength `k` inside `filterFor`"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Readability is only tested against `--bg`, but accent text also sits on `--panel` and `--panel-2`"
  - id: IN-01
    severity: info
    disposition: open
    title: "Test duplicates the regex literal and walks the filesystem for a one-line invariant"
  - id: P1-WR-01
    severity: warning
    disposition: fixed
    fixed_in: 90a0231
    proof: "10-desktop-check.mjs --check accent step (n), PC and phone; owner check 10-09"
    title: "`.setting-options button` also hits the picker's close button, clipping the ×"
  - id: P1-WR-02
    severity: warning
    disposition: open
    title: "Virus rows are `role=\"option\"` in a listbox but have no roving tabindex or arrow keys"
  - id: P1-WR-03
    severity: warning
    disposition: open
    title: "The colour board in the custom picker is pointer-only, with no focus, keys or accessible name"
  - id: P1-IN-01
    severity: info
    disposition: open
    title: "Clicking «Свой» saves the current preset colour at once; silently does nothing on a non-hex `--teal`"
  - id: P1-IN-02
    severity: info
    disposition: open
    title: "Picker blur with `relatedTarget === null` commits again, flashing «saved» twice"
  - id: P1-IN-03
    severity: info
    disposition: open
    title: "Shared sandbox `allow-scripts allow-same-origin` is safe only while every embed src stays cross-origin"
  - id: P1-IN-04
    severity: info
    disposition: open
    title: "Many new tests grep component source; `zoomModifier` relies on deprecated `navigator.platform`"
open: 9
total: 10
recorded: 2026-10-25T20:54:12.657Z
---

# Phase 10: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| P1-WR-01 | warning | fixed | prior full-phase review (10-REVIEW.md at 305976d); fixed in 90a0231 |
| P1-WR-02 | warning | open | prior full-phase review (10-REVIEW.md at 305976d) |
| P1-WR-03 | warning | open | prior full-phase review (10-REVIEW.md at 305976d) |
| P1-IN-01 | info | open | prior full-phase review (10-REVIEW.md at 305976d) |
| P1-IN-02 | info | open | prior full-phase review (10-REVIEW.md at 305976d) |
| P1-IN-03 | info | open | prior full-phase review (10-REVIEW.md at 305976d) |
| P1-IN-04 | info | open | prior full-phase review (10-REVIEW.md at 305976d) |

`WR-01`, `WR-02`, `IN-01` come from the current incremental review of plans 10-08 and 10-09 (`10-REVIEW.md`). `P1-*` rows are the earlier full-phase review's findings. Their ids were renamed with a `P1-` prefix because the incremental review reused the same ids, so the earlier decisions are kept here.

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
