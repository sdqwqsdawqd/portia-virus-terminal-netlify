---
phase: PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische
plan: 09
subsystem: build-scan
tags: [sec-03, build-scan, postbuild, content-markers, tracer]
status: complete

requires:
  - phase: PORTIA-25 plan 05
    provides: the former seed moved to lib/testing/portia-content-fixture.ts (the marker source)
  - phase: PORTIA-25 plan 06
    provides: production source with no seed and no import of the fixture
provides:
  - "scripts/phase25-build-scan.mjs: CONTENT_MARKERS (16), SKIP_DIRS, markerForms, walk, scanTree, scanTreeDetailed; CLI exit 0 clean / 1 finding / 2 no .next; prints paths and markers only"
  - "package.json: postbuild runs the scan after next build"
  - "lib/phase25-build-scan.test.ts: 15 cases (temp dirs, skips, encodings, line-break boundary, CLI codes, canary, marker drift against the fixture and against app/components/lib)"
affects: [25-10 (the matrix and dependency-audit evidence are pinned to package.json, see Deviations)]

actuals:
  tokens: 3300
  tasks: 2
  commits: 1
plan_head_before: 648319fc854b2aea2ebe1138c60a1bcf0df7c9b2
plan_head_after: 8f0d810f66d21f3793091bb7660980496741ccba
commits: 1

tech-stack:
  added: []
  patterns:
    - "Plain ESM .mjs scan with node:fs/node:path only (Netlify Node 22.13.0 runs it with no strip-types flag)"
    - "Marker list kept in step with the fixture by a test; each marker checked as a UTF-8 literal and as a \\uXXXX escape (lower and upper hex)"

key-files:
  created:
    - scripts/phase25-build-scan.mjs
    - lib/phase25-build-scan.test.ts
  modified:
    - package.json

key-decisions:
  - "All 16 proposed markers passed the drift check (present in the fixture, absent from working code), so none was removed and none was added."
  - "The scan skips only top-level .next/cache, dev, diagnostics and files whose name starts with trace; static/, server/, .map and manifests are scanned. A missing .next exits 2, never clean."
  - "The Task 2 cases (drift, no-print canary, line-break boundary, interface-text exclusions) were written in the same RED-first test file as Task 1, so Task 2 produced no separate change and no separate commit."
  - "interface-text exclusion is checked against the real classificationOptions and assistantDefaults exported by lib/portia-content.ts (assumption A1), not against fixture keys that do not exist."

requirements-completed: []  # SEC-03 is not checked off: the postbuild hook on Netlify is BLOCKED until a deploy preview (A4), and the review/matrix part is plan 25-10

duration: about 25 min
completed: 2026-11-16

coverage:
  - id: D1
    description: "A build that carries starting content fails: the scan finds markers in .next/static, .next/server chunks and .map and exits 1; a clean build exits 0"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "lib/phase25-build-scan.test.ts (scanTree on temp dirs, CLI exit codes)"
        status: pass
      - kind: integration
        ref: "node scripts/phase25-build-scan.mjs on the pre-phase .next (exit 1, 80 findings) then on a fresh next build (exit 0, 0 markers in 457 files)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Marker list cannot drift: every marker is in the fixture, none in working code, none is interface text"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "lib/phase25-build-scan.test.ts (CONTENT_MARKERS drift cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Logs carry paths and markers only, never file content"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "lib/phase25-build-scan.test.ts (canary CANARY_DO_NOT_PRINT_7f3a is not printed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm lifecycle build -> postbuild fires in the Netlify build"
    requirement: SEC-03
    verification:
      - kind: manual
        ref: "deploy preview of the Netlify build"
        status: blocked
    human_judgment: true
    rationale: "BLOCKED (A4): the hook is declared in package.json and netlify.toml runs npm run build, but a Netlify deploy preview is the only proof. Not run, not recorded as a pass."
---

# Phase 25 Plan 09: Build scan for starting content Summary

Post-build scan of `.next` for 16 starting-content markers (UTF-8 literal and `\uXXXX` forms), wired as the npm `postbuild` hook; it printed 80 findings on the pre-phase build (exit 1) and 0 markers in 457 files on a fresh build (exit 0).

## What was built

- `scripts/phase25-build-scan.mjs`: `CONTENT_MARKERS`, `SKIP_DIRS = {cache, dev, diagnostics}`, `markerForms`, `walk`, `scanTree` (plus `scanTreeDetailed` for the file count). CLI default target is `.next` at the repo root; one argument overrides it. Exit 0 clean (`build scan: 0 markers in N files`), 1 finding (`build scan: content marker found`, then `path: marker` lines on stderr), 2 directory missing.
- `package.json`: `"postbuild": "node scripts/phase25-build-scan.mjs"`. `npm run build`, `npm run check`, the Playwright `webServer` command and the Netlify command (`npm run build`) all reach it through the npm lifecycle.
- `lib/phase25-build-scan.test.ts`: 15 cases. Written first (RED: module not found), then the script (GREEN, 15/15).

