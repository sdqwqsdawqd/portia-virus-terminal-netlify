---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "A queued employee click silently discards typed details the database refused"
  - id: WR-02
    severity: warning
    disposition: open
    title: "The editor ignores `manualRead` and shows a roster that is silently missing manual employees"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Every 403 from the editor list is reported as an expired session"
  - id: IN-01
    severity: info
    disposition: open
    title: "`resolveQueued` searches a stale `employees` closure"
  - id: IN-02
    severity: info
    disposition: open
    title: "A queued click gives the user no feedback"
  - id: IN-03
    severity: info
    disposition: open
    title: "`patchEmployeesCache` and `withEmployee` rely on an empty `catch {}` and unvalidated cached shape"
open: 6
total: 6
recorded: 2026-10-20T00:00:00.000Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
