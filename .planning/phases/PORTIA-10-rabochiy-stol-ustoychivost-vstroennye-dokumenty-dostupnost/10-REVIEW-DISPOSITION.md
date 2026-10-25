---
phase: PORTIA-10
review: 10-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    fixed_in: 90a0231
    proof: "10-desktop-check.mjs --check accent step (n), PC and phone; owner check 10-09"
    title: "`.setting-options button` also hits the picker's close button, clipping the ×"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Virus rows are `role=\"option\"` in a listbox but have no roving tabindex or arrow keys"
  - id: WR-03
    severity: warning
    disposition: open
    title: "The colour board in the custom picker is pointer-only, with no focus, keys or accessible name"
  - id: IN-01
    severity: info
    disposition: open
    title: "Clicking «Свой» saves the current preset colour at once; silently does nothing on a non-hex `--teal`"
  - id: IN-02
    severity: info
    disposition: open
    title: "Picker blur with `relatedTarget === null` commits again, flashing «saved» twice"
  - id: IN-03
    severity: info
    disposition: open
    title: "Shared sandbox `allow-scripts allow-same-origin` is safe only while every embed src stays cross-origin"
  - id: IN-04
    severity: info
    disposition: open
    title: "Many new tests grep component source; `zoomModifier` relies on deprecated `navigator.platform`"
open: 6
---

# Phase 10: Review Disposition

Every finding in `10-REVIEW.md` starts as `open`. Change a row to `fixed`, `skipped` or `wontfix` (with its commit or reason) when it is handled.
