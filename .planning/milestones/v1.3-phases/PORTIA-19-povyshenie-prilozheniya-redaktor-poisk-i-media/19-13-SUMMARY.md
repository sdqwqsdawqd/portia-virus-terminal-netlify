---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 13
subsystem: ui
tags: [editor, background-sync, rebase, fail-closed, access, format-panel, d-11, stab-app-07, stab-app-08, stab-app-09]
requires:
  - phase: 19-01
    provides: 19-OWNER-DECISIONS.md verdicts 4 (строка «Не удалось проверить права. Повторите позже.») and 7 (черновик в памяти)
  - phase: 19-08
    provides: AppDeniedPanel in components/portia-desktop-states.tsx
  - phase: 19-12
    provides: lib/editor-save-status.ts, ConflictPanel (D-09), historyReducer keep/rebase options
provides:
  - rebaseDecision (none / rebase / conflict) in lib/editor-save-status.ts
  - history action "rebase" in lib/editor-history.ts (baseline + source + projection of present, past, future)
  - .editor-stale-banner «Запись изменили» above the editor form
  - accessState "ok" | "failed" in portia-desktop.tsx and the accessFailed prop of PortiaEditor (fail-closed)
  - accessCheckFailedText in lib/app-state.ts
  - tests for tab ids, empty lists, email normalization, selection/range of the format panel, typography and scrolling
affects: [19-14]
status: complete
actuals:
  tokens: 12600
  tasks: 3
  commits: 3
plan_head_before: 0fd22d6
plan_head_after: d94e324db501222f9d780ea5e06e8be940b36eb4
tech-stack:
  added: []
  patterns:
    - "Background update with unsaved edits: rebaseDecision(baseline, present, incoming, protectedSections) is a pure function; the editor only dispatches its answer."
    - "A rebase projects present AND every undo/redo entry (reuse of the restrict reducer), so Ctrl+Z cannot bring back the old stored value of a section the server changed."
    - "Fail-closed by a prop, not by an empty tab list: an empty list would revert the draft (closure effect); accessFailed keeps the editor mounted and swaps only the body."
    - "Access answers are ordered by a request counter (accessRequestSeq / accessAppliedSeq); a late answer never overrides a newer one."
key-files:
  created: []
  modified:
    - lib/editor-save-status.ts
    - lib/editor-history.ts
    - lib/app-state.ts
    - components/portia-editor.tsx
    - components/portia-desktop.tsx
    - app/portia.css
    - lib/editor-save-status.test.ts
    - lib/editor-history.test.ts
    - lib/editor-tabs.test.ts
    - lib/editor-access.test.ts
    - lib/rich-text-style.test.ts
    - lib/panel-position.test.ts
    - lib/portia-desktop.test.ts
key-decisions:
  - "Protected section of rebaseDecision = the section of the active tab; a server change there is always a conflict (D-11), even if the user did not edit it."
  - "The sync effect also depends on the active tab, so switching away from a conflicting section re-runs the decision and can rebase silently."
  - "/api/access 401/403 = no access (canEdit false); any other non-OK answer or exception = accessState failed."
  - "Verdict 7 A (draft stays in memory) is applied to the failed-check state; for a revoked section the existing rollback (D-15/D-16) is kept, see Deviations."
requirements-completed: [STAB-APP-07, STAB-APP-08, STAB-APP-09]
coverage:
  - id: D1
    description: "Background update with unsaved edits: other sections rebase silently, the open section and edited sections keep the draft and show «Запись изменили»"
    requirement: STAB-APP-07
    verification:
      - kind: unit
        ref: "lib/editor-save-status.test.ts#rebaseDecision"
        status: pass
      - kind: unit
        ref: "lib/editor-history.test.ts#rebase takes the stored copy as the baseline"
        status: pass
    human_judgment: false
  - id: D2
    description: "Failed /api/access check closes the editor body («Доступ закрыт» + verdict-4 line), keeps the draft, disables save and shortcuts; late answers are dropped"
    requirement: STAB-APP-09
    verification:
      - kind: unit
        ref: "lib/portia-desktop.test.ts#fetchAccess fails closed"
        status: pass
      - kind: unit
        ref: "lib/portia-desktop.test.ts#an access answer sent before one already applied is dropped"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tab/grant rules pinned: exact ASCII ids, no-grant and empty lists, email normalization, revoked-tab refusal"
    requirement: STAB-APP-09
    verification:
      - kind: unit
        ref: "lib/editor-tabs.test.ts; lib/editor-access.test.ts#normalizeEditorEmail"
        status: pass
    human_judgment: false
  - id: D4
    description: "Format panel keeps the range while dragged (mouse/touch), saving keeps the panel open, editable typography equals the viewer, editor lists scroll inside"
    requirement: STAB-APP-08
    verification:
      - kind: unit
        ref: "lib/rich-text-style.test.ts; lib/panel-position.test.ts; lib/portia-desktop.test.ts#dragging the panel"
        status: pass
    human_judgment: true
    rationale: "Selection/drag behaviour in a real browser (PC mouse, phone touch) is source- and logic-tested only; the physical owner PC/phone verdict is owned by 19-14."
