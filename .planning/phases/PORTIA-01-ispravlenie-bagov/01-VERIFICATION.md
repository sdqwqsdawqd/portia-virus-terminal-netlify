---
phase: PORTIA-01-ispravlenie-bagov
verified: 2026-10-13T14:00:00Z
status: human_needed
score: 12/12 must-haves verified
covered_files:
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-01-PLAN.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-01-SUMMARY.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-02-PLAN.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-02-SUMMARY.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-03-PLAN.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-03-SUMMARY.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-04-PLAN.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-04-SUMMARY.md
  - app/layout.tsx
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
covered_digest: "v3:sha256:11c6a4369d1acc0dfb90249468c80d9b8c70ca75e0dc26dccb377aa14083e819"
behavior_unverified: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/6
  gaps_closed:
    - "G-PORTIA-01-5 (UAT test 5): editor field font must match the site area being edited (user clarification, supersedes 01-CONTEXT D-03)"
    - "Ctrl+wheel zoom with iframe focus (previously behavior_unverified): UAT test 1 passed by the user"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Owner login (/owner-login). For each of the 10 areas open the editor field and the matching site area side by side (lead: virus dossier sections 02/04; metric: section 03; mutation: section 05; scientist: log; info: «Информация»; broadcast: «Сводка»; trash text file and image caption: «Корзина»; search: «Рекомендации»; assistant: Вивьян bubble). Toggle БЕЛЫЙ/ЧЁРНЫЙ. Repeat at 375px."
    expected: "Each field shows the same typeface, base size and line height as the site text it edits; only the scientist field is serif; the preview toggle changes colour and background only. This is the UAT test 5 re-test."
    why_human: "Rendered side-by-side comparison inside the owner session; computed styles were checked by the orchestrator at 397px but not visually compared."
  - test: "Judge the two small fields: «Рекомендации» (search, 11px) and the assistant phrase fields (700 10px Segoe UI stack)."
    expected: "The user accepts that these editor fields are now as small as the site text they mirror."
    why_human: "Product decision: a faithful mirror makes these fields much smaller than the old 17px field."
  - test: "Open «Сводка» with a published broadcast."
    expected: "Type label (ЗАДАЧА / НОВОСТЬ / ЕЖЕНЕДЕЛЬНЫЙ КВЕСТ) stays 11px bold in teal/amber/blue; the body is now 15px regular grey-green."
    why_human: "Intentional visible change on the public site (listed in 01-04 SUMMARY); needs the user's eye."
---

# Phase PORTIA-01: Исправление багов Verification Report

**Phase Goal:** Пять видимых багов из списка пользователя устранены, незакоммиченная работа (зум, Dark Reader, подзаголовок) закоммичена
**Verified:** 2026-10-13
**Status:** human_needed
**Re-verification:** Yes, after UAT gap closure (plan 01-04)

## Re-verification Summary

Gap G-PORTIA-01-5 (UAT test 5) is closed in code. The previously tracked behavior-unverified item (Ctrl+wheel zoom with iframe focus) is resolved by the user's UAT test 1 pass. UAT test 6 (Dark Reader extension) was skipped by the user ("не важно"); the meta tag itself stays verified in the code. What remains is the human re-test of test 5: a rendered side-by-side comparison of editor field vs site text in the owner session, plus acceptance of the small search and assistant fields.

