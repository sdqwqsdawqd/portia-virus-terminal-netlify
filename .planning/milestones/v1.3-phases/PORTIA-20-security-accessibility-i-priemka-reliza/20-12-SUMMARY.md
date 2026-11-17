---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 12
subsystem: visual-baselines
tags: [D-68, visual, baselines, playwright, offline-harness, STAB-REL-03]
requires:
  - phase: PORTIA-20
    provides: "20-58 owner verdict `accepted` on 0c2a59d1d1a7 (D-68) and the offline Supabase harness"
provides:
  - "scripts/phase15-visual-manifest.mjs --verify-promotion accepts the Phase 20 baseline register (D-68), without the register nothing changes"
  - "32 phase20-* baselines (PC and phone) on fixed data, 24 replaced Phase 15 baselines, each a register row"
  - "tests/e2e/visual/phase20-baselines.json (portia-phase20-baselines-v1): 56 rows, 24 with supersedes = the approved Phase 15 hash"
affects: [20-13, 20-14, 20-15]
key-files:
  created:
    - tests/e2e/visual/phase20.spec.ts
    - tests/e2e/visual/phase20-baselines.json
  modified:
    - scripts/phase15-visual-manifest.mjs
    - lib/phase15-visual-manifest.test.ts
    - tests/e2e/fixtures/visual-policy.ts
    - tests/e2e/visual/desktop.spec.ts
    - tests/e2e/visual/motion.spec.ts
key-decisions:
  - "A replaced Phase 15 baseline is registered with class accepted-redesign or fixed-data and supersedes = the old approved hash; --verify-promotion checks both"
  - "Replacement of desktop.spec/motion.spec snapshots used a worktree-only patch of visual-policy.ts (soft, rewrite and dump modes through environment variables); the patch is not committed and not needed by the gate"
  - "phone-webkit--webkit-phone stays red (class (г)), motion-vivian-activity and motion-vivian-offended stay red as BLOCKED (CAPTURE): STAB-REL-03 stays open"
status: complete
outcome: complete-with-open-blockers
owner_verdict: accepted
owner_verdict_commit: 0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1
plan_head_before: eeb0a580d8fc792cfe00a3ca338355250caf2cdd
plan_head_after: 4f280685dd3c8428e2aeb3a10b6e25bac865e538
actuals:
  tokens: 27265
  tasks: 3
  commits: 13
---

# Phase 20 Plan 12: Phase 20 visual baselines on the accepted code (D-68) Summary

The Phase 20 baselines exist for 16 of 17 surfaces on PC and phone (32 PNG, reviewer BLOCKED), 24 of 33 Phase 15 baselines were replaced on the accepted code, and `--verify-promotion` accepts every byte through the register. The full visual gate is NOT green: three old snapshots stay red and are recorded as such (one class (г), two BLOCKED (CAPTURE)). STAB-REL-03 is open.

PLAN_BASE: eeb0a580d8fc792cfe00a3ca338355250caf2cdd

Product code on every capture and run equals H6 `0c2a59d1d1a7` (`git diff --name-only 0c2a59d1d1a7 HEAD -- app components public lib` lists only `*.test.*`). Phase 15 evidence unchanged: `git diff --exit-code --stat PLAN_BASE -- .planning/phases/PORTIA-15-baseline` exits 0.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 RED | 8a98127 | RED for the Phase 20 baseline register in --verify-promotion |
| 1 GREEN | ffceb4e | --verify-promotion accepts the register tied to the owner verdict |
| 1 | 2f0ce8a, c714eec | phase20 states and spec; spider-at-rest baselines, register |
| 2 | 402f934 | flasks |
| 2 | f19869c | empty-state drawings (3) |
| 2 | 319a100 | Promotion participant, class icons |
| 2 | cd3fca1 | template builder (4 states) |
| 2 | 4cc1499, 3f68580 | editor and site framing; unused variable removed |
| 3 | 66bdf21 | stabilise the shell scene, park the clock in the motion scene (class (в)) |
| 3 | 77aef4b | replace 23 Phase 15 baselines, register rows |
| 3 | 4f28068 | the Сводка baseline missed by 77aef4b (24 in total) |

