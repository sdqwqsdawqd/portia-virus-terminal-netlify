---
phase: 11
review: 11-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "Multi-field format target is not invalidated when a peer field is deleted, shifted or edited, so a style click writes into deleted or wrong fields"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Ctrl/Cmd editing keys do not end an additive gesture, so fragments keep stale offsets"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Folding a card or the whole list does not drop peers inside it"
  - id: WR-03
    severity: warning
    disposition: open
    title: "key={formatTarget.key} remounts the panel on every field change (phone sheet re-expands)"
  - id: IN-01
    severity: info
    disposition: open
    title: "Fallback row id can collide with a later explicit id"
  - id: IN-02
    severity: info
    disposition: open
    title: "Save chip has a dangling aria-controls and a dialog without focus management"
open: 6
---

# Phase 11 — code review disposition

| ID | Severity | Disposition | Source |
|----|----------|-------------|--------|
| CR-01 | critical | open | 11-REVIEW.md |
| WR-01 | warning | open | 11-REVIEW.md |
| WR-02 | warning | open | 11-REVIEW.md |
| WR-03 | warning | open | 11-REVIEW.md |
| IN-01 | info | open | 11-REVIEW.md |
| IN-02 | info | open | 11-REVIEW.md |
