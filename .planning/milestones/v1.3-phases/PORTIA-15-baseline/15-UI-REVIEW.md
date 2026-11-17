# Phase 15 Repository UI Review

**Review status:** TASK 1 COMPLETE — OWNER VERDICT PARTIAL; MOTION REJECTED IN PHYSICAL UAT
**Review mode:** repository-native, bounded to current code and deterministic candidate captures
**Candidate set:** `phase15-current-efbc1401080d`
**Source commit:** `efbc1401080d6b65ba1f4916ad0343b783c62bb8`
**Evidence:** 51 immutable PNGs and 33 typed `BLOCKED` rows
**Authority boundary:** this review describes CURRENT evidence and PROPOSED follow-up. It approves no hash.

## Review Basis

The audit sampled the clean desktop, Start panel, restored window, virus archive, personnel, visitor/editor boundary, WebKit phone and Vivian motion captures, then checked the corresponding custom CSS and React behavior. The complete row inventory is bound in `evidence/15-FRAME-TEST-MAP.md`; the sample is for critique, not for reducing machine coverage.

## Six-Pillar Scorecard — CURRENT

| Pillar | Score | Current finding |
|---|---:|---|
| Copywriting | 4/5 | Russian labels are concise and product-specific. Window paths, status language and role-denial copy reinforce the station-terminal model. Some loading/empty evidence is not yet semantically complete. |
| Visuals | 4/5 | The spider/web field, laboratory icons, document-paper contrast and window chrome form a distinctive PORTIA OS identity. A few captured application states are visually blank or still loading. |
| Color | 4/5 | Near-black teal surfaces, restrained cyan and dedicated paper/warning/destructive roles are coherent. Small muted labels and the Vivian bubble approach low-contrast territory in the captures. |
| Typography | 4/5 | Monospace system chrome and larger application headings establish hierarchy without losing the archive tone. Very small uppercase metadata is harder to scan at desktop capture scale. |
| Spacing | 3/5 | Desktop geometry is deliberate and windows remain legible. The phone grid creates a long sparse canvas, while some dense desktop windows require internal scrolling before primary actions are visible. |
| Registry safety | 5/5 | The UI remains custom PORTIA code and assets; no component registry, generic shell or replacement design system enters the baseline. |

**Total:** 24/30. The incumbent is visually coherent and identifiable, but baseline promotion still needs exact-hash owner verdicts and later phases must close the typed state gaps.

## Bounded Technical Critique — CURRENT

### Hierarchy and layout

- Strong: the system bar, desktop icons, active taskbar item and window titlebar establish clear layers. The virus archive's dark index against the paper dossier is the clearest application hierarchy in the sample.
- Defect `UI-CURRENT-01` (medium): `application-employees-current--chromium-desktop.png` announces 16 profiles in chrome while the content body is blank. This is honest evidence of a readiness/content-render gap, not a baseline-quality frame.
- Defect `UI-CURRENT-02` (medium): `window-search-restored--chromium-desktop.png` shows “Загрузка архива…” while also displaying an available-record count. The capture is immutable, but this state should not be mistaken for a settled search result.
- Defect `UI-CURRENT-03` (low): the Settings capture places additional controls below the visible window fold. Internal scrolling is valid, though the editor entry and save/reset feedback are not visible in the first viewport.

### Responsive behavior

- Strong: the WebKit phone capture replaces desktop windows with a touch-oriented app grid, keeps Russian labels readable and preserves the bottom PORTIA/settings affordance.
- Defect `UI-CURRENT-04` (medium): the phone surface is substantially taller than its populated content, producing a long low-information scroll before the assistant/taskbar region. This is CURRENT behavior, not a request to redesign in Phase 15.
- Typed blockers correctly retain phone-only exclusions for separate minimize/maximize controls; the full-screen phone contract must not be scored as missing desktop chrome.

### Accessibility

- Strong: shared CSS supplies visible `:focus-visible` outlines; interactive editor controls carry names, state and status semantics; motion-off keeps static content available.
- Defect `UI-CURRENT-05` (medium): several 10–11px muted labels and the Vivian advice bubble have weak visual prominence against the dark field. Contrast and readable-size measurements should be verified before any later style change.
- Desktop window controls are visually compact. Their phone equivalents are removed by the full-screen contract, but keyboard target clarity remains part of later physical UAT.

### Motion and performance

