---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
verified: 2026-10-26T12:00:00Z
status: gaps_found
score: 8/9 must-haves verified
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
  - "app/portia.css"
  - "components/portia-desktop.tsx"
  - "components/portia-editor.tsx"
  - "lib/accent-theme.test.ts"
  - "lib/editor-history.ts"
  - "lib/format-fragments.ts"
  - "lib/panel-position.ts"
  - "lib/portia-content-normalize.ts"
  - "lib/portia-desktop.test.ts"
  - "lib/rich-text-style.test.ts"
  - "lib/rich-text-style.ts"
covered_digest: "v3:sha256:d44c359247d782c73dae0d486b26eae739b6038652d10cbcc229011aea28e414"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "11-06 prohibition: applying a style to several fragments never styles characters outside the fragments or fields that hold none (test-tier, claimed resolved)"
    status: partial
    reason: "Open review findings CR-01, WR-01, WR-02 (11-REVIEW.md, disposition all `open`) are confirmed in the code: the multi-field target (`peers`/`fragments`) is not kept in step with the draft. No test or harness check covers these paths, so the test-tier prohibition has no enforcement for them."
    artifacts:
      - path: "components/portia-editor.tsx"
        issue: "closeFormatterFor (~873) closes only when formatTarget.key === key; a deleted item that is held only as a peer stays in peers/fragments, and the next style click runs peer.onCommit(peer.value, next), writing an orphan formattedText[key] (normalizeFormattedText does not prune orphans, so it is saved and marks the draft dirty)"
      - path: "components/portia-editor.tsx"
        issue: "onKeyDown (~2194) ends the additive gesture only when !ctrlKey && !metaKey, so Ctrl+X / Ctrl+V / Ctrl+Backspace leave fragments with stale offsets (WR-01)"
      - path: "components/portia-editor.tsx"
        issue: "toggleCard (~301) and setAllOpen (~351) test only formatTarget.key against the collapsed body; peers inside a folded card stay selected and styled (WR-02)"
    missing:
      - "Prune peers/fragments in closeFormatterFor for a deleted key (fix proposed in 11-REVIEW.md CR-01)"
      - "Clear the target (or drop peers) in the recycled-virus onRemoveMutation path (~1431), which, unlike the main mutation delete at ~1231, does not call setFormatTarget(null)"
      - "End the additive gesture on Ctrl/Cmd+X, V, Backspace, Delete (WR-01); drop peers inside a folded body (WR-02)"
      - "A test or harness step that deletes a peer's field and then clicks a style"
---

# Phase 11: Редактор: панель оформления и тексты — Verification Report

**Phase Goal:** Панель оформления текста надёжна на телефоне и на светлом поле, свободно двигается по рабочему столу и красит сразу несколько выделений; по редактору с большим числом разделов легко перемещаться; в редакторе нет шуточных надписей, а тесты охраняют правила панели
**Verified:** 2026-10-26
**Status:** gaps_found
**Re-verification:** No — initial verification

## Verdict in one paragraph

