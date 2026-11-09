---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 10
subsystem: ui
tags: [media, images, placeholder, skeleton, fetch-priority, lazy-loading, playwright]
requires:
  - phase: 19-02
    provides: lib/media-url.ts isAllowedMediaUrl, the single URL contract
  - phase: 19-09
    provides: wave 5 baseline (c6074a6)
provides:
  - lib/media-display.ts (mediaSource, mediaLoadingAttrs, MEDIA_SLOW_MS)
  - PortiaImage in components/portia-desktop-media.tsx, the only way a record picture reaches an <img>
  - .portia-image CSS (sized frame, 150ms skeleton, PORTIA placeholder)
  - tests/e2e/specs/media-states.spec.ts (4 tests x 5 projects)
affects: [19-14]
status: complete
actuals:
  tokens: 21500
  tasks: 3
  commits: 4
plan_head_before: c6074a6730e77e7e3b8a667fdafc7b4a55ed79f6
plan_head_after: 82dc9af10a0f431980023faab74412035432f060
tech-stack:
  added: []
  patterns:
    - "One component for every record picture: link gate (mediaSource) -> keyed frame (recordId|link) -> skeleton after 150ms -> loaded fade-in, or placeholder on error / block / 15s"
    - "Priority is data, not markup: mediaLoadingAttrs('hero'|'lazy') is the only place that writes loading / fetchPriority / decoding; prioritizeImage (preconnect + preload) is private to PortiaImage and runs only for hero"
    - "Browser spec that faults only IMAGE requests to other hosts (route.fallback for everything else) and strips exactly the diagnostics it caused; own /api is never fulfilled"
key-files:
  created:
    - lib/media-display.ts
    - lib/media-display.test.ts
    - components/portia-desktop-media.tsx
    - tests/e2e/specs/media-states.spec.ts
  modified:
    - components/portia-desktop.tsx
    - components/portia-desktop-dossier.tsx
    - components/portia-desktop-documents.tsx
    - app/portia.css
    - lib/portia-desktop.test.ts
key-decisions:
  - "prioritizeImage moved from portia-desktop-dossier.tsx into portia-desktop-media.tsx (private): the dossier imports PortiaImage, so keeping it in the dossier would be a circular import; this also makes 'only PortiaImage calls it' structurally true."
  - "Frame geometry: natural-size contexts (dossier, mutation, information, trash, guide page photo) keep a ratio-locked box while loading/failed and release it once loaded; box-sized contexts (avatar, portrait, guide tile cover, section band) use is-fill (absolute inset 0 in an already-sized parent). Loading -> failed never changes the box; loading -> loaded can, because no image dimensions are stored (backstop for 19-14)."
  - "Empty src in MediaBlock keeps the existing «ОЖИДАЕТ ЗАГРУЗКИ» block (no image was ever uploaded: no <img>, no request); PortiaImage's own empty/disallowed link gives the «Изображение недоступно» placeholder where the UI expects a picture (trash image without file, http/javascript links)."
  - "The 76px portrait shows the placeholder icon only (is-icon-only): 'Изображение недоступно' at 11px/700 does not fit in 70px and broke mid-word in a screenshot. The label stays as visually hidden text and as the title tooltip."
  - "The decorative guide section band is is-quiet: on failure it falls back to a plain panel, no icon or label under the section title."
requirements-completed: []
requirements-advanced: [STAB-MEDIA-02, STAB-MEDIA-03, STAB-MEDIA-05]
---

# Phase 19 Plan 10: PortiaImage, resilient record pictures Summary

Every record picture (employee avatar and portrait, dossier hero and mutations, information photos, trash images, reference-book band, covers and page photos) now goes through one component: the link is checked by `isAllowedMediaUrl` before any request, a quiet skeleton holds the same box, and an error, a block or 15 seconds without a load ends in the PORTIA placeholder «Изображение недоступно» of the same size; the previous record's picture can never be shown as the new one.

## Performance

- **Duration:** not measured (single session)
- **Tasks:** 3 of 3 (Task 1 tracer, Task 2 auto/tdd, Task 3 auto); plus one RED test commit before Task 1
- **Files:** 4 created, 5 modified; logos (system-brand, start-button, boot, assistant) untouched; editor modules untouched

## Accomplishments

- **RED (bf3585f):** `lib/media-display.test.ts`: empty/undefined/whitespace/`javascript:`/`data:`/`//host`/`/\host`/`http:`/control-char links -> placeholder; exact trimmed string for https, local path and a Cyrillic + %-encoded URL; hero vs lazy attrs; 15000.
- **Task 1 tracer (573b97c):** `lib/media-display.ts`, `PortiaImage` with state `loading | loaded | failed`, `key={recordId|link}`, 150ms skeleton by CSS delay (shimmer only `data-motion="full"`), fade-in under `html[data-motion]:not([data-motion="off"])` with `--motion-fast`, 15s `setTimeout` cleared in the effect cleanup, `onError` ignored once loaded, `img.complete` check for pictures that finished before hydration. Employee avatar and portrait ported (hero); `EmployeeImage` and `.personnel-image-*` CSS removed; dossier hero ported in the same commit because `prioritizeImage` relocated. Tracer gate: unit tests, tsc, lint and a real chromium run on the production build.
- **Task 2 (fa53549):** information photo, trash image, guide cover/band/page photo ported, all lazy. `.trash-image-missing` and `.guide-photo-error` replaced by the shared placeholder. Source test: every `<PortiaImage` has `recordId` and a priority, exactly the avatar and portrait are literal heroes (dossier hero asserted separately), no `loading="eager"` anywhere, the only `fetchPriority="high"` left is the boot logo, `prioritizeImage(` exists only in `portia-desktop-media.tsx`.
- **Task 3 (82dc9af):** `media-states.spec.ts`: (1) 404 -> placeholder, window / name visible; (2) never-answering image + `page.clock.runFor` -> still loading at 14s, failed at 15.5s, skeleton gone; (3) portrait and avatar-stage bounding boxes identical loading vs failed; (4) A -> B -> A shows `img[src]` equal to the record's own `photoUrl || robloxAvatarUrl` from the real `/api/employees` answer (or the placeholder when the link is not allowed).

