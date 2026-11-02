---
phase: 18
review: 18-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Shortcut CSS clamp (118/128px) disagrees with the JS clamp, so large drags and obstacle avoidance are not honoured"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Free shortcut drag disabled at <=900px, but the 521-900px CSS still lays icons out absolutely with `touch-action: none`"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Drag-sort hit test reads rects that include the running FLIP transform"
  - id: WR-04
    severity: warning
    disposition: open
    title: "The OS `prefers-reduced-motion` setting is no longer honoured anywhere, including the no-JS fallback"
  - id: IN-01
    severity: info
    disposition: open
    title: "`dragGeometry` now silently shrinks window height, below the app minimum"
  - id: IN-02
    severity: info
    disposition: open
    title: "Several tests assert source text instead of behaviour, and one e2e test cannot fail without the feature"
  - id: IN-03
    severity: info
    disposition: open
    title: "Spider pause-state bookkeeping is partial"
open: 7
total: 7
recorded: 2026-11-02T05:11:40.134Z
---

# Phase 18: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
