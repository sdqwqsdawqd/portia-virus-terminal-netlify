---
phase: 11
review: 11-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    fixed_in: 0bdf9b4, 7be2bba
    title: "Multi-field format target is not invalidated when a peer field is deleted, shifted or edited, so a style click writes into deleted or wrong fields"
  - id: WR-01
    severity: warning
    disposition: fixed
    fixed_in: 7be2bba
    title: "Ctrl/Cmd editing keys do not end an additive gesture, so fragments keep stale offsets"
  - id: WR-02
    severity: warning
    disposition: fixed
    fixed_in: 7be2bba
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
  - id: IN-03
    severity: info
    disposition: open
    title: "Fold predicate reads the DOM inside a setFormatTarget updater (re-review IN-01)"
  - id: IN-04
    severity: info
    disposition: open
    title: "Peers commit snapshot value/document; sync effect does not clear formatTarget (re-review IN-02)"
open: 5
---

# Phase 11 — code review disposition

| ID | Severity | Disposition | Source |
|----|----------|-------------|--------|
| CR-01 | critical | fixed | fixed in 0bdf9b4, 7be2bba; test «a gone peer leaves with its fragments» (`node --experimental-strip-types --test lib/format-fragments.test.ts`); harness `--check peers` steps (a), (b); the archived `onRemoveMutation` clears the target like the live delete; `node .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs --check peers --url http://localhost:3124` |
| WR-01 | warning | fixed | fixed in 7be2bba; `commitEditorValue` starts a plain gesture; harness `--check peers` step (c); `node .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs --check peers --url http://localhost:3124` |
| WR-02 | warning | fixed | fixed in 7be2bba; `toggleCard`/`setAllOpen` prune peers via `dropFormatFields`; harness `--check peers` step (d); `node .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs --check peers --url http://localhost:3124` |
| WR-03 | warning | open | 11-REVIEW.md at 89eea5a (pre-11-08 review) |
| IN-01 | info | open | 11-REVIEW.md at 89eea5a (pre-11-08 review) |
| IN-02 | info | open | 11-REVIEW.md at 89eea5a (pre-11-08 review) |
| IN-03 | info | open | 11-REVIEW.md (re-review after 11-08), its IN-01 |
| IN-04 | info | open | 11-REVIEW.md (re-review after 11-08), its IN-02 |
