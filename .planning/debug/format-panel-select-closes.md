---
status: diagnosed
trigger: "UAT 12 (PORTIA-03, after 03-06): When i trying to select editor is closing so i need to open again, also if in document color is different i can only notice if i select the category"
created: 2026-10-14T15:00:00Z
updated: 2026-10-14T15:40:00Z
---

## Current Focus

hypothesis: CONFIRMED (A) the phone effect in FloatingTextFormatPanel closes the panel on any focusin of the field, and a touch on the blurred field always focuses it; this was built on purpose in 03-03 (6583baf), not in 03-06. (B) the panel already shows the colour of the first selected character. What hides colour is the document side: fields that are not active force every run to the neutral colour (portia.css:507), and the global ::selection rule paints selected text near-white (portia.css:68). The panel readout is also weak (seeded from one character, 11px, no ✓ for custom colours)
bug_class: Bohrbug (deterministic UI logic)
next_action: hand diagnosis to caller (find_root_cause_only)

reasoning_checkpoint:
  hypothesis: "(A) portia-editor.tsx:1545-1547 adds a document focusin listener that calls onClose when event.target === field. The panel blurs the field on open (1533). Any tap or long-press to select text focuses the field again, focusin fires, and setFormatterOpen(false) unmounts the panel. (B) portia.css:507 resets span colour/background with !important on every .formatted-rich-input that is neither :focus nor .is-editor-active. portia.css:68 ::selection sets the text colour to near-white, so the selected run's own colour is hidden while it is selected"
  confirming_evidence:
    - "code: onFocusIn is the only path from user input to onClose except × and ГОТОВО (finish). activate/onSelect only calls setFormatTarget"
    - "03-03-PLAN.md:26 truth + :216 action: 'tapping the text while the panel is open closes the panel'; 03-03-SUMMARY.md:14 same; blame 1525-1554 = 6583baf (03-03); bbd6002 (03-06) touches only app/portia.css"
    - "headless Edge harness, 375x667 mobile + touch emulation, real portia.css, replicated effect: a touch tap on the field gives focusin:field, the panel closes, activeElement=field"
    - "same harness with inputmode=none and no focusin close: the tap focuses the field and the panel stays (keyboard cannot be seen headless)"
    - "harness: red span in an inactive field computes to oklch(0.845 0.017 180.4), so the red is hidden; the selected orange word in the active field renders near-white on teal (::selection); panel card title shows ■ #E0592A without any tap"
  falsification_test: "(A) if a touch on the blurred field did not fire focusin, or another handler closed the panel, the harness would keep the panel open. (B) if the panel readout appeared only after the custom picker opened, case1 would have shown no hex"
  fix_rationale: "(A) drop the focusin close and suppress the keyboard with inputmode=none on the active field while the panel is open. Selection changes then flow through the existing onSelect -> activate -> setFormatTarget path. (B) let the document show run colours, and stop ::selection overriding them inside the rich-text field"
  blind_spots: "no real-device test (iOS 13+/Chrome Android inputmode=none, long-press handles on a contenteditable with inputmode=none, whether the native selection survives blur on each OS). The owner's word 'category' is ambiguous (field vs the panel's colour card)"
  candidate_causes:
    - "code (A): focusin -> onClose in the phone effect (confirmed)"
    - "code (A): visualViewport resize / selectionchange closing the panel (eliminated)"
    - "config/CSS (A): 03-06 phone panel CSS (eliminated, CSS cannot unmount a React node)"
    - "code (B): panel colour state not read from the selection (eliminated, it is read on every remount)"
    - "CSS (B): inactive-field colour override + global ::selection colour (confirmed)"
  and_gate: "(A) yes: it needs the focusin close AND the panel blurring the field on open (without the blur the field would already be focused and a tap would not fire focusin). (B) no single cause: either CSS rule alone hides the colour in its own situation"

## Symptoms

expected: (A) with the panel open the owner can change the selection in the field and apply styles; panel stays open until ГОТОВО. (B) the panel shows the selection's current text colour without opening the colour control
actual: owner: "When i trying to select editor is closing so i need to open again, also if in document color is different i can only notice if i select the category"
errors: none
reproduction: phone, editor, focus a rich-text field, tap ✎, then touch/long-press the text to select
started: retest after 03-06 (bbd6002, CSS only); behaviour present since 03-03 (6583baf)

## Eliminated

- hypothesis: 03-06 (bbd6002) introduced the close
  evidence: git show --stat bbd6002 = app/portia.css only (+8/-6); blame of the phone effect 1525-1554 = 6583baf (03-03)
  timestamp: 2026-10-14T15:10:00Z

- hypothesis: visualViewport resize (keyboard returning) closes the panel
  evidence: keepVisible (1538-1543) only calls window.scrollBy; it never calls onClose
  timestamp: 2026-10-14T15:10:00Z

- hypothesis: selectionchange / onSelect closes the panel
  evidence: onSelect/onFocus/onMouseUp/onKeyUp -> activate -> onActivate = setFormatTarget (672); this changes the panel key (1141) so the panel remounts, but formatterOpen stays true. In the harness, close happened on focusin:field before any selection logic
  timestamp: 2026-10-14T15:20:00Z

- hypothesis: an outside-pointerdown handler closes the panel
  evidence: no document pointerdown listener exists; the only onPointerDown is on the ✎ button (855, preventDefault)
  timestamp: 2026-10-14T15:10:00Z

