# Pitfalls Research

**Domain:** promotion workflows and timed qualification tests
**Researched:** 2026-10-27
**Confidence:** HIGH

## Critical Pitfalls

### 1. Client-authoritative time

**What goes wrong:** cooldown or one-minute deadline is bypassed by changing the clock, pausing JavaScript or restoring an old tab.
**Avoid:** persist server timestamps; every write endpoint rechecks deadline using server time. The client timer is display only.
**Warning signs:** API accepts `remainingMs` or a client-provided completion time.
**Phase:** domain/API foundation.

### 2. Leaking the answer bank

**What goes wrong:** public test payload contains correct answers or future questions; DevTools exposes the bank.
**Avoid:** return only the current question without correctness metadata; grade/review data only through trusted API.
**Warning signs:** one response downloads the full attempt or correct option IDs.
**Phase:** test runner.

### 3. Mixing assignments and qualification attempts

**What goes wrong:** cleanup deletes the wrong data, ordinary tasks inherit test deadlines, statuses become contradictory.
**Avoid:** separate types, tables and transition functions; share only identity/cooldown helpers.
**Warning signs:** one status enum has branches used by only half the records.
**Phase:** schema foundation.

### 4. UI-only one-active-request rule

**What goes wrong:** double-clicks, tabs or concurrent devices create duplicates.
**Avoid:** database unique constraint/index for active nickname/workflow plus idempotent route.
**Warning signs:** duplicate prevention is a React disabled flag.
**Phase:** schema/API foundation.

### 5. False anti-cheat promises

**What goes wrong:** blur fires from browser chrome, permission dialog or mobile behavior; users fail unfairly, while OS-level capture remains possible.
**Avoid:** apply only on identified desktop mode, explain behavior before start, combine visibility/pagehide/focus conservatively, make reviewer able to inspect reason and set outcome. Do not claim complete prevention.
**Warning signs:** `window.blur` alone immediately mutates UI without server transition.
**Phase:** qualification runner and UAT.

### 6. Stale Google Sheet decisions

**What goes wrong:** title changes after request but old workflow still grants tasks or starts a test.
**Avoid:** snapshot eligibility for display, but re-read A61:E85 at irreversible transitions; require expected current title.
**Warning signs:** sheet read happens only when the initial request is created.
**Phase:** eligibility and transition APIs.

### 7. Cleanup without audit-safe result

**What goes wrong:** detailed rows are deleted before a short result is committed, losing retake date and outcome.
**Avoid:** one transaction: append/trim result then delete active details.
**Warning signs:** cleanup uses independent requests or browser callbacks.
**Phase:** closure/cleanup.

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Public status returns answers/banks/reviewer identity | Privacy and test leakage | Explicit public DTO allowlist |
| Reviewer route checks canEdit but not promo tab | Any editor can grade | Require trusted `promo` in openTabs |
| RLS trusts email alone | Revoked access persists | Reuse confirmed-email/tab functions |
| Nickname normalization differs between sheet and DB | Duplicate workflows/impersonation confusion | One canonical normalization, preserve display spelling |
| Correct answers changed during an active test | Attempt becomes ungradeable | Snapshot question and grading key at test start |

## UX Pitfalls

| Pitfall | Better Approach |
|---------|-----------------|
| One screen mixes requests, task bank and active grading | Separate branches with counts and clear state |
| Random tasks are assigned before reviewer sees them | Preview, then explicit confirmation |
| Countdown ends but UI stays blocked | Server-derived eligibility plus quest-style ready notice |
| Test reload looks like a fresh start | Resume active attempt or show closed result |
| Failure reveals incorrect questions | Show only outcome and optional percentage |
| Cleanup surprises reviewer | Quiet 3-day hint beside affected queue, not a warning banner |

## “Looks Done But Isn’t” Checklist

- [ ] Two simultaneous request calls cannot create two active rows.
- [ ] Changing local clock does not alter cooldown/deadline.
- [ ] Public network responses never contain correct answers or future questions.
- [ ] Refresh resumes the same question and does not reset one minute.
- [ ] Desktop focus loss closes the server attempt; phone does not.
- [ ] Reviewer can change the default two-day retake date.
- [ ] Promotion cooldown and qualification retake are independent.
- [ ] Random preview does not freeze until confirmation.
- [ ] Sheet title is rechecked before assignment/test start/closure.
- [ ] Closing is transactional and leaves at most three short results.
- [ ] Stale active data is removed after three days with a visible quiet hint.
- [ ] Revoked promo permission blocks both UI and direct API calls.

## Pitfall-to-Phase Mapping

| Pitfall | Prevention |
|---------|------------|
| State/time/concurrency | Foundation schema and pure policy tests |
| Sheet staleness | Eligibility API and irreversible-transition checks |
| Answer leakage | Qualification runner API contract tests |
| Focus false positives | Dedicated PC/phone browser verification |
| Cleanup loss | Transactional close and retention tests |

## Sources

- Existing PORTIA data-loss postmortems and Phase 7–12 patterns
- Browser platform constraints already documented for iframe/focus behavior
- Owner-approved workflow and retention decisions

---
*Pitfalls research for: PORTIA v1.2 «Повышение»*
*Researched: 2026-10-27*

