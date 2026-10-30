# Phase 15 Baseline Results

**Overall status:** AUTOMATED CLEAN-CHECKOUT GATES PASS / PHASE CLOSURE BLOCKED  
**Verified commit:** `8493636b31083dc3a8af5cafb4ab3f35626482dd`  
**Worktree:** disposable detached clean checkout; zero tracked changes at verification  
**Runtime:** Windows 10.0.26100 x64, Node `22.13.1`, npm `10.9.2`, Git `2.55.0.windows.5`

## Target Identity and Safety

| Boundary | Identity / result |
|---|---|
| Browser target | local production build at `http://127.0.0.1:3000` |
| Public read backing | Supabase project ref `wqiyghssdulzsbshjtur`, injected from the operator's local public configuration without copying it into the checkout |
| Promotion device secret | deterministic Phase 15 test-only value injected into the process; not written to disk or Git |
| Mutation target | **BLOCKED / NOT CONFIGURED** |
| Privileged authority | no auth storage, cookies, service key or role session supplied |
| Production mutation | none; fail-closed target guard kept all mutation-capable role lanes blocked |

The first clean run at `8fd346e` correctly failed: it had no runtime public
configuration and the default Playwright discovery incorrectly included the
candidate-generation suite. Commit `8493636` isolated candidate capture from the
regression suite. A fresh clean checkout at that commit then passed the exact
regression command. This failed attempt was not reclassified as a pass.

## Tool and Browser Versions

| Tool | Version |
|---|---|
| Playwright | `1.64.1` |
| Chromium | `156.0.8078.4` |
| Firefox | `157.0` |
| WebKit | `27.2` |
| Next.js | `16.4.2` |
| TypeScript | `5.9.3` |
| Axe Playwright | `4.14.0` |

## Clean-Checkout Gate Results

| Gate | Command | Result |
|---|---|---|
| Install | `npm ci` | **PASS** — 373 packages from lockfile |
| Deterministic unit suite | `npm.cmd test` | **PASS** — 594 passed, 1 explicit skip, 0 failed |
| Typecheck | `npm.cmd exec tsc -- --noEmit` | **PASS** |
| Production build | `npm.cmd run build` | **PASS** — all application and API routes compiled |
| Lint | `npm.cmd run lint` | **PASS WITH ACCEPTED LIMITATION** — 0 errors, 18 pre-existing warnings |
| Approved hash promotion | `node scripts/phase15-visual-manifest.mjs --verify-promotion` | **PASS** — 23 exact approved bytes, 0 non-approved rows |
| Full browser regression | `npm.cmd exec playwright -- test --retries=0` | **PASS** — 66 passed, 79 skipped, 0 unexpected, 0 flaky |
| Approved visual comparisons | included in the full command; pinned to `chromium-desktop` | **PASS** — 14 tests / 23 screenshot assertions |
| Diagnostics | included in Playwright suite | **PASS** — real root clean; all six injected diagnostic classes fail through the redacted path |
| Accessibility | included in Playwright suite | **PASS** — 0 critical/serious Axe findings |
| Secret/artifact scan | tracked Phase 15 outputs and E2E contract | **PASS** — 0 JWT, raw Authorization, raw Cookie, service-key value or tracked auth-state matches |

## Explicit Skip Inventory

The 79 skips are visible in the Playwright JSON report and are not silent:

| Count | Classification | Status |
|---:|---|---|
| 56 | Approved pixels are authoritative only on `chromium-desktop` (14 tests × 4 other projects) | **EXPECTED / OWNER-BOUND** |
| 20 | participant, editor, promo reviewer and owner lanes across five projects lack an approved isolated target | **BLOCKED** |
| 3 | phone-only touch smoke on the three desktop projects | **EXPECTED** |

## Accessibility and Diagnostic Inventory

- Critical Axe findings: **0**.
- Serious Axe findings: **0**.
- Visible moderate inventory: `page-has-heading-one:moderate` and
  `region:moderate`; these are not silently allowlisted as critical/serious.
- The only expected runtime failure is the exact unbound-device Promotion
  `GET /api/promotion/status -> 404` plus its browser console mirror. It is
  project-specific, owned and expires on 2027-01-31.

## Approved Artifacts

- Signer: `Qloxz`.
- Signature time: `2026-10-30T16:12:03.2978944+05:00`.
- Candidate source: `4ec66b7d693c68546954aace3e104a8ba7da511b`.
- Candidate set: `phase15-current-4ec66b7d693c`.
- Figma file: `GEf7NB9v2GZN80cMzRvUVQ`.
- Figma revision locator: MCP session
  `77cd90e1-9022-4a59-8906-de90227ad904`.
- Exact per-file SHA-256 values are authoritative in
  `15-VISUAL-APPROVAL.md`; the promotion verifier confirmed all 23 tracked PNGs
  match those values without transformation.

## Accepted Limitations

| Limitation | Classification | Owner / later phase |
|---|---|---|
| 18 lint warnings (`<img>` optimization and one existing hook-dependency warning) | **CURRENT OBSERVATION**, not an owner waiver or a zero-warning claim | Later implementation phases |
| Approved visual specs tolerate at most 2,500 differing real-time background pixels per 1440×900 frame; approved source bytes remain exact | **TEST-HARNESS LIMITATION**, not permission to alter approved bytes | Phase 18 motion stabilization |
| Figma Starter is represented as CURRENT sections plus PROPOSED and APPROVED pages; no native `figma.spec` API was available | **ACCEPTED PLATFORM LIMITATION** | Figma contract |

## Blocking Gaps

| Gap | Status | Required owner / phase |
|---|---|---|
| Isolated non-production Supabase and disposable participant/editor/reviewer/owner identities | **BLOCKED** | Phase 16 |
| 35 mapped visual rows, including privileged states, representative phone/DPR evidence and spider/web/Vivian semantic states | **BLOCKED** | Phases 16, 18, 19 and 22 |
| Physical PC DPR 1.25 and representative phone UAT | **BLOCKED** | Phase 22 owner UAT |
| Managed deep security evidence could not start without the parent-managed filesystem permission profile | **BLOCKED** | Security gate before milestone closure |

The automated clean-checkout chain is reproducible and green, but Phase 15's
own success criteria forbid completion while mandatory actor, visual, device or
security gates remain blocked. No requirement status is advanced by this report.