13 commits measured by `git rev-list --count PLAN_BASE..HEAD`. Tasks 1 and 2 were done by the previous executor (see the commit subjects and phase20-baselines.json); this run did only Task 3.

## Task 3: classification of the 33 Phase 15 baselines

Method: production build of HEAD in a worktree in %TEMP% (physical node_modules, no env files), `next start` on 127.0.0.1:3100 under the offline harness, Node 22.13.1. First a no-update run on all five projects with a worktree-only patch of `visual-policy.ts` that does not stop at the first failing snapshot (all 15 desktop.spec and the 5 motion snapshots are reached) and dumps actual and diff PNGs; every pair was inspected as old / new / diff; a second identical run measured run-to-run drift per snapshot with the Playwright comparator.

Key findings:

- Class (в) found: all 15 snapshots of desktop.spec drifted 1100-4800 px between two identical runs (spider left where the switch to «Выключены» caught it). Fixed in the scene: motion is seeded off before the load (the scene still chooses «Выключены» through the settings window, the spider stays in the frame). Afterwards 0 px between runs on all five projects. Commit 66bdf21.
- Motion scene: parkClock + `test.slow()` reduced drift (web-rest 1131 -> 606 px) but vivian-activity (2763 px between runs) and vivian-offended (1850) still vary above or near the 2300 ceiling between identical runs, and the gate flips between them (offended failed in some runs, activity in others). Not stabilised without changing the animation policy of Phase 15, which is outside this plan: BLOCKED (CAPTURE), baseline unchanged.
- The old frames differ from the accepted code by: empty-state drawings and shortened captions (D-21, D-56), the new spider and its place of rest (D-45, D-50, D-53), the redesigned «Повышение» (D-18, D-20), window geometry on the accepted code, and, for three application frames, the starting content instead of live Phase 15 data (fixed-data).

Counts: 33 = 6 PASS unchanged + 24 replaced + 1 class (г) + 2 BLOCKED (CAPTURE). Replaced: 21 accepted-redesign, 3 fixed-data. (а)+(б) rows with `supersedes`: 24 = `grep -c '"supersedes": "[0-9a-f]\{64\}"'` on the register.