## Verification (this worktree)

- `node --experimental-strip-types --test lib/media-display.test.ts`: 4/4. `lib/accent-theme.test.ts`: pass.
- `npm test`: 983 tests, 978 pass, 2 fail, both the known worktree-only failures (`phase16-guard-boundary`, `editor form cards ... (D-15)`); no new failures. `tsc --noEmit`: only the known `.claude/hooks/guard.mjs` error. `npm run lint`: 0 errors (13 warnings, all pre-existing kinds plus the unavoidable `no-img-element` for the new `<img>`).
- `playwright --list`: 20 tests (4 x 5 projects), acceptance greps satisfied (`export function PortiaImage` 1, `Изображение недоступно` 1 line in the component, `<PortiaImage` in desktop 4 lines, dossier+documents 4).
- Browser lane: `next build --webpack --experimental-build-mode compile` + `next start -p 3100` from this worktree (stopped afterwards; 3000/3001 and `next dev` untouched). `media-states.spec.ts`: **16/16 pass** on chromium-desktop, chromium-dpr125, chromium-phone, firefox-desktop (real roster of 16 employees, so nothing skipped). `tests/e2e/specs` on chromium-desktop: 18 passed, 15 skipped (role lanes), 0 failed.
- **BLOCKED (ENV): webkit-phone.** All 4 tests fail at `desktop.goto()` waiting for the desktop navigation; the existing `visitor.spec.ts` `@smoke` test fails identically on webkit-phone in this environment, so it is not a media regression. Not recorded as a pass. Owner phone/PC verdicts belong to 19-14.
- Not run: `npm run build` (full) fails type-check on the absent `.claude/hooks/guard.mjs` in worktrees (same as 19-09); the compile-mode build passed. `tests/e2e/visual` not run (12 pre-existing failures on the base build, out of scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] prioritizeImage moved into the media module**
- **Found during:** Task 1
- **Issue:** the plan keeps `prioritizeImage` in the dossier while `PortiaImage` (new module) must call it and the dossier must import `PortiaImage`: a circular import.
- **Fix:** defined it privately in `portia-desktop-media.tsx`, removed it and the `react-dom` import from the dossier and the import from `portia-desktop.tsx`. Existing source test updated (it matched `LoadingMedia ... loading="eager"`), plus new tests.
- **Commit:** 573b97c

**2. [Rule 1 - Bug] Portrait placeholder label broke mid-word at 76px**
- **Found during:** Task 3 screenshot review
- **Issue:** the 11px/700 label does not fit the 70px inner width of the portrait thumbnail (rendered «Изображе / ние / недоступ…» clipped).
- **Fix:** `is-icon-only` modifier: label kept as visually hidden text plus `title` tooltip; the full avatar and every larger box show the visible label. Strict reading of the UI-SPEC ("подпись по центру") is not met for this one 76px thumbnail; flag for the owner.
- **Commit:** 82dc9af

**3. [Scope] Dossier hero ported in Task 1, not Task 2**
- The relocation of `prioritizeImage` forced it; Task 2 still ported the remaining sites. No behavior difference.

## Known Stubs

None. `caption` on `PortiaImage` is implemented and tested through the source test but no call site passes it (existing figcaptions stay where they were so layouts do not change); it is an unused optional prop, not a stub on a goal path.

## Threat Flags

None. T-19-22 (javascript:/data: src): mitigated, `mediaSource` runs `isAllowedMediaUrl` before an `<img>` exists, unit-tested. T-19-23 (Referer): mitigated, `referrerPolicy="no-referrer"` set once in `PortiaImage` (asserted by source test). T-19-SC: no packages installed.

## Notes for 19-14 / owner

- Loaded images change the frame from the ratio-locked box to their natural size (no stored dimensions), so a loading -> loaded shift remains for the dossier, mutation, information, trash and guide photos; CLS = 0 is proven only for loading -> failed (spec test 3). Slow-network CLS / request-burst trace stays backstop (Phase 20 / STAB-MEDIA-06).
- The dossier hero with an http/other-scheme link now shows «Изображение недоступно»; an empty link still shows the old «ОЖИДАЕТ ЗАГРУЗКИ» block.
- The spec needs a target that serves at least one employee (otherwise it skips with `BLOCKED (DATA)` and a reason; 19-14 must not count a skip as a pass).

## Self-Check: PASSED

- Files exist: `lib/media-display.ts`, `lib/media-display.test.ts`, `components/portia-desktop-media.tsx`, `tests/e2e/specs/media-states.spec.ts`.
- Commits exist on `gsd/19-10-media`: bf3585f, 573b97c, fa53549, 82dc9af.