Truths 1-6 from the previous report were regression-checked (existence and sanity): `ТЯНИТЕ` count 0 in `components/portia-editor.tsx`; `.document-app-viewport` absolute (portia.css:1118-1119); `is-viewing` at portia-desktop.tsx:922; `a.personnel-portrait` with roblox.com href at :872; `darkreader-lock` at layout.tsx:22; no Georgia anywhere in app/components/lib. Plan 01-04 touched only `components/portia-editor.tsx` and `app/portia.css` (git diff fe2fbf8..a9241e6), so layout.tsx and portia-desktop.tsx are unchanged.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 / FIX-01: drag handle fully inside the row | ✓ VERIFIED (static; UAT 2 pass) | `ТЯНИТЕ` count 0; UAT test 2 passed by the user |
| 2 | SC2 / FIX-02: «Устав» fills the whole window at any zoom | ✓ VERIFIED (static; UAT 1 pass) | portia.css:1118-1119; UAT test 1 passed, including Ctrl+wheel with iframe focus |
| 3 | SC3 / FIX-03: no Georgia, editor fields use the font of the site area they edit | ✓ VERIFIED (code + computed styles); visual re-test pending | See truths 7-11; `grep -i georgia` over app/components/lib: none |
| 4 | SC4 / FIX-04: file from «Корзина» opens over the whole window | ✓ VERIFIED (static; UAT 3 pass) | portia-desktop.tsx:922; UAT test 3 passed |
| 5 | SC5 / FIX-05: portrait click opens Roblox profile, no text link | ✓ VERIFIED (static; UAT 4 pass) | portia-desktop.tsx:872; UAT test 4 passed |
| 6 | Goal clause: WIP (zoom, Dark Reader, subtitle) committed; lock reaches the page | ✓ VERIFIED | Commit ecaf6a4 (UAT test 7 auto-pass); `other: { "darkreader-lock": "true" }` at layout.tsx:22; extension reaction not tested (test 6 skipped by the user) |
| 7 | 01-04: every editor field mirrors the font family, size and line height of its site area; only scientist is serif | ✓ VERIFIED | `type DisplayArea` (10 literals, editor:38); required `area: DisplayArea` prop (:1031); `data-area={area}` on the contentEditable div with `ref={editorRef}` (:1081); `area=` at all 13 call sites (613, 614, 619, 637, 653, 684, 700, 798 via image/text ternary, 814, 833, 834, 841, 842); shared block portia.css:475-484, all `var(--sans)` except scientist `var(--serif)` and assistant `var(--assistant-font)` |
| 8 | 01-04: each area font declared once in a shared rule (display selector + `[data-area]` field); ≤900px overrides carry the field | ✓ VERIFIED | Display rules no longer declare font (diff shows font/size/line-height removed from the 9 display rules); grep of all area classes finds no competing font rule on the same elements except the dead `p` rules and the unrelated children; overrides at portia.css:911 (lead), :945 (info), :989 (trash) list the field |
| 9 | 01-04: БЕЛЫЙ/ЧЁРНЫЙ toggle changes only background and colour; base `.formatted-rich-input` sets no font | ✓ VERIFIED | portia.css:468 and :472 carry no font/font-family; only `:empty::before` placeholder font (:473) remains, which is not text content |
| 10 | 01-04: broadcast body renders 15px/1.7 regular; label keeps 700 11px | ✓ VERIFIED | portia.css:376-378 narrowed to `> span:first-child`; label is the first span of `.broadcast-card` (portia-desktop.tsx:912) and the body `FormattedText.broadcast-card-copy` is a later sibling |
| 11 | 01-04: other areas keep their previous values; no Georgia | ✓ VERIFIED | Shared values equal the removed display values (16/1.75, 14/1.6, 14/1.65, 17/1.78 serif, 16/1.78, 14/1.75, 14/1.65, 11px, 700 10px/1.5); ≤900px values unchanged (15/1.7, 15, 12/1.65); assistant `!important` rule at :658 now uses `var(--assistant-font)`, literal Segoe stack appears once (:25) |
| 12 | 01-04: three local commits on design/stage-1-desktop; tsc, tests, build green | ✓ VERIFIED | `git log fe2fbf8..HEAD`: 5dfa482, 374335a, a9241e6 (+ docs 439b69c) on branch design/stage-1-desktop; `npx tsc --noEmit` exit 0 and `npm test` 13 pass / 0 fail re-run by the verifier; `npm run build` exit 0 and live computed fonts per area at 397px are the orchestrator's report (not re-run here); lint not re-run |

**Score:** 12/12 truths verified, 0 behavior-unverified. The only open items are visual/product confirmations for UAT test 5.

### Prohibitions (01-04)

All three are judgment tier; NON-AUTHORITATIVE verdicts, no violation seen.