duration: single session
completed: 2026-11-03
---

# Phase 19 Plan 13: Editor background update, fail-closed access, WYSIWYG tests Summary

**The editor no longer drops typing on a background update (silent rebase of untouched sections, «Запись изменили» strip on overlap), closes its body with «Доступ закрыт» when the rights check fails, and the format-panel selection, typography and scrolling are pinned by tests.**

## Performance

- **Tasks:** 3 (1 tracer, 2 auto) — all committed individually
- **Files:** 13 changed, +439/-20 (diff from 0fd22d6)
- **Tests:** `npm test` 1028 -> 1057 (+29); the single failure is the known worktree-only `lib/phase16-guard-boundary.test.ts` (baseline)

## Accomplishments

- **Task 1 (tracer, 872d708).** `rebaseDecision` returns `none` (server changed no section), `rebase` (server changed only sections the user did not edit and that are not the active tab's section: baseline = server copy, present = user's sections over the server copy) or `conflict`. The editor sync effect calls it when dirty and the revision is newer than `baseRevision`; `rebase` dispatches the new history action `rebase` and moves `baseRevision`; `conflict` leaves the draft and revision alone and shows `.editor-stale-banner` (`role="status"`, «Запись изменили» / «Показаны ваши правки. Конфликт решится при сохранении.»). The save then gets the 409 and the D-09 panel. The strip disappears after a save, after «Загрузить их версию», or when the draft becomes clean.
- **Task 2 (da147c8).** `fetchAccess` sets `accessState = "failed"` on a non-OK answer (other than 401/403) or an exception; the editor then renders `AppDeniedPanel` with «Не удалось проверить права. Повторите позже.», refuses `save()` and takes the window shortcuts away, while staying mounted so the content draft survives (owner verdict 7 A). Polling of `/api/access` continues while failed so the editor recovers. Late answers are dropped by `accessRequestSeq/accessAppliedSeq`. Tests pin exact-string tab ids, no-grant/empty lists (content and uploads refused), `normalizeEditorEmail` (+ lookup by the normalized email) and the revoked-tab refusal naming only that section.
- **Task 3 (d94e324).** Tests for: caret between words applies nothing and creates no empty run; boundary of equal/different style runs; text order after several applications; multi-selection fragments; fractional touch/mouse drag stays whole-pixel and idempotent; panel drag code never touches the selection and uses pointer events with `touch-action: none`; save does not close the format panel; viewer/editor share the font rule per area; editor lists scroll inside (`min-height: 0` + `overflow-y: auto`); the only sticky editor layer is the save chip, under the format panel. No product code needed changing — all behaviours already held.

## Verification

| Check | Result |
|-------|--------|
| `node --experimental-strip-types --test lib/editor-save-status.test.ts lib/editor-history.test.ts` | pass (61/61 at Task 1) |
| `node --experimental-strip-types --test lib/editor-tabs.test.ts lib/editor-access.test.ts lib/portia-desktop.test.ts` | pass |
| `node --experimental-strip-types --test lib/rich-text-style.test.ts lib/panel-position.test.ts lib/format-fragments.test.ts lib/portia-desktop.test.ts` | pass (136/136) |
| `node --experimental-strip-types --test lib/accent-theme.test.ts` | pass (31/31) |
| `npm test` | 1057 tests, 1 fail = baseline `phase16-guard-boundary` (worktree-only, `.claude/hooks/guard.mjs` absent) |
| `npm exec tsc -- --noEmit` | only the baseline TS2307 of `phase16-guard-boundary.test.ts` |
| `npm run lint` | 0 errors, 14 warnings (baseline kinds: `<img>`, exhaustive-deps elsewhere) |
| build | `next build --webpack --experimental-build-mode compile` compiled (plain `npm run build` uses Turbopack, which fails on the node_modules junction) |
| Task 1 acceptance greps | `export function rebaseDecision` = 1, `rebaseDecision(` in editor = 1, banner text = 1 |
| Task 2 acceptance greps | `accessState` in desktop = 3 lines, `<AppDeniedPanel` desktop 1 + editor 1, editor-tabs `# fail 0` |
| Task 3 test counts | rich-text-style 27 -> 32, panel-position 14 -> 17 |

