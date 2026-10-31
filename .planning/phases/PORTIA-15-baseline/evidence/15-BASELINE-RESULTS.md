# Phase 15 Baseline Results

**Overall status:** LOCAL CLEAN-CHECKOUT GATES PASS / DATA-BACKED, ACTOR AND DEVICE LANES BLOCKED / PHASE CLOSURE BLOCKED  
**Verified commit:** `348684a5f408bf664b05b2395e57b84072c14291` (Plan 15-14 close-out; HEAD at the start of Plan 15-15)  
**Verified on:** 2026-11-01  
**Checkout:** disposable `git clone --no-hardlinks` of the repository, detached at the verified commit, zero tracked or untracked changes before and after the run; removed afterwards. The main working tree was never reset, cleaned or stashed.  
**Runtime:** Windows 10.0.26100 x64, Node `22.13.1` (reference runtime), npm `10.9.2`  
**Supersedes:** the 2026-10-30 result set at `8493636` (23-image baseline, Figma/managed-scan wording). That record is historical provenance only.

## Target Identity and Safety

| Boundary | Identity / result |
|---|---|
| Browser target | local production build served at `http://127.0.0.1:3000` |
| Public read backing | **NOT PROVIDED.** `.env.local` was not copied. Placeholder public values (`https://aaaaaaaaaaaaaaaaaaaa.supabase.co`, a non-key anon string) were injected into the process only so the tracked preflight shape check passes. Every server-side fetch failed with `ENOTFOUND`; no real Supabase project, production or otherwise, was contacted. |
| Promotion device secret | deterministic Phase 15 test-only value injected into the process; not written to disk or Git |
| Mutation target | **BLOCKED / NOT CONFIGURED** |
| Privileged authority | no auth storage, cookies, service key or role session supplied; no service-role code executed |
| Production mutation | none |

## Gate Results: Disposable Clean Checkout (Node 22.13.1)

