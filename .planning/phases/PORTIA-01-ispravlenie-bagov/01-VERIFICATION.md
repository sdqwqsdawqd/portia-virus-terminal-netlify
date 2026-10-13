---
phase: PORTIA-01-ispravlenie-bagov
verified: 2026-10-13T11:30:00Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-01-PLAN.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-01-SUMMARY.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-02-PLAN.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-02-SUMMARY.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-03-PLAN.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-03-SUMMARY.md
  - app/layout.tsx
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
covered_digest: "v3:sha256:d68d4220180dd92c610ce314c337b433c549bb53c342179d1f897db732790daa"
behavior_unverified: 1
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "Dark Reader is locked: the committed WIP `darkreader-lock` meta actually reaches the page (CR-01)"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Ctrl+wheel zoom of the embedded «Устав»/«Таблица» works (committed WIP; plan 01-01 truth)"
    test: "Open «Устав», click inside the document so the iframe has focus, then hold Ctrl and scroll the wheel. Repeat after clicking the window title bar (parent focus). Also hold the Win key while over the document."
    expected: "Document zoom steps 50-200 % in both cases and the browser tab does not zoom; Win key does not raise the overlay or block clicks/scroll"
    why_human: "Code review WR-01/WR-02/WR-03: ctrlHeld is driven by keydown/keyup on the parent window only, so with focus inside the iframe the overlay never mounts and the wheel is swallowed by the iframe; `metaKey` also counts as a modifier. Event routing across a cross-origin iframe is not assertable by grep and no test covers it."
human_verification:
  - test: "Open «Устав» and «Таблица»: step 50/100/200 % with − / + and Ctrl+wheel, windowed, maximized, 375px. Also click into the document first, then Ctrl+wheel."
    expected: "Page covers the whole area under the title bar at every step; bar stays a bottom-right pill; Ctrl+wheel zooms the document, not the tab, even with iframe focus."
    why_human: "Cross-origin iframe under transform; key/wheel routing (WR-01)."
  - test: "Owner login (/owner-login): virus list, «Информация» sections, «Корзина», «Рекомендации» at desktop and 375px; long-press (about 170 ms) and drag to reorder."
    expected: "Only ≡ at row start, fully inside the row, no label or tooltip; reorder works."
    why_human: "Owner session required; containment is a rendered property."
  - test: "«Корзина»: open a text file, an image and a recycled virus, windowed/maximized/375px; press ×."
    expected: "Heading hidden, viewer meets the title bar and window edges, virus record keeps its header, × restores the list."
    why_human: "Rendered geometry."
  - test: "«Сотрудники»: employee with and without Roblox id; hover, Tab, click the portrait."
    expected: "No «Профиль Roblox» text; hover ring and hand cursor; click opens roblox.com/users/{id}/profile in a new tab; no link without id."
    why_human: "Hover/focus/new-tab behaviour."
  - test: "DevTools Computed/Rendered Fonts on rich-text field, scientist log, archive paragraph; compare «ЖИРНЫЙ» vs «СРЕДНИЙ»."
    expected: "IBM Plex Serif with Cyrillic, no change on focus, visible weight difference."
    why_human: "Glyph and weight rendering."
  - test: "With the Dark Reader extension enabled, open the site."
    expected: "The extension reports the site as locked / already dark and does not rewrite the page."
    why_human: "Extension behaviour is not observable from build output (the tag itself is verified below)."
---

# Phase PORTIA-01: Исправление багов Verification Report

**Phase Goal:** Пять видимых багов из списка пользователя устранены, незакоммиченная работа (зум, Dark Reader, подзаголовок) закоммичена
**Verified:** 2026-10-13
**Status:** human_needed
**Re-verification:** Yes, after gap closure (plan 01-03)

## Re-verification Summary

The single previous gap (CR-01, `darkreader-lock` meta never emitted) is closed. Truths 1-5 were re-checked quickly for regressions (existence and sanity); none found. Plan 01-03 touched only `app/layout.tsx` (`git diff --stat 83d176b..HEAD -- app components lib` after a4df852 shows the layout file as the only change from that commit), so no regression surface exists in the other files.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 / FIX-01: drag handle fully inside the row | ✓ VERIFIED (static) | `ТЯНИТЕ` count in portia-editor.tsx is 0; `OrderDragHandle` unchanged since the previous pass. Rendered check is a human item. |
| 2 | SC2 / FIX-02: «Устав» fills the whole window at any zoom | ✓ VERIFIED (static) | `.document-app-viewport { position:absolute; inset:0 }` and absolutely positioned scaled iframe present (portia.css:1106-1107). Visual check is a human item. |
| 3 | SC3 / FIX-03: no Georgia in editor fields | ✓ VERIFIED | `grep -i georgia` over app/components/lib returns nothing; `plexSerif` still wired in layout.tsx (`--font-plex-serif` on `<html>`). |
| 4 | SC4 / FIX-04: file from «Корзина» opens over the whole window | ✓ VERIFIED (static) | `is-viewing` toggle present at portia-desktop.tsx:922. Geometry is a human item. |
| 5 | SC5 / FIX-05: portrait click opens Roblox profile, no text link | ✓ VERIFIED (static) | `a.personnel-portrait` with roblox.com href at portia-desktop.tsx:872, `<figure>` fallback without id. |
| 6 | Goal clause: uncommitted WIP (zoom, Dark Reader, subtitle) committed, and the Dark Reader lock actually works | ✓ VERIFIED (Dark Reader, subtitle); ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (zoom) | Commit ecaf6a4 holds the WIP. Commit a4df852 sets `other: { "darkreader-lock": "true" }` (layout.tsx:22). Built `.next/server/app/index.html` (mtime 11:11:56, after layout.tsx 11:10:04) contains `<meta name="darkreader-lock" content="true"/>` at offset 2908, inside `<head>` (226..3175). Zoom behavior with iframe focus is the tracked human item below. |