| Snapshot | Result | Class | SHA256 before | SHA256 after |
|---|---|---|---|---|
| application-broadcasts--chromium-desktop | FAIL, replaced | accepted-redesign (D-21, D-56, D-50, D-53) | b314d6be9b | 7381890291 |
| application-charter--chromium-desktop | PASS (masked frame) | - | fcde3e3dc4 | unchanged |
| application-employees--chromium-desktop | PASS (masked data) | - | 7616d567b5 | unchanged |
| application-guide--chromium-desktop | FAIL, replaced | accepted-redesign (D-21 microscope, D-56) | bbe2e065e6 | a31261181b |
| application-information--chromium-desktop | FAIL, replaced | fixed-data (starting content; also D-56) | 2c95613f64 | e0d7021601 |
| application-search--chromium-desktop | FAIL, replaced | accepted-redesign (D-56, window size) | 7fdcaf5d14 | 8d46c6d349 |
| application-settings--chromium-desktop | FAIL, replaced | accepted-redesign (D-56, window size) | 005bc62cbc | 56e5b02d31 |
| application-table--chromium-desktop | PASS (masked frame) | - | dd5989e4c8 | unchanged |
| application-trash--chromium-desktop | FAIL, replaced | fixed-data (starting content; also D-56) | 1465c070f6 | f022c02111 |
| application-virus-archive--chromium-desktop | FAIL, replaced | fixed-data (МОРОК, АРХАИЯ, КАЛЛИСТО instead of «НОВЫЙ ВИРУС»; also D-56) | 83582e367f | 9a24671b77 |
| desktop-clean--chromium-desktop | FAIL, replaced | accepted-redesign + scene fix (в) | 3b10ee74ca | f8c78ec2d5 |
| desktop-clean--chromium-dpr125 | FAIL, replaced | accepted-redesign + scene fix (в) | 392929a3b6 | 45d9baf717 |
| desktop-clean--chromium-phone | FAIL, replaced | accepted-redesign + scene fix (в) | ad42834974 | bc75eb8ce7 |
| desktop-clean--firefox-desktop | FAIL, replaced | accepted-redesign + scene fix (в) | 27122e4471 | 2aaa3ed1c5 |
| desktop-dpr125--chromium-dpr125 | FAIL, replaced | accepted-redesign + scene fix (в) | d38c7043ec | 45d9baf717 |
| desktop-start-open--chromium-desktop | FAIL, replaced | accepted-redesign + scene fix (в) | c0b524e77b | dd08d85d07 |
| desktop-start-open--chromium-dpr125 | FAIL, replaced | accepted-redesign + scene fix (в) | 0e1cae7fbc | 22642b1dd9 |
| desktop-start-open--chromium-phone | FAIL, replaced | accepted-redesign + scene fix (в) | 2f01992b92 | e4807a79d0 |
| desktop-start-open--firefox-desktop | FAIL, replaced | accepted-redesign + scene fix (в) | 8670df147c | 15242cea3e |
| desktop-start-open--webkit-phone | FAIL, replaced | accepted-redesign + scene fix (в) | c48f035e6a | 32c0fc939e |
| editor-signed-out-login--chromium-desktop | FAIL, replaced | accepted-redesign (D-56: shorter hint) | bc02c956de | b3a9423b8c |
| editor-visitor-denied--chromium-desktop | FAIL, replaced | accepted-redesign (D-56, D-50, D-53) | 3f118d1816 | 5fb49c0d98 |
| motion-vivian-activity--chromium-desktop | FAIL (flaky) | (в) BLOCKED (CAPTURE), baseline kept | bcc8f283cd | unchanged |
| motion-vivian-idle--chromium-desktop | PASS (within tolerance, both runs) | - | 954878cd14 | unchanged |
| motion-vivian-offended--chromium-desktop | FAIL (flaky) | (в) BLOCKED (CAPTURE), baseline kept | f042c262e5 | unchanged |
| motion-vivian-recovery--chromium-desktop | PASS (within tolerance, both runs) | - | fc39b8c67f | unchanged |
| motion-web-rest--chromium-desktop | PASS (within tolerance, both runs) | - | 5a2a82e8ea | unchanged |
| phone-chromium--chromium-phone | FAIL, replaced | accepted-redesign + scene fix (в) | 2e4945364d | bc75eb8ce7 |
| phone-webkit--webkit-phone | FAIL, 58293 px | (г) not explained, baseline kept, gate red | ccf89983a4 | unchanged |
| promotion-participant-lookup--chromium-desktop | FAIL, replaced | accepted-redesign (D-18, D-20, D-56) | bfe7bba30d | d8bb1689e8 |
| window-search-maximized--firefox-desktop | FAIL, replaced | accepted-redesign (D-56, window) | 1c1c8c700b | dd55ce3570 |
| window-search-minimized--firefox-desktop | FAIL, replaced | accepted-redesign (D-56, window) | d5513ffd65 | 6518c67ceb |
| window-search-restored--firefox-desktop | FAIL, replaced | accepted-redesign (D-56, window) | 3242f0969b | beb1a18462 |

Full hashes: old = the approved Phase 15 hash (`supersedes` in the register), new = `sha256` in `tests/e2e/visual/phase20-baselines.json`. desktop-clean and desktop-dpr125 on dpr125, and desktop-clean and phone-chromium on the phone, are the same scene and so identical bytes.

Notes on the classification:

- Several replaced rows have more than one cause (titles D-56, spider D-50/D-53, starting content). The register `class` holds the dominant one, `reason` lists all. Three frames whose visible content differs (virus archive, information, trash) are `fixed-data`; the owner agreed to the starting content in 20-58.
- Small web and spider differences on the phone and webkit start-open frames (411-1659 px, mostly around the «База вирусов» icon and the web beads) were not isolated further; they are put under the spider/web redesign of the accepted code. This is a judgement from the old/new/diff images, not a measurement of each pixel; if the owner disagrees, the replacement is one commit.
- (г) phone-webkit--webkit-phone: the OLD approved frame has a vertical scrollbar on the right and the icons shifted by it; the new frame has none. The cause of the scrollbar in Phase 15 is not isolated (B4), so by the plan's rule the baseline is not replaced and the gate stays red.
- BLOCKED (CAPTURE) motion-vivian-activity and motion-vivian-offended: no stable frame without changing the `animations: "allow"` policy of the motion states (Phase 15 authority). Not changed here.

