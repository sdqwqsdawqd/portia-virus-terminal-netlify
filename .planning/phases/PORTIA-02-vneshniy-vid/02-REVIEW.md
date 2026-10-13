---
phase: PORTIA-02-vneshniy-vid
reviewed: 2026-10-13T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - app/layout.tsx
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-icons.tsx
  - components/portia-wallpaper.tsx
  - lib/accent-boot.ts
  - lib/accent-theme.test.ts
findings:
  critical: 1
  warning: 4
  info: 6
  total: 11
status: issues_found
---

# Phase PORTIA-02: Code Review Report

**Reviewed:** 2026-10-13
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the diff `2d2a662..HEAD` for the seven files, reading the surrounding code in `portia-desktop.tsx` and `portia.css` where needed. No CLAUDE.md or project skills exist in the repo.

The inline head script in `lib/accent-boot.ts` is safe. Its only interpolation is `JSON.stringify` of a compile-time constant array, it creates no globals, and its storage and `matchMedia` access is wrapped in `try/catch`. Exit timers, the bounce timers and the restore-before-save flags (`desktopSettingsLoaded`, `taskbarOrderLoaded`) are handled correctly in the main paths. The `ASSISTANT_RECOVER_MS` and `WINDOW_*_MS` constants match their CSS durations.

The main defects:
- The taskbar drag state machine can be left armed after an ordinary mouse gesture and then hijack hover (CR-01).
- Window focus does not take exiting windows into account (WR-01).
- Stored settings are trusted by the component but whitelisted by the boot script (WR-02).
- The «Animations» switch has no safe default when `data-motion` is absent (WR-03).

## Critical Issues

### CR-01: Taskbar drag stays armed after a press that leaves the button, then hijacks hover and leaves a button stuck

**File:** `components/portia-desktop.tsx:612-646` (`beginTaskbarDrag`, `moveTaskbarDrag`, `endTaskbarDrag`)
**Issue:** `beginTaskbarDrag` stores `taskbarDrag.current` on pointerdown, but pointer capture is only taken in `moveTaskbarDrag` once the pointer has moved 5px horizontally. Mouse pointers have no implicit capture.

Repro:
1. Press a taskbar button.
2. Move the mouse out of the button before it has moved 5px horizontally. Moving up or down is enough, and a fast flick also does it.
3. Release outside the button.

No `pointerup` or `pointercancel` reaches the button, so `taskbarDrag.current` stays set with `moved:false`. A mouse always has `pointerId === 1`.

Consequences:
- The next time the mouse moves over any taskbar button, `moveTaskbarDrag` finds the stale record and the id check passes. If the cursor is more than 5px from `startX`, it sets `moved = true`, calls `setPointerCapture` and adds `is-reordering`.
- That button now follows the cursor on plain hover, with no button pressed.
- If it is a different button, `event.currentTarget` is that other button, so the translate and class go on the wrong element.
- The next pointerdown overwrites `taskbarDrag.current`. Its `pointerup` sees `moved:false` and returns early, so `translate` and `is-reordering` are never cleaned up. The button stays displaced until reload.

**Fix:** Capture at pointerdown, and ignore moves when the primary button is not held.
```tsx
const beginTaskbarDrag = (app: AppId) => (event: React.PointerEvent<HTMLButtonElement>) => {
  if (event.pointerType === "touch" || event.button !== 0) return;
  event.currentTarget.setPointerCapture(event.pointerId); // pointerup/cancel now always reach this button
  taskbarDrag.current = { app, pointerId: event.pointerId, startX: event.clientX, moved: false };
};
const moveTaskbarDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
  const drag = taskbarDrag.current;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (!(event.buttons & 1)) { taskbarDrag.current = null; return; } // stale record
  /* ...unchanged... but drop the setPointerCapture call */
};
```
Also clear `button.style.translate` and the class on every `endTaskbarDrag` path, not only when `moved` is true.

## Warnings

### WR-01: `focusApp` ignores exiting windows, so a click or pointerdown during an exit is lost and `activeApp` can end up on a closed window

