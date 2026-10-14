---
status: diagnosed
trigger: "UAT test 10: long employee nickname in personnel profile header breaks mid-word (Kotik_p / lay1232) in normal and maximized window"
created: 2026-10-14T00:00:00Z
updated: 2026-10-14T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. Three independent causes (AND-gate per window state), all in app/portia.css:
  (1) non-maximized: identity column is the residual track — avatar track grabs its full 238px + 54px gap + viewport-maxed paddings, leaving 107-257px; font is viewport-based (4vw -> always 44px on desktop) so 14 chars * 26.4px = 370px cannot fit; overflow-wrap:anywhere splits it.
  (2) maximized: h2 `max-width: 12ch` (= 316.8px at 44px Plex Mono) caps the line at 12 chars even when the column is 393-828px -> "Kotik_play12 / 32".
  (3) phone (<=900px viewport): line 1002 sets font 10vw (39px @390) in a vw-88px column -> needs 327.6px, has 302px -> "Kotik_play12 / 32".
test: done — static repro (real app/portia.css + built IBM Plex Mono 700 woff2) in headless Edge, measured at windows 820/950/1040/1100/1160/maximized, viewports 1920/1536/1280/390/360
next_action: return diagnosis (find_root_cause_only)
bug_class: Bohrbug (deterministic layout)

reasoning_checkpoint:
  hypothesis: "Nick breaks because the h2 is narrower than the unbreakable token: residual grid track + viewport-fixed 44px font (normal window), 12ch max-width cap (maximized), 10vw font vs vw-88 column (phone); overflow-wrap:anywhere then splits mid-word"
  confirming_evidence:
    - "Repro window 950 -> identity 196px, h2 44px -> 'Kotik_p / lay1232' (owner: 202.45px, same split)"
    - "Repro maximized (1240-1880) -> h2w=317 (12ch) while identity 393-828 -> 'Kotik_play12 / 32'"
    - "Repro phone 390/360 -> 'Kotik_play12 / 32'"
    - "Candidate fix in injected stylesheet -> one line at every tested size"
  falsification_test: "If removing max-width + container-scaled font + container stacking still split the nick, hypothesis wrong — it did not (all one line)"
  fix_rationale: "Gives the h2 the full column, sizes font from the window (container) not viewport, stacks the head when the window is too narrow for side-by-side"
  blind_spots: "Not tested in the live Next app (static repro with real stylesheet); emoji/CJK nicks fall back to non-0.6em fonts"
  candidate_causes:
    - "code: CSS track sizing / max-width:12ch / vw-based font"
    - "data: nickname length (14 chars; sheet column has no cap)"
    - "environment: viewport vs window size (desktop window resizable inside wide viewport)"
  and_gate: "yes — needs long unbreakable token AND narrow h2 (track or 12ch cap) AND font not scaling with window"

## Symptoms

expected: Header looks normal at any window size (nick does not break mid-word)
actual: "this shows really weird when window is not fully open, and if it fully open nickname still shows weird"
errors: none
reproduction: open PORTIA://PERSONNEL (employees AppWindow), select employee "Kotik_play1232"; h2 computed 44px/700, width 202.45px, height 89.75px -> "Kotik_p" / "lay1232"
started: rule set introduced 890b651 (2026-10-12, pre-GSD "Refine employee profiles and editor feedback"); overflow-wrap:anywhere since c759f14; 09cd765 (phase 02-01) only recoloured

## Eliminated

- hypothesis: overflow-wrap:anywhere vs break-word is itself the cause
  evidence: identity is min-width:0 in a minmax(0,1fr) track, so anywhere/break-word differ only in min-content contribution, which does not affect this track; both split an over-long token identically. Without any break rule the nick would overflow the card. It is the carrier, not the cause.
  timestamp: 2026-10-14

## Evidence

- timestamp: 2026-10-14
  checked: app/portia.css:341,362-363,1002; components/portia-desktop.tsx:1078-1083
  found: head grid `minmax(190px,238px) minmax(0,1fr)`, gap clamp(26px,5vw,54px); h2 `max-width:12ch; font: 700 clamp(27px,4vw,44px)/1.02 var(--display); overflow-wrap:anywhere`; --display = IBM Plex Mono (0.6em -> 26.4px/char at 44px). Only viewport @media(max-width:900px) collapses to 1 column; no @container anywhere in portia.css.
  implication: font size and layout key off the viewport, not the window.

- timestamp: 2026-10-14
  checked: git blame/log -S on lines 341/363/999/1002
  found: 890b651 (2026-10-12, no phase tag, pre-GSD) introduced minmax(190px,238px) track, 12ch cap, 44px clamp, phone rules 999/1002; c759f14 introduced overflow-wrap:anywhere; 09cd765 feat(02-01) only changed colours to oklch accent hue.
  implication: not a PORTIA-03 regression; pre-existing personnel window rule.

- timestamp: 2026-10-14
  checked: headless Edge repro (scratchpad repro.html linking real app/portia.css + .next Plex Mono 700 woff2), current CSS
  found: viewport 1536: win 820 -> cols "238px 107px", "Koti / k_pl / ay12 / 32"; win 950 -> 196px "Kotik_p / lay1232"; win 1040 -> 257px "Kotik_pla / y1232"; maximized 1496 -> col 567 but h2w=317 (12ch) "Kotik_play12 / 32". Same at 1920/1280 (font always 44px). Phone 390 -> col 302, font 39px, "Kotik_play12 / 32"; 360 -> same.
  implication: reproduces owner exactly (202.45px ~ 960px window); maximized break is the 12ch cap; phone also breaks.

- timestamp: 2026-10-14
  checked: candidate fix injected as override stylesheet (container-type on .personnel-profile + .personnel-profile-identity, h2 max-width none + cqi font + break-word, @container (max-width:680px) stack head)
  found: 14-char and 20-char nicks one line at windows 820/950/1040/1100/1160/max on 1920/1536/1280 and phones 390/360; with 600px threshold the 20-char nick still split at win 1040 (identity 257px), 680px fixes it.
  implication: fix direction verified in repro; line 1002 font-size override must go or it beats the new rule at <=900px.

## Resolution

root_cause: app/portia.css .personnel-profile-head/h2 size the nickname from the viewport, not the window: (a) identity column is the residual grid track after the avatar track takes its full 238px + 54px gap + viewport-maxed paddings (107-257px for 820-1040px windows) while font stays 44px (clamp 4vw); (b) `max-width: 12ch` caps the h2 at 12 Plex Mono chars (316.8px) even maximized; (c) phone rule line 1002 uses 10vw font in a vw-88px column; overflow-wrap:anywhere then splits the 14-char token mid-word.
fix: (not applied — diagnose only)
verification: repro only
files_changed: []