## Tracer evidence (SEC-03, success 2)

| Step | Command | Result |
|---|---|---|
| (a) old build | `node scripts/phase25-build-scan.mjs` on the `.next` built before this phase | exit 1; 80 `path: marker` lines: 16 in `static/chunks`, 64 in `server/chunks` and `server/chunks/ssr` (32 of them `.map`). The scan sees the seed. |
| (b) fresh build | `node node_modules/next/dist/bin/next build` (see below) | exit 0, build green |
| (c) scan | `node scripts/phase25-build-scan.mjs` | exit 0, `build scan: 0 markers in 457 files` |
| `git status --porcelain -- .next` | | empty (build output is ignored, not staged) |

`npm run build` itself could not be run: npm in the temporary Node 22.13.1 fails with `Cannot find module 'node-gyp/bin/node-gyp.js'` (the known precedent, 24-BROWSER-EVIDENCE.md). The plan's fallback was used: `next build` directly, then the explicit scan. That means the npm `postbuild` hook was NOT observed firing locally; only its command was run by hand. Node on PATH was 22.13.1 (the reference). `.env*` were not read; the build needed no invented values.

## Verification

- `node --experimental-strip-types --test lib/phase25-build-scan.test.ts lib/phase25-fixture-boundary.test.ts`: 20 pass, 0 fail, no "is stale".
- Red-window gate (`lib/*.test.ts`, two skip patterns): 2216 pass, 1 fail, 3 skipped. The one failure is not in the plan's expected-red set, see Deviations.
- `tsc --noEmit`: exit 0. ESLint: 0 errors, 17 warnings (all in `tests/e2e/visual-candidates/.runs/`, pre-existing, not touched).

## Deviations from Plan

### Auto-fixed Issues

None.

### Issues found, not fixed

**1. [Rule 4 - out of scope / owner evidence] The dependency-audit evidence test goes red because package.json changed**
- **Found during:** Task 2 verification (red-window gate).
- **Issue:** `lib/security-matrix.test.ts` "the real audit evidence verifies" fails with `stale report: package.json changed after the audit was captured`. `scripts/phase20-audit-check.mjs --verify` compares a whole-file sha256 of `package.json` with `packageJsonSha256` stored in the Phase 20 evidence `.planning/milestones/v1.3-phases/PORTIA-20-.../20-DEPENDENCY-AUDIT.json`. The required `postbuild` line changes that hash. This test is not in the plan's skip list and 25-10 does not mention it.
- **Why not fixed here:** the only repair is `node scripts/phase20-audit-check.mjs --capture`, which runs `npm audit` against the npm registry and rewrites archived signed evidence (and `20-DEPENDENCY-AUDIT.md`). That is a network call and a change to archived owner evidence, so it was left to a decision.
- **Options:** (1) re-capture the audit evidence once (owner or 25-10, with network); (2) have 25-10 add this test to the red-window skip list and re-capture at the end of the phase; (3) change the audit hash to cover only `dependencies`/`devDependencies`. Recommendation: option 1 at the end of the phase, since any later package.json edit invalidates it again.
- **Status:** the test stays red on this branch until one of these is done. The other two red tests (matrix freshness, migration coverage) are the planned red window until 25-10.

### Task 2 had no separate commit

The Task 2 behaviours were covered by the same test file that Task 1 created RED-first; nothing changed afterwards, so there was nothing to commit for Task 2. Its verify commands were run and passed (see Verification).

## Known limits

- A marker broken by a line break is not found. This is a recorded boundary (a minifier does not split literals), pinned by a test.
- A marker the minifier writes in a form other than a UTF-8 literal or `\uXXXX` (for example `\u{...}` or a split string concatenation) is not found (assumption A3).
- `.next/cache`, `dev`, `diagnostics` and `trace*` are not scanned: they are not deployed.

## Known Stubs

None.

## Threat Flags

None. The script only reads files under `.next` and writes to stdout/stderr.

## Blocked / owner steps

- `postbuild` firing in the Netlify build: BLOCKED until a deploy preview (A4). Not a pass.
- No migration applied, no Supabase or Netlify call made, no secret read.

## Commits

- `8f0d810` feat(PORTIA-25-09): post-build scan of .next for starting content markers, postbuild hook

## Self-Check: PASSED

- scripts/phase25-build-scan.mjs, lib/phase25-build-scan.test.ts: present.
- Commit 8f0d810 is an ancestor of HEAD.
- `"postbuild": "node scripts/phase25-build-scan.mjs"` present in package.json (1 match).