| Prohibition | Verdict | Evidence |
|-------------|---------|----------|
| Saved content unchanged (formatKey, RichTextDocument shape, save path) | no violation (judgment) | Editor diff is only the type, the prop in the destructuring and signature, `data-area`, and `area=` attributes at call sites |
| role=textbox, aria-multiline, spellCheck, handlers unchanged | no violation (judgment) | Lines :1082-1090 untouched in the diff |
| No change to formatting panel controls or layout; no push/PR/branch switch | no violation (judgment) | Diff touches only portia-editor.tsx and portia.css font declarations plus selectors; branch is design/stage-1-desktop |

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/portia-editor.tsx` | `DisplayArea` union, required `area` prop rendered as `data-area`, 13 call sites | ✓ VERIFIED | contains `data-area={area}`; all 13 sites pass `area` |
| `app/portia.css` | one shared typography rule per area, `--assistant-font` token, narrowed broadcast label selectors, no font on base/preview-dark | ✓ VERIFIED | lines 25, 376-378, 468-484, 658, 911, 945, 989 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| FormattedTextarea `area` | `.formatted-rich-input[data-area=...]` | `data-area={area}` | WIRED | specificity (0,2,0) beats base (0,1,0); orchestrator computed fonts confirm each area applies |
| Site display selectors | shared rule | selector list | WIRED | display rules have no font of their own, shared block is the sole source |
| `--assistant-font` | `.assistant-formatted-text > span` and shared assistant rule | `var(--assistant-font)` | WIRED | portia.css:484, :658 |

### Data-Flow Trace (Level 4)

Not applicable: presentation-only change (prop to attribute to CSS). `area` is never stored.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Unit tests | `npm test` | 13 pass / 0 fail | ✓ PASS (none cover the UI) |
| 13 call sites pass `area` | grep `area=` in portia-editor.tsx | 13 sites | ✓ PASS |
| Computed field fonts at 397px | orchestrator report | lead Golos 15/1.7, metric 14, mutation 14, scientist IBM Plex Serif 17/1.78, info 15, broadcast 15/1.7, trash 12, caption 14, search 11, assistant Segoe UI 10 bold | ✓ PASS (reported, not reproduced) |
| No Georgia | `grep -rIil georgia app components lib` | none | ✓ PASS |

### Probe Execution

SKIPPED, no probes declared by any plan.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-01 | 01-02 | Drag handle inside row | ✓ SATISFIED | truth 1, UAT 2 pass |
| FIX-02 | 01-01 | Устав fills window | ✓ SATISFIED | truth 2, UAT 1 pass |
| FIX-03 | 01-01, 01-04 | Editor fields use site font, clarified: font of the edited area | ✓ SATISFIED in code; visual re-test pending | truths 3, 7-11 |
| FIX-04 | 01-02 | Trash file full window | ✓ SATISFIED | truth 4, UAT 3 pass |
| FIX-05 | 01-02 | Roblox via portrait click | ✓ SATISFIED | truth 5, UAT 4 pass |

All five IDs appear in PLAN frontmatter (01-01, 01-02, 01-04) and in REQUIREMENTS.md (lines 7-11, table 46-50). No orphaned IDs. Plan 01-03 declares `requirements: []` by design. Tracking mismatch for the orchestrator: REQUIREMENTS.md still shows `[ ]` / "Gaps Found" for FIX-01, 02, 04, 05 (only FIX-03 is Complete), although UAT tests 1-4 passed. FIX-03 should stay Complete only once the test 5 re-test passes.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| app/portia.css | 655 | `.assistant-bubble > span` (0,1,1) also matches the assistant text root | ℹ️ Info | Pre-existing, same defect class as the broadcast one; out of scope in 01-04 and listed in its SUMMARY ("Noticed, not fixed"); live family/size/weight are unaffected |
| app/portia.css | 993, 1008 | assistant ≤900px size (9px/10px, line-height 1.45) not mirrored by the field | ℹ️ Info | Deliberate per plan; field stays 10px/1.5 |
| components/portia-editor.tsx | 1135, 1176 | formatting panel default size 17 / preset "M" no longer equals the base size for most areas | ℹ️ Info | Deliberate; belongs to phase 5 (TEXT-01) |
| components/portia-desktop.tsx | 1109-1128 | zoom modifier key handling (WR-01..03) | ℹ️ Info | UAT test 1 passed including iframe focus; no longer a verification blocker |

No TBD/FIXME/XXX markers in files modified by 01-04.

### Human Verification Required

See frontmatter `human_verification`: (1) UAT test 5 re-test, side-by-side per area in the owner session, both preview surfaces, desktop and 375px; (2) user acceptance of the small search (11px) and assistant (10px bold) fields; (3) the intentional visible change to broadcast bodies in «Сводка».

### Gaps Summary

No gaps. G-PORTIA-01-5 is implemented, wired, committed and consistent with the user's clarified intent. Status is `human_needed` only because the confirming evidence for the clarified FIX-03 is a rendered comparison that requires an owner login, and the product acceptability of the small fields is the user's call.

---

_Verified: 2026-10-13_
_Verifier: Claude (gsd-verifier)_
