---
phase: 15-baseline
plan: 03
subsystem: testing
tags: [playwright, diagnostics, accessibility, roles, webkit]

requires:
  - phase: 15-baseline
    provides: pinned browser runner and fail-closed mutation guard from plan 15-02
provides:
  - deterministic visitor and phone browser journeys through real PORTIA routes
  - redacted runtime diagnostic gate with exact expiring expected-state rows
  - semantic Russian page objects and an executable accessibility inventory
  - explicit BLOCKED role lanes when isolated staging is absent
affects: [15-04-visual-candidates, 16-promotion-live-proof, 22-owner-uat]

tech-stack:
  added: []
  patterns: [semantic page objects, server-authorized actor lanes, exact diagnostic allowlist, candidate-ready browser state]

key-files:
  created:
    - tests/e2e/pages/desktop.page.ts
    - tests/e2e/pages/editor.page.ts
    - tests/e2e/pages/promotion.page.ts
    - tests/e2e/specs/visitor.spec.ts
    - tests/e2e/specs/roles.spec.ts
    - tests/e2e/specs/accessibility.spec.ts
  modified:
    - tests/e2e/fixtures/test.ts
    - tests/e2e/fixtures/determinism.ts
    - tests/e2e/fixtures/diagnostics.ts
    - playwright.config.ts
    - next.config.ts
    - components/portia-desktop.tsx

key-decisions:
  - "Do not synthesize editor, reviewer or owner authority in localStorage; block those lanes until isolated staging exists."
  - "Treat the unbound-device Promotion 404 as an exact, expiring expected state while failing every other unexpected runtime event."
  - "Disable production-only HTTP upgrading solely inside the local Playwright server environment so WebKit can exercise the production build without weakening deployed CSP."

patterns-established:
  - "Assertions remain in specs; page objects expose Russian user intent and semantic locators."
  - "Axe critical/serious fingerprints fail immediately; moderate findings remain visible inventory."

requirements-completed: [STAB-BASE-05]
requirements-partial: [STAB-BASE-02]

duration: 47min
completed: 2026-10-30
---

# Phase 15 Plan 03: Browser Contract Summary

**PORTIA now has deterministic real-browser visitor, Promotion, settings, keyboard, accessibility and phone gates; privileged role lanes remain explicitly blocked without isolated staging.**

## Performance

- **Duration:** 47 min
- **Completed:** 2026-10-30T15:48:25+05:00
- **Tasks:** 3
- **Task commits:** 3

## Accomplishments

- Declared sanitized visitor, participant, editor, promotion-reviewer and owner actors with cleanup ownership and a production-denying target guard.
- Added fixed time, random seed, locale/settings preseed and reload-safe deterministic persistence.
- Added redacted diagnostics for console errors, page errors, failed requests, unexpected HTTP responses, hydration warnings and CSP violations.
- Stabilized only named Google/Roblox boundaries and proved that PORTIA `/api/**` routes cannot be fulfilled by fixtures.
- Added semantic Russian page objects and real journeys for desktop opening, global search, settings persistence, Promotion identity gate, visitor editor denial, keyboard operation and phone touch.
- Fixed the discovered serious Axe defect by giving the open-program taskbar container the correct toolbar role.
- Fixed the local production-runner/WebKit CSP conflict without changing deployed production hardening.

## Task Commits

1. **Task 1: Provision the non-production role fixture contract** — `a5935eb`
2. **Task 2: Implement deterministic, diagnostic and external-boundary fixtures** — `70b331a`
3. **Task 3: Add semantic page objects and representative requirement flows** — `b535d14`

## Browser Evidence

- Chromium desktop: **10 passed, 5 skipped**. Four privileged role decisions are `BLOCKED`; the phone-only test is intentionally skipped.
- WebKit phone visitor lane: **4 passed**.
- Diagnostics injection: all six diagnostic classes enter the redacted failure path.
- Axe: no critical or serious findings after the taskbar-role fix.
- Remaining current Axe inventory: `page-has-heading-one:moderate`, `region:moderate`.
- Unit suite: **594 passed, 1 skipped, 0 failed**.
- Lint: **0 errors, 18 pre-existing warnings**.

## Actor Coverage

| Actor | Status | Evidence |
|---|---|---|
| Visitor | PASS | Chromium desktop and WebKit phone real routes |
| Participant | BLOCKED | No approved isolated Supabase target |
| Editor | BLOCKED | No approved disposable editor identity |
| Promotion reviewer | BLOCKED | No approved disposable reviewer identity |
| Owner | BLOCKED | No approved disposable owner identity |

No role was faked through browser storage, cookies or client-only flags.

## Diagnostic Policy

The only allowed runtime events are the exact `GET /api/promotion/status -> 404` response and its browser console mirror for a first-visit unbound device. Rows are project-specific, owned by `promotion-api-contract`, mapped to `STAB-BASE-02` and expire on 2027-01-31. Every other event fails and emits a redacted JSON attachment.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Determinism reset saved settings on every navigation**
   - Changed the init script to preseed only when the settings key is absent.
   - Verified real reload persistence in Chromium and WebKit.

2. **[Rule 1 - Bug] Taskbar ARIA label was prohibited on a roleless div**
   - Added `role="toolbar"` without visual change.
   - Verified the serious Axe fingerprint disappeared.

3. **[Rule 3 - Blocking] Production CSP upgraded local WebKit resources to unavailable HTTPS**
   - Added `PORTIA_E2E_ALLOW_HTTP=1` only to the Playwright web-server environment.
   - Production builds outside that harness still emit `upgrade-insecure-requests`.

4. **[Rule 1 - Bug] Expected Promotion 404 was indistinguishable after URL redaction**
   - Diagnostics now retain only safe same-origin paths/statuses and use exact expiring rows.
   - Secret-bearing and external URLs remain redacted.

## Open Gates

- `STAB-BASE-02` is not complete: participant/editor/reviewer/owner decisions require an isolated non-production Supabase target and disposable identities.
- Physical owner devices are not substituted by emulation and remain a Phase 22 gate.

## Next Plan Readiness

Plan 15-04 can capture sanitized deterministic candidates from the passing visitor lanes. Privileged editor and Promotion states must be represented as explicit `BLOCKED` rows until staging is provisioned.

---
*Phase: 15-baseline*
*Completed: 2026-10-30*
