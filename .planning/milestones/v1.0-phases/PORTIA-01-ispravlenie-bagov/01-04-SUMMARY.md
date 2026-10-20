---
phase: PORTIA-01-ispravlenie-bagov
plan: 04
subsystem: ui
tags: [css, editor, typography, wysiwyg, gap-closure]

requires: ["01-01", "01-02"]
provides:
  - "Every editor text field uses the font of the site area it edits, through one shared CSS rule per area (G-PORTIA-01-5, FIX-03 clarified)"
  - "Typed required `area: DisplayArea` prop on FormattedTextarea, rendered as data-area"
  - "--assistant-font token (single source of the Segoe UI assistant stack)"
  - "Broadcast bodies on the site render 15px/1.7 regular as .broadcast-card-copy intends"
affects: [PORTIA-02-vneshniy-vid (the shared block is where the interface/document font boundary is drawn), PORTIA-05 (TEXT-01 size presets)]

actuals:
  tokens: 9000
  tasks: 3
  commits: 3
plan_head_before: fe2fbf812a0545d028c36230bd231f6400e9162f
plan_head_after: a9241e60f56f58924e78eeed1ec691835ddce340
commits: 3

tech-stack:
  added: []
  patterns:
    - "Display selector and `.formatted-rich-input[data-area=...]` share one CSS rule, so site text and editor field cannot drift apart"

key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - app/portia.css

key-decisions:
  - "Explicit typed `area` prop instead of parsing formatKey (formatKey has no recycle-file kind; one `virus:` prefix maps to three areas)"
  - "--assistant-font token holds the Segoe UI stack once; the assistant mobile rules are not mirrored because they never change the live 10px on the site"
  - "Base .formatted-rich-input and the preview-dark rule no longer set any font: БЕЛЫЙ/ЧЁРНЫЙ changes only background and colour"

requirements-completed: [FIX-03]
status: complete

coverage:
  - id: D1
    description: "Each of the 13 FormattedTextarea call sites passes a typed area and each of the 10 areas has one shared display+field font rule with the pre-existing display values"
    verification:
      - kind: other
        ref: "Task 3 node check prints 'area fonts OK'; Task 1 check printed 'tracer OK'; tsc, lint (0 errors, 13 warnings), npm test (13 pass), npm run build all exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rendered typeface identity between each site area and its editor field, including 375px and the БЕЛЫЙ/ЧЁРНЫЙ toggle"
    verification:
      - kind: other
        ref: "Plan Task 3 human-check (10 rows) - not run: needs an owner session in a browser"
        status: pending
    human_judgment: true
---

# Phase PORTIA-01 Plan 04: Editor field font follows its site area Summary

**Each editor text field now shares one CSS font rule with the site area that displays its text, via a typed `area` prop rendered as `data-area`; the БЕЛЫЙ/ЧЁРНЫЙ toggle no longer touches the font.**

## Performance

- **Duration:** about 15 min (start time was not captured; estimate)
- **Completed:** 2026-10-13
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files modified:** 2

## Accomplishments

- Task 1 (tracer): `type DisplayArea` (10 literals), required `area` prop on FormattedTextarea rendered as `data-area={area}`, `area` passed at all 13 call sites (line 796 uses the image/text ternary). Lead area wired end to end: shared rule `.lead-copy, .formatted-rich-input[data-area="lead"]` plus the 900px override.
- Task 2: `.broadcast-card > span`, `.quest > span`, `.task > span` narrowed to `:first-child` (3 lines, selectors only), so broadcast bodies are no longer restyled as the type label.
- Task 3: the other nine areas fanned out into the shared block, typography removed from the nine display rules, `--assistant-font` token added, 900px overrides for info and trash extended with the field selector, base field font and preview-dark font-family removed.

## Task Commits

1. Task 1: `5dfa482` fix(editor): field font follows its site area, dossier text first (FIX-03) - components/portia-editor.tsx, app/portia.css
2. Task 2: `374335a` fix(broadcasts): type label style no longer hits the body text - app/portia.css (3+/3-)
3. Task 3: `a9241e6` fix(editor): every editor field uses its site area font (FIX-03) - app/portia.css

## Visible changes

- Every editor field now has its area's typeface and size. Only the scientist log field stays serif (IBM Plex Serif 17px). Fields are Golos at 16/14/14/16/15/14/14/11 px (lead, metric, mutation, info, broadcast, trash, caption, search); assistant fields are bold 10px Segoe UI. The search field is now 11px and assistant fields 10px, which is small to type in; the user should confirm this is wanted.
- Public site: broadcast bodies in «Сводка» are now 15px/1.7 regular grey (#a3b6b1) instead of the bold 11px coloured label style. This is a deliberate visible change (Task 2).
- All other site areas carry the same values as before (moved, not changed).

## Deviations from Plan

None - plan executed as written. The CSS edits for Task 3 were applied with a one-off exact-match replace script (each pattern asserted unique); one pattern was made more specific after the script refused an ambiguous match (`.mutation-copy p` shares the same declaration text). Nothing was written by the failed run.

## Noticed, not fixed

- `.assistant-bubble > span` (specificity 0,1,1) also matches the assistant FormattedText root span and overrides `.assistant-formatted-text`. Same defect class as the broadcast one; live family/size/weight come from `.assistant-formatted-text > span` (!important), so it was not reported. Narrowing it to `:first-child` would visibly change bubble letter-spacing, line-height and bottom margin. User's decision.
- Formatting panel size presets (S/M/L/XL = 13/17/22/30 px, default 17) are unchanged (phase 5, TEXT-01). After this plan the "M" highlight no longer equals the base size for most areas.
- Dead rules `.info-document-copy p`, `.broadcast-card p`, `.metric-grid p`, `.mutation-copy p` left untouched.

## Known Stubs

None.

## Threat Flags

None. `data-area` is a compile-time literal from the DisplayArea union; no new input path. Stored content (formatKey, RichTextDocument, save path) untouched.

## Verification

- tsc: exit 0. lint: 0 errors, 13 warnings (pre-existing). npm test: 13 pass. npm run build: exit 0 (dev server on 3123 left running).
- Browser spot-check of computed styles and the 10-row human check were NOT done (needs an owner login session); left for UAT re-run of test 5.

## Self-Check: PASSED

- Commits 5dfa482, 374335a, a9241e6 exist on design/stage-1-desktop; the orchestrator's .planning/config.json, state.json and milestone.lock were not staged.