## Final runs (worktree on 4f28068, offline harness, `--retries=0 --update-snapshots=none`)

| Run | Result |
|---|---|
| chromium-desktop, chromium-dpr125, chromium-phone, webkit-phone, `--grep-invert @phase20`, run 1 | 18 expected, 2 unexpected: webkit-phone `phone-webkit` (58293 px, class (г)), chromium-desktop motion (vivian-offended 2897 px) |
| same, run 2 | 18 expected, 2 unexpected: the same webkit-phone `phone-webkit`, motion (vivian-activity 3603 px) |
| firefox-desktop, `--grep-invert @phase20` | 3 clean runs of 8 (1 test, all 5 snapshots pass); the other runs fail every test on `browserContext.close ... _maybeDontRestoreTabs ... undefined` at teardown, a Firefox/Playwright teardown fault in this environment, not a pixel difference. Recorded as environment flake, not as PASS or FAIL of a snapshot |
| `phase20.spec.ts`, chromium-desktop + chromium-phone, run 1 | 32 passed, 2 skipped (reviewer, BLOCKED ENV) |
| same, run 2 | 32 passed, 2 skipped |

Main tree (Node 22.13.1): `node --experimental-strip-types --test lib/*.test.ts` 1589 tests, 1586 pass, 0 fail, 3 skipped; `tsc --noEmit` exit 0; eslint 0 errors, 17 warnings (as before); `--verify-promotion`: "Verified 65 exact owner-approved snapshot bytes; 18 non-approved rows excluded."

## Data mode (repeated by 20-13)

Offline stub `tests/e2e/harness/offline-supabase.cjs` (empty `portia_content` -> starting content of the site), invented public values, production build of a worktree, `next start` on 127.0.0.1:3100, Node 22.13.1; scenes with substituted reads of the candidate specs are UI contracts, not proof of roles, saving or live data. No Supabase, no production, no env files read. The server was stopped by verified PID (24168) and the worktree removed.

## BLOCKED and open

- Reviewer Promotion pair (PC and phone): BLOCKED (ENV), no attested isolated staging of the reviewer (19-VERIFICATION); no baseline, not in the register.
- `phone-webkit--webkit-phone`: (г), red, cause of the Phase 15 scrollbar not isolated.
- `motion-vivian-activity`, `motion-vivian-offended`: BLOCKED (CAPTURE), red or flaky in the gate.
- Firefox teardown flake (environment).
- STAB-REL-03 stays open; `requirements.mark-complete` not run, as the plan says.

## Deviations from Plan

**1. [Rule 3 - Blocking] Replacement of snapshots in desktop.spec and motion.spec**
- **Issue:** `compareApprovedScreenshot` ignores `--update-snapshots`, so `changed` could not replace `desktop-*` snapshots, and the first failing snapshot stopped each test.
- **Fix:** a worktree-only patch of `visual-policy.ts` (dump, soft and rewrite modes by environment variables) used for classification and replacement, reverted with `git checkout -- <file>` before the final runs. Not committed. The committed gate code is unchanged.

**2. [Rule 1 - Bug, class (в)] Shell and motion scenes were not reproducible**
- **Found during:** classification run 2 (1100-4800 px between identical runs).
- **Fix:** commit 66bdf21 (desktop.spec: motion off before load; motion.spec: parkClock + test.slow). Shell: fully fixed. Motion: only reduced, two frames stay BLOCKED (CAPTURE).

**3. [Process] A register row was missed by the first replacement commit** (the first line of `git status` lost its leading space after `trim()`), found by counting 23 instead of 24, fixed in 4f28068.

## Known Stubs

None in this plan's files.

## Threat Flags

None.

## Self-Check: PASSED

- `phase20-baselines.json`: 56 rows (32 phase20, 24 with `supersedes`); every PNG in `tests/e2e/visual/__screenshots__` (65) is covered by Phase 15 or the register: `--verify-promotion` exit 0.
- Commits 66bdf21, 77aef4b, 4f28068 are ancestors of HEAD.
- `git status --porcelain -- tests/e2e/visual/__screenshots__` is empty; port 3100 not listening; worktree `portia-20-12-verify` removed.