All eight ROADMAP success criteria hold on the evidence I could check myself, and the owner approved the phone and PC behaviour on real devices (PC Firefox, iPhone Firefox and WebKit). `npm test` 332/332 and `tsc --noEmit` clean (run by me). One thing is not clean: the open critical code-review finding CR-01 (plus WR-01, WR-02) is real in the code. It does not make the roadmap criterion «С Ctrl выделяется несколько фрагментов, и оформление применяется ко всем сразу» false, so EDIT-06 as a feature works. It does break the plan 11-06 safety prohibition (a style click must never touch fields that hold no fragment), and nothing tests that path. I therefore record one narrow gap instead of `passed`. Judgement on CR-01 is below.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Phone ГОТОВО with no known selection does not put the caret at 0; next ✎ says «ВЫДЕЛИТЕ ТЕКСТ» (EDIT-01) | ✓ VERIFIED | `finish()` in `portia-editor.tsx:2323-2331` returns before `field.focus()` when `!target.selection`; label branch `!range -> "ВЫДЕЛИТЕ ТЕКСТ"` at ~2336. Owner confirmed on iPhone (11-07). Not unit-tested (browser-only); evidence is code + owner. |
| 2 | Teal mark visible on light field (>=3:1) and on dark (EDIT-02) | ✓ VERIFIED | `app/portia.css:531` single rule: underline, oklch(.57 ...), no background. Test "the format mark is an underline with no fill and keeps 3:1 on every preview field" sweeps 24 hues x 3 strengths over >=5 light and >=2 dark fields. Owner confirmed on PC and phone. |
| 3 | No joking or empty labels (A11Y-03) | ✓ VERIFIED | `grep фигни/дружок/пирожок components lib app` returns nothing; GIF hint at `portia-editor.tsx:2229` is neutral; test in `lib/portia-desktop.test.ts:92` guards the words and empty `<small>`. |
| 4 | `npm test` fails if `::highlight(portia-format)` gets a fill or the own-input boundary moves; rich-text-style imports merged (TEST-02) | ✓ VERIFIED | Mutation-checked by me: adding `background: red` to the rule fails the accent-theme test; changing `ownInputGraceMs` 400 -> 450 fails "the own-input window closes exactly 400 ms after up". Both restored (`git diff` on those files empty). Exactly 1 `from "@/lib/rich-text-style"` in the editor, counted by a test. |
| 5 | Sections fold/unfold, quick jump (TOC), reorder easy with many sections (EDIT-03) | ✓ VERIFIED | `EditorToc` (`portia-editor.tsx:555`) used for info, virus, broadcast and recycle lists; `aria-expanded` toggles on cards; СВЕРНУТЬ ВСЕ/РАЗВЕРНУТЬ ВСЕ. Owner confirmed on PC and phone after two fix rounds; phone-fit checks in `11-editor-check.mjs` and `11-engines-check.mjs` exist. No unit tests (UI only). |
| 6 | Format panel is a free window across the desktop; compact «НЕ СОХРАНЕНО» chip (EDIT-04, EDIT-05) | ✓ VERIFIED | `createPortal(<FloatingTextFormatPanel .../>, #desktop)` at `portia-editor.tsx:1546`, hidden when `minimized`; `lib/panel-position.ts` + 28 tests across panel-position/format-fragments pin limits; chip `editor-save-chip` at ~1550 with aria-expanded and popover. Owner confirmed on PC and phone. |
| 7 | With Ctrl several fragments are selected and the chosen style applies to all (EDIT-06) | ✓ VERIFIED (with gap below) | `joinFormatTarget`, `applyOp` batch over `set` (`portia-editor.tsx:598-617, 2349-2380`), `mergeFragments`/`pickCurrentRange` unit-tested in `format-fragments.test.ts`; owner confirmed on PC Firefox; Playwright Firefox `--check ctrl` reported ok by the executor (not re-run by me). The happy path works. The lifecycle holes are CR-01/WR-01/WR-02, see Gaps. |
| 8 | Table rows reorder, columns swap, order persists (EDIT-07) | ✓ VERIFIED | Row `id` added in `lib/portia-content-normalize.ts` (tests at `portia-content-normalize.test.ts:150`, positional ids and repeats); `OrderDragHandle` per row at `portia-editor.tsx:1298`, `ColumnSwapHandle` x2 at 1291-1292 swapping `key`/`value` in all rows; `+ СТРОКА` creates `makeId("row")`. Owner confirmed. Row-move and column-swap logic itself has no unit test, only the harness and the owner. |

**Score:** 8/9 (8 roadmap criteria verified; 1 plan-level prohibition, 11-06 "never styles outside the fragments", partially violated and unenforced).

### Judgement on CR-01 and EDIT-06 (asked explicitly)

I read the code behind CR-01, WR-01, WR-02 and WR-03; all four are accurately described by 11-REVIEW.md. Weighing the actual reach:

- **Confirmed.** After Ctrl-selecting in field A then field B, A lives only in `target.peers`. Deleting A's host (section, block, broadcast, ...) calls `closeFormatterFor(A)`, which does nothing because `formatTarget.key` is B. The next style click commits `peer.onCommit(peer.value, next)`; the id-keyed text write is a no-op but `formattedText[A]` is written as an orphan. `normalizeFormattedText` (`lib/portia-content-normalize.ts:68`) does not prune orphans, so it is saved.
- **Partly mitigated, contrary to the review's wording.** The main-editor mutation delete (`portia-editor.tsx:1231`) calls `setFormatTarget(null)`, which clears peers, so the index-shift overwrite the review describes is not reachable there. It is reachable in the recycled-virus path (`:1431`, `onRemoveMutation` clears nothing): there `updatePlainText` is index-based and writes the stale `peer.value` into the mutation that shifted into that slot. This would overwrite visible text, but only in the draft, behind a narrow sequence, and Ctrl+Z / ОТМЕНИТЬ reverts it.
- **Stale text snapshot is mostly unreachable**: re-entering a peer field makes it the live target and refreshes its snapshot; undo/redo clears the target.
- **WR-01 and WR-02 are real and easier to hit**: Ctrl+X/V in a field after a Ctrl selection, or folding a card holding a selected field, leaves the panel showing «ВЫБРАНО: n» and styling stale or invisible ranges.

Does it undermine EDIT-06? **Not the feature as the roadmap states it.** The criterion (select several fragments with Ctrl, one style to all) is delivered, tested in pure helpers, harness-checked and owner-approved on real engines. It does undermine the **plan-level safety prohibition** of 11-06 ("never styles characters outside the fragments or fields that hold none"), which was marked `resolved` / `test` while no test touches peers. Under the test-tier fail-closed rule that prohibition is unverified, hence `gaps_found`, scope limited to the stale-target lifecycle. Typical impact is invisible orphan entries and a stale "ВЫБРАНО" panel, not routine data loss; the one text-overwrite path is the recycled-virus mutation delete.

If the owner prefers to ship, the finding can be accepted as an override (add `overrides:` with reason and `accepted_by`); that is a human decision, I have not applied one. Otherwise the closure is small: the CR-01 snippet in 11-REVIEW.md, one extra clear in `onRemoveMutation`, Ctrl/Cmd+X/V/Backspace/Delete ending the gesture, peers pruned on fold, plus one test or harness step.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/portia.css` mark rule + phone/chip/panel styles | one underline-only rule | ✓ VERIFIED | line 531; `minmax(0, 1fr)`/overflow fixes from 11-07 present per summary |
| `components/portia-editor.tsx` | panel, chip, TOC, row/column handles, multi-select | ✓ VERIFIED | 2707 lines; features located at lines cited above |
| `components/portia-desktop.tsx` | `#desktop` host for the panel, z-order | ✓ VERIFIED | portal target `document.getElementById("desktop")` |
| `lib/format-fragments.ts` (+ test) | merge/pick/remove fragment helpers | ✓ VERIFIED | imported at `portia-editor.tsx:8`, tested |
| `lib/panel-position.ts` (+ test) | clamped stored place | ✓ VERIFIED | 28 tests together with format-fragments |
| `lib/portia-content-normalize.ts` row ids | stable unique row ids | ✓ VERIFIED | tests at lines 132-167 |
| `11-editor-check.mjs`, `11-engines-check.mjs` | browser harness | ✓ EXISTS | not re-run by me: needs servers/browsers (told not to touch 3124/3125) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| FloatingTextFormatPanel | #desktop | createPortal | WIRED | `portia-editor.tsx:1546` |
| field activate | target join | `activateFormatter` -> `joinFormatTarget` | WIRED | line ~870 |
| panel controls | all fragments | `applyOp` -> `onBatch` | WIRED | one history step per batch |
| delete handlers | peers cleanup | `closeFormatterFor` | NOT_WIRED for peers | the gap above |
| row ≡ / column ≡ | rows in draft | `editTableRows` | WIRED | lines 784, 1298 |
| editor code | `@/lib/rich-text-style` | single import | WIRED | counted by test |

### Data-Flow Trace (Level 4)

