---
phase: 14-prilozhenie-povyshenie
status: preflight_blocked
verified_at: 2026-10-29
automated_tests: 571
requirements: 49
decisions: 23
---

# Phase 14 Verification

## Automated evidence

- Production SQL was applied manually by the owner on 2026-10-28; the transaction and embedded postflight assertions completed with `Success. No rows returned`.
- `npm test`: 571 passed, 1 guarded isolated-live test skipped, 0 failed (572 total).
- `npm run test:promotion-live` with `READ_ONLY_PREFLIGHT`: 1/1 passed and verified all 18 deployed Promotion RPC signatures without a write.
- `npx tsc --noEmit`: pass.
- `npm run build`: pass.
- Scoped remediation lint: pass. Full repository lint still has three pre-existing errors in two archived Phase 06 CommonJS scripts and `components/portia-desktop.tsx:1782`.
- No automated command mutated the production database or Google Sheet.

## Remediation integration evidence

| Gap | Implementation commits | Integrated evidence | State |
|---|---|---|---|
| GAP-14-01 live submit/binding | `08f0498`, `e037151` | API/database regressions and deployed 18-RPC read-only inventory pass | Live accepted-write and restore need isolated project or approved participant |
| GAP-14-02 participant dates/actions | `2838756`, `3910044` | punctuation, eligibility matrix and independent-submit tests pass | Automated closed; eligible browser submit pending |
| GAP-14-03 bank editor | `8fea76a`, `64ea8fb`, `b44dec8`, `980dac0` | count/quota, typed CRUD, versioned preview and control-state tests pass | Authenticated PC/phone round trip pending |
| GAP-14-04 spider lifecycle | `c44f29c` | lifecycle tests plus local persistence observation pass | Preflight passed |
| GAP-14-05 window bounds | `7fa9ad7` | mirrored edge, oversized-window and resize-then-drag tests pass | Physical PC drag pending |
| GAP-14-06 shortcut handoff | `bfef47d` | persistent 24×24 SVG contract and computed style pass | Desktop DPR 1.25 visual check pending |
| GAP-14-07 reviewer/motion follow-up | `6346786` | all-status badges, visible answer selection, front-pair schedule, exact spider colour and virus diagnostic scan regressions pass | Authenticated reviewer and owner aesthetic checks pending |

The integrated branch passes 571 deterministic tests, TypeScript, the production build, scoped lint and the non-mutating deployed RPC preflight together. The follow-up browser smoke confirmed the exact custom spider token and virus scan layer without a runtime overlay.

## Requirement evidence (49/49 implemented; owner UAT pending)

| Requirement | Evidence | Owner UAT |
|---|---|---|
| PROM-01 | Public nickname status API and participant gate tests | 1 |
| PROM-02 | Read-only `Portia!A61:E85` loader and request boundary | 1 |
| PROM-03 | Missing-nickname API test proves zero workflow writes | 1 |
| PROM-04 | Partial unique indexes for both active request kinds | 4, 6 |
| PROM-05 | Nick/IP attempt buckets with progressive waits | 3 |
| PROM-06 | Reviewer approval rechecks the live roster | 8 |
| TASK-01 | Per-target ordinary banks | 7 |
| TASK-02 | Per-bank required count | 7 |
| TASK-03 | Manual preview selection | 7 |
| TASK-04 | Random preview token and rebuild/replace flow | 7 |
| TASK-05 | Immutable assignment snapshots | 8 |
| TASK-06 | Claimed reviewer mutation boundary | 6, 8 |
| TASK-07 | Explicit reviewer approval RPC | 8 |
| TASK-08 | `awaiting-sheet-change` state | 8 |
| COOL-01 | Academic 7-day rule tests | 4 |
| COOL-02 | 3/4/6/8/10/18-day rule tests | 4 |
| COOL-03 | Qualification gates after titles 2/4/6 | 4, 9 |
| COOL-04 | Expert special-task state | 4 |
| COOL-05 | Server-time calculations and forged-time regression | 4, 20 |
| QUAL-01 | Three transition-specific qualification banks | 9 |
| QUAL-02 | Per-type bank quotas | 9 |
| QUAL-03 | Typed single/multiple/free-text validators | 11 |
| QUAL-04 | Manual/random qualification preview | 9 |
| QUAL-05 | Claimed-reviewer confirmation starts the attempt | 10 |
| QUAL-06 | One-question forward-only 15-minute runner | 10 |
| QUAL-07 | Read-only current-test reload path | 10 |
| QUAL-08 | Desktop focus/visibility/page-exit terminal handlers | 12 |
| QUAL-09 | Phone skips focus protection | 14 |
| QUAL-10 | Safe projection and future-question regression | 11, 20 |
| QUAL-11 | Per-answer reviewer grading | 15 |
| QUAL-12 | Separate confirmed final decision | 15 |
| QUAL-13 | Result/optional percent only | 15 |
| RETRY-01 | Server `retake_at` request gate | 17 |
| RETRY-02 | Default 2-day reviewer control | 17 |
| RETRY-03 | Bounded custom extension up to 365 days | 17 |
| RETRY-04 | No lifetime attempt cap; compact history only | 17, 19 |
| RETRY-05 | Bounded once-only ready notification ledger | 18 |
| PERM-01 | Trusted `promo` tab closed by default | 5 |
| PERM-02 | Existing owner-only grant management | 5 |
| PERM-03 | Route and SQL `portia_has_tab_grant('promo')` guards | 5, 20 |
| EDIT-01 | Separate requests/tasks/qualification workspaces | 5 |
| EDIT-02 | Visible-tab polling preserves selection | 5, 6 |
| EDIT-03 | Three-day cleanup hint in reviewer workspace | 19 |
| DATA-01 | Dedicated read-only roster loader; no employee writes | 1 |
| DATA-02 | Normalized active workflow tables | 19 |
| DATA-03 | Transactional result insert plus payload cascade delete | 19 |
| DATA-04 | Per-nickname history pruning after three results | 19 |
| DATA-05 | Bounded three-day cleanup predicates and Cron assertion | 19 |
| DATA-06 | Public projection allowlists and direct-denial regression | 11, 20 |

