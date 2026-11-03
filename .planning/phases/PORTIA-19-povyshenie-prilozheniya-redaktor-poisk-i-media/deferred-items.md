# Deferred items found during 19-15

| Item | Evidence | Scope |
|---|---|---|
| Full `npm.cmd run lint` fails in existing skill scripts | 34 errors, 30 warnings, including `@typescript-eslint/no-require-imports` under `.agents/skills/` and `.claude/skills/`; lint of all 19-15 changed files exits 0 with one existing `<img>` warning. | Outside 19-15 source changes; owner skill scripts were not edited. |
| Extra browser projects from the initial `npm run test:e2e -- ...` invocation | On this shell npm did not forward `--project`/`--grep`; Playwright ran all five projects: chromium-desktop, chromium-phone, chromium-dpr125 passed, firefox-desktop reported a third-party diagnostic, webkit-phone timed out at taskbar click. Correct direct Playwright command passed both required Chromium projects twice. | The plan's required projects are Chromium desktop and phone; extra projects need separate investigation. |
