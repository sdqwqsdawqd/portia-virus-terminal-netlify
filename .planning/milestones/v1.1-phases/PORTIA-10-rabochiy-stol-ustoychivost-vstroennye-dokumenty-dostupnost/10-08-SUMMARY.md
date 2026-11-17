---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
plan: 08
subsystem: theme
tags: [custom-accent, oklch, neutral-theme, gap-closure, G-10-2b, D-23]
requires: ["10-07"]
provides:
  - "deriveAccentTokens keeps the pick's own hue and chroma (cap 0.17); only lightness is clamped"
  - "--accent-chroma token (0 for a neutral pick, 1 at preset strength) scaling all 422 accent tints"
  - "neutral picks (black, grey, white) give a neutral grey theme; #0D0D0D gives --teal #868686"
  - "D-23 recorded in 10-CONTEXT.md (supersedes D-05); UI-SPEC derived-token contract follows the shipped maths"
affects: ["10-09"]
tech-stack:
  patterns:
    - "oklch(L calc(C * var(--accent-chroma)) var(--accent-hue)) for every accent tint"
key-files:
  modified:
    - lib/accent-custom.ts
    - lib/accent-theme.test.ts
    - lib/editor-field-look.test.ts
    - app/portia.css
    - components/portia-editor.tsx
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-boot-check.mjs
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-CONTEXT.md
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-UI-SPEC.md
decisions:
  - "D-23 (owner): the Свой accent follows the picked colour; neutral picks make the whole theme neutral via --accent-chroma; only lightness is corrected"
  - "Chrome tint choice: a neutral pick makes the chrome neutral too (every oklch tint scaled by --accent-chroma, :root 1 so presets are unchanged)"
metrics:
  duration: ~35 min
  completed: 2026-10-26
status: complete
requirements-completed: [THEME-01]
actuals:
  tokens: 60000
  tasks: 3
  commits: 4
plan_head_before: 83f029269444605c7efad86b89f21decff420050
plan_head_after: 6fd0d3691942793ea0e25ab8bb8007f10181c646
coverage:
  - deliverable: "A neutral pick gives a neutral grey accent and chrome, never teal"
    verification:
      - { kind: test, ref: "lib/accent-theme.test.ts#an achromatic pick gives a neutral grey theme", status: pass }
      - { kind: command, ref: "10-boot-check.mjs (neutral case, 11 tokens)", status: pass }
      - { kind: command, ref: "10-desktop-check.mjs --check accent step (m)", status: pass }
    human_judgment: false
  - deliverable: "Every accent tint follows --accent-chroma"
    verification:
      - { kind: test, ref: "lib/accent-theme.test.ts#every accent tint follows --accent-chroma", status: pass }
    human_judgment: false
  - deliverable: "A dark or muted pick keeps its hue and strength"
    verification:
      - { kind: test, ref: "lib/accent-theme.test.ts#a dark or muted pick keeps its hue and strength", status: pass }
    human_judgment: false
  - deliverable: "Owner sees the neutral theme on their own devices"
    human_judgment: true
    rationale: "Owner device look is plan 10-09; headless Edge only proves computed chroma"
---

# Phase 10 Plan 08: Свой accent follows the picked colour Summary

**Black, grey and white picks now give a neutral grey theme (#0D0D0D gives accent #868686), and dark or muted colours keep their own hue and strength, through a new `--accent-chroma` token that scales every accent tint.**

## Accomplishments

- `deriveAccentTokens` (D-23): a pick with OKLCH chroma below 1e-4 is neutral (hue 0, `--accent-chroma` 0, both PNG filters exactly `hue-rotate(0deg) saturate(0)`). Every other pick keeps its own hue and chroma (cap 0.17, no floor, no grey-to-teal fallback); only lightness is clamped to 0.62-0.80. `--accent-chroma = min(1, teal chroma / 0.08)`; base/deep use 0.02 x and 0.03 x it; the filter search scales saturate by it.
- `app/portia.css`: `:root --accent-chroma: 1`, and all 422 `oklch(L C var(--accent-hue))` tints (plus `components/portia-editor.tsx` baseInk) are now `oklch(L calc(C * var(--accent-chroma)) var(--accent-hue))`. Vivian's hover glow uses `--desktop-glow`; the fixed teal `--assistant-glow` token is deleted.
- Tests: neutral grey theme for #000/#0d0d0d/#808080/#fff, per-file scaled-form check, dusky red continuity (#180d0d vs #1c0d0d), bluish grey (#3a3a42), muted red (#6b4a4a), and a 432-pick HSV board. `npm test` 304/304.
- Harness: boot check has a `neutral` case and 11 tokens; Edge accent step (m) proves `--bg`, `--line-bright` and a Settings option border compute to chroma <= 0.001 for #0d0d0d and >= 0.01 for #ff3366.
- D-23 recorded in 10-CONTEXT.md (D-05 marked superseded); 10-UI-SPEC.md contract rows amended.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (tracer) | 5498d21 | neutral custom accent gives a neutral grey theme |
| 2 | 851a433 | every accent tint follows --accent-chroma |
| 3 | 41bee8a | muted custom accent keeps its hue and strength |
| 3 (docs) | 6fd0d36 | D-23 supersedes D-05; UI-SPEC follows the pick |

## Deviations from Plan

None - plan executed exactly as written. (Task 3's new test passed on the first implementation run after being seen failing against the Task 2 code, so RED was confirmed and no separate RED commit was made, matching the plan's single code commit.)

## Verification

- `npm test`: 304 pass, 0 fail.
- Fresh `npm run build` + `npx next start -p 3124`: `10-boot-check.mjs` `"ok": true`, `customProps: 11`, `neutral: true`; `10-desktop-check.mjs --check accent` `"ok": true`, no reasons (including (m)). No non-GET request to /api/content was made.
- Acceptance greps (accent-chroma names, 422 = 422 scaled sites, `assistant-glow` 0, D-23 lines, `Portia teal hue` 0) all as specified.

## Known Stubs

None.

## Threat Flags

None. T-10-13 held: the strict `/^#[0-9a-f]{6}$/i` check is unchanged, the new token is `String()` of a `toFixed` number, tampered-colour test and boot hostile case stay green.

## Next Phase Readiness

Ready for 10-09 (G-10-2 picker x button and the owner device look at the neutral theme).

## Self-Check: PASSED

- Files modified exist; commits 5498d21, 851a433, 41bee8a, 6fd0d36 are ancestors of HEAD.
