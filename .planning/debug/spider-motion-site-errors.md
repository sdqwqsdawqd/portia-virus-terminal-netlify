---
status: resolved
trigger: "Wallpaper spider moves the wrong legs; shortcut animations stop abruptly; Vivian is dull; Next reports an inline script rendering error; audit site and security."
created: 2026-10-29
updated: 2026-10-29
---

# Symptoms

- Expected: the anatomical front legs beside the fangs lead the spider's walking and perform its occasional hunting signal.
- Actual: rear legs dominate while the front legs appear still.
- Expected: shortcut animations finish cleanly and settle into the unchanged resting SVG.
- Actual: the transition appears cut off before the motion completes.
- Expected: Vivian matches the brightness and saturation of the selected interface accent.
- Actual: Vivian remains dull/grey against a brighter interface.
- Error: React/Next development overlay reports `Encountered a script tag while rendering React component` at `app/layout.tsx`.
- Reproduction: enable full animations, observe the wallpaper spider and hover desktop shortcuts; reload the local Next development site.

## Current Focus

hypothesis: Confirmed.
test: Completed with source tests, production build and browser runtime measurements.
expecting: Resolved.
next_action: Owner visual confirmation on the target display.

## Evidence

- timestamp: 2026-10-29T14:05:00+05:00
  observation: User screenshots show the React script warning, constrained editor columns, a front-facing spider whose rear motion dominates, and a visibly grey assistant.
- timestamp: 2026-10-29T14:38:00+05:00
  observation: The artwork's `L4/R4` paths terminate beside the chelicerae and are the anatomical front pair; equal 7-degree gait amplitudes made the much longer rear paths dominate visually.
- timestamp: 2026-10-29T14:44:00+05:00
  observation: Browser sampling across nine seconds measured front `L4/R4` gait peaks at about 11.6 degrees after the fix, versus about 3.5 degrees for rear `L1/R1`; the intermittent resting probe also targets only `L4/R4`.
- timestamp: 2026-10-29T14:49:00+05:00
  observation: Shortcut motion was owned only by `:hover`/`:focus-visible`, so leaving the hit area cancelled the animation before delayed layers reached their terminal frame. The explicit playback class now remains for 760 ms (present at 350 ms, absent at 820 ms in browser smoke).
- timestamp: 2026-10-29T14:54:00+05:00
  observation: Replacing the raw root script with Next `Script` using `beforeInteractive` removed the development overlay; a fresh browser tab reports no runtime error.
- timestamp: 2026-10-29T15:02:00+05:00
  observation: Production dependency audit reports zero vulnerabilities. The full development tree reports five fixable transitive toolchain findings; applying them would overlap the user's existing package/lock changes and is intentionally deferred.

## Eliminated

- The spider's rare hunting probe was not targeting a rear pair; it already targeted `L4/R4`. The visible problem was equal walking amplitude across unequal path lengths.
- The shortcut artwork itself does not swap raster/vector assets. The quality snap came from premature CSS animation cancellation.
- The extension-injected `cz-shortcut-listen` body attribute is not this warning; `suppressHydrationWarning` already covers it.

## Resolution

root_cause: Equal per-leg gait amplitudes let long rear paths dominate; shortcut lifetime depended on hover; Vivian was brightness-adjusted inside an already colour-filtered image; the root layout emitted a raw script element; the editor list allowed horizontal overflow.
fix: Applied pair-specific gait amplitudes with the front pair strongest, retained the intermittent front-only probe, added a deterministic shortcut playback state, consolidated and brightened Vivian's filter, migrated the boot code to Next Script, and bounded the editor list horizontally.
verification: 577 tests passed with one opt-in live test skipped; TypeScript, production build and lint (0 errors) passed. Browser smoke confirmed clean console, front-pair amplitude, 760 ms shortcut lifetime and brighter accent-matched Vivian. Production `npm audit` reports 0 vulnerabilities.
files_changed: app/layout.tsx, app/portia.css, components/portia-desktop.tsx, components/portia-wallpaper-spider.tsx, eslint.config.mjs, next.config.ts, lib/layout-hydration.test.ts, lib/portia-desktop.test.ts, lib/wallpaper-web.test.ts
