---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 11
subsystem: visual-approval
tags: [owner-verdict, visual-approval-ledger, fail-closed-validation, spider, flasks, class-icons, d-19, d-26, d-39, d-45]
requires:
  - phase: PORTIA-20
    provides: 20-03/04/05/06/20 candidate captures, 20-29 refreshed candidate set on HEAD 0929a084, 20-07 contrast defect pinned
provides:
  - "20-VISUAL-APPROVAL.md: owner verdict per candidate row (79 accepted with date and exact SHA256, 4 sent back for fixes, BLOCKED rows left BLOCKED), section 7 owner answers"
  - "lib/phase20-visual-approval.test.ts: fail-closed ledger validation; PORTIA_REQUIRE_APPROVAL=1 rejects unapproved, stale, fix-requested and hash-mismatched rows"
affects: [20-12, 20-13, 20-14, 19-21, STAB-VIS-01, STAB-VIS-02, STAB-VIS-03, STAB-VIS-04, STAB-REL-08]
status: complete-with-open-followups
actuals:
  tokens: 83000
  tasks: 2
  commits: 3
commits: 3
plan_head_before: a8738fbda23e59efdd75ed5f63640805891e1f19
plan_head_after: 0a2e1fe3d1400d20621290c305f4a86956ce61bb
tech-stack:
  added: []
  patterns:
    - "Owner verdict recorded in the ledger itself (verdict, date, accepted hash = candidate SHA256 verbatim); strict mode fails closed on any row that is not an exact positive verdict"
key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-VISUAL-APPROVAL.md
    - lib/phase20-visual-approval.test.ts
  modified: []
key-decisions:
  - "Owner accepted 79 candidate rows and sent 4 back for fixes (spider on custom accent #1a1a1a, PC and phone; class icon Transitium, PC and phone). The 4 rows stay rejected; a rejected row blocks 20-12 for its own surface."
  - "Strict gate (PORTIA_REQUIRE_APPROVAL=1) fails by design on exactly those 4 fix rows. The test was not weakened and the owner verdicts were not flipped."
  - "D-10 contrast (Архив, Глобальный поиск, Корзина small labels) is to be fixed now in 20-12/20-13, raised to at least 4.5:1, with the affected approved frames re-shot. 20-12 tasks do not cover this yet."
  - "Flask durations 6.8 / 8.9 / 11.3 / 7.7 s: owner undecided; candidate values kept, final call deferred to physical UAT 20-14. Static flask frames accepted."
requirements-completed: []
requirements-partial:
  - "STAB-VIS-01, STAB-VIS-02, STAB-VIS-03, STAB-VIS-04, STAB-REL-08: owner verdicts recorded for the surfaces that could be shown, but 4 rows need fixes and Promotion participant cards and reviewer view remain BLOCKED. None is marked Complete by this plan; they stay Pending."
coverage:
  - id: C1
    description: "Ledger of all visual candidates (spider and web by accent and state, flasks, two empty-state SVGs, nine class icons, spider-rest-sharp, Promotion participant and reviewer, rebaseline-* rows) with exact SHA256 and old/new comparisons"
    requirement: STAB-VIS-01
    verification:
      - kind: unit
        ref: "node --experimental-strip-types --test lib/phase20-visual-approval.test.ts"
        status: pass
    human_judgment: false
  - id: C2
    description: "Owner verdict on each exact candidate row: accepted rows carry date and the exact candidate hash; fix rows block 20-12 for their surface"
    requirement: STAB-VIS-03
    verification:
      - kind: unit
        ref: "PORTIA_REQUIRE_APPROVAL=1 node --experimental-strip-types --test lib/phase20-visual-approval.test.ts (fails only on the 4 fix rows)"
        status: fail
    human_judgment: true
    rationale: "Aesthetic acceptance is the owner's decision (D-19); automation cannot replace it. The strict gate stays red until the 4 fixed frames are re-shot and re-approved."
duration: owner-gated (Task 1 on 2026-11-04, verdict and close-out on 2026-11-05)
completed: 2026-11-05
---

# Phase 20 Plan 11: Owner visual approval Summary

**Owner verdicts recorded in the visual approval ledger: 79 exact candidate rows accepted with their SHA256, 4 sent back for fixes (spider on the dark custom accent, Transitium icon), and the strict approval gate honestly red on exactly those 4 rows.**

## Performance

- **Tasks:** 2 of 2 (Task 1 auto, Task 2 checkpoint:human-verify resolved by the owner)
- **Commits:** b1d2499 (Task 1), 0a2e1fe (Task 2 verdict), plus this summary commit
- **Completed:** 2026-11-05

## Accomplishments

- Task 1 (b1d2499): ledger `20-VISUAL-APPROVAL.md` with every surface, state, device and exact SHA256, and `lib/phase20-visual-approval.test.ts` that fails closed on missing rows (spider accent-default, accent-custom-dark, accent-custom-light, spider-off, spider-rest-sharp, nine class-icon-* rows).
- Task 2 (0a2e1fe): owner verdicts written into the ledger. Frontmatter status is `owner-verdict-recorded`. The approved baseline in `tests/e2e/visual/__screenshots__` was not touched.
- 79 captured rows: `принято`, date 2026-11-05, accepted hash equal to the row's candidate SHA256 verbatim.
- BLOCKED rows (DATA, ENV, CAPTURE) stay BLOCKED and are not counted as approval.