| Gate | Command | Result |
|---|---|---|
| Install | `npm ci` | **PASS** — 373 packages from the lockfile (exercises the 15-14 lockfile-only audit fix) |
| Unit suite | `npm test` | **PASS** — 636 tests, 635 pass, 0 fail, 1 explicit skip |
| Typecheck | `npm exec tsc -- --noEmit` | **PASS** |
| Production build | `npm run build` | **PASS** — 3 static pages, all API routes compiled |
| Lint | `npm run lint` | **PASS WITH ACCEPTED LIMITATION** — 0 errors, 18 pre-existing `no-img-element` warnings |
| E2E preflight | `npm run test:e2e:preflight` | **PASS** (visitor mode, placeholder public shape) |
| Manifest tests | `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | **PASS** — 24 tests, 24 pass |
| Approved snapshot bytes | `node scripts/phase15-visual-manifest.mjs --verify-promotion` | **PASS** — 33 exact owner-approved bytes, 18 non-approved rows excluded |
| UI map | `... --verify-ui-map` | **PASS (Plan 15-16, tracked index)** — 84 rows (51 captured, 33 blocked) in a disposable clean checkout with no `.runs/` (the original 15-15 result was BLOCKED with `PORTIA_CANDIDATE_SET_MISSING`; main tree: 84 rows, 51 captured, 33 blocked). `Source: tracked index (candidate PNG bytes not re-hashed)`; approved bytes are covered by `--verify-promotion` |
| Approval ledger | `... --verify-approval` | **PASS (Plan 15-16, tracked index)** — 51 captured verdicts, 33 blocked excluded. `Source: tracked index (candidate PNG bytes not re-hashed)`; approved bytes are covered by `--verify-promotion` |
| Manifest `--verify` default mode | `... --verify` | **NOT RUN** — it rewrites signed evidence markdown (owner constraint) and has the same `.runs/` dependency |
| Dependency audit (runtime) | `npm audit --omit=dev` | **PASS** — 0 vulnerabilities |
| Dependency audit (all) | `npm audit` | **ACCEPTED** — 0 critical, 0 high, 16 moderate dev-only (npm offers only breaking downgrades; see `15-SECURITY.md`) |
| Secret / artifact scan | `git grep` on tracked files | **PASS** — 0 JWT-shaped strings, 0 private-key blocks, 0 `sb_secret_` / service-key values, 0 tracked dotenv files (besides the example), 0 tracked auth-state files, 0 raw Authorization/Cookie lines in Phase 15 evidence or E2E sources; the only service-role mention in code paths is the opt-in env name inside the skipped live test |
| Browser regression | `playwright test tests/e2e/specs tests/e2e/visual --retries=0` | **PARTIAL** — 155 tests: 63 passed, 15 failed, 77 skipped, 0 flaky (see below) |

## Gate Results: Main Working Tree (Node 22.13.1)

| Gate | Result |
|---|---|
| `npm test` | **PASS** — 649 tests, 648 pass, 0 fail, 1 skip (Plan 15-16; 636/635 before) |
| `npm exec tsc -- --noEmit` | **PASS** |
| `npm run lint` | **PASS** — 0 errors, 18 warnings |
| Manifest tests | **PASS** — 37/37 after Plan 15-16 (was 24/24) |
| `--verify-ui-map` | **PASS** — 84 rows (51 captured, 33 blocked); `Source: capture`, drift guard green |
| `--verify-approval` | **PASS** — 51 captured verdicts, 33 blocked excluded; `Source: capture`, drift guard green |
| `--verify-promotion` | **PASS** — 33 exact approved bytes, 18 excluded |
| `npm audit --omit=dev` / `npm audit` | **PASS** 0 / **ACCEPTED** 16 moderate dev-only |
| `npm run test:e2e:preflight` | **FAIL-CLOSED** `missing-environment: NEXT_PUBLIC_SUPABASE_ANON_KEY` — the machine-local `.env.local` no longer supplies a complete public configuration, so browser lanes cannot start on the main tree either. Build and Playwright were deliberately not run there (they would load `.env.local`). |

The main tree and the clean checkout agree on every gate that does not depend on
the untracked capture directory or on a live read backing.

## Plan 15-16 (G6) Clean-Checkout Proof

Disposable `git clone --no-hardlinks` detached at `b6164ed2e45e1c1140d803d88d7ae03f17d3c98d`, Node `22.13.1`, no `tests/e2e/visual-candidates/.runs/` directory, `git status --porcelain` empty afterwards; removed afterwards.

| Check | Result |
|---|---|
| Manifest tests | **PASS** — 37 tests, 37 pass, 0 fail |
| `--verify-ui-map` | **PASS** — `Verified repository UI map for 84 rows (51 captured, 33 blocked). Source: tracked index (candidate PNG bytes not re-hashed).` |
| `--verify-approval` | **PASS** — `Verified owner verdict coverage for 51 captured rows; 33 blocked rows excluded. Source: tracked index (candidate PNG bytes not re-hashed).` |
| `--verify-promotion` | **PASS** — `Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.` |
| Tamper probe (one CAPTURED row sha256 zeroed in the clone's index) | **FAIL-CLOSED** — `--verify-ui-map` exit 1 `PORTIA_UI_MAP_HASH_MISMATCH`; `--verify-approval` exit 1 `PORTIA_APPROVAL_VERDICT_MISSING` |

Limit: the clean checkout does not re-hash candidate PNG bytes (they live in the gitignored run directory); that is covered on the capturing machine (`Source: capture`) and approved bytes by `--verify-promotion`. G1-G5 and all STAB-BASE statuses are unchanged.

## Playwright Result Classification (clean checkout, 155 tests)

| Class | Count | Status | Detail |
|---|---:|---|---|
| Passed | 63 | **PASS** | Accessibility 10/10, diagnostics 15/15, tooling 5/5, role-gate spec 10 active, visitor 12 of 17 active, approved visual comparisons 11 |
| Failed — no read backing | 15 | **BLOCKED (DATA)** | `ENOTFOUND` on every `/api/content`, `/api/access`, `/api/employees` call: visitor settings persist across reload (5 projects); seven approved public application pixel comparisons; Firefox `search-restored` 7061 px diff and chromium-desktop `vivian-activity` 2347 px diff (frames that render fetched content); WebKit-phone shell diagnostics event (the network failure). Not recorded as passes and not recorded as regressions: they are the expected result of deliberately withholding the read backing. Earlier runs with a real read backing (Plan 15-12: 21 passed, 54 skipped, 0 failed) are not re-proven here. |
| Skipped — actor lanes | 20 | **BLOCKED** | participant, editor, promo reviewer and owner lanes: `BLOCKED: safe target unavailable (confirmation)` |
| Skipped — pixel authority | 52 | **EXPECTED / OWNER-BOUND** | pixels are authoritative only on the declared pixel-authority project (`chromium-desktop`, Firefox for Search-window) |
| Skipped — no row for project | 2 | **EXPECTED** | no device-specific approved row for that project |
| Skipped — phone-only smoke | 3 | **EXPECTED** | phone-only touch smoke on desktop projects |
| Flaky | 0 | — | `--retries=0` |

Counts: **pass 63 / fail 15 (all BLOCKED-DATA) / skip 77 (20 BLOCKED actor, 57 expected) / flaky 0.**

## Accessibility and Diagnostic Inventory

- Critical Axe findings: **0**. Serious Axe findings: **0** (10/10 accessibility tests passed).
- Diagnostics: all six injected diagnostic classes fail through the redacted path (15/15 passed).
- The only expected runtime failure remains the exact unbound-device Promotion `GET /api/promotion/status -> 404` allowance, owned by `promotion-api-contract`, expiring 2027-01-31.

## Visual Authority Accounting

| Bucket | Count | Status |
|---|---:|---|
| APPROVED, exact bytes in `tests/e2e/visual/__screenshots__/` | 33 | verified by `--verify-promotion` on both trees |
| REJECTED (shortcut, spider and web-wave motion candidates) | 18 | excluded; replacement owned by Phase 18 |
| BLOCKED (privileged actors, representative phone/DPR, semantic states) | 33 | excluded; owned by Phases 16, 19 and 22 |

## Accepted Limitations

| Limitation | Classification | Owner / later phase |
|---|---|---|
| 18 lint warnings (`<img>` optimization and one hook-dependency warning) | **CURRENT OBSERVATION**, not a waiver | Later implementation phases |
| Approved visual specs tolerate a bounded count of differing real-time background pixels; approved source bytes remain exact | **TEST-HARNESS LIMITATION** | Phase 18 motion stabilization |
| `--verify-ui-map` and `--verify-approval` needed the untracked `.runs/` capture directory | **RESOLVED by Plan 15-16** (tooling only): tracked `15-CANDIDATE-INDEX.json`. A clean checkout does not re-hash candidate PNG bytes; the main tree does and checks index == capture | Resolved; G1-G5 unchanged |
| 16 moderate dev-only npm advisories | **ACCEPTED**, see `15-SECURITY.md` | Phase 21 |

## Blocking Gaps (concrete, unproven)

| Gap | Status | Required owner / phase |
|---|---|---|
| Isolated non-production Supabase and disposable participant/editor/reviewer/owner identities | **BLOCKED** | Phase 16 |
| Read backing for the 15 data-backed lanes (public content API reachable from the checkout) | **BLOCKED** | Phase 16 isolated Supabase, or owner decision to supply a read-only public configuration |
| 33 mapped visual rows (privileged states, representative phone/DPR, spider/web/Vivian semantic states) | **BLOCKED** | Phases 16, 18, 19 and 22 |
| 18 rejected motion candidates | **REJECTED** | Phase 18 |
| Physical PC DPR 1.25 and representative phone UAT | **BLOCKED** | Phase 22 owner UAT |

No external design service or managed scanner is a prerequisite. No requirement
status is advanced by this report beyond what `15-VERIFICATION.md` records.
