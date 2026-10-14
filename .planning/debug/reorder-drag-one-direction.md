---
status: diagnosed
trigger: "During one drag on the ≡ handle (gel-lane reorder in the editor), a row can move both up and down until the pointer is released; each move is visibly animated. UAT 2: 'its hard for phone to drag them down and up'; UAT 9: 'still problems, after i move to up it cant move down until i stop holding. Also i need some kind of animations for moving to make sure'"
created: 2026-10-14T00:00:00Z
updated: 2026-10-14T00:00:00Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED. A DOWN swap makes React re-insert the dragged row's DOM node. That drops pointer capture on its ≡ button. Tracking lives only in the button's onPointerMove, so the drag goes deaf. It stays active (no lostpointercapture handler) until the window pointerup.
bug_class: Bohrbug (deterministic; same result in 6/6 harness scenarios, mouse and touch)
next_action: none (find_root_cause_only); hand the diagnosis back to the caller.
reasoning_checkpoint:
  hypothesis: "Keyed reorder re-inserts the dragged row on every downward move (react-dom placeChild), the browser releases pointer capture on removal, and OrderDragHandle only tracks via the button's onPointerMove, so after the first down swap no further moves are processed"
  confirming_evidence:
    - "react-dom-client.development.js:6201-6215: a fiber gets Placement (DOM re-insert) only if its oldIndex < lastPlacedIndex. That is the neighbour on up moves and the dragged row on down moves"
    - "Edge 155 harness, real react-dom 19.2.6 and verbatim handler: up×2 gives CABDE with no lostpointercapture. Down to E stops at ABDCE (wanted ABDEC) with lostpointercapture:C. Up-then-down stops at ABCDE (wanted ABDEC). Mouse and touch identical"
    - "After capture is lost, pointermove targets are 'list' (the row gap) and other rows' handles (D, E), not handle C"
  falsification_test: "If tracking is moved to window pointermove and the drag still cannot reverse, the hypothesis is wrong. Result: with the window listener all 6 scenarios reach the intended order"
  fix_rationale: "Tracking stops depending on capture, which the DOM move removes; this is the root cause, not a retry"
  blind_spots: "Real iOS Safari or Android not run (CDP touch emulation only); the full editor not mounted (the harness copies the handler and the keyed row structure)"
  candidate_causes:
    - "code: tracking tied to button onPointerMove plus capture (CONFIRMED)"
    - "code: moveTo hysteresis or indexRef staleness blocks reversal (ELIMINATED)"
    - "environment: browser drops capture on node re-insert (CONFIRMED as the contributing platform behaviour)"
  and_gate: "yes. Needs (a) React re-inserting the dragged row on down moves, (b) the browser releasing capture on removal, and (c) tracking only on the button. Removing (c) is enough"

## Symptoms

expected: Rows slide along lanes, the screen edge autoscrolls, ↑/↓ on a focused ≡ moves the row; one drag = one undo step. Releasing outside the handle or switching windows ends the drag. Within one drag a row can move up and down; moves are animated.
actual: UAT 2 "its hard for phone to drag them down and up"; UAT 9 "after i move to up it cant move down until i stop holding. Also i need some kind of animations for moving to make sure"
errors: none
reproduction: Open the editor on a list with ≡ handles (virus list / dossier sections / recycle / recommendations), press ≡, drag a row up past one neighbour, then try to drag it back down without releasing. Phone and desktop.
started: since 0ab78f1 (gel-lane reorder); 616e707 (WR-03 window listeners) did not fix it.

## Eliminated

- hypothesis: moveTo's middle-crossing rule or a stale indexRef/onMoveRef prevents reversing direction
  evidence: With only the event source changed (window pointermove), the same moveTo reverses correctly. Up-then-down reaches ABDEC, and onMove is called the minimal number of times (2/2/4)
  timestamp: 2026-10-14T00:00:00Z
- hypothesis: the WR-03 window pointerup/pointercancel/blur listeners end the drag early
  evidence: The harness logs no stop before release; with the window-move fix the same listeners are present and the drag continues the whole way
  timestamp: 2026-10-14T00:00:00Z

## Evidence

- timestamp: 2026-10-14T00:00:00Z
  checked: components/portia-editor.tsx:149-250 (OrderDragHandle)
  found: Tracking relies only on the button's onPointerMove (line 237), which updates pointer.current and calls moveTo. setPointerCapture is called on pointerdown (229). There is no onLostPointerCapture and no window pointermove. The window listeners (173-185) handle only blur, pointerup and pointercancel, so they end the drag but do not track it. autoscroll (202-215) reads the frozen pointer.current.
  implication: Once capture is lost and the pointer is off the 34/44px button, nothing updates the drag position.

