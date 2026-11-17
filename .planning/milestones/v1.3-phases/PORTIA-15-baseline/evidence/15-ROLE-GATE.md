---
phase: 15-baseline
plan: 15-07
status: PARTIAL / BLOCKED
captured: 2026-10-31
mode: local-read-only
---

# Phase 15 role gate

## Result

The Chromium desktop role lane completed with retries disabled:

- 2 executed and passed: visitor denial and privileged-role blocker inventory.
- 4 explicitly skipped as BLOCKED: participant, editor, promo-reviewer and owner.
- 0 privileged lanes reported as passed.
- 0 production mutations or remote actor provisioning actions attempted.

## Actor matrix

| Role | Result | Stable blocker | Evidence |
|---|---|---|---|
| visitor | EXECUTED / PASS | — | Real local page keeps the editor action disabled and routes sign-in to `/owner-login`. |
| participant | BLOCKED | `TARGET_NOT_ISOLATED` | No attested isolated target is available in this run. |
| editor | BLOCKED | `TARGET_NOT_ISOLATED` | No attested isolated target is available in this run. |
| promo-reviewer | BLOCKED | `TARGET_NOT_ISOLATED` | No attested isolated target is available in this run. |
| owner | BLOCKED | `TARGET_NOT_ISOLATED` | No attested isolated target is available in this run. |

If an isolated target declaration is supplied without matching server-derived role
proof, the stable blocker becomes `AUTHENTICATED_SESSION_UNPROVEN`; environment
strings alone cannot release a privileged lane.

## Open gate

CR-01 and `STAB-BASE-02` remain open. This read-only result proves fail-closed
accounting, not authenticated role behavior.

Phase 16 may recover these rows only after all of the following exist on an
isolated target:

1. immutable target attestation that excludes production identity;
2. a server-derived session proof matching the requested role;
3. positive and negative authorization decisions from the real server boundary;
4. an idempotent cleanup receipt for disposable identities and namespaced data.

Production mutation is not authorized. This evidence intentionally contains no
target identifier, credential, account identity, cookie or authorization header.

## Phase 16 recovery (Plan 15-20)

Четыре условия из «Open gate» доказаны Phase 16 на изолированной цели: см. `16-LIVE-RUN.md`, раздел «Привилегированные lanes и API (G1)». Lanes participant, editor, promo-reviewer и owner дали PASS в 5 проектах; `receipt-playwright.json` имеет status PASS с residual 0. Сверка: `15-GAP-RECONCILIATION.md`.

Результат 2026-10-31 выше остаётся исторической записью. Это evidence по-прежнему не содержит идентификаторов цели, учётных данных, аккаунтов, cookie и заголовков авторизации.