**File:** `components/portia-desktop.tsx:609-616` (`focusApp`), `:1143-1147` (taskbar onClick), `:714-731` (`requestExit`), `:1449` (`onPointerDown`)
**Issue:** `requestExit` immediately moves `activeApp` to a fallback and starts a 180ms or 320ms timer. `focusApp` neither checks `exiting` nor cancels the timer.
- A pointerdown on the still-visible closing window (the section's `onPointerDown`) sets `activeApp` back to it. When `finishExit(close)` runs, `activeApp` points at a closed window and no open window gets `is-active`.
- Taskbar click during a minimize: `windows[app].minimized` is still false and `activeApp !== app`, so the click goes to `focusApp`. The window keeps minimizing and the click does nothing. A quick double-click on the title bar's minimize button has the same effect.
- `requestExit` returns early while `exiting` is set, so clicking × within 320ms of a minimize is silently dropped.

**Fix:**
- In `focusApp`, return early if `windows[appId].exiting`.
- In the taskbar onClick, treat `windows[app].exiting` as "restore": call `openApp(app, ...)`, which already cancels the exit timer and clears `exiting`.
- Let a `close` request override a pending `minimize`: clear the existing timer, then restart with the new kind.

### WR-02: Stored desktop settings are trusted by the component but whitelisted by the boot script

**File:** `components/portia-desktop.tsx:435-443` and `:563-570`
**Issue:** The settings restore does `JSON.parse(...)` and `{ ...current, ...parsed }` with no validation. The boot script only applies `accent` if it is in `accentIds`, but the effect then writes whatever string is stored into `dataset.accent`, `dataset.wallpaper` and `dataset.iconSize`, and writes it back to localStorage. Consequences:
- A hand-edited or stale value such as `"accent":"purple"` is ignored by the boot script, then applied by React, so it matches no theme block.
- The Settings UI shows no selected option.
- A non-object payload is spread by index: `"abc"` adds keys `0,1,2` to the settings object, which is then persisted.
- `DesktopWallpaper` silently falls through to the web wallpaper for any unknown `kind`.
- No XSS is possible (these are `dataset` values), but the two code paths disagree.

**Fix:** Validate on restore against the same lists the Settings UI renders. For `accent` and `motion`, reuse `accentIds` and `motionModes`, which are currently imported only by the test.
```tsx
const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T) => allowed.includes(value as T) ? (value as T) : fallback;
const raw = typeof parsed === "object" && parsed ? parsed : {};
setDesktopSettings({
  accent: pick(accentIds, raw.accent, "teal"),
  motion: pick(motionModes, raw.motion, "system"),
  wallpaper: pick(wallpaperIds, raw.wallpaper, "radar"),
  iconSize: pick(iconSizeIds, raw.iconSize, "standard"),
});
```

### WR-03: The motion switch has no safe default: with `data-motion` absent, un-gated animations run for reduced-motion users

**File:** `app/portia.css:1091, 1109-1110, 1170, 1201` (plus the base rules `.wallpaper-helix`, `.wallpaper-web path`, `.app-window`, `.content-fade`, `.boot-thread`, `.boot-core > .portia-mark`)
**Issue:** The bare `@media (prefers-reduced-motion)` rule was removed on purpose, and `html[data-motion]` is now the only switch. The base rules are not gated on it:
- `.app-window { animation: window-open }`
- `.wallpaper-helix` (an infinite animation)
- `.wallpaper-web path`
- `.content-fade`
- `.boot-thread` and the spider

If the head script never runs (a future CSP without a nonce or hash, which the comment in `accent-boot.ts` anticipates; script blocked by an extension; script error), `data-motion` is never set. Reduced-motion users then get the infinite helix drift and the window entrance animations, and nothing reduces them.

Related: when `data-motion` is absent, `.is-closing` and `.is-minimizing` match no animation rule. The window then stays fully visible for 180ms or 320ms and disappears, because the timer still runs.

**Fix:** Gate the base animations on `html[data-motion="full"]`, so that "unknown" behaves as reduced. Alternatively keep a `@media (prefers-reduced-motion: reduce) { html:not([data-motion]) ... }` fallback. The test at `lib/accent-theme.test.ts:232` forbids any bare media query, so it would need to allow the `:not([data-motion])` form.

### WR-04: `suppressTaskbarClick` is only cleared by the next click, so a missing post-drag click swallows the next real one

**File:** `components/portia-desktop.tsx:642` and `:1143-1144`
**Issue:** `endTaskbarDrag` sets `suppressTaskbarClick.current = true` on pointerup after a real drag. The only code that resets it is the next `onClick`. Browsers differ on whether and where a click is dispatched after pointer capture plus a DOM reorder. React reorders the taskbar DOM synchronously in the same pointerup, and a captured element that is moved releases capture. If no click reaches that button, the flag stays true. The user's next legitimate click on any taskbar button is then ignored, and that click does nothing instead of minimizing, restoring or focusing.

**Fix:** Clear the flag on a timer, so it only covers the click that belongs to this gesture.
```tsx
suppressTaskbarClick.current = event.type === "pointerup";
window.setTimeout(() => { suppressTaskbarClick.current = false; }, 0);
```
Alternatively, clear it in `beginTaskbarDrag`.

## Info

### IN-01: Dead fields and unused CSS class

**File:** `components/portia-desktop.tsx:81` (`grabX`), `:1429` (`box.width`), `app/portia.css` (`.is-loading`)
**Issue:**
- `grabX` in the `taskbarDrag` ref is initialised to 0 and never read.
- `box.width` in the `AppWindow` layout effect is computed and never used.
- `LoadingMedia` adds `is-loading` to `subject-media`, but no CSS rule matches `.is-loading`.

**Fix:** Remove the three, or add the intended `.subject-media.is-loading img { opacity: 0 }` style.

### IN-02: Stale CSS keyframe name in a comment

**File:** `components/portia-desktop.tsx:874`
**Issue:** The comment says "must match assistant-recover in portia.css", but the keyframes are named `vivian-recover`. The constant `ASSISTANT_RECOVER_MS = 780` does match `vivian-recover 780ms`.
**Fix:** Update the comment, or better, add a test asserting the paired constants match the CSS durations. `WINDOW_CLOSE_MS`, `WINDOW_MINIMIZE_MS` and `WINDOW_FADE_OUT_MS` have the same drift risk and are only protected by comments.

### IN-03: Settings option lists are duplicated and kept in sync by a regex over the component source

**File:** `lib/accent-boot.ts:4-6`, `lib/accent-theme.test.ts:219, 235`
**Issue:** `accentIds` and `motionModes` exist in production code only for the boot script and the test. `DesktopSettings` fields are plain `string`. The Settings JSX re-declares the same lists as literals, and the test parses `portia-desktop.tsx` with `/values=\{(\[\[.*?\]\])\}/` to check they match. That test breaks on any reformatting of those JSX lines, and it does not cover wallpaper or icon size.
**Fix:** Derive the Settings groups and the `DesktopSettings` union types from shared constants, then drop the source-scraping assertions. This also supports the validation in WR-02.

### IN-04: «Синхронизировано» and the green status dot show while the archive is still loading

**File:** `components/portia-desktop.tsx:~1004` (`browser-footer`)
**Issue:** The footer shows `СИНХРОНИЗИРОВАНО` and `РЕВИЗИЯ 00` while the list and dossier are showing loaders. The global search summary likewise shows a count taken from the default content under the loader.
**Fix:** Show «СИНХРОНИЗАЦИЯ…» and hide the count until `contentReady`.

### IN-05: Taskbar reorder has no keyboard or touch alternative

**File:** `components/portia-desktop.tsx:612-646`
**Issue:** Reordering is pointer-only (touch is explicitly excluded). It is an enhancement, not a requirement, but taskbar buttons gain a hidden interaction with no accessible equivalent. In addition, each `LoadingState` is its own `role="status" aria-live="polite"` region, so opening a window with two loaders (archive list plus dossier) announces both.
**Fix:** Optional: add Alt+Arrow keys on the focused taskbar button. Keep a single live region per window.

### IN-06: Reduced-motion boot override bypasses the "wait for the spider PNG to decode" gate, and `transformOrigin` can go stale on restore without an origin

**File:** `app/portia.css:1311` and `components/portia-desktop.tsx:1431-1434`

Boot gate:
- The base rule keeps the spider and thread paused until `.boot-core.is-ready`.
- The reduced-motion rule `animation: fade-in 200ms ... !important` is a shorthand, so it resets `animation-play-state` to `running`.
- In reduce mode the fade therefore starts before the image is ready, and the spider can fade in empty and then pop.
- Fix: add `animation-play-state: paused !important` to the base `.boot-core:not(.is-ready)` selector, or write the fade as longhands.

Stale origin:
- The `AppWindow` layout effect returns early without resetting `element.style.transformOrigin` when `target` is undefined.
- A window minimized toward its taskbar button and restored via the Start menu or `focusApp` (no origin) keeps the previous taskbar-button origin. `window-open` then scales from an odd point.
- Fix: set `element.style.transformOrigin = ""` in that branch.

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
