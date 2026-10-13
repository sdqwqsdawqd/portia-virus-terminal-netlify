---
phase: PORTIA-02-vneshniy-vid
review: 02-REVIEW.md
fixed: [CR-01, WR-01, WR-02, WR-03, WR-04, IN-01, IN-02]
deferred: [IN-03, IN-04, IN-05, IN-06]
status: fixed
---

# Phase 2: Code review fixes

| Finding | Fix | Verified |
|---|---|---|
| CR-01 taskbar drag stays armed after a release off the button | Pointer capture taken on pointerdown; a move without the primary button ends the drag; `lostpointercapture` also ends it; reset in one helper | Browser: press, drift up, release off, then hover another entry → no entry displaced |
| WR-01 exiting windows ignored by focus / close | A close may overtake a running minimise (timer replaced); the taskbar entry of an exiting window brings it back via `openApp` | Code path; exit timers still cleared on reopen / unmount |
| WR-02 settings restore spread raw storage | Field-by-field whitelist (`settingValues` from `accentIds`, `motionModes`, wallpaper and icon-size ids); non-object payloads ignored | Browser: stored `wallpaper:"evil\"><x>"`, `iconSize:42` → defaults applied and rewritten |
| WR-03 no motion default without the head script | `@media (prefers-reduced-motion: reduce)` net scoped to `html:not([data-motion])`; test asserts every selector in such a block is scoped that way (mutation-checked) | npm test 25/25; probe rule fails the test |
| WR-04 click suppressor only cleared by a later click | Set only after a real drag's pointerup and cleared on the next task | Browser: a real click after a drag minimises |
| IN-01 dead code | `grabX` and the unused window width removed | tsc, lint |
| IN-02 comment named the wrong keyframe | Now names `vivian-recover` | — |

Deferred (info, no behaviour risk): IN-03 settings lists checked by regex in the test, IN-04 «СИНХРОНИЗИРОВАНО» shown while loading, IN-05 taskbar reorder has no keyboard path and each loader is its own live region, IN-06 reduced-motion boot override skips the decode gate and a stale transform-origin after a restore without origin.
