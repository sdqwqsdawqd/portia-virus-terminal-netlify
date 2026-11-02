---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 05
subsystem: ui
tags: [promotion, reviewer-ui, a11y, bank-editor, access-denied, confirmations]
requires:
  - phase: 19-01
    provides: owner verdict 6 = A (PromotionConfirmDialog with UI-SPEC labels)
  - phase: 19-04
    provides: participant promotion UI and shared promotion tests
provides:
  - grade buttons with visible Верно/Неверно, aria-label with question number, aria-pressed
  - manual final outcome behind PromotionConfirmDialog (confirmLabel/cancelLabel required props)
  - bank block reason beside aria-disabled buttons, stale-preview banner, stable preview order
  - 403 -> "Доступ закрыт" panel, pending-database -> "Серверная часть раздела не обновлена.", loading skeleton
affects: [19-06 owner UAT, 19-13 revoked-section draft retention, 19-14 320px wrap backstop]
status: complete
actuals:
  tokens: 21000
  tasks: 3
  commits: 6
plan_head_before: a37947e7c31389eb7cae1f7945f33daf243f7fe7
plan_head_after: c466404882dee5262e04cac6a2cd6babb068ea99
tech-stack:
  added: []
  patterns:
    - "One shared ConfirmIntent type (exported from editor-main) with required confirmLabel/cancelLabel; no generic cancel"
    - "aria-disabled + aria-describedby reason instead of disabled/title, click guarded in the handler"
key-files:
  created: []
  modified:
    - components/portia-promotion-editor.tsx
    - components/portia-promotion-editor-main.tsx
    - components/portia-promotion-ordinary-editor.tsx
    - components/portia-promotion-qualification-editor.tsx
    - lib/portia-promotion-reviewer.ts
    - lib/portia-promotion-reviewer.test.ts
    - lib/portia-promotion-editor.test.ts
    - lib/portia-qualification-ui.test.ts
    - app/portia.css
key-decisions:
  - "Verdict 6 = A implemented: dialog labels Подтвердить итог/Не подтверждать, Удалить вопрос/Оставить вопрос, Удалить запрос/Не удалять, Снять claim/Не снимать; others name their own action (Не открывать, Не сбрасывать, Не зачитывать, Не отклонять, Оставить задание)."
  - "Access revocation = HTTP 403 with no error code. Per-command 403s (command-failed, delete-forbidden, reset-forbidden) carry a code and stay ordinary errors, so they do not wipe the queue."
  - "Outcome buttons relabelled to Проверка пройдена / Проверка не пройдена (plan text); the old ЗАСЧИТАТЬ ПРОВЕРКУ / НЕ ЗАСЧИТЫВАТЬ labels are gone."
requirements-completed: []
coverage:
  - id: D1
    description: "Grade buttons: visible label, numbered aria-label, aria-pressed; outcome only via confirmation; qualificationGrade returns only items+percent"
    requirement: STAB-PROM-11
    verification:
      - kind: unit
        ref: "lib/portia-promotion-editor.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bank limit text, exact-required vs required-1, empty and all-disabled bank (M=0), stable sortOrder+id order, zero quotas, code-point length (4000 ok, 4001 rejected)"
    requirement: STAB-PROM-05
    verification:
      - kind: unit
        ref: "lib/portia-promotion-reviewer.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Blocked-reason markup, stale-preview banner, newer count/quota edits survive a save response, failed save keeps the draft"
    requirement: STAB-PROM-10
    verification:
      - kind: unit
        ref: "lib/portia-promotion-editor.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "403 closes workspace and clears queue/banks; pending-database is not an empty queue; retake proposal pinned"
    requirement: STAB-PROM-09
    verification:
      - kind: unit
        ref: "lib/portia-promotion-editor.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Rendered behaviour on real devices (44px phone targets, 320px overflow, long-text wrap, live 403 after grant revoke, two-claim race) is not exercised here"
    requirement: STAB-PROM-11
    verification:
      - kind: manual
        ref: "19-06 owner UAT / 19-14 backstop"
        status: not-run
    human_judgment: true
---

# Phase 19 Plan 05: Reviewer client Summary

Reviewer grades each answer with labelled, numbered, aria-pressed buttons, picks the outcome by hand behind a named confirmation, and manages banks without losing drafts; a revoked grant shows a bare «Доступ закрыт».

## What changed

