---
phase: PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh
plan: 03
subsystem: review-ledger
tags: [triage, tdd, quests, docs]
requires: []
provides:
  - markQuestsSeen keeps seen ids a stale tab does not list, capped at 200
  - 03.2-REVIEW-DISPOSITION.md (10 rows, open 8)
affects: [06-04]
key-files:
  created:
    - .planning/milestones/v1.0-phases/PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW-DISPOSITION.md
  modified:
    - lib/broadcasts.ts
    - lib/broadcasts.test.ts
decisions:
  - "D-07 used: previous-pass 03.2 WR-03 (markQuestsSeen pruning) was NOT fixed at HEAD although research FEATURES.md:14 called it fixed; fixed with the cap option so components/portia-desktop.tsx stays untouched"
  - "03.2-IN-03 stays open as a whole: the owner-decision half is resolved (03.2-07), the CSS comment half at app/portia.css:475 remains and has no v1.1 requirement"
metrics:
  tasks: 2
  files: 3
status: complete
requirements: [TRIAGE-01]
actuals:
  tokens: 4500
  tasks: 2
  commits: 3
plan_head_before: 99a5a96c4c1c917fd8f0001fe627fe5b13852034
plan_head_after: d87d2b838e8d99b5b9249ccaba37af19bb86e949
---

# Phase 6 Plan 03: 03.2 findings and markQuestsSeen fix Summary

A stale tab no longer drops a seen quest id from storage (markQuestsSeen keeps every stored id, capped at 200, active quests always kept), and the 03.2 review now has a ledger with 10 rows, open 8.

## Results

- Task 1 (TDD, D-07): RED commit 33c31da (stale-tab test, 200-cap test, the test that pinned pruning renamed and flipped; 3 failing). GREEN commit 239431c: `markQuestsSeen` returns `[...seen, ...active]` deduped, dropping the oldest non-active ids past `SEEN_QUEST_LIMIT = 200`. Storage key, format and signature unchanged; `components/portia-desktop.tsx` unchanged (`git diff 7d53afd` empty). `npm test`: 204 pass, 0 fail. `npx tsc --noEmit`: clean.
- Task 2: commit d87d2b8 creates the 03.2 ledger via the 05 format. Checker prints `OK ... open=8 total=10`. WR-03-prev `fixed in 239431c`; IN-02 `skipped` (`cache purge failed` at lib/portia-cdn.ts:25); IN-03 `open` with a progress note (03.2-07 owner decision resolved, app/portia.css:475 comment still open); current WR-03 untouched (`open`, `-`).

## Deviations from Plan

- The fix commit is the GREEN commit 239431c (TDD split: RED 33c31da separately), so the ledger cites 239431c.
- Shortcut: with more than 200 simultaneously active quests the result exceeds the cap (comment in code); the plan's "at most 200" holds for any realistic count.

## Threat Flags

None. T-06-05 mitigated by the cap test.

## Known Stubs

None.

## Self-Check: PASSED

- lib/broadcasts.ts, lib/broadcasts.test.ts, 03.2-REVIEW-DISPOSITION.md exist; commits 33c31da, 239431c, d87d2b8 are on HEAD.