### Owner answers to section 7 questions

| Question | Answer |
|---|---|
| q-spider-shape | Keep as is |
| q-spider-dark-legibility | No, spider is unreadable on #1a1a1a: fix (light outline or rim) |
| q-flasks-durations | Undecided; candidate values kept; deferred to physical UAT 20-14. Static flask frames accepted |
| q-flasks-phone-crop | Accept |
| q-class-transitium-faint | Fix: raise right-half opacity to match the left half |
| q-class-phone-crop | Accept PC-only for Stabilar, Impulsar, Infernar |
| q-empty-info-flask | Yes, flask judged only in Summary -> News |
| q-promotion-participant-cards | Accept the entry only; cards stay BLOCKED and are carried forward |
| q-promotion-reviewer | Postponed to the role (19-21) |
| q-contrast-d10 | Fix now in 20-12/20-13 |
| q-rel-08 | Confirmed |

## Verification

| Check | Result |
|---|---|
| `node --experimental-strip-types --test lib/phase20-visual-approval.test.ts` | 20 tests, 19 pass, 0 fail, 1 skipped (the strict test) |
| `PORTIA_REQUIRE_APPROVAL=1 node --experimental-strip-types --test lib/phase20-visual-approval.test.ts` | 20 tests, 19 pass, 1 fail, exit 1 |

**Strict gate result, stated honestly: the strict gate FAILS, by design.** The single failing test is "every captured candidate has an exact positive owner verdict and every owner question an answer". It reports exactly four rows with `owner asked for a fix`: `spider-accent-custom-dark:pc`, `spider-accent-custom-dark:phone`, `class-icon-transitium:pc`, `class-icon-transitium:phone`. There is no stale-candidate failure and no hash mismatch. Per the ledger's own rule ("Отклонённая строка блокирует 20-12 для своей поверхности") this is the expected outcome of an owner rejection, not a defect. The test was not weakened and the owner verdicts were not flipped to make it green. The plan's acceptance criterion "every surface has a positive exact verdict" is therefore NOT met; the plan is closed because the owner decision is recorded, while the surfaces below remain open.

## Open follow-ups (NOT resolved by this plan)

- **(a) Spider on custom accent #1a1a1a.** Add a light outline or rim so the body is readable on the dark background (rows `spider-accent-custom-dark:pc` and `:phone`). The fix must be implemented, re-shot and re-approved by the owner. Blocks 20-12 baselines for the spider surface until then.
- **(b) Transitium icon right half.** Raise the opacity of the right half to match the left at 18 px (rows `class-icon-transitium:pc` and `:phone`). The fix must be implemented, re-shot and re-approved. Blocks 20-12 baselines for that class icon until then.
- **(c) D-10 contrast fix now, with a planning gap.** The owner decided to fix color-contrast of the small labels of Архив (`.browser-labels`, `.row-index`, `.row-main small`, `.browser-footer`, 2.2-4.4:1), Глобальный поиск (`.global-result-mark`, 4.46:1) and Корзина (`.trash-list-head`, 4.0:1) to at least 4.5:1 in 20-12/20-13 and re-shoot the affected approved frames. The tasks of 20-12 (spider and flask baselines, SVG and participant baselines, reviewer and class-icon baselines with the full visual gate) and 20-13 (strict release gate, rehearsal) do not currently cover this CSS change or the re-shoot. A gap or plan addition is needed before 20-12/20-13 run; otherwise the contrast fix has no owner and the axe color-contrast gate stays red.
- **(d) Flask durations deferred to 20-14.** 6.8 / 8.9 / 11.3 / 7.7 s remain candidate values with no approved budget; the owner will judge them in physical PC/phone UAT 20-14. Static flask frames are accepted.
- **(e) Promotion participant cards and reviewer view remain BLOCKED.** Participant cards need an isolated roster (BLOCKED DATA/ENV); the whole reviewer view needs the reviewer role (19-21). Their verdicts are carried forward and they are not approvals, not baselines.

Also still unproven and carried from the ledger section 9: authenticated roles, staging data and physical devices remain BLOCKED until their own phases prove them. Class icons Stabilar, Impulsar, Infernar are accepted on PC only.

## Deviations from Plan

None in implementation. Process note: the plan's Task 2 acceptance (positive verdict for every surface) could not be reached because the owner rejected four rows; per the plan's own `done` clause this is the "plan stopped for fixes" branch, so the plan is recorded complete with open follow-ups rather than with a green strict gate.

Commit accounting: the shared ledger file `.git/gsd-plan-head-before-PORTIA-20-11` records `a8738fb` as the base, but this plan ran interleaved with other 20-xx plans, so `git rev-list --count a8738fb..HEAD` is 69 and does not measure this plan. The `commits: 3` value counts the commits scoped to 20-11 (b1d2499, 0a2e1fe, and the summary commit); `plan_head_after` is the head of the verdict commit.

## Known Stubs

None. The ledger rows listed as BLOCKED are documented evidence gaps, not code stubs.

## Threat Flags

None. No new network endpoint, auth path or schema change; visual evidence contains no secrets and no production mutation (T-20-11 mitigated: owner, date and hash per candidate, fail-closed validation).

## Self-Check: PASSED

- `.planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-VISUAL-APPROVAL.md` found.
- `lib/phase20-visual-approval.test.ts` found.
- Commits b1d2499 and 0a2e1fe are ancestors of HEAD.
