---
status: resolved
trigger: "UAT 3 (PORTIA-03): РЕДАКТОР ОФОРМЛЕНИЯ is too big for phones, no need to remove functions but to make window smaller and allow to scroll it"
created: 2026-10-14T00:00:00Z
updated: 2026-10-18T13:41:02Z
---

## Current Focus

hypothesis: CONFIRMED - phone cap min(44svh,340px) is large and the whole <section> is the scroller, so ГОТОВО/СБРОСИТЬ sit below the fold and the panel reads as a big unscrollable block
bug_class: Bohrbug (deterministic layout)
next_action: hand diagnosis to caller (find_root_cause_only)

reasoning_checkpoint:
  hypothesis: "Panel is too big because app/portia.css:1022 caps it at min(44svh,340px) (40-44% of the viewport, ~51% with the 44px taskbar) while its 2-column card content is 471px (618px with the colour picker); overflow sits on the whole section, so the non-sticky footer (ГОТОВО) is only reachable after scrolling to the end"
  confirming_evidence:
    - "headless Edge 375x667: panel 293px (44%), scrollHeight 471, ГОТОВО not visible without scrolling, 284px of page left above it"
    - "390x844: panel 340px, scrollHeight 471; with picker at 375x667 scrollHeight 618"
    - "candidate CSS (flex column, toolbar scrolls, cap min(38svh,300px)) in the same harness: panel 253px (38%), ГОТОВО visible, toolbar scrolls 167 of 357px"
  falsification_test: "if scrollHeight <= max-height at 375px, size would not be the cause"
  fix_rationale: "shrinks the cap and moves overflow from the section to the toolbar so header/footer stay pinned; every control kept"
  blind_spots: "Chromium only; no real iOS touch-scroll test; owner device/browser unknown"
  candidate_causes:
    - "code/CSS: cap + section-level overflow + static footer (confirmed)"
    - "environment: browser without svh support drops max-height entirely (not reproduced; all target browsers support svh)"
  and_gate: "yes - size complaint needs both the large cap and content ~1.6x the cap; scroll complaint needs section-level overflow with an off-screen footer"

## Symptoms

expected: (UAT 3) keyboard hidden while panel open; selection highlighted; style applies; ГОТОВО returns save bar; panel fits phone and is usable
actual: owner: "РЕДАКТОР ОФОРМЛЕНИЯ is too big for phones, no need to remove functions but to make window smaller and allow to scroll it"
errors: none
reproduction: editor at ~375px width, focus a text field, tap ✎
started: since 03-03 (6583baf feat(03-03): format panel replaces the keyboard on phones)

## Eliminated

- hypothesis: position:fixed resolved against a transformed/filtered ancestor (panel not on the viewport)
  evidence: .app-window has transform:none !important at <=900px; only .system-bar/.taskbar/.record-header carry backdrop-filter and none is an ancestor; savebar (same parent, fixed) passes UAT 4
  timestamp: 2026-10-14T14:05:00Z

- hypothesis: phone rules overridden later in the cascade
  evidence: .floating-text-format only appears at portia.css 518-562, 1022-1032, 1110-1121; harness computed max-height 293.48px / overflow-y auto at 375x667
  timestamp: 2026-10-14T14:08:00Z

## Evidence

- timestamp: 2026-10-14T00:00:00Z
  checked: knowledge base
  found: .planning/debug has no knowledge-base.md; no prior match
  implication: open investigation

- timestamp: 2026-10-14T00:00:00Z
  checked: app/portia.css 518, 1022, 1031, 1110-1121
  found: phone (<=900px) sets .floating-text-format max-height min(44svh,340px) + overflow-y auto, bottom 42px; <=430px makes header sticky, hides footer hint; footer (ГОТОВО/СБРОСИТЬ) is NOT sticky; toolbar stays 2 columns
  implication: cap + scroll exist in CSS; complaint is about size and/or scroll usability, not a missing overflow rule

- timestamp: 2026-10-14T14:08:00Z
  checked: scratch harness (panel markup copied from FloatingTextFormatPanel + real app/portia.css + IBM Plex Mono) in headless Edge, iframe-sized viewports
  found: 375x667 panel 293px/44%, scrollH 471, header 49 sticky, toolbar 375, footer 47 static, ГОТОВО hidden; 375x548 panel 241, scrollH 471; 390x844 panel 340/40%, scrollH 471; picker open scrollH 618; control cards 107/107, 99/99, 139/139 (2-col rows stretch: preview card ~60px content in a 107px card)
  implication: content is 1.6-2.1x the visible box; ГОТОВО always below the fold on phones

- timestamp: 2026-10-14T14:12:00Z
  checked: candidate CSS in harness (not applied to source)
  found: 375x667 panel 253/38%, bottom gap 44 (sits on taskbar), header 41, footer 43, toolbar visible 167 of 357 (502 with picker), ГОТОВО visible; 390x844 panel 300/36%; 600x800 panel 300, ГОТОВО visible; 375x548 toolbar visible only 122px
  implication: fix direction verified in Chromium

## Resolution

root_cause: app/portia.css phone rules size the format panel at min(44svh,340px) (portia.css:1022) and put overflow on the whole <section>, while the 2-column card toolbar is 471px tall at 375px (618 with the colour picker); the footer with ГОТОВО/СБРОСИТЬ is static at the end of the scroll and the header is sticky only <=430px, so on phones the panel covers ~half the screen and its scroll is hidden/awkward
fix: (not applied - diagnose only) see caller report
verification:
files_changed: []