Chip count comes from `changed` (real draft diff), TOC items from the live draft lists, row order from the stored `rows` array that the normalizer keeps in order. No static/hollow data found. The one disconnect is stale `peer.value`/`peer.document` snapshots (CR-01).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite | `npm test` | 332 pass, 0 fail | ✓ PASS |
| Types | `npx tsc --noEmit` | no output | ✓ PASS |
| Mark guard bites | add `background: red` to the rule, run accent-theme test | test fails, then restored | ✓ PASS |
| Boundary guard bites | 400 -> 450 ms, run rich-text-style test | test fails, then restored | ✓ PASS |
| Browser harness (`11-*-check.mjs`) | not run | needs preview servers and browsers | ? SKIP — owner device approval stands in |

### Probe Execution

No `scripts/*/tests/probe-*.sh` declared by this phase. Not applicable.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| EDIT-01 | 11-01, 11-07 | ✓ SATISFIED | truth 1 |
| EDIT-02 | 11-01, 11-07 | ✓ SATISFIED | truth 2 |
| A11Y-03 | 11-01 | ✓ SATISFIED | truth 3 |
| TEST-02 | 11-01 | ✓ SATISFIED | truth 4, mutation-checked |
| EDIT-03 | 11-04, 11-07 | ✓ SATISFIED | truth 5 |
| EDIT-04 | 11-02, 11-07 | ✓ SATISFIED | truth 6 |
| EDIT-05 | 11-03, 11-07 | ✓ SATISFIED | truth 6 |
| EDIT-06 | 11-06, 11-07 | ✓ SATISFIED for the stated behavior; **CR-01/WR-01/WR-02 open** | truth 7 and gap |
| EDIT-07 | 11-05, 11-07 | ✓ SATISFIED | truth 8 |

All nine IDs appear in PLAN frontmatter and in REQUIREMENTS.md (ticked, traceability rows "Complete"). No orphaned requirement IDs for Phase 11.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/portia-editor.tsx` | ~873 | stale peer target after delete (CR-01) | 🛑 Blocker (scoped, see gap) | orphan saved entry; text overwrite in recycled-mutation path |
| `components/portia-editor.tsx` | ~2194 | Ctrl-edit keys keep additive gesture (WR-01) | ⚠️ Warning | styles shifted ranges |
| `components/portia-editor.tsx` | ~301, ~351 | fold does not prune peers (WR-02) | ⚠️ Warning | panel formats invisible text |
| `components/portia-editor.tsx` | 1546 | `key={formatTarget.key}` remounts panel (WR-03) | ⚠️ Warning | phone sheet re-expands on every field change; also contradicts the folded-sheet behavior owner approved only for a single field |
| `lib/portia-content-normalize.ts` | 170 | fallback row id can collide (IN-01) | ℹ️ Info | needs hand-crafted content |
| `components/portia-editor.tsx` | 1562 | dangling `aria-controls`, dialog without focus move (IN-02) | ℹ️ Info | a11y polish |

No TBD/FIXME/XXX in files changed by this phase. `deferred-items.md` records 2 pre-existing lint errors in Phase 06 files outside this phase's scope.

### Human Verification Required

None outstanding: the owner's real-device check (PC Firefox, iPhone Firefox/WebKit) is already recorded as approved in 11-07-SUMMARY.md. Caveat I could not independently confirm: that approval, the Firefox/WebKit harness runs, and the 11-02/03/04/06 browser-only behaviors rest on the summary and owner statement; I verified them by code reading only.

### Gaps Summary

One concern, three findings: the multi-field format target is not invalidated on delete (CR-01), on Ctrl-edit keys (WR-01) or on folding (WR-02). WR-03 (panel remount on each field change) is not in the gap list because it affects convenience, not data, but it should be fixed in the same closure since it touches the same `FormatTarget` lifecycle. The disposition ledger `11-REVIEW-DISPOSITION.md` still shows all six findings `open`; either close them with a gap plan or record an accepted risk. Phase 12 edits the same file, so fixing now is cheaper than later.

---

_Verified: 2026-10-26_
_Verifier: Claude (gsd-verifier)_