- hypothesis: (B) the panel colour readout updates only when the colour control / custom picker is opened
  evidence: color state is seeded at mount from richTextStyleAt(target.document, target.selection.start) (1507, 1512) and rendered in the card title (1601). The panel remounts on every selection change because the key includes start/end (1141). Harness case1 shows ■ #E0592A in the ЦВЕТ ТЕКСТА title at the top of the toolbar with no interaction
  timestamp: 2026-10-14T15:30:00Z

## Evidence

- timestamp: 2026-10-14T15:05:00Z
  checked: .planning/debug/knowledge-base.md
  found: does not exist; no prior match (format-panel-too-big-phone.md is about size only)
  implication: open investigation

- timestamp: 2026-10-14T15:08:00Z
  checked: components/portia-editor.tsx:1525-1554 (FloatingTextFormatPanel phone effect)
  found: phone only (matchMedia max-width 900px). It blurs the field if focused (1533), paints CSS.highlights "portia-format" and scrolls the selection above the panel. `const onFocusIn = (event) => { if (event.target === field) onCloseRef.current(); }` is registered on document (1545, 1547). The comment at 1526 says "touching the text closes the panel"
  implication: any focus of the field while the panel is open closes it, by design

- timestamp: 2026-10-14T15:09:00Z
  checked: 03-03-PLAN.md:26, :216, :278; 03-03-SUMMARY.md:14, :97; 03-CONTEXT.md D-06 (line 24)
  found: the plan truth says "tapping the text while the panel is open closes the panel (D-05, D-06)". The rationale is "tapping the text means typing: keyboard back, panel away". D-06 itself only says the keyboard hides while the panel is open and "Закрыли панель — можно снова печатать"; it does not require tap-to-close
  implication: pre-existing from 03-03, a plan-level interpretation of D-06 that the owner now rejects; the fix must amend that truth

- timestamp: 2026-10-14T15:20:00Z
  checked: scratch harness (real app/portia.css, panel markup from FloatingTextFormatPanel, replicated phone effect) in headless Edge via CDP, 375x667 mobile, touch emulation
  found: case2 touch tap on the blurred field gives focusin:field, the panel closes, activeElement=field. case3 with inputmode=none on the field and no focusin close: same tap gives activeElement=field and the panel stays
  implication: the focusin close is the mechanism; inputmode=none + no close is a viable direction (keyboard suppression needs a real device)

- timestamp: 2026-10-14T15:25:00Z
  checked: effect deps [formatKey, selectionStart, selectionEnd, formatDocument] + panel key `${key}:${start}:${end}:${surface}` (1141)
  found: every selection change remounts the panel and re-runs the effect, which calls field.blur() whenever the field is focused (1533)
  implication: removing only the focusin close is not enough. After the first new selection the effect would blur the field again (on iOS blur drops the selection handles). The blur must happen once on open (e.g. in the ✎ onClick, 856), not in the per-selection effect

- timestamp: 2026-10-14T15:30:00Z
  checked: panel colour readout (1507, 1508, 1512, 1601) + palette (69-77) + harness case1 screenshot
  found: the readout ■ + hex (11px font, 11px square) sits in the ЦВЕТ ТЕКСТА card title and is visible without interaction. Weak spots: (1) seeded from the single character at selection.start; with a collapsed caret (ВЕСЬ ТЕКСТ mode, the usual phone case) it shows the character at the caret, or the last character when the caret is at the end, while styles apply to the whole text, so a coloured word elsewhere is not reflected. (2) a non-palette colour gets no ✓ on any swatch. (3) the dark-surface default #aebfba is not in the palette, so default text on ЧЁРНЫЙ shows no ✓
  implication: the panel does show colour, but weakly and for one character only

- timestamp: 2026-10-14T15:32:00Z
  checked: app/portia.css:507 + harness case4
  found: `.formatted-rich-input:not(:focus):not(.is-editor-active) > span { color: oklch(.845 .017 var(--accent-hue)) !important; background-color: transparent !important; }`. A red span in a non-active field computes to the neutral grey. Present since 5001944 (initial deploy), recoloured in 09cd765
  implication: coloured text in the document is invisible in the editor until that field is focused/active ("only notice if i select the category" = select the field)

- timestamp: 2026-10-14T15:34:00Z
  checked: app/portia.css:68 + harness case1 screenshot
  found: `::selection { background: rgba(var(--desktop-glow), .32); color: oklch(.981 .01 var(--accent-hue)); }`. The selected orange word renders near-white on teal inside the active field. ::highlight(portia-format) (433) sets only background
  implication: the run whose colour the owner is checking is exactly the run whose colour is hidden while it is natively selected

## Resolution

root_cause: (A) components/portia-editor.tsx:1545-1547: the phone effect of FloatingTextFormatPanel registers a document focusin listener that calls onClose when the rich-text field gets focus. The same effect blurs the field when the panel opens (1533), so every touch or long-press to select text refocuses the field and closes the panel. Built in 03-03 (6583baf) as the plan truth "tapping the text closes the panel"; not caused by 03-06. (B) the document hides text colour, not the panel. app/portia.css:507 forces every run in a non-active .formatted-rich-input to neutral grey (!important). app/portia.css:68 global ::selection sets the selected text near-white, so the selected run loses its colour. The panel readout (portia-editor.tsx:1507/1512/1601) does show the colour without opening anything, but only for the character at selection.start (with a caret: the character at the caret, or the last one), tiny (11px), and custom colours get no ✓
fix: (not applied - goal find_root_cause_only)
verification:
files_changed: []
