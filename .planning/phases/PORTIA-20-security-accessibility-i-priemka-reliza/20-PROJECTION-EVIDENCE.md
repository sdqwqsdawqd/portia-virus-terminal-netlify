# 20-PROJECTION-EVIDENCE: actor-by-surface verdict (plan 20-09, STAB-SEC-02)

Scope: participant-visible network response bodies and `Cache-Control` of the Promotion API, reviewer guard, direct API denial and revoke without re-login.
Target: attested isolated staging project (Phase 16 target guard, `requireStagingLiveTarget`). Production was not touched. No keys, tokens, env files or project URLs are recorded here.

## Run identity

| Field | Value |
|---|---|
| Code ref (HEAD when the run started) | `afcb6fe` on `design/stage-1-desktop` (plus uncommitted spec edit of this plan, committed afterwards) |
| Command | `npm.cmd run test:e2e:mutation -- --retries=0 tests/e2e/specs/staging-authz.spec.ts` |
| Result | exit 0; 80 passed, 5 skipped (roles.spec + staging-authz.spec, 5 browser projects) |
| Staging receipt | `portia-staging-receipt-v1`, runId `mw1n7zca_83beb303`, refHash `01d085e7b9f0`, sha256 `0c45843b4e3907c5e1d8c592ba1ce9b8f4f1a26995e1c6e69d546cdda57f3f12` |
| Receipt suites | `roles-spec-ts: PASS`, `staging-authz-spec-ts: SKIP` (SKIP is caused only by the BLOCKED(DATA) case below) |
| Cleanup | created authUsers 7 / editors 5; deleted authUsers 7 / editors 4; residual authUsers 0, content 0, editors 0, promo 0, storage 0 |

Receipt file lives in the git-ignored `test-results/staging/receipt-playwright-mw1n7zca_83beb303.json`.

## Server contract (unit level, `lib/portia-promotion-api.test.ts`, `npm test` 1121 pass / 0 fail)

| Surface | Verdict | Evidence |
|---|---|---|
| `GET /api/promotion/status` body | PASS | Recursive key allowlist plus privileged-marker scan on a hostile RPC projection (answerKey, futureQuestions, questions, bank, internalNote, notes, reviewerId/Name, linkedNickname, tokenHash, riskBucket, ipBucket) |
| status repeat / idempotency | PASS | Two identical requests deep-equal; request with a device token has the same key set; no submit call |
| status parallel | PASS | 8 interleaved Alice/Bob requests: no cross-nickname text, per-actor result count preserved |
| status denied/failed (423/503/404/404) | PASS | No privileged marker, no cookie set |
| `GET/POST /api/promotion/test` projection | PASS | `safeProjection` extracted from the route source and executed: closed key set, question keys `id,index,options,text,total,type`, non-string options dropped, unknown `terminalReason` dropped |
| no-store on every branch | PASS | Balanced scan: every `Response.json(` in `status`, `test`, `reviewer` routes carries `noStoreHeaders`; `noStoreHeaders` = `Cache-Control: no-store` + `Netlify-CDN-Cache-Control: no-store` |
| Route code change | none | No leak was confirmed, so no route was edited (plan: fix only on confirmed leak) |

## Staging network evidence (`tests/e2e/specs/staging-authz.spec.ts`, 5 projects: chromium-desktop, chromium-dpr125, firefox-desktop, webkit-phone, chromium-phone)

| Actor | Surface | Verdict | Notes |
|---|---|---|---|
| visitor | `GET/POST /api/promotion/reviewer` | PASS (5/5 projects) | 503 per matrix, `no-store`, body keys exactly `["error"]`, no privileged marker |
| visitor | `GET /api/promotion/test` (no device token) | PASS | 403, `no-store`, `["error"]` only |
| visitor | `GET /api/promotion/status` (no nickname) | PASS | 404 `unbound-device`, `no-store` |
| participant | `GET/POST /api/promotion/reviewer` | PASS (5/5) | 403 per matrix, `no-store`, `["error"]` only |
| participant | `GET /api/promotion/test`, `GET /api/promotion/status` | PASS (5/5) | same as visitor |
| editor / promo-reviewer / owner | reviewer matrix (STAB-SEC-01) | PASS (5/5) | 403 / 200 / 200 per `expected-authz.json` |
| promo-reviewer | revoke without re-login | PASS (5/5) | `/api/promotion/reviewer` 403 after revoke; denial now also asserted `no-store` with `["error"]` only |
| participant | status body for a roster nickname (allowlist, repeats, parallel x3) | BLOCKED(DATA) | Skipped in 5/5 projects: no promotion-roster nickname for the isolated project (`PORTIA_E2E_PROMO_NICKNAME` unset). Not counted as PASS. Covered at unit level only. |
| participant | qualification test attempt body (answer/future-question leak) | BLOCKED(DATA) | Needs a seeded attempt and device-bound token in the isolated project; not available. Covered at unit level (`safeProjection`) only. |

## Verdict

- Server projection and no-store contract: PASS (unit, source-level).
- Direct API denial, reviewer guard, revoke: PASS on isolated staging, 5 projects, with response-body inspection.
- Participant status body and qualification attempt body on staging: BLOCKED(DATA) until a promotion roster nickname and seeded attempt exist in the isolated project. To close: set `PORTIA_E2E_PROMO_NICKNAME` to a nickname present in the staging promotion sheet and rerun the command above.
- Production: not used.
