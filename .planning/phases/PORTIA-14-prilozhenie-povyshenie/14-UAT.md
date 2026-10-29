---
status: preflight_blocked
phase: PORTIA-14-prilozhenie-povyshenie
source: [14-VERIFICATION.md]
started: 2026-10-28
updated: 2026-10-29
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
remediation preflight: passed — formatter regression is covered by `lib/portia-promotion-ui.test.ts`; integrated suite passes.

### 23. Eligible request controls
expected: A participant whose server cooldown has elapsed sees the correct ordinary or qualification action, can press it once, and receives a specific success or failure state rather than a silently absent/disabled control.
result: failed — owner cannot submit either request from the participant window
remediation preflight: automated pass; live browser submit blocked until an owner-approved eligible temporary roster nickname is available.

### 24. Atomic first binding through accepted submit
expected: Lookup alone stays read-only; the first accepted request sets the HttpOnly-backed binding, a reload restores the same nickname, and another nickname is refused neutrally.
result: failed — request does not complete and the nickname is not restored as bound
remediation preflight: API/database regressions and the deployed 18-RPC read-only inventory pass; the accepted-write round trip is blocked without an isolated Supabase project or an owner-approved temporary participant.

### 25. Ordinary bank required count
expected: The reviewer can change the required task count within the bank limits, save it, reload the workspace and see the persisted value.
result: failed — count cannot be selected reliably
remediation preflight: automated pass; authenticated reviewer browser round trip is blocked without temporary reviewer access and a safe test bank.

### 26. Task and qualification bank CRUD
expected: The reviewer can add, edit, disable and remove ordinary tasks and all three qualification question types; save/error state is explicit and entered data is not lost.
result: failed — adding tasks/questions and understanding save state do not work reliably
remediation preflight: automated pass for ordinary and all three typed qualification flows; authenticated PC/phone CRUD remains blocked by the same safe-data gate.

### 27. Promotion editor control consistency
expected: Bank actions use the established PORTIA control hierarchy and expose clear enabled, disabled, saving, saved and error states on PC and phone.
result: failed — controls are inconsistent and the workflow is unclear
remediation preflight: source/behavior tests, scoped lint and production build pass; owner visual confirmation on authenticated PC and phone remains pending.

### 28. Spider persistence and explicit relocation
expected: While enabled, the spider never fades out or relocates after completing a route. A new visible spawn and non-identical initial pose are selected only after the user explicitly switches `Скрыть → Показать`.
result: failed — spider repeatedly disappears, reappears and resets to the same pose
remediation preflight: passed — lifecycle tests pass and the enabled spider stayed visible across the local browser observation while its route transform advanced.

### 29. Symmetric window bounds
expected: A normal window remains fully inside the desktop workspace with the same left and right inset; neither side permits hiding most of the frame.
result: failed — left movement is blocked while the right side permits most of the frame off-screen
remediation preflight: mirrored drag, oversized-window and resize-then-drag tests pass; physical PC edge dragging remains pending because the available browser surface is phone-width.

### 30. Shortcut animation handoff
expected: The final animated frame and resting shortcut use identical geometry, viewBox, scale, filter and raster/vector quality; no visible snap occurs when motion settles.
result: failed — quality and geometry visibly change at the animated-to-static handoff
remediation preflight: persistent-SVG geometry/style tests and local computed-style checks pass; owner visual confirmation at desktop DPR 1.25 remains pending.

### 31. Integrated regression pass
expected: Tests 22–30 pass together after reload on PC and phone, with no stale local state masking an API/database failure.
result: blocked by 22–30
remediation preflight: blocked by the live-write, authenticated reviewer, PC edge-drag and DPR 1.25 checks listed above; no automated failure remains.

### 32. Request badge includes in-progress requests
expected: The «Запросы» and type badges equal the rows visible in their queues, including a request already claimed or assigned rather than only `pending` rows.
result: failed — owner observed 0 while requests already existed
remediation preflight: automated pass; authenticated reviewer observation remains pending.

### 33. Qualification answer-key editor
expected: The reviewer writes the question normally and selects the correct visible answer with radio/checkbox controls; no zero-based indices are exposed.
result: failed — the index fields made qualification question creation unusable
remediation preflight: automated and responsive source pass; authenticated reviewer PC/phone interaction remains pending.

### 34. Spider front-leg signal
expected: Only the front pair beside the chelicerae performs a short hunting signal at irregular resting intervals; no pair twitches continuously.
result: failed — the rear pair moved continuously while resting
remediation preflight: passed — artwork geometry confirms that the face-side pair is `L4/R4` despite the misleading source numbering; it now owns the bounded 14–32 second signal and `L1/R1` remains neutral at rest. Owner visual timing confirmation remains pending.

