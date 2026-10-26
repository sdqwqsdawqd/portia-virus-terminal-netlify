---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
verified: 2026-10-26T15:00:00Z
status: passed
score: 9/9 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-01-PLAN.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-01-SUMMARY.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-02-PLAN.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-02-SUMMARY.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-03-PLAN.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-03-SUMMARY.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-04-PLAN.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-04-SUMMARY.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-05-PLAN.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-05-SUMMARY.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-06-PLAN.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-06-SUMMARY.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-07-PLAN.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-07-SUMMARY.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-08-PLAN.md"
  - ".planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-08-SUMMARY.md"
  - "app/portia.css"
  - "components/portia-desktop.tsx"
  - "components/portia-editor.tsx"
  - "lib/accent-theme.test.ts"
  - "lib/editor-history.ts"
  - "lib/format-fragments.test.ts"
  - "lib/format-fragments.ts"
  - "lib/panel-position.ts"
  - "lib/portia-content-normalize.ts"
  - "lib/portia-desktop.test.ts"
  - "lib/rich-text-style.test.ts"
  - "lib/rich-text-style.ts"
covered_digest: "v3:sha256:3931bcf5462075640db980b2112acbcd3390ee839944fb6d001da2a6f4626e26"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "11-06 prohibition: applying a style to several fragments never styles characters outside the fragments or fields that hold none (CR-01, WR-01, WR-02, archived-virus mutation delete)"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-03: key={formatTarget.key} remounts the panel on every field change (phone sheet re-expands)"
    category: other
    reason: "Open in the disposition ledger, outside the verification gaps; owner approved phone behaviour in 11-07. Would resolve with a keyed-state fix."
    evidence_status: "none provided"
  - finding: "IN-03 (re-review IN-01): fold predicate reads the DOM inside a setFormatTarget updater"
    category: other
    reason: "Works today (updater runs before the commit). Only at risk under a future concurrent rebase. Fix: compute gone keys eagerly."
    evidence_status: "none provided"
  - finding: "IN-04 (re-review IN-02): a peer still commits its snapshot value; the sync effect does not clear formatTarget"
    category: other
    reason: "Narrow: needs a non-dirty draft replaced by a save or remote change while a target is open. The main target had the same exposure before 11-08."
    evidence_status: "none provided"
---

# Phase 11: Редактор: панель оформления и тексты — Verification Report

**Phase Goal:** Панель оформления текста надёжна на телефоне и на светлом поле, свободно двигается по рабочему столу и красит сразу несколько выделений; по редактору с большим числом разделов легко перемещаться; в редакторе нет шуточных надписей, а тесты охраняют правила панели
**Verified:** 2026-10-26
**Status:** passed
**Re-verification:** Yes — after gap closure 11-08

## Verdict

The one gap from the earlier report (CR-01 plus WR-01 and WR-02, the multi-field format target not kept in step with the draft) is closed. I confirmed it in the code, with a mutation check on the unit test, and by running the browser harness myself against the current production build. The seven other roadmap criteria were not re-derived. I did a regression check on them, and the only source files changed since the previous report are `components/portia-editor.tsx`, `lib/format-fragments.ts` and its test (`git diff 0e03632..HEAD`). The roadmap's «tests guard the panel rules» claim now covers this path as well.

## Gap closure (what I checked myself)

| Claim in 11-08 / re-review | Evidence I gathered | Result |
|---|---|---|
| `dropFields` prunes gone peers and fragments (CR-01) | `lib/format-fragments.ts:33-42`: null when the target key is gone, filtered `fragments` and `peers` otherwise, same object when nothing is gone. Mutation: I replaced the `peers` filter with `peers: target.peers`; `format-fragments.test.ts` failed «a gone peer leaves with its fragments». File restored (`git diff` empty, 17/17 pass again). | VERIFIED |
| Deletes route through it (CR-01) | `closeFormatterFor(...keys)` → `dropFormatFields` → `setFormatTarget((prev) => prev && dropFields(prev, gone))` (`portia-editor.tsx:871-876`). Section delete at :1268 passes the section key plus every block key of every subsection; subsection, block and broadcast deletes at :1275, :1281, :1356. | VERIFIED |
| Archived-virus mutation delete clears the target | `portia-editor.tsx:1431`: `setFormatTarget(null); setFormatterOpen(false);` before `changeDraft`, same as the live delete at :1230. Defensive only (the archived editor renders a plain textarea), so source check only. | VERIFIED |
| Ctrl/Cmd text edits end the additive gesture (WR-01) | `commitEditorValue` (:2154) calls `startGesture(false)` before `onActivate`; `joinFormatTarget` returns the bare target for a non-additive gesture, so `fragments` and `peers` reset. Panel commits do not pass through this function. Harness step (c) uses real Ctrl+Backspace. | VERIFIED |
| Folding releases fragments inside the card (WR-02) | `toggleCard` (:713) and `setAllOpen` (:891) call `dropFormatFields` with a body predicate. Harness step (d). | VERIFIED |
| `npm test` 335/335, `tsc` clean | I ran both: 335 pass, 0 fail; `npx tsc --noEmit` exit 0. | VERIFIED |
| Harness `peers` (a)-(d) passes, and `all` stays green | I started `next start -p 3124` on the existing production build (`.next/BUILD_ID` newer than the last editor edit) and ran `11-editor-check.mjs --check peers`, `--check multiselect` and `--check all` (mark, panel, savechip, sections, table, multiselect, peers, phonefit): all `ok: true`, `reasons: []`. Server stopped afterwards. The check drives real mouse clicks and a real Ctrl press, blocks every non-GET to `/api/*` and checks the PUT body of the fake save for orphan `formattedText` keys, so the CR-01 symptom (a saved orphan) is asserted directly. | VERIFIED |

