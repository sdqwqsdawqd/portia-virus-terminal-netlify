---
phase: PORTIA-12
review: 12-REVIEW.md
fixed: 1
accepted: 2
deferred: 4
open: 0
---

# Phase 12 review disposition

| ID | Severity | Disposition | Source |
|----|----------|-------------|--------|
| CR-01 | critical | fixed | `/api/access` answers 503 on `isAuthRetryableFetchError` from `getUser()`, so a network blip keeps the editor open; test "an auth network blip makes /api/access answer 503" in lib/editor-tabs.test.ts |
| WR-01 | warning | accepted | D-11: per-tab enforcement for portia_content and storage is app-level; recorded in PROJECT.md Known Limitations. Employee tables are DB-gated. |
| WR-02 | warning | deferred | `unavailable` read as no-access outside /api/access (owner-login sign-out, misleading 403 on save during a DB blip). No data loss: the editor stays open and the draft is kept. |
| WR-03 | warning | accepted | «Confirm email» is ON in project wqiyghssdulzsbshjtur (owner confirmed 2026-10-26); the code gate relies on it by design (STEP 0). |
| WR-04 | warning | deferred | `sectionOfFormattedKey` splits on ":"; generated virus ids have no colon. Fail-closed for unknown ids is a follow-up. |
| IN-01 | info | deferred | /api/editors handlers lack try/catch. |
| IN-02 | info | deferred | "employees" tab id repeated as a bare string. |