### 35. Virus archive shortcut motion
expected: «База вирусов» performs one restrained diagnostic scan on hover/focus and returns to the identical resting vector without a quality snap.
result: failed — owner rejected the previous generic pulse/rotation
remediation preflight: exact terminal-frame tests and local scan-layer browser smoke pass; owner aesthetic confirmation remains pending.

### 36. Spider custom colour fidelity
expected: The wallpaper spider keeps the calm PORTIA logo-like black/pale/accent palette, while Vivian uses the readable interface accent and no longer looks substantially darker than the surrounding controls.
result: failed — the wallpaper spider became neon and Vivian remained noticeably darker than the selected interface colour
remediation preflight: passed — the raw `--spider-accent` override was removed, wallpaper fills are derived from the readable system accent, and the local browser confirmed Vivian's brighter accent filter without runtime errors.

### 37. Qualification focus lock and status freshness
expected: Loading or active qualification makes «Повышение» the only interactive window, darkens the rest of the desktop, prevents moving/minimising/closing that window, and refreshes status immediately when the attempt ends.
result: failed — other windows and desktop controls remained available, while qualification information could lag behind the attempt state
remediation preflight: automated pass — modal lock, guarded desktop actions, 5-second fallback polling and immediate terminal refresh are covered; a real active qualification still requires the safe authenticated fixture listed below.

### 38. Bounded editor lists and non-sticky contents
expected: Editor headings and contents remain at their natural top position, while long record lists use a bounded internal scrollbar instead of extending the entire window indefinitely.
result: failed — sticky editor chrome consumed useful space and record columns grew without a practical limit
remediation preflight: source and production-build pass — content editors, Promotion banks and record lists now use bounded internal scrolling; authenticated PC/phone visual confirmation remains pending.

### 39. Global search surface coverage
expected: Global search reaches applications and records from employees, guide, information, virus archive, broadcasts and recycle bin, and opens the owning surface for a selected result.
result: failed — search coverage omitted major desktop surfaces and employee records
remediation preflight: passed — source regressions cover all requested providers, and the local browser lists the requested applications without console/runtime errors; employee result interaction awaits a session with loaded roster data.

## Remediation preflight — 2026-10-29

- `npm test`: 574 passed, 1 opt-in isolated-live test skipped, 0 failed (575 total).
- `npm run test:promotion-live` with `READ_ONLY_PREFLIGHT`: 1/1 passed; all 18 deployed Promotion RPC signatures are present.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Scoped lint for every remediation module changed in plans 14-15 through 14-18: passed.
- Scoped lint for the newly changed modules passes. Full-file desktop lint still reports the pre-existing refs-during-render issue in `GuideApp` and existing `<img>` warnings; no newly changed surface reports an error.
- Local in-app-browser smoke: no console/runtime errors; wallpaper spider and Vivian use the corrected palette; global search exposes the requested application surfaces.
- Production data and the employee sheet were not mutated during preflight.

### Required to finish test 31

1. An owner-approved temporary eligible/cooldown nickname present in the roster, plus a second nickname for the neutral device-conflict check.
2. Temporary `promo` reviewer access and a safe ordinary/qualification bank that may be edited from PC and phone.
3. An isolated Supabase test-project URL, anon key and service-role key for the guarded mutating live suite; production credentials are intentionally rejected for this run.

## Summary

total: 39
passed: 0
issues: 18
pending: 21
skipped: 0
blocked: 1
failed: 17

remediation_preflight_passed: 3
remediation_preflight_partial: 14
remediation_preflight_blocked: 1

## Gaps

- GAP-14-01: participant request and first-binding path is not proven against the live deployed RPC contract (tests 23–24).
- GAP-14-02: cooldown copy has Russian punctuation regression and action absence lacks a trustworthy reason (tests 22–23).
- GAP-14-03: ordinary and qualification bank count/CRUD/control states fail owner use (tests 25–27).
- GAP-14-04: spider lifecycle violates explicit-toggle-only relocation (test 28).
- GAP-14-05: window clamping is asymmetric and permits excessive right overflow (test 29).
- GAP-14-06: shortcut animation-to-resting handoff visibly snaps (test 30).
- GAP-14-07: reviewer request badges, qualification answer-key UX, spider signal/colour and virus shortcut quality require the integrated fixes in tests 32–36.
- GAP-14-08: qualification modal focus, bounded editor layout and expanded global search require owner/live confirmation in tests 37–39.
- Source todo: `.planning/todos/pending/2026-10-28-stabilize-promotion-and-desktop-ui.md`.