**Score:** 6/6 truths verified (1 present, behavior-unverified: Ctrl+wheel zoom, counted within truth 6 only for its commit/presence part and tracked separately)

### Gap Closure Check (CR-01)

- Source: `app/layout.tsx:21-22`, comment explains why content must be non-empty; value `"true"`. Title, description, icons, the four font instances, `<html>` className and `suppressHydrationWarning` are unchanged (read in full).
- Commit: a4df852 `fix(layout): emit darkreader-lock meta (CR-01)`, one file, +2/-1. Summary commit 4afbdeb is docs only.
- Artifact: `grep -o '<meta[^>]*darkreader[^>]*>'` on the fresh build returns the single expected tag.
- Prohibitions in 01-03 (no forced colour/colour-scheme overrides, no script, no push/PR/branch change): diff is a single meta value; nothing else added. Judgment tier, no violation seen; NON-AUTHORITATIVE judgment, human review of the diff is trivial (2 lines).

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/layout.tsx` | IBM_Plex_Serif as `--font-plex-serif`; darkreader-lock with non-empty content | ✓ VERIFIED | Font wiring intact; meta now emitted |
| `app/portia.css` | `--serif` token, absolute viewport, 34px-first grids, `.trash-app.is-viewing`, portrait link | ✓ VERIFIED | Unchanged since previous pass; spot-checked |
| `components/portia-desktop.tsx` | `EmbeddedDocument`, `is-viewing`, portrait link | ✓ VERIFIED | lines 872, 922 |
| `components/portia-editor.tsx` | `OrderDragHandle` only ≡ | ✓ VERIFIED | no `ТЯНИТЕ` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| layout.tsx `other["darkreader-lock"]` | rendered `<meta>` in `<head>` | Next metadata | WIRED | tag present in built HTML at offset 2908 |
| layout.tsx plexSerif.variable | portia.css `--serif` | `--font-plex-serif` on `<html>` | WIRED | unchanged |
| activeTrashFile/Virus | `.trash-app.is-viewing` | className toggle | WIRED | unchanged |
| `selectedEmployee.robloxUserId` | roblox.com profile URL | href on `a.personnel-portrait` | WIRED | unchanged |

### Data-Flow Trace (Level 4)

Not applicable: layout/CSS/font/link/metadata changes. Portrait `href` derives from real employee data.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| darkreader meta in built HTML | `grep -o '<meta[^>]*darkreader[^>]*>' .next/server/app/index.html` | `<meta name="darkreader-lock" content="true"/>`, inside `<head>` | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Unit tests | `npm test` | 13 pass / 0 fail | ✓ PASS (none cover the UI changes) |
| No Georgia left | `grep -rIil georgia app components lib` | none | ✓ PASS |

Build was not re-run by the verifier; the orchestrator reported exit 0 and the on-disk `.next` output is newer than the last source edit and was inspected directly.

### Probe Execution

SKIPPED, no probes declared by any plan.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-01 | 01-02 | Drag handle stays inside row | ✓ SATISFIED (rendered check pending) | truth 1 |
| FIX-02 | 01-01 | Устав fills window | ✓ SATISFIED (rendered check pending) | truth 2 |
| FIX-03 | 01-01 | Site font instead of Georgia | ✓ SATISFIED | truth 3 |
| FIX-04 | 01-02 | Trash file full window | ✓ SATISFIED (rendered check pending) | truth 4 |
| FIX-05 | 01-02 | Roblox via portrait click | ✓ SATISFIED (interactive check pending) | truth 5 |

All five IDs appear in PLAN frontmatter (01-01, 01-02) and REQUIREMENTS.md (lines 7-11, traceability table lines 46-50). Plan 01-03 declares `requirements: []` by design (closes a goal clause, not a FIX-xx). No orphaned IDs. Note: REQUIREMENTS.md currently shows `[ ]` / "Gaps Found" for all five (reverted in commit 59b99e0); it should be flipped back to Complete by the orchestrator since the gap is now closed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| components/portia-desktop.tsx | 1109-1119, 1128 | zoom modifier driven by parent-window key events; `metaKey` counted | ⚠️ Warning | WR-01/02/03: Ctrl+wheel zoom lost when iframe focused; explicitly out of scope for 01-03, human item, not a gap |
| components/portia-desktop.tsx | 872 | unlabelled portrait link, no `title` | ℹ️ Info | IN-01 (deliberate per D-05) |
| components/portia-editor.tsx | 131-152 | no hint for 170 ms hold-to-drag | ℹ️ Info | IN-02 (deliberate per D-01) |
| components/portia-desktop.tsx | 1148 | aria-label hides zoom value | ℹ️ Info | IN-03 |

The previous blocker (layout.tsx empty-content meta) is resolved. No TBD/FIXME/XXX markers in files touched by 01-03.

### Human Verification Required

See frontmatter `human_verification`: six items (zoom fill and Ctrl+wheel with iframe focus; drag handle under owner login; Корзина viewer geometry; Roblox portrait; IBM Plex Serif rendering; Dark Reader extension reaction). These are rendering/interaction checks that code inspection cannot cover.

### Gaps Summary

No gaps remain. All five roadmap success criteria (FIX-01..FIX-05) are implemented, wired and committed, and the Dark Reader lock now demonstrably reaches the built HTML. Status is `human_needed` because of one behavior-unverified truth (Ctrl+wheel zoom with iframe focus, WR-01..03, deliberately left for a later decision) and the rendering checks above.

---

_Verified: 2026-10-13_
_Verifier: Claude (gsd-verifier)_
