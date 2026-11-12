---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 06
subsystem: template-builder
tags: [image-framing, local-export, react]
requires:
  - phase: PORTIA-20
    provides: local dossier, image framing dialog, shared card exporter
provides:
  - independent normalized frame for each local photo
  - shared crop styling in visible card and HTML/PNG source
affects: [PORTIA-23-07]
actuals:
  tokens: 1400
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns: [frame kept on local image, single shared card for preview and export]
key-files:
  created: []
  modified: [lib/portia-template-dossier.ts, lib/portia-template-dossier.test.ts, lib/portia-template-export.ts, components/portia-template-builder.tsx, app/portia.css]
key-decisions:
  - "Template photo slots use a 4:3 frame in both editor dialog and exported card."
  - "Replacing a local image clears only that image's frame."
requirements-completed: [PROM-05]
duration: 35min
completed: 2026-11-13
status: complete
---

# Phase 23 Plan 06 Summary

The local template builder now opens the existing framing dialog for main and mutation photos. Applied x/y/zoom stays with the corresponding image, changes the dossier snapshot key, and is rendered by the single card path used for preview and export.

## Verification

- PASS: `node --experimental-strip-types --test lib/portia-template-dossier.test.ts lib/portia-template-export.test.ts lib/portia-template-builder.test.ts lib/image-framing-crop.test.ts` (74 tests).
- PASS: TypeScript, scoped ESLint and Next.js build.
- BLOCKED: Pixel comparison of preview and downloaded HTML/PNG at several zooms needs a browser lane; physical-device checks belong to Phase 27.

## Commit

- `6f496b1` — local frames and shared crop rendering.