I did not re-run the harness against the pre-fix code, so «each step was seen failing before its fix» (11-08 SUMMARY) rests on the executor's word. The unit-test mutation above is my independent proof that the test is not vacuous.

## Goal Achievement

### Observable Truths (ROADMAP success criteria and plan must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Phone ГОТОВО with no known selection does not put the caret at 0; next ✎ says «ВЫДЕЛИТЕ ТЕКСТ» (EDIT-01) | ✓ VERIFIED | Unchanged since previous report; `finish()` in `portia-editor.tsx` returns before `field.focus()` when no selection; owner confirmed on iPhone (11-07). Not unit-testable (browser only). |
| 2 | Teal mark visible on light and dark fields, >= 3:1, underline with no fill (EDIT-02) | ✓ VERIFIED | `app/portia.css` `::highlight(portia-format) { text-decoration: underline solid oklch(.57 ...) 3px; }`, no background; accent-theme sweep test passes in the 335. Harness `mark` ok. |
| 3 | No joking or empty labels (A11Y-03) | ✓ VERIFIED | `grep фигни/дружок/пирожок components lib app`: no hits. Guard test in `lib/portia-desktop.test.ts` passes. |
| 4 | Tests fail if the highlight rule gets a fill or the own-input boundary moves; rich-text-style imports merged (TEST-02) | ✓ VERIFIED | Mutation-checked in the previous round; today exactly 1 `from "@/lib/rich-text-style"` in the editor; tests green. |
| 5 | Sections fold, quick jump, easy reorder (EDIT-03) | ✓ VERIFIED | `EditorToc`, `aria-expanded` cards, fold-all; harness `sections` and `phonefit` ok. Folding now also releases peers (WR-02). |
| 6 | Free-window panel across the desktop; compact «НЕ СОХРАНЕНО» chip (EDIT-04, EDIT-05) | ✓ VERIFIED | Portal into `#desktop`, `lib/panel-position.ts` tests, `editor-save-chip`; harness `panel` and `savechip` ok. |
| 7 | Ctrl selects several fragments and a style applies to all (EDIT-06) | ✓ VERIFIED | `joinFormatTarget`, `applyOp` batch; harness `multiselect` ok; `peers` ok; `format-fragments.test.ts` 17/17. The lifecycle holes of the earlier report are closed. |
| 8 | Table rows reorder, columns swap, order persists (EDIT-07) | ✓ VERIFIED | Row ids in `portia-content-normalize.ts` with tests; `OrderDragHandle` / `ColumnSwapHandle`; harness `table` ok; owner confirmed. Row-move logic has no unit test, only harness and owner. |
| 9 | 11-06 prohibition: a style never touches characters outside the fragments or fields holding none, also after a peer is deleted, edited with Ctrl or folded (test-tier) | ✓ VERIFIED | Now enforced: unit test «a gone peer leaves with its fragments» (mutation-proven) and harness `peers` (a)-(d) (green). No longer an unenforced test-tier claim. |

**Score:** 9/9 truths verified, 0 behavior-unverified.

Reliance check: the harness steps use the fixture only for input the real editor also supplies; no coincidental reliance flagged.

### Requirements Coverage

Every ID in the plan frontmatter maps to REQUIREMENTS.md, all marked `[x]` and `Complete` for Phase 11. No orphaned IDs: REQUIREMENTS.md lists exactly these nine for Phase 11.

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| EDIT-01 | 11-01, 11-07 | ✓ SATISFIED | Truth 1 |
| EDIT-02 | 11-01, 11-07 | ✓ SATISFIED | Truth 2 |
| A11Y-03 | 11-01 | ✓ SATISFIED | Truth 3 |
| TEST-02 | 11-01, 11-08 | ✓ SATISFIED | Truths 4, 9 |
| EDIT-03 | 11-04, 11-07, 11-08 | ✓ SATISFIED | Truth 5 |
| EDIT-04 | 11-02, 11-07 | ✓ SATISFIED | Truth 6 |
| EDIT-05 | 11-03, 11-07 | ✓ SATISFIED | Truth 6 |
| EDIT-06 | 11-06, 11-07, 11-08 | ✓ SATISFIED | Truths 7, 9 |
| EDIT-07 | 11-05, 11-07 | ✓ SATISFIED | Truth 8 |

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` in `components/portia-editor.tsx` or `lib/format-fragments.ts`. No stubs in the changed code.

### Advisory (open, not blocking)

Carried in frontmatter `advisory:` and in the ledger `11-REVIEW-DISPOSITION.md` (5 open: WR-03, IN-01, IN-02, IN-03, IN-04). None sits in the earlier `gaps:` and none contradicts a roadmap criterion. The two worth a later look:

- IN-04: after a save or remote refresh replaces a non-dirty draft, an open target or peer can write its older text back. Narrow; the main target had the same exposure before 11-08.
- WR-03: the panel remounts when the target key changes, so the phone sheet re-expands. The owner accepted the phone behaviour in 11-07.

### Human Verification Required

None new. The owner approved PC and phone behaviour in 11-07; the 11-08 change touched only lifecycle state, and the harness exercises it with real input events in headless Edge. A real iPhone re-check of the Ctrl path is not meaningful (no Ctrl on a phone).

---

_Verified: 2026-10-26_
_Verifier: Claude (gsd-verifier)_