- Evidence coverage: shortcut captures cover start, key, interruption, end and rest; spider, web and Vivian have deterministic still states, and `data-motion="reduce"` suppresses continuous wallpaper motion. These stills prove capture coverage only, not smooth playback.
- The current user setting is `on|off`; CSS implements “off” as reduced/soft motion, not a universal zero-transition mode. This is documented CURRENT behavior.
- Defect `UI-CURRENT-06` (medium): boot and wallpaper-switch sequences remain typed blockers, so the motion story is not complete even though individual shortcut/spider/web/Vivian states are captured.
- Defect `UI-CURRENT-07` (high, owner physical UAT): the PNG spider moves in visible jumps/teleports; its route was offset instead of being rebuilt, so adjacent web sectors are not traversed naturally and a one-sided trail remains.
- Defect `UI-CURRENT-08` (high, owner physical UAT): shortcut hover/focus cycles shift the icon container and can freeze before the terminal frame (Table is the reported example). Pointer exit and animation-to-static handoff do not preserve geometry or complete the full cycle.
- Defect `UI-CURRENT-09` (medium, owner physical UAT): window content does not consistently reflow with the available bounds, so important information can move or clip in ways that damage the composition.
- The implementation avoids blur/filter-heavy web waves and scopes continuous motion to the wallpaper/assistant layers. Performance remains a physical-device UAT concern rather than a claim made from still PNGs.

## CURRENT Disposition

| Area | Captured authority | Remaining typed boundary |
|---|---|---|
| Desktop/window shell | Desktop, Start, restored/minimized/maximized, DPR 1.25, Firefox and phone layouts | Phone-specific minimize/maximize controls are intentionally blocked |
| Public applications | Ten safe public app frames | Loading, empty, degraded, denied and fatal fixtures are blocked to Phase 20 |
| Editor | Signed-out login and visitor denial | Authenticated role/save/conflict/WYSIWYG/phone states are blocked to Phase 16 |
| Promotion | Safe participant lookup | Participant/reviewer/private-data states are blocked to Phase 19 |
| Motion | Shortcut, spider, web and Vivian deterministic states | Boot/wallpaper boundary to Phase 18; qualification lock follows isolated data |

## PROPOSED — EXCLUDED FROM CURRENT BASELINE

These are review recommendations only. They do not alter CURRENT evidence and cannot be approved by accepting a current PNG.

1. `UI-PROPOSED-01`: add semantic readiness gates so populated/search/personnel captures cannot finish on an empty or transitional body.
2. `UI-PROPOSED-02`: evaluate a denser phone vertical composition while preserving the same app inventory and full-screen phone contract.
3. `UI-PROPOSED-03`: measure muted metadata and Vivian bubble contrast/size, then adjust only failing tokens in a later implementation phase.
4. `UI-PROPOSED-04`: capture boot and wallpaper switching with explicit clocks and interruption rules in Phase 18.
5. `UI-PROPOSED-05`: keep the existing `on|off` product setting unless the owner separately chooses a three-state motion model.
6. `UI-PROPOSED-06` (owner-directed, Phase 18): retain the PORTIA OS concept but rebuild shortcut icon artwork and motion as one system. Every cycle must complete after pointer exit, keep the outer shortcut box fixed, and hand off to a static frame with identical geometry, viewBox, filter and raster quality.
7. `UI-PROPOSED-07` (owner-directed, Phase 18): rebuild spider routing as continuous interpolation across the usable web field. Do not fake coverage by offsetting the spawn point; support neighboring sectors, coherent footfall waves and no teleport/trail discontinuity.
8. `UI-PROPOSED-08` (owner-directed, Phase 18): make window content reflow within bounded geometry so important information remains visible without breaking the PORTIA composition.

## Owner Motion Disposition — 2026-10-31

Qloxz rejected the current spider route/gait, web-wave behavior and shortcut animation cycle after physical playback review. This verdict overrides positive impressions inferred from still PNGs. The affected CURRENT captures remain evidence of the defective implementation and must not become approved replacement baselines. Exact per-hash ledger rows are recorded during Task 2; unchanged non-motion candidates still require an explicit verdict.

## Review Verdict

Repository review is complete for Task 1. The candidate set remains **PENDING OWNER VERDICT**: 51 captured hashes require one Qloxz verdict each, while all 33 unavailable states remain `BLOCKED` and ineligible for approval.