**Not run / BLOCKED:** authenticated editor browser lanes (no isolated staging credentials in this worktree: BLOCKED (ENV)); webkit-phone lane (BLOCKED (ENV), as for existing @smoke). The behaviour of the banner, rebase and the denied body in a live editor, and PC/phone drag of the format panel, are covered by unit/source tests only; the physical owner PC/phone verdict goes to 19-14.

## Deviations from Plan

### Auto-fixed / added

**1. [Rule 3 - Blocking] History action `rebase` added**
- **Found during:** Task 1 (the plan's read_first allows it)
- **Issue:** the history had no way to take a new stored copy while keeping a dirty draft; reusing `sync` would drop the draft, and leaving past/future untouched would let undo restore the old server value of a section the server changed (silent overwrite of someone else's work on the next save, T-19-28).
- **Fix:** `{ type: "rebase", baseline, source, project }` = `restrict` projection + new baseline/source. Test in `lib/editor-history.test.ts`.
- **Files:** lib/editor-history.ts, lib/editor-history.test.ts
- **Commit:** 872d708

**2. [Rule 3 - Blocking] `accessCheckFailedText` in lib/app-state.ts and an allow-list entry**
- **Found during:** Task 2
- **Issue:** the verdict-4 line is shared by desktop and editor (not in the plan's file list); the source test "component families import only their own seams" rejected the editor importing `portia-desktop-states`.
- **Fix:** constant in `lib/app-state.ts`; `portia-desktop-states` added to the editor's allowed shared components in `lib/portia-desktop.test.ts` with a comment.
- **Commit:** da147c8

**3. [Design] Sync effect depends on the active tab too**
- Switching away from a conflicting section re-runs the decision, so a draft can rebase silently once the section is no longer under the cursor.

### Not done / open (flag for review)

**A. Verdict 7 A for a section revoked while editing is NOT implemented.** The plan truth allows "draft in memory until close, or the current rollback". The current D-15/D-16 rollback (closed-section edits reset to the stored copy, history projected, notice «несохранённые правки в нём сброшены») is unchanged. Implementing A there means hidden closed-section edits would keep `dirty` true, interact with the `saved` action (`keep`/`rebase`) and the close dialog list, and revise the D-16 security property that Ctrl+Z cannot bring back a closed section's edit. That is a separate design step and was not taken inside this plan; the server still refuses closed sections (`contentRefusal`, partial save 19-12). Verdict A is honoured for the failed-check state (draft kept mounted).

**B. Employee profile draft is not kept in the failed-check state.** The `Сотрудники` tab component unmounts when the body is replaced; its form draft (saved separately, outside the content draft) is lost and the editor reports it clean. The content draft is kept.

**C. A stale banner can show for a section the user did not edit.** Per the plan a server change in the active tab's section is a conflict by definition, even when the user's own edits are in another section.

**Total deviations:** 2 auto-added (Rule 3), 1 design note, 3 open items. **Impact:** none of the open items changes the server-side authorization; A and B are UX gaps for 19-14 / follow-up.

## Known Stubs

None.

## Threat Flags

None. No new endpoints, auth paths or schema; T-19-27 (stale `openTabs` after a failed check) and T-19-28 (rebase overwriting someone's change) are mitigated by `accessState`/`accessFailed` and by rebasing only non-overlapping, non-protected sections with projected history.

## Self-Check: PASSED

- Commits 872d708, da147c8, d94e324 are ancestors of HEAD on `gsd/19-13`.
- Modified files exist; STATE.md, ROADMAP.md and owner paths untouched.
