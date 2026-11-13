# 23 - Local and live evidence ledger

Recorded 2026-11-13 08:37 UTC. LOCAL-CHECK means implementation and offline test provenance. It does not mean live role, browser, or physical-device acceptance. No Phase 23 SQL was applied.

## Local commands

| Lane | Exact command | Node | UTC completion | Exit | Output reference | Verdict |
|---|---|---|---|---|---|---|
| Full gate | C:\Program Files\Git\bin\bash.exe .agents/skills/portia-check/run.sh; PORTIA_NODE22=/tmp/portia-node22-check-only, PATH excludes broken temp npm | 22.13.1 | 2026-11-13 08:37:41 | 0 | 23-LOCAL-CHECK.txt; full transient %TEMP%\portia-phase23-check-final2.log, SHA256 839e765d02f19c1dc2d423bdf21144a160f4fa0e1e844b7b5eb14eaefd64e501 | PASS-local |
| Unit | npm test --silent | 22.13.1 | 2026-11-13 08:37:41 | 0 | 23-LOCAL-CHECK.txt: 1909 total, 1906 pass, 3 skipped, 0 fail | PASS-local |
| Types | npm exec --silent tsc -- --noEmit | 22.13.1 | 2026-11-13 08:37:41 | 0 | 23-LOCAL-CHECK.txt: types step followed by lint | PASS-local |
| Lint | npm run lint --silent | 22.13.1 | 2026-11-13 08:37:41 | 0 | 23-LOCAL-CHECK.txt: 0 errors, 17 warnings | PASS-local |
| Visual manifest test | node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts | 22.13.1 | 2026-11-13 08:37:41 | 0 | 23-LOCAL-CHECK.txt: 49 pass, 0 fail | PASS-local |
| Visual promotion | node --experimental-strip-types scripts/phase15-visual-manifest.mjs --verify-promotion | 22.13.1 | 2026-11-13 08:37:41 | 0 | 23-LOCAL-CHECK.txt: 65 approved bytes, 18 excluded | PASS-local |

The first script invocation exited 1 before tests: temporary npm lacked node-gyp/bin/node-gyp.js. The final run used the same reference Node with working system npm. The rewriting --verify mode was never used. Build is BLOCKED as a Phase 23 evidence lane: no isolated checkout without real .env files was prepared.

## Requirement coverage

| ID | Plan summary | Offline source | Verdict | Live/browser gate |
|---|---|---|---|---|
| ACC-01 | 23-01-SUMMARY.md | lib/access-gate.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| ACC-02 | 23-01-SUMMARY.md | lib/access-gate.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| ACC-03 | 23-01-SUMMARY.md | lib/access-gate.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| ACC-05 | 23-02-SUMMARY.md | lib/access-requests.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| ACC-06 | 23-02-SUMMARY.md | lib/access-gate.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| ACC-07 | 23-02-SUMMARY.md | lib/access-gate.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| ACC-08 | 23-01-SUMMARY.md | lib/access-gate.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| PROM-01 | 23-03-SUMMARY.md | lib/portia-promotion-security.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| PROM-02 | 23-03-SUMMARY.md | lib/portia-promotion-security.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| PROM-03 | 23-04-SUMMARY.md | lib/portia-promotion-api.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| PROM-04 | 23-05-SUMMARY.md | lib/portia-promotion-reviewer.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |
| PROM-05 | 23-06-SUMMARY.md | lib/portia-template-model.test.ts in unit gate | LOCAL-CHECK | BLOCKED until isolated role/browser evidence |

## UI considerations

37 rows in 23-UI-SPEC.md: 34 explicit, 3 backstop. Explicit rows have local source coverage only; all browser acceptance is outstanding.

| ID | Category | Provenance | Offline source | Verdict |
|---|---|---|---|---|
| E1 | empty | 23-UI-SPEC.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| E1 | loading | 23-UI-SPEC.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| E1 | error | 23-UI-SPEC.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| E1 | partial | 23-UI-SPEC.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| E1 | long-text | 23-UI-SPEC.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| E2 | loading | 23-UI-SPEC.md backstop | lib/access-gate.test.ts | BLOCKED-browser |
| E2 | error | 23-UI-SPEC.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| E2 | overflow | 23-UI-SPEC.md backstop | lib/access-gate.test.ts | BLOCKED-browser |
| E2 | long-text | 23-UI-SPEC.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| E3 | empty | 23-UI-SPEC.md explicit | lib/portia-promotion-ui.test.ts | LOCAL-CHECK |
| E3 | loading | 23-UI-SPEC.md explicit | lib/portia-promotion-ui.test.ts | LOCAL-CHECK |
| E3 | error | 23-UI-SPEC.md explicit | lib/portia-promotion-ui.test.ts | LOCAL-CHECK |
| E3 | populated | 23-UI-SPEC.md explicit | lib/portia-promotion-ui.test.ts | LOCAL-CHECK |
| E3 | partial | 23-UI-SPEC.md explicit | lib/portia-promotion-ui.test.ts | LOCAL-CHECK |
| E3 | overflow | 23-UI-SPEC.md explicit | lib/portia-promotion-ui.test.ts | LOCAL-CHECK |
| E3 | zero-one-many | 23-UI-SPEC.md explicit | lib/portia-promotion-ui.test.ts | LOCAL-CHECK |
| E3 | long-text | 23-UI-SPEC.md explicit | lib/portia-promotion-ui.test.ts | LOCAL-CHECK |
| E4 | empty | 23-UI-SPEC.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| E4 | loading | 23-UI-SPEC.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| E4 | error | 23-UI-SPEC.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| E4 | populated | 23-UI-SPEC.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| E4 | partial | 23-UI-SPEC.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| E4 | overflow | 23-UI-SPEC.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| E4 | zero-one-many | 23-UI-SPEC.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| E4 | long-text | 23-UI-SPEC.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| E5 | empty | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| E5 | loading | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| E5 | error | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| E5 | populated | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| E5 | long-text | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| E6 | empty | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| E6 | loading | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| E6 | error | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| E6 | populated | 23-UI-SPEC.md backstop | lib/portia-template-model.test.ts | BLOCKED-browser |
| E6 | partial | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| E6 | overflow | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| E6 | zero-one-many | 23-UI-SPEC.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |

