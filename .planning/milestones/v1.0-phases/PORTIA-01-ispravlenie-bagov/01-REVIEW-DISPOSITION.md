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
    disposition: fixed
    title: "`metaKey` is treated as the zoom modifier"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Overlay can get stuck, and it intercepts all clicks while Ctrl is held"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "Roblox profile link is now an unlabelled portrait"
  - id: IN-02
    severity: info
    disposition: skipped
    title: "Drag handle no longer explains the 170 ms long-press"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "Zoom percentage button hides its value from assistive tech"
open: 0
total: 7
recorded: 2026-10-25T19:28:28Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | fixed in a4df852; grep -n darkreader-lock app/layout.tsx → 22: other: { "darkreader-lock": "true" } (non-empty content, so Next emits the meta) |
| WR-01 | warning | deferred | accepted risk: while focus is inside the cross-origin «Устав»/«Таблица» frame, Ctrl and wheel events go to the frame and never reach the page, which is a browser limit. The +/− buttons zoom instead. The workaround is listed in REQUIREMENTS.md Future Requirements (also recorded in PROJECT.md Known Limitations). |
| WR-02 | warning | fixed | fixed in 7bef37d; ZOOM-01; owner decision D-21 (10-CONTEXT.md): Ctrl zooms everywhere, Cmd counts only on a Mac (navigator.platform), never the Windows key; test "zoom listens to Ctrl, Cmd only on a Mac, and clears on every way out (ZOOM-01)" (node --experimental-strip-types --test lib/portia-desktop.test.ts); harness check zoom (node .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs --check zoom); owner check 10-07 step 4 (PC, Windows key + wheel does nothing); Cmd+wheel on a real Mac was not checked on a device, only by the CDP platform override |
| WR-03 | warning | fixed | fixed in 7bef37d; ZOOM-01; the zoom layer clears on keyup, blur, hidden tab and the first unmodified pointer move or press, so it never sticks or blocks clicks; same test "zoom listens to Ctrl, Cmd only on a Mac, and clears on every way out (ZOOM-01)" (node --experimental-strip-types --test lib/portia-desktop.test.ts); harness check zoom (node .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs --check zoom); owner check 10-07 step 4 (release Ctrl and click at once; Ctrl+Tab away and back, no stuck cursor). Ctrl+click into the frame while Ctrl is held stays a browser limit, like WR-01 |
| IN-01 | info | fixed | fixed in 56ad1d1; A11Y-02; test "the Roblox portrait link has its tooltip and the plain portrait none (A11Y-02)" (node --experimental-strip-types --test lib/portia-desktop.test.ts); grep -n "title={`Профиль Roblox" components/portia-desktop.tsx → 1283; harness check toast steps (d)-(e) (node .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs --check toast); owner check 10-07 step 6 (PC hover tooltip) |
| IN-02 | info | skipped | owner decision D-18 (10-CONTEXT.md): the ≡ handle gets no tooltip; REQUIREMENTS.md A11Y-02 amended; test "the ≡ handle keeps no tooltip (D-18)" (node --experimental-strip-types --test lib/portia-desktop.test.ts) |
| IN-03 | info | fixed | fixed in 7bef37d; ZOOM-02; test "the zoom reset button is named by its percent (ZOOM-02)" (node --experimental-strip-types --test lib/portia-desktop.test.ts); harness check zoom (node .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs --check zoom); owner check 10-07 step 4 (the button reads e.g. «110%»); a screen reader listening to it was not checked on a device |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