## Decision evidence (D-01–D-23)

| Decision | Evidence | Owner UAT |
|---|---|---|
| D-01 | Ordinary/qualification eligibility functions | 4, 9 |
| D-02 | Lookup is read-only; accepted submit binds atomically | 2 |
| D-03 | Reviewer-only reset; roster removal does not reset | 1, 2 |
| D-04 | Every participant route rechecks roster membership | 1 |
| D-05 | Neutral device-conflict response | 2 |
| D-06 | 5/15/60 server bucket progression | 3 |
| D-07 | Cookie token + nickname/IP risk bucket; no absolute bypass claim | 2, 3 |
| D-08 | Shared reviewer queue | 6 |
| D-09 | Conditional atomic claim and 409 conflict | 6 |
| D-10 | Assigned release and owner force-release | 6 |
| D-11 | No short claim timeout; cleanup only after three days | 6, 19 |
| D-12 | Public rejection omits internal note | 8, 11 |
| D-13 | Separate target/transition banks | 7, 9 |
| D-14 | Active-only, no-duplicate, sufficient-pool preview | 7, 9 |
| D-15 | Preview/rebuild/replace before confirmation | 7, 9 |
| D-16 | Immutable confirmed snapshots | 8, 10 |
| D-17 | Per-type quotas; protected answer keys | 9, 11 |
| D-18 | Immediate single server 15-minute deadline | 10 |
| D-19 | Boundary timeout failure retains answers | 13 |
| D-20 | Technical-failure override before final decision | 16 |
| D-21 | Desktop focus/offline and phone offline behavior | 12–14 |
| D-22 | Any promo reviewer can release retake wait | 17 |
| D-23 | Default/custom retake with unlimited attempts | 17 |

## Outstanding gate

Plans 14-15 through 14-18 remediate all six recorded gap groups in code and deterministic tests. Plan 14-19 cannot truthfully mark tests 23–27, 29–31 preflight-passed without an owner-approved temporary participant, authenticated `promo` reviewer/test bank, desktop DPR 1.25 observation and isolated Supabase credentials for the mutating live suite. Phase 14 remains open; after those inputs are available, finish Plan 14-19 and run the full 31-test owner checkpoint through 14-14.

## Gap closure routing

| Gap | Plan | Closure evidence |
|---|---|---|
| GAP-14-01 live submit/binding | 14-15 | Deployed RPC inventory, opt-in live test and accepted request restoring the binding |
| GAP-14-02 participant dates/actions | 14-16 | Exact UI/API state tests plus eligible/ineligible browser cases |
| GAP-14-03 bank editor | 14-17 | Count and CRUD round trips, preview/confirm and responsive control states |
| GAP-14-04 spider lifecycle | 14-18 | No automatic fade/relocation; explicit toggle selects a new spawn and pose |
| GAP-14-05 window bounds | 14-18 | Symmetric fully-visible drag geometry tests |
| GAP-14-06 shortcut handoff | 14-18 | Geometry/style contract and visual handoff check |
| Integrated regression | 14-19 then 14-14 | Automated/browser preflight followed by owner PC/phone UAT |

## Safe-data blocker details

- The local environment exposes the deployed URL and public key, but no service-role credential for an isolated test project.
- The guarded mutating live suite requires `PORTIA_PROMO_LIVE_CONFIRM=ISOLATED_TEST_PROJECT`; it was not pointed at production.
- No eligible temporary roster nickname, second conflict nickname, reviewer credentials or disposable bank was provided.
- Available in-app browser evidence is narrow-screen only; it cannot substitute for physical PC edge dragging or DPR 1.25 visual inspection.
