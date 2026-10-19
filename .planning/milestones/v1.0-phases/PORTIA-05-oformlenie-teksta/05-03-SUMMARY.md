---
phase: PORTIA-05-oformlenie-teksta
plan: 03
subsystem: ui
tags: [react, css, editor, wysiwyg, node-test]
status: complete

requires:
  - phase: PORTIA-05 plan 02
    provides: phone panel tabs (data-tab / data-tab-group), nextFieldSelection
provides:
  - per-area field ink and surface (--field-ink / --field-bg) that mirror the site place on its native surface
  - nativeSurface map and a nullable previewSurface (a field opens on its own area's surface)
  - assistant field that ignores run colour, size and weight like the site, with a D-19 hint
  - lib/editor-field-look.test.ts, a CSS pairing test between field and site rules
affects: [05-04, 05-05]

actuals:
  tokens: 2900
  tasks: 2
  commits: 4
plan_head_before: 5257a1efb56229d4ab02dc7e0591481cfa15de73
plan_head_after: 24ba17ed570188c41674397b2aca647778cb031a

tech-stack:
  added: []
  patterns:
    - "the field reads --field-ink / --field-bg; one rule per area on its native surface sets them (specificity 0,3,0)"
    - "preview surface is null until the owner picks БЕЛЫЙ/ЧЁРНЫЙ; null means nativeSurface[area]"

key-files:
  created: [lib/editor-field-look.test.ts]
  modified: [app/portia.css, components/portia-editor.tsx]

key-decisions:
  - "05-03: field ink and surface are per area on the area's native surface via --field-ink/--field-bg; lib/editor-field-look.test.ts keeps them equal to the site (D-09, D-17)"
  - "05-03: preview surface defaults to each field's own area (nativeSurface), not the editor tab"

requirements-completed: []
---

# Phase 5 Plan 3: Editor field looks like the site Summary

Each editor field now shows unformatted text in the ink and on the surface of the site place it edits (dossier, metrics, mutations, scientist logs, Корзина, Информация, broadcasts, captions, search, assistant), with the generic D-06/D-07 colours on the opposite surface, and a test that fails when a field and its site rule drift apart.

## Accomplishments

- `app/portia.css`: `.formatted-rich-input` declares `--field-ink: oklch(.79 .02 var(--accent-hue))` (D-06, equals #AEBFBA at the default accent) and `--field-bg`, and reads them; `.preview-light` sets the `.class-cell strong` ink (D-07) on `#f3f1e9`. The two focus / active rules lost `color` and `background`, so the ink no longer jumps on focus.
- Ten native-surface rules `.formatted-rich-input[data-area="<area>"].preview-<native>` (lead, metric, mutation, scientist, trash light; info, broadcast, caption, search, assistant dark), each with the site rule it mirrors in a trailing comment.
- Assistant: font `700 10px/1.4` with `letter-spacing .099em` (bubble values), ink and background taken after the bubble's `brightness(.7)` filter, `text-shadow`, and `span { color / font-size / font-weight: inherit !important }` on both surfaces; run background still shows.
- `components/portia-editor.tsx`: `nativeSurface` map, `previewSurface` nullable (initial null, `showTab` resets to null), `ActiveFormatContext.surface` nullable, field class `preview-${activeFormat.surface ?? nativeSurface[area]}`, `FormatTarget.area`, panel `surface = previewSurface ?? nativeSurface[target.area]` driving БЕЛЫЙ/ЧЁРНЫЙ, the default text colour and the «Основной» swatch.
- Assistant hint `p.format-area-note` is the first child of the toolbar with no `data-tab-group`, so it shows in every phone tab and scrolls with the controls; all buttons stay.
- `lib/editor-field-look.test.ts` (14 tests): generic D-06/D-07, no colour/background in focus rules, lead, eight area pairs (ink) with four background pairs (metric, scientist, trash, caption), native rule present for all ten areas, assistant override and spacing. 184 tests pass.
- The STATE concern about the assistant bubble spacing (phase 1) is closed: the field now uses the bubble's letter-spacing and line height, and the test pins them.

## Task Commits

| Task | Commit | Note |
|------|--------|------|
| 1 RED | 1bb5fae | generic surfaces, focus, lead pair (failing) |
| 1 GREEN (tracer) | 1e1df46 | variables, D-06/D-07, nativeSurface, nullable surface, FormatTarget.area |
| 2 RED | f765c6f | eight area pairs, assistant mirror (failing) |
| 2 GREEN | 24ba17e | all native-surface rules, assistant override, hint |

## Deviations from Plan

None - plan executed as written.

Tracer gate note: the tracer's `<verify>` carries a `<human-check>` (browser comparison needing the owner's login), so it was not run here. The automated verify was re-run end-to-end after the tracer commit (tests, tsc, lint, build, no diff in the protected files) and passed before expansion, matching how 05-02 handled its tracer. The human check stays for end-of-phase UAT.

## Verification

- `npm test` (184 pass), `npx tsc --noEmit`, `npm run lint` (0 errors, 14 pre-existing warnings), `npm run build` pass.
- `components/portia-desktop.tsx`, `lib/portia-content.ts`, `lib/portia-content-normalize.ts` have no diff. `app/portia.css` and `components/portia-editor.tsx` keep CRLF.
- The plan's two node string checks were covered by the same assertions (test names, rule presence, note placement before the footer, `grid-column: 1 / -1`) and checked by reading, not by running the long one-liners.
- NOT run: both human checks (dossier comparison and the all-areas plus phone-panel comparison). The editor needs login; SAVE was never pressed and no content was written.

## Differences for owner sign-off at UAT (D-09)

1. «Рекомендации поиска»: no pill border per line (one contenteditable).
2. «Важная» broadcast: site card is teal, the field uses the ordinary broadcast tone.
3. Information, broadcast and search gradients are mirrored by one mid tone (`oklch(.206 .019)` / `.212 .019`).
4. Assistant: the bubble dims run backgrounds by 30 %, the field does not.

Also derived rather than copied: mutation background `#f5f3eb` (the card's 20 % white over the paper) is not asserted by the test; only its ink is.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: lib/editor-field-look.test.ts, app/portia.css, components/portia-editor.tsx
- FOUND commits: 1bb5fae, 1e1df46, f765c6f, 24ba17e
