---
phase: PORTIA-07
review: 07-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Newcomer check accepts any `roblox-<digits>` id for any sheet nickname"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "A thrown sheet-header error in the newcomer check becomes a generic 500"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "A manual-table read failure makes DELETE report \"not found\""
  - id: IN-01
    severity: info
    disposition: open
    title: "`photoUrl` accepts protocol-relative URLs"
  - id: IN-02
    severity: info
    disposition: open
    title: "Restore result is ignored in the details rollback"
  - id: IN-03
    severity: info
    disposition: open
    title: "Client merges the PATCH answer into the stale `selected` closure"
open: 3
total: 6
recorded: 2026-10-20T05:43:25Z
---

# Phase 07: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | fixed in 364404d; a nickname already stored under a Roblox id cannot be re-pointed; residual: a never-saved nickname still accepts any roblox-digits id once (Roblox not asked, D-06; AR-07-03); node --experimental-strip-types --test lib/portia-employees.test.ts → a newcomer id cannot be re-pointed ok |
| WR-02 | warning | fixed | fixed in a63990d; node --experimental-strip-types --test lib/portia-employees.test.ts → a sheet with changed headers is sheet-unavailable for a newcomer ok |
| WR-03 | warning | fixed | fixed in 4a21aa2; DELETE answers 503 when manual rows were not read; node --experimental-strip-types --test lib/portia-employees.test.ts → loadEmployees says whether the manual rows were read ok |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
