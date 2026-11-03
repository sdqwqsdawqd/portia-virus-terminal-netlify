# Deferred items found during 19-15

| Item | Evidence | Scope |
|---|---|---|
| Full `npm.cmd run lint` fails in existing skill scripts | 34 errors, 30 warnings, including `@typescript-eslint/no-require-imports` under `.agents/skills/` and `.claude/skills/`; lint of all 19-15 changed files exits 0 with one existing `<img>` warning. | Outside 19-15 source changes; owner skill scripts were not edited. |
| Extra browser projects from the initial `npm run test:e2e -- ...` invocation | On this shell npm did not forward `--project`/`--grep`; Playwright ran all five projects: chromium-desktop, chromium-phone, chromium-dpr125 passed, firefox-desktop reported a third-party diagnostic, webkit-phone timed out at taskbar click. Correct direct Playwright command passed both required Chromium projects twice. | The plan's required projects are Chromium desktop and phone; extra projects need separate investigation. |
| 19-16 full `npm.cmd run lint` cannot pass | 32 errors and 30 warnings in pre-existing `.agents/skills/` and `.claude/skills/` scripts and linked worktree; all changed files pass ESLint, and lint of `app components lib scripts` exits 0 with 14 warnings. | Outside 19-16 source changes; no skill scripts were modified. |
| 19-17 full `npm.cmd run lint` cannot pass | 32 errors and 30 warnings in existing `.claude/skills/` and other skill scripts; ESLint of all four 19-17 changed files exits 0. | Outside 19-17 source changes; no skill scripts were modified. |
