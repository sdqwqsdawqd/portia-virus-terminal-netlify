# Research Summary

**Milestone:** v1.2 «Повышение»
**Researched:** 2026-10-27
**Confidence:** HIGH

## Executive Summary

«Повышение» should be built as two separate server-authoritative workflows: ordinary promotion assignments and qualification tests. They share nickname eligibility, permissions, cooldown helpers and compact result history, but must not share one state model or active table. The current Next.js + Supabase stack is sufficient; no new runtime dependency is justified.

## Recommended Direction

### Stack

- Keep Next.js 16.4.2, React 19 and the existing Supabase client/RLS conventions.
- Read Google Sheet `Portia!A61:E85` through a dedicated read-only parser.
- Use server timestamps for cooldowns and question deadlines.
- Use node:test for domain transitions and CDP plus owner UAT for desktop/mobile browser behavior.

### Architecture

1. Add independent promotion domain modules rather than extending `portia_content`.
2. Store configuration/banks separately from active workflows and compact results.
3. Make all irreversible transitions idempotent and validate persisted state plus fresh sheet eligibility.
4. Add `promo` as a trusted editor tab; every reviewer endpoint enforces it.
5. Serve current test questions one at a time and never expose correct/future answers publicly.
6. Close workflows transactionally: create/trim short result, then remove detailed active data.

### Feature Table Stakes

- Nickname validation and one active request.
- Separate promotion and qualification branches.
- Banks per title/rank transition.
- Manual/random assignment with preview.
- Three question types, one-minute server deadline and forward-only runner.
- Manual answer marking and final decision.
- Promotion cooldowns, editable two-day retake default and ready notification.
- Three-result history and three-day stale cleanup.
- Trusted-tab permissions and server enforcement.

## Highest Risks

1. Client-authoritative timers.
2. Correct-answer or future-question leakage.
3. Duplicate active requests under concurrency.
4. Stale Google Sheet eligibility at later transitions.
5. False confidence or false positives in desktop focus protection.
6. Losing the compact result during cleanup.
7. Accidentally mixing ordinary assignments with tests.

## Roadmap Implications

Recommended phase order continuing after Phase 13:

- **Phase 14:** domain contracts, schema, RLS, permissions and sheet reader.
- **Phase 15:** public request/status and reviewer queues/banks.
- **Phase 16:** ordinary promotion assignment workflow.
- **Phase 17:** qualification test runner and PC focus protection.
- **Phase 18:** manual grading, retakes, notifications, history and cleanup.
- **Phase 19:** integration, security and owner verification on PC/phone.

## Scope Boundaries

Keep outside v1.2:

- unified application-system redesign;
- writing to Google Sheets;
- upload of evidence;
- automatic pass/fail thresholds;
- revealing exact mistakes;
- external Discord/email/push notifications;
- complete prevention of OS-level cheating.

## Conclusion

The feature is feasible inside the existing architecture without new dependencies. Quality depends less on UI complexity than on explicit state transitions, server-controlled time, strict public DTOs, trusted permissions and transactional cleanup.

---
*Research summary for: PORTIA v1.2 «Повышение»*
*Researched: 2026-10-27*