- **Task 1 (tracer).** Grade buttons now show `✓ Верно` / `✗ Неверно` (11px label), carry `aria-label` «Ответ верен/неверен, вопрос N» (N equals the visible «ВОПРОС N»; the server already orders answers by `sort_order`) and `aria-pressed`. The two outcome buttons «Проверка пройдена» / «Проверка не пройдена» are `aria-disabled` with the reason «Отметьте все ответы» (or «Ответов пока нет.») and open `PromotionConfirmDialog` («Подтвердите итог: …», «Подтвердить итог» / «Не подтверждать»). There is exactly one `finalize-attempt` call site, inside that confirmation's `run`. The dialog takes required `confirmLabel` / `cancelLabel`; the generic ОТМЕНИТЬ/ПОДТВЕРДИТЬ pair is gone. Force-release now asks «Снять claim» / «Не снимать». Phone grade buttons are 44px at max-width 900px.
- **Task 2.** `taskBankLimitError` now says «В банке недостаточно активных вопросов: нужно N, есть M.»; all-zero qualification quotas return an error. `selectTaskPreview` / `selectQualificationPreview` sort by `sortOrder` then `id`. `validText` counts code points. Bank editors show the reason in `.promotion-bank-reason` beside `aria-disabled` build/confirm buttons, show «Набор изменился — пересоберите превью» after a mutation that dropped a preview, and a save response no longer clears a count/quota edited after submit.
- **Task 3.** 403 with no `code` calls `deny()` (empty queue, banks, selection, confirm) and renders `role="alert"` «Доступ закрыт» with nothing else. `pending-database` maps to «Серверная часть раздела не обновлена.»; queue and banks have `loading` / `ready` / `error` status so a load failure is not drawn as «НОВЫХ ЗАПРОСОВ НЕТ» (it shows «ОЧЕРЕДЬ НЕ ЗАГРУЖЕНА» / «БАНКИ НЕ ЗАГРУЖЕНЫ» + «Повторить загрузку»); first load shows a skeleton. The retake control (default 2, 0 = no wait, release-retake) already existed and is now pinned by tests; its label says «0 — без ожидания».

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dead LegacyPromotionEditor removed from `components/portia-promotion-editor.tsx`**
- **Found during:** Task 1
- **Issue:** The file held a full second copy (`LegacyPromotionEditor`, its own `QualificationGrading` and `PromotionConfirmDialog`) that nothing imports; the live code is `portia-promotion-editor-main.tsx`, re-exported as `PromotionEditor`. Updating the copy would only edit dead code.
- **Fix:** Reduced the file to the single re-export line. Consequence: the plan acceptance `grep -c "Ответ верен, вопрос" components/portia-promotion-editor.tsx` prints 0; the string lives in `portia-promotion-editor-main.tsx` (and is asserted there by test). The same applies to the "Подтвердить итог" grep, which is satisfied by the main file only.
- **Files modified:** components/portia-promotion-editor.tsx
- **Commit:** d4e0754

**2. [Rule 3 - Blocking] `lib/portia-qualification-ui.test.ts` pinned the old outcome labels**
- **Found during:** Task 1
- **Issue:** It asserted «ВЕРНО», «НЕВЕРНО», «ЗАСЧИТАТЬ ПРОВЕРКУ», «НЕ ЗАСЧИТЫВАТЬ», which the plan replaces.
- **Fix:** Updated the four assertions to the new labels (file is outside the plan's `files_modified`).
- **Commit:** d4e0754

**3. [Rule 1 - Bug] `ConfirmIntent` type was triplicated**
- Exported once from editor-main and imported as a type by the two bank editors, so the new required labels cannot drift.

**4. [Scope] Task 1 touched bank-editor confirmations**
- The plan lists them under Task 2, but the "no generic cancel / every confirmation names its action" test spans all three files, so their labels landed in the Task 1 commit.

## Known limits / handoff

- **Revoked grant drops local bank drafts.** `deny()` replaces the whole workspace, so the bank editors unmount and their in-memory drafts go. Owner verdict 7 (keep the draft until the editor closes) is scheduled for 19-13; this plan does not satisfy it.
- **403 on POST paths** is treated as revocation only when the body has no `code`; revocation noticed only through a command still clears the state the same way, and polling (10s) covers the idle case.
- **Textarea `maxLength={4000}`** counts UTF-16 units, so the form still stops at 2000 emoji even though `validateQuestionDraft` now accepts 4000. Not changed.
- **Not exercised:** rendered layout (44px, 320px overflow, long-text wrap), live revoke, two-claim race. Those stay with 19-06 / 19-14. No requirement is marked complete.
- No `app/api/` or `supabase/` change (`git diff --name-only -- app/api/ supabase/` empty), so no RLS review is needed.
- Hook note: `LF will be replaced by CRLF` warnings appear on commit; files keep their existing line endings.

## Known Stubs

None.

## Verification

- `npm test`: 960 pass, 0 fail
- `npm exec tsc -- --noEmit`: clean
- `npm run lint`: 0 errors (18 pre-existing warnings)
- `npm run build`: succeeds

## Commits

- 03c774d test(19-05): grade buttons, manual outcome, action-named confirmations (red)
- d4e0754 feat(19-05): labelled grade buttons and manual outcome behind a named confirmation
- 8d77b16 test(19-05): bank limit text, stable order, code-point length, stale banner, reason markup (red)
- a9a99dc feat(19-05): bank block reason, stable preview order, code-point length, stale-preview banner
- 4976cb7 test(19-05): 403 panel, pending-database vs empty queue, retake proposal (red)
- c466404 feat(19-05): access-closed panel on 403, pending-database distinct from empty queue, loading skeleton

## Self-Check: PASSED

All six commits are ancestors of HEAD; modified files exist.
