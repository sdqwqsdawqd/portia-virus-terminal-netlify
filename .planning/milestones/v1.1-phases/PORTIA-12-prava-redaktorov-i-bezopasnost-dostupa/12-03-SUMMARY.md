---
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
plan: 03
subsystem: media-url-safety
tags: [security, media-url, tdd, CONT-09]
requires: []
provides:
  - "isLocalMediaPath, isAllowedMediaUrl in lib/media-url.ts"
affects: [12-04 (SQL photo_url CHECK must use the same rule)]
tech-stack:
  added: []
  patterns: [one shared predicate instead of three copies of a prefix test]
key-files:
  created:
    - lib/media-url.ts
    - lib/media-url.test.ts
  modified:
    - lib/portia-content-normalize.ts
    - lib/portia-content-normalize.test.ts
    - lib/portia-employees.ts
    - lib/portia-employees.test.ts
    - components/portia-editor.tsx
key-decisions:
  - "A local path is one slash, then neither slash nor backslash, with no ASCII control character anywhere (stricter than needed is not worse)"
status: complete
commits: 4
plan_head_before: fde5f6bb06fb85f3fb7db09993f94f29ee767747
plan_head_after: cbb8a366b973a2c5ffa5b215f8e5d186e9998ba7
actuals:
  tokens: 3500
  tasks: 2
  commits: 4
completed: 2026-10-26
---

# Phase 12 Plan 03: local media path rule Summary

`//host/x.png` and `/\host/x.png` are no longer taken for local files: one shared rule in `lib/media-url.ts` now decides at the content normalizer, the employee profile code and the editor's media field.

## What was built

- `lib/media-url.ts`: `isLocalMediaPath` (one leading slash, second character not `/` or `\`, no control characters U+0000-U+001F or U+007F) and `isAllowedMediaUrl` (https or local path).
- `normalizeMediaUrl` uses `isAllowedMediaUrl`, so recycle file, virus, mutation and info photo block links of the `//host` kind are blanked on every save and cached read.
- `sanitizeEmployeeUpdate` refuses such a `photoUrl` (null, the route answers 400); `profileFromRow` shows a stored bad `photo_url` as no photo.
- `mediaUrlFromText` falls back to the pasted text only when `isLocalMediaPath` holds. A pasted `//host` stays plain text and the normalizer blanks it on save. The editor diff is two lines (import + fallback).

## Verification

- `npm test`: 361 pass, 0 fail.
- `npx tsc --noEmit`: clean.
- `npm run lint`: no errors in changed files (see Deferred Issues).
- TDD order held: test commits (red) 3ce9ac6, 9c09110, then feat commits 68c95f2, cbb8a36.

## Deviations from Plan

None - plan executed as written.

## Deferred Issues

`npm run lint` exits non-zero with 2 errors that exist before this plan and are outside it: `@typescript-eslint/no-require-imports` in `.planning/phases/PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh/06-check-backup.cjs` and `06-check-disposition.cjs`. Not touched. The remaining lint output is `<img>` warnings in `components/portia-editor.tsx`, also pre-existing.

## Known Stubs

None.

## Threat Flags

None. T-12-09 is mitigated in code; the SQL CHECK half is plan 12-04.

## Self-Check: PASSED

- lib/media-url.ts and lib/media-url.test.ts exist; the three call sites use the shared rule.
- Commits 3ce9ac6, 68c95f2, 9c09110, cbb8a36 are on design/stage-1-desktop.
