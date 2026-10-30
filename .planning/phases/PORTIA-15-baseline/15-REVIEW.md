---
phase: 15
status: issues_found
depth: standard
files_reviewed: 38
findings:
  critical: 1
  warning: 4
  info: 1
  total: 6
reviewed_at: 2026-10-30
---

# Phase 15 Code Review

## Scope

Reviewed all 38 non-planning source/test files changed from the Phase 15 base,
including Playwright configuration, actor/target/diagnostic fixtures, candidate
capture and promotion logic, browser/visual specs, package scripts, security
headers and the one production ARIA change. The review was performed inline
because no callable subagent runtime was available in this session.

## Findings

### CR-01 — Role lanes do not establish server-authorized actor sessions

**Severity:** Critical / phase blocker  
**Files:** `tests/e2e/fixtures/actors.ts`, `tests/e2e/fixtures/test.ts`, `tests/e2e/specs/roles.spec.ts`

`actorAvailability()` changes a declaration from `BLOCKED` to `READY` when the
target environment passes the guard, but no fixture provisions credentials,
creates an authenticated browser context, or binds that context to the selected
participant/editor/reviewer/owner. The role spec then navigates as the ordinary
visitor and expects privileged UI. Supplying staging variables will therefore
unskip the tests without making the actor real, causing failure rather than
providing the promised server-authorized coverage.

**Required correction:** Phase 16 must provision disposable identities and
server-derived auth state per role, attach cleanup ownership and prove that no
client-only authority flag is used before `STAB-BASE-02` can close.

### WR-01 — Mutation guard accepts an unlisted production project

**Severity:** Warning / high safety risk  
**File:** `tests/e2e/fixtures/target-guard.ts`

The production deny-list defaults to an empty set. A matching 20-character
project ref and `https://<ref>.supabase.co/` URL are accepted when the operator
sets the confirmation string, even if `PORTIA_E2E_PRODUCTION_PROJECT_IDS` is
missing or stale. This is not a fail-closed proof that the target is isolated.

**Required correction:** require a positive isolated-target attestation that is
verified against the remote project, and require the known production ref set to
be present before any mutation-capable setup.

### WR-02 — Diagnostic expiry is evaluated against a permanently fixed date

**Severity:** Warning  
**File:** `tests/e2e/fixtures/diagnostics.ts`

`assertDiagnosticsClean()` evaluates allowlist expiry against
`2026-10-30T06:00:00.000Z`, not the runner's real wall clock. The Promotion 404
rows therefore remain accepted after their declared 2027-01-31 expiry.

**Required correction:** use real Node wall time for policy expiry. Keep fixed
browser time only for UI determinism and pass explicit dates solely in unit tests
that exercise the expiry boundary.

### WR-03 — The documented clean command is not self-bootstrapping

**Severity:** Warning / reproducibility gap  
**Files:** `playwright.config.ts`, `.env.example`, `15-BASELINE-RESULTS.md`

A detached checkout with the literal Playwright command fails when the ignored
public Supabase configuration is absent. The successful proof injected values
from the operator's separate `.env.local` plus a test-only device secret, but the
recorded command table does not provide a sanitized bootstrap command or a
machine-checkable preflight. Another clean machine cannot reproduce the pass
from tracked files alone.

**Required correction:** add a tracked, non-secret test bootstrap/preflight or
document an explicit environment-presence contract and fail before starting 145
tests. Do not commit keys or copy auth state.

### WR-04 — Global pixel allowance can hide a small complete-control regression

**Severity:** Warning  
**Files:** `tests/e2e/visual/*.spec.ts`

Every approved comparison permits up to 2,500 arbitrary differing pixels on the
entire 1440×900 page. That is enough to replace or remove a small button/icon
while still passing. The tolerance was introduced to absorb moving background
pixels rather than being bound to named dynamic masks.

**Required correction:** mask or stabilize the specific web/spider regions and
reduce the global allowance toward zero. Any new masking/tolerance needs an
explicit evidence update; approved PNG bytes must remain unchanged.

### IN-01 — Promotion verifier does not bind top-level revision metadata

**Severity:** Info / audit hardening  
**File:** `scripts/phase15-visual-manifest.mjs`

`--verify-promotion` verifies row hashes and destinations but does not parse and
cross-check the ledger's candidate-set, source-commit and Figma-revision headers
against `15-FIGMA-CONTRACT.md` and `15-FRAME-TEST-MAP.md`. Git history provides
human auditability, but the automated trust chain is incomplete.

**Suggested correction:** parse the three metadata fields and fail when they do
not match the signed contract/map before checking destination hashes.

## Positive Findings

- Approved PNG promotion is exact-byte and refuses unknown snapshot files.
- Candidate output cannot directly target the approved snapshot directory.
- Diagnostics redact URLs and common secret forms before attaching output.
- Production source does not import Phase 15 E2E support.
- The ARIA toolbar correction is minimal and does not alter visual identity.
- Unit, typecheck, build, lint and the bounded browser suite pass on the reviewed commit.

## Disposition

No finding was silently fixed during review. `CR-01`, `WR-01`, `WR-02` and
`WR-03` reinforce the existing Phase 15 closure block. `WR-04` and `IN-01` are
test-authority hardening work and must be resolved or explicitly accepted before
the milestone baseline is treated as release authority.

