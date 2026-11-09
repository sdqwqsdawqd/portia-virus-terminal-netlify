---
phase: 15-baseline
plan: 19
subsystem: security
tags: [csp, netlify, gap-closure, review-disposition]
requires:
  - phase: 15-baseline
    provides: "15-17 and 15-18 closure commits, 15-VERIFICATION W1/W2, 15-REVIEW findings"
provides:
  - "next.config.ts guard: E2E HTTP flag cannot drop upgrade-insecure-requests in any Netlify build (NETLIFY=true or any CONTEXT)"
  - "behavioural CSP unit test over seven environment combinations"
  - "15-REVIEW-DISPOSITION.md with a verifiable disposition for all 12 findings and the W1 exception record"
  - "SEC-L5 row updated"
affects: [Phase 16, Phase 18, Phase 22]
tech-stack:
  added: []
  patterns: ["import the real next.config.ts with a unique query per environment case"]
key-files:
  created: []
  modified:
    - next.config.ts
    - lib/security-headers.test.ts
    - .planning/phases/PORTIA-15-baseline/15-REVIEW-DISPOSITION.md
    - .planning/phases/PORTIA-15-baseline/15-SECURITY.md
key-decisions:
  - "NODE_ENV cannot be the guard: the local Playwright server is itself a production build. Guard is NETLIFY=true or any non-empty CONTEXT."
  - "b535d14 product-source exception recorded as accepted by the owner scope decision 2026-11-01 (repo-fixable gap closure); no separate owner sign-off text exists and none is claimed."
status: complete
commits: 3
plan_head_before: cef242f
plan_head_after: 3339388
actuals:
  tokens: 9000
  tasks: 2
  commits: 3
---

# Phase 15 Plan 19: CSP guard and review disposition (W1, W2, SEC-L5) Summary

`PORTIA_E2E_ALLOW_HTTP=1` now removes `upgrade-insecure-requests` only for a local server with no `NETLIFY` and no `CONTEXT`; this is proven by a test that imports the real `next.config.ts`, and all 12 review findings carry a disposition.

## Changes

- `next.config.ts`: `allowHttpForE2E` gains a third condition `!process.env.CONTEXT`; comment updated. CSP directives and the `nextConfig` block are byte-identical to `769c3d1` (checked by sed range diff).
- `lib/security-headers.test.ts`: removed the source-text pin of the old guard expression; added a behavioural test that sets `NODE_ENV`, `PORTIA_E2E_ALLOW_HTTP`, `NETLIFY`, `CONTEXT` (restored in `finally`), imports `next.config.ts?case=<label>` and reads the `Content-Security-Policy` of the first header rule. Seven cases: production without flag keeps the directive; flag `1` without Netlify variables drops it; flag plus `NETLIFY=true`, `CONTEXT=production`, `CONTEXT=deploy-preview` keep it; flag `true` keeps it; development has no directive and `script-src` has `'unsafe-eval'`.
- RED confirmed before the guard change: the `CONTEXT=production` case failed on the old `next.config.ts` (2 other tests passed); GREEN after (3/3).
- `15-REVIEW-DISPOSITION.md` rewritten in Russian: frontmatter `closure_plans: [15-17, 15-18, 15-19]`, W1 section, 12-row table.
- `15-SECURITY.md`: only the SEC-L5 disposition cell changed; frontmatter, counts and `status: PASS-LOCAL-SCOPE` untouched.

## Commits

- 140a265 fix(15-19): E2E HTTP flag cannot drop upgrade-insecure-requests in Netlify builds (W1)
- 3339388 docs(15-19): disposition of 12 review findings, W1 owner exception, SEC-L5 update
- (this summary) docs(15-19): complete CSP guard and review disposition plan

## Disposition counts (12 findings)

| Disposition | Count | IDs |
|---|---|---|
| fixed | 5 | WR-03, WR-04, WR-05, WR-06, IN-05 |
| partial | 1 | IN-01 (part 1 in 15-18; diff attachment deferred to Phase 18) |
| deferred | 5 | WR-01 (Phase 16), WR-02 (Phase 18/16), IN-02 (Phase 18), IN-03 (Phase 16), IN-04 (Phase 18) |
| open | 1 | IN-06 |

## Full local run (Node v22.13.1 reference, from the temp folder)

- `npm test`: 685 tests, 684 pass, 0 fail, 1 skipped (pre-existing).
- `npm exec tsc -- --noEmit`: clean.
- `npm run lint`: 0 errors, 18 warnings (pre-existing `<img>` warnings).
- `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts`: 37/37 pass.
- `node scripts/phase15-visual-manifest.mjs --verify-promotion`: "Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded."
- Unchanged vs `769c3d1`: `15-REVIEW.md`, `15-VERIFICATION.md`, `evidence/`, `.planning/REQUIREMENTS.md`, approved PNGs, `package.json`, `package-lock.json`, `playwright.config.ts`, `components/`, `app/`.

## Unchanged by this plan

G1-G5 remain open (Phases 16/18/19/22). Phase status `gaps_found`, score 1/4, and STAB-BASE statuses are not changed. No BLOCKED item was recorded as a pass. Owner paths, approved PNGs and signed evidence were not touched or staged; visual-manifest `--verify` was not run.

## Question for the owner (IN-06 part 1)

Which snapshots are authoritative for window-search in firefox-desktop? This cannot be written into the signed `15-FRAME-TEST-MAP.md` without the owner's explicit answer, so IN-06 stays open. Part 2 (operator project lists) is an accepted fail-closed assumption until the Phase 16 Management API check.

## Deviations from Plan

- Commit trailer is `Co-Authored-By: Claude Sonnet 5.5` (harness attribution rule), as in 15-17 and 15-18.
- The W1 owner fixation is worded as acceptance by the owner scope decision of 2026-11-01, not as a quoted explicit owner confirmation; the owner may confirm the wording separately.
- WR-03/WR-06 SHAs in the disposition were checked against `git show --stat` (22f8818 holds the preflight, `.env.example` and first tests; 4e30bd1 the Node pin and key-priority tests; bbf2a55 the README).
- The `\n` line-ending warnings from git (LF to CRLF) are the repository's existing autocrlf behaviour.

## Known Stubs

None.

## Threat Flags

None. T-15-49 mitigated (guard plus behavioural test), T-15-50 accepted (non-Netlify hosting, Phase 22 checklist), T-15-51/52/SC mitigated.

## Self-Check: PASSED

Modified files exist; 140a265 and 3339388 are ancestors of HEAD.
