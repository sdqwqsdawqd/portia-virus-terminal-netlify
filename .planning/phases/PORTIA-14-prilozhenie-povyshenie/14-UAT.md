---
status: gaps_found
phase: PORTIA-14-prilozhenie-povyshenie
source: [14-VERIFICATION.md]
started: 2026-10-28
updated: 2026-10-28
safe_data_only: true
---

# Phase 14 Owner UAT: «Повышение»

Use only temporary nicknames/rows approved for testing. Do not change a real employee row. Test the participant window in a private browser profile and the reviewer workspace in the trusted editor.

## Test data

- PC participant nickname: `[owner fills]`
- Phone participant nickname: `[owner fills]`
- Second/different nickname: `[owner fills]`
- Reviewer A: `[owner fills]`
- Reviewer B or owner session: `[owner fills]`

## Tests

### 1. Nickname gate and immediate roster removal
expected: A listed nickname opens a safe state; a missing nickname creates nothing; removing the temporary nickname from `Portia!A61:E85` immediately blocks status, requests, tasks and test continuation. Restoring the row restores only valid access and does not silently release its device binding.
result: pending

### 2. First request binds the device
expected: Looking up a nickname does not bind it. The first accepted request binds it; trying another nickname on the same device gives a neutral refusal that never names the bound nickname.
result: pending

### 3. Repeated suspicious entry attempts
expected: Repeated conflicting attempts produce 5, then 15, then 60 minute waits; retrying during an active wait does not restart its end time.
result: pending

### 4. Ordinary eligibility and cooldowns
expected: Ordinary tasks are available only after anti-speedrun and the correct 7/3/4/6/8/10/18-day boundary. Qualification boundaries are enforced after titles 2, 4 and 6; Expert Virologist uses the special-task path.
result: pending

### 5. Trusted reviewer access
expected: An editor without `promo` receives a refusal and cannot call reviewer/bank actions. Granting `promo` opens the three separate areas «Запросы», «Задания» and «Квалификационные проверки»; revoking it closes them again.
result: pending

### 6. Two-reviewer claim race
expected: Reviewer A and B open the same pending request and click «Взять запрос» nearly together. Exactly one owns it; the other sees that the state changed and cannot mutate it. Manual release and owner force-release work.
result: pending

### 7. Ordinary manual and random assignment
expected: The reviewer can select manually or preview a random active-only, duplicate-free set; insufficient active items block confirmation; rebuild and single-item replacement work before confirmation.
result: pending

### 8. Immutable ordinary assignment and approval
expected: After confirmation, the participant sees the ordered tasks. Editing/deleting the bank does not change the issued copy. Only the assigned reviewer can approve; after approval, a new assignment stays blocked until the temporary sheet title changes.
result: pending

### 9. Qualification eligibility and bank assembly
expected: Qualification can be requested only at titles 2, 4 and 6. Separate transition banks enforce counts for single-choice, multiple-choice and free-text questions; manual and random previews preserve order and exclude inactive questions.
result: pending

### 10. Immediate 15-minute test start
expected: Reviewer confirmation starts one server deadline immediately. The participant receives one question at a time, cannot go back, and reload keeps the current question and original deadline.
result: pending

### 11. All answer types and response privacy
expected: Radio, checkbox and free-text answers submit correctly. Browser/network inspection shows no answer key, future question, bank data, reviewer identity or internal note.
result: pending

### 12. PC focus and navigation protection
expected: After the warning, switching tabs, hiding the page, losing focus or leaving the page ends the active PC attempt. Already submitted answers remain available to the reviewer.
result: pending

### 13. PC offline and timeout
expected: Going offline ends the attempt. At exactly the 15-minute boundary the server rejects another answer and marks failure; the participant cannot continue editing.
result: pending

### 14. Phone behavior
expected: On a phone, switching apps/tabs and refocusing does not fail the attempt, while going offline still fails it. The same server deadline remains authoritative.
result: pending

### 15. Grading and independent decision
expected: The reviewer marks every answer correct/incorrect, sees the derived percentage, then independently chooses pass/fail. The participant sees only final result and optional percentage, never the particular mistakes.
result: pending

### 16. Technical-failure override
expected: The reviewer can override a timeout/focus/offline technical failure and continue to the explicit final decision without losing submitted answers.
result: pending

