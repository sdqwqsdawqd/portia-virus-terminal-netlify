---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "`darkreader-lock` meta is never rendered, so the Dark Reader fix is a no-op"
  - id: WR-01
    severity: warning
    disposition: deferred
    title: "Ctrl+wheel zoom is lost whenever the iframe has keyboard focus"
  - id: WR-02
    severity: warning
    disposition: open
    title: "`metaKey` is treated as the zoom modifier"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Overlay can get stuck, and it intercepts all clicks while Ctrl is held"
  - id: IN-01
    severity: info
    disposition: open
    title: "Roblox profile link is now an unlabelled portrait"
  - id: IN-02
    severity: info
    disposition: open
    title: "Drag handle no longer explains the 170 ms long-press"
  - id: IN-03
    severity: info
    disposition: open
    title: "Zoom percentage button hides its value from assistive tech"
open: 5
total: 7
recorded: 2026-10-19T10:53:48.000Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | fixed in a4df852; grep -n darkreader-lock app/layout.tsx → 22: other: { "darkreader-lock": "true" } (non-empty content, so Next emits the meta) |
| WR-01 | warning | deferred | accepted risk: while focus is inside the cross-origin «Устав»/«Таблица» frame, Ctrl and wheel events go to the frame and never reach the page, which is a browser limit. The +/− buttons zoom instead. The workaround is listed in REQUIREMENTS.md Future Requirements (PROJECT.md has no Known Limitations section to cite). |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