## Edge considerations

36 rows from plans 01-06: 32 explicit, 4 backstop. Mock and SQL-text checks do not prove live races.

| Requirement / case | Provenance | Offline source | Verdict |
|---|---|---|---|
| ACC-01 / empty | 23-01-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-01 / encoding | 23-01-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-01 / idempotency | 23-01-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-01 / concurrency | 23-01-PLAN.md backstop | lib/access-gate.test.ts | BLOCKED-live |
| ACC-02 / idempotency | 23-01-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-02 / concurrency | 23-01-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-03 / idempotency | 23-01-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-03 / concurrency | 23-01-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-08 / idempotency | 23-01-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-08 / concurrency | 23-01-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-05 / empty | 23-02-PLAN.md explicit | lib/access-requests.test.ts | LOCAL-CHECK |
| ACC-05 / encoding | 23-02-PLAN.md explicit | lib/access-requests.test.ts | LOCAL-CHECK |
| ACC-05 / idempotency | 23-02-PLAN.md explicit | lib/access-requests.test.ts | LOCAL-CHECK |
| ACC-05 / concurrency | 23-02-PLAN.md backstop | lib/access-requests.test.ts | BLOCKED-live |
| ACC-06 / idempotency | 23-02-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-06 / concurrency | 23-02-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-07 / idempotency | 23-02-PLAN.md explicit | lib/access-gate.test.ts | LOCAL-CHECK |
| ACC-07 / concurrency | 23-02-PLAN.md backstop | lib/access-gate.test.ts | BLOCKED-live |
| PROM-01 / empty | 23-03-PLAN.md explicit | lib/portia-promotion-security.test.ts | LOCAL-CHECK |
| PROM-01 / encoding | 23-03-PLAN.md explicit | lib/portia-promotion-security.test.ts | LOCAL-CHECK |
| PROM-01 / idempotency | 23-03-PLAN.md explicit | lib/portia-promotion-security.test.ts | LOCAL-CHECK |
| PROM-01 / concurrency | 23-03-PLAN.md backstop | lib/portia-promotion-security.test.ts | BLOCKED-live |
| PROM-02 / idempotency | 23-03-PLAN.md explicit | lib/portia-promotion-security.test.ts | LOCAL-CHECK |
| PROM-02 / concurrency | 23-03-PLAN.md explicit | lib/portia-promotion-security.test.ts | LOCAL-CHECK |
| PROM-03 / empty | 23-04-PLAN.md explicit | lib/portia-promotion-api.test.ts | LOCAL-CHECK |
| PROM-03 / encoding | 23-04-PLAN.md explicit | lib/portia-promotion-api.test.ts | LOCAL-CHECK |
| PROM-03 / idempotency | 23-04-PLAN.md explicit | lib/portia-promotion-api.test.ts | LOCAL-CHECK |
| PROM-03 / concurrency | 23-04-PLAN.md explicit | lib/portia-promotion-api.test.ts | LOCAL-CHECK |
| PROM-04 / adjacency | 23-05-PLAN.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| PROM-04 / empty | 23-05-PLAN.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| PROM-04 / ordering | 23-05-PLAN.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| PROM-04 / idempotency | 23-05-PLAN.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| PROM-04 / concurrency | 23-05-PLAN.md explicit | lib/portia-promotion-reviewer.test.ts | LOCAL-CHECK |
| PROM-05 / boundary | 23-06-PLAN.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| PROM-05 / precision | 23-06-PLAN.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |
| PROM-05 / concurrency | 23-06-PLAN.md explicit | lib/portia-template-model.test.ts | LOCAL-CHECK |

## Live boundaries

| Lane | Verdict | Reason and recovery |
|---|---|---|
| Migration push | BLOCKED | No explicitly isolated disposable test project/branch; do not contact production. |
| Direct anon/editor/visitor RPC allow/deny | BLOCKED | Migration unapplied; test on isolated Postgres with disposable identities. |
| Postgres RLS and simultaneous submit/revoke | BLOCKED | Offline assertions and mocks do not prove live races. |
| Authenticated editor and visitor browser acceptance | BLOCKED | No isolated auth fixtures or browser preflight. |
| Staging and production | BLOCKED | No Phase 23 deployment; production closure stays Phase 25. |
| Physical phone and desktop | BLOCKED | Phase 27 acceptance remains outstanding. |
| Framing preview/HTML/PNG pixel parity | BLOCKED | Browser/export comparison on isolated fixtures not run. |