### 17. Retake controls
expected: Failure proposes 2 days; the reviewer can set another value or increase it for cheating. New qualification requests remain blocked until that server date. Any `promo` reviewer can release the wait early, and another attempt remains possible.
result: pending

### 18. Once-only retake notification
expected: After this device has observed a waiting retake, expiry produces one quiet quest-style toast that opens «Повышение». It does not repeat after dismissal/reload and is suppressed while the ready state is already open.
result: pending

### 19. Close, history and cleanup
expected: Closing removes detailed task/test payload, leaves at most three compact results, and shows the unobtrusive three-day cleanup hint. No real row is used to test deletion.
result: pending

### 20. Direct access denial
expected: An unauthenticated direct table request fails; a signed-in editor without `promo` receives 403 from reviewer and bank APIs; forged client timestamps do not alter cooldowns, deadlines or retake dates.
result: pending

### 21. PC and phone presentation/accessibility
expected: The participant and reviewer views fit without horizontal overflow, sticky actions do not hide content, keyboard focus is visible, labels are understandable, and reduced-motion/disabled animations avoid distracting movement.
result: pending

### 22. Russian cooldown punctuation
expected: A calendar cooldown is rendered without invented time and without `..` after the localized year abbreviation.
result: failed — owner observed a doubled final period

### 23. Eligible request controls
expected: A participant whose server cooldown has elapsed sees the correct ordinary or qualification action, can press it once, and receives a specific success or failure state rather than a silently absent/disabled control.
result: failed — owner cannot submit either request from the participant window

### 24. Atomic first binding through accepted submit
expected: Lookup alone stays read-only; the first accepted request sets the HttpOnly-backed binding, a reload restores the same nickname, and another nickname is refused neutrally.
result: failed — request does not complete and the nickname is not restored as bound

### 25. Ordinary bank required count
expected: The reviewer can change the required task count within the bank limits, save it, reload the workspace and see the persisted value.
result: failed — count cannot be selected reliably

### 26. Task and qualification bank CRUD
expected: The reviewer can add, edit, disable and remove ordinary tasks and all three qualification question types; save/error state is explicit and entered data is not lost.
result: failed — adding tasks/questions and understanding save state do not work reliably

### 27. Promotion editor control consistency
expected: Bank actions use the established PORTIA control hierarchy and expose clear enabled, disabled, saving, saved and error states on PC and phone.
result: failed — controls are inconsistent and the workflow is unclear

### 28. Spider persistence and explicit relocation
expected: While enabled, the spider never fades out or relocates after completing a route. A new visible spawn and non-identical initial pose are selected only after the user explicitly switches `Скрыть → Показать`.
result: failed — spider repeatedly disappears, reappears and resets to the same pose

### 29. Symmetric window bounds
expected: A normal window remains fully inside the desktop workspace with the same left and right inset; neither side permits hiding most of the frame.
result: failed — left movement is blocked while the right side permits most of the frame off-screen

### 30. Shortcut animation handoff
expected: The final animated frame and resting shortcut use identical geometry, viewBox, scale, filter and raster/vector quality; no visible snap occurs when motion settles.
result: failed — quality and geometry visibly change at the animated-to-static handoff

### 31. Integrated regression pass
expected: Tests 22–30 pass together after reload on PC and phone, with no stale local state masking an API/database failure.
result: blocked by 22–30

## Summary

total: 31
passed: 0
issues: 10
pending: 21
skipped: 0
blocked: 1
failed: 9

## Gaps

- GAP-14-01: participant request and first-binding path is not proven against the live deployed RPC contract (tests 23–24).
- GAP-14-02: cooldown copy has Russian punctuation regression and action absence lacks a trustworthy reason (tests 22–23).
- GAP-14-03: ordinary and qualification bank count/CRUD/control states fail owner use (tests 25–27).
- GAP-14-04: spider lifecycle violates explicit-toggle-only relocation (test 28).
- GAP-14-05: window clamping is asymmetric and permits excessive right overflow (test 29).
- GAP-14-06: shortcut animation-to-resting handoff visibly snaps (test 30).
- Source todo: `.planning/todos/pending/2026-10-28-stabilize-promotion-and-desktop-ui.md`.
