---
phase: PORTIA-02-vneshniy-vid
review: 02-REVIEW.md
fixed: [WR-01, WR-02, WR-03]
deferred: [IN-01, IN-02, IN-03]
status: fixed
---

# Phase 2: Code review fixes (second review, 9cb6923..HEAD)

The first review's fixes (CR-01, WR-01..04, IN-01, IN-02 of the 9cb6923 report) landed in `5ac7991`; its
info items IN-03..IN-06 stay deferred. This file covers the second review.

| Finding | Fix | Verified |
|---|---|---|
| WR-01 gel size labels stayed put while the bands drifted | Labels moved into the animated bands group | tsc; labels share the band transform |
| WR-02 restore switched tab without the tab reset | One `switchTab` for the tab buttons and the restore (preview surface, formatter target and panel reset) | tsc, lint |
| WR-03 press released off a taskbar entry still clicked it | Pointer capture kept; a release outside the button suppresses the following click | Browser: press, drag up 70px, release → window unchanged; a plain click still minimises |

Deferred (info, no behaviour risk): IN-01 a vacuous loop in the media-block test when no block matches, IN-02 wallpaper / icon-size ids listed twice and not tested, IN-03 rim cells may keep an unclipped corner beyond the 180px neighbour radius (cosmetic, faded by the mask).