- timestamp: 2026-10-14T00:00:00Z
  checked: call sites at lines 851, 933, 971, 1072
  found: Rows are keyed by stable ids (virus.id, section.id, recycle key, recommendation text plus occurrence). OrderDragHandle sits inside the row, so the same component instance and DOM node move with the row.
  implication: The reorder physically moves DOM nodes; which node React moves decides whether the handle's ancestor gets detached.

- timestamp: 2026-10-14T00:00:00Z
  checked: app/portia.css:434-442, 1394-1395, 1134-1138
  found: The handle has touch-action:none and is 34px (44px on phones at ≤900px). During a drag the row gets an outline, background and shadow via :has([data-dragging]). There is no transition or animation on row position, no FLIP, and no transform anywhere in the reorder path. A global data-motion="reduce" rule clamps transition and animation durations.
  implication: Moves are currently instant, so there is no move animation at all.

- timestamp: 2026-10-14T00:00:00Z
  checked: node_modules/react-dom/cjs/react-dom-client.development.js:6201-6215 (placeChild)
  found: An existing fiber is flagged Placement (its DOM node re-inserted) only when oldIndex < lastPlacedIndex. For a move from i to j<i (up), the displaced rows are re-inserted and the dragged row stays. For i to j>i (down), the dragged row is re-inserted.
  implication: Every downward step detaches the dragged row (and the ≡ button inside it) from the document for a moment.

- timestamp: 2026-10-14T00:00:00Z
  checked: Headless Edge 155 via CDP. Harness at <scratchpad>/drag-harness/run.mjs inlines the repo's react 19.2.6 / react-dom CJS dev builds and a verbatim JS copy of OrderDragHandle + moveArrayItem, with the same grid row layout. Rows ABCDE; drag C.
  found: |
    current code, mouse and touch identical:
      C up to A    -> CABDE (correct), capture kept
      C down to E  -> ABDCE (expected ABDEC): only 1 of 2 swaps, then lostpointercapture:C; later pointermoves hit "list"/handle E
      C up past B, then down to E -> ACBDE then ABCDE (expected ABDEC): stuck after the first down swap
  implication: Reproduces UAT 9 exactly. Up moves keep working; the first down swap kills tracking until release.

- timestamp: 2026-10-14T00:00:00Z
  checked: same harness, variant with tracking moved to a window pointermove listener (guarded by active.current && isPrimary) and the button onPointerMove removed
  found: All 6 scenarios (mouse/touch × 3) reach the intended order (CABDE, ABDEC, ABDEC). lostpointercapture still fires but no longer matters. touch-action:none on the handle keeps the touch from turning into a pan after capture loss.
  implication: The IN-05 fix direction is sufficient and proven.

- timestamp: 2026-10-14T00:00:00Z
  checked: same harness plus a per-handle FLIP (useLayoutEffect, row.offsetTop delta, row.animate translateY -> none, 160ms, --ease-out curve, skipped when html[data-motion=reduce])
  found: Mouse scenarios give the same final orders, onMove calls stay at the minimum (2/2/4, so no flip-back while neighbours slide), and there are 2 row animations per swap (dragged row and neighbour). The touch runs hit the harness timeout (slow CDP round-trips), but FLIP does not depend on input type.
  implication: A minimal FLIP inside OrderDragHandle animates all four lists and the ↑/↓ path without touching list code.

## Resolution

root_cause: In OrderDragHandle (components/portia-editor.tsx:149-250) drag tracking comes only from the ≡ button's onPointerMove (:237-240), which depends on the pointer capture set at :229. Rows are keyed by id (:851, :933, :971, :1072), and on every downward move React re-inserts the dragged row's DOM node (react-dom placeChild). The browser then releases capture (lostpointercapture fires on the handle), so pointermove goes to whatever is under the finger. pointer.current freezes (autoscroll at :202-215 keeps using the stale point), and the drag stays "active" but deaf until the window pointerup from WR-03 (:173-185) ends it. Up moves re-insert the neighbour instead, which is why up works and the first down swap kills it. IN-05 is verified, not refuted. Separately, there is no move animation anywhere: rows jump instantly.
fix: (not applied; find_root_cause_only)
verification: Harness reproduction plus a fix-variant pass, as recorded in Evidence.
files_changed: []
