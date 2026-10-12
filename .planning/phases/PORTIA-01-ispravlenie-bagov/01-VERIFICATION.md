---
phase: PORTIA-01-ispravlenie-bagov
verified: 2026-10-13T00:00:00Z
status: gaps_found
score: 5/6 must-haves verified
covered_files:
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-01-PLAN.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-01-SUMMARY.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-02-PLAN.md
  - .planning/phases/PORTIA-01-ispravlenie-bagov/01-02-SUMMARY.md
  - app/layout.tsx
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
covered_digest: "v3:sha256:a7acca2a1397896f7d48a1aadc0ab086a01e5045620799a281001f81b393306f"
behavior_unverified: 1
gaps:
  - truth: "Dark Reader is locked: the committed WIP `darkreader-lock` meta actually reaches the page (phase goal names Dark Reader work; intent is that the extension leaves the site alone)"
    status: failed
    reason: "`other: { \"darkreader-lock\": \"\" }` in app/layout.tsx is silently skipped by Next 16.3.4 (node_modules/next/dist/lib/metadata/metadata.js: pushes a <meta> only when `content != null && content !== ''`). Built .next/server/app/index.html (built after the last edit of layout.tsx) contains only description / viewport / next-size-adjust metas and zero `darkreader` matches. The commit exists, but the feature it ships is a no-op."
    artifacts:
      - path: "app/layout.tsx"
        issue: "line 21: empty-string content is dropped, no <meta name=\"darkreader-lock\"> is emitted"
    missing:
      - "Give the meta a non-empty content (`other: { \"darkreader-lock\": \"true\" }`) or render `<head><meta name=\"darkreader-lock\" /></head>` directly; then rebuild and confirm `grep darkreader .next/server/app/index.html` matches"
behavior_unverified_items:
  - truth: "Ctrl+wheel zoom of the embedded «Устав»/«Таблица» works (committed WIP; plan 01-01 truth)"
    test: "Open «Устав», click inside the document so the iframe has focus, then hold Ctrl and scroll the wheel. Repeat after clicking the window title bar (parent focus). Also hold the Win key while over the document."
    expected: "Document zoom steps 50-200 % in both cases and the browser tab does not zoom; Win key does not raise the overlay or block clicks/scroll"
    why_human: "Code review WR-01/WR-02/WR-03: ctrlHeld is driven by keydown/keyup on the parent window only, so with focus inside the iframe the overlay never mounts and the wheel is swallowed by the iframe; `metaKey` also counts as a modifier. Event routing across a cross-origin iframe is not assertable by grep and no test covers it."
---

# Phase PORTIA-01: Исправление багов Verification Report

**Phase Goal:** Пять видимых багов из списка пользователя устранены, незакоммиченная работа (зум, Dark Reader, подзаголовок) закоммичена
**Verified:** 2026-10-13
**Status:** gaps_found
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 / FIX-01: drag handle in «Рекомендациях» and «Корзине» (and virus list, info sections) fully inside the row, desktop and phone | ✓ VERIFIED (static) | commit 801c031. `OrderDragHandle` (portia-editor.tsx:115-152) renders only `<span aria-hidden>≡</span>`; `<small>ТЯНИТЕ</small>` and `title` removed, `aria-label="Изменить порядок: …"` kept. All 4 call sites (lines 588, 680, 717, 814) are now the first DOM child. CSS grids `.editor-record-row` and `.recommendation-order-row` use `34px minmax(0,1fr)`; `:first-child` selectors updated to `:last-child` (also in the mobile block, line 955). No remaining `ТЯНИТЕ` string. Rendered containment needs the owner session (human item 2). |
| 2 | SC2 / FIX-02: «Устав» fills the whole window at any zoom | ✓ VERIFIED (static) | commit d2c2909. `.document-app-viewport { position:absolute; inset:0 }`, iframe `position:absolute; top/left:0`, inline width/height `100/zoom %` with `scale(zoom)` and `transform-origin:0 0` (portia-desktop.tsx:1131), so scaled frame always covers the viewport. Zoom bar is an absolutely positioned bottom-right overlay (`.document-app-bar`), takes no layout space. Visual confirmation is human item 1. |
| 3 | SC3 / FIX-03: no Georgia in editor fields | ✓ VERIFIED | commit 2be1417. `grep -i georgia` across the repo (excluding node_modules/.next/.planning) returns nothing. `.formatted-rich-input`, `.scientist-rich-text`, `.archive-document-section p` use `var(--serif)`; `--serif: var(--font-plex-serif), serif` in `:root`; `IBM_Plex_Serif` (latin+cyrillic, 400/600/700) wired through `plexSerif.variable` on `<html>`. Focus rule no longer overrides `font-family`. |
| 4 | SC4 / FIX-04: file from «Корзина» opens over the whole window | ✓ VERIFIED (static) | commit 8e0800d. `.trash-app` gets `is-viewing` when `activeTrashFile \|\| activeTrashVirus` (portia-desktop.tsx:922); CSS hides the direct-child `header`, zeroes padding and layout border; `.trash-viewer` is `position:absolute; inset:0` inside `.trash-layout` (flex 1). Child combinator keeps the virus record's own `header.record-header`. Mobile padding override loses on specificity (0,2,0 vs 0,1,0). Geometry check is human item 3. |
| 5 | SC5 / FIX-05: no «Профиль Roblox» link; portrait click opens profile | ✓ VERIFIED (static) | commit 4676cf4. No `Профиль Roblox` text node remains (only the `aria-label` on the portrait link). Portrait is `<a class="personnel-portrait" href="https://www.roblox.com/users/{id}/profile" target="_blank" rel="noreferrer">` when `robloxUserId` is set, plain `<figure>` otherwise. Hover/focus ring CSS present. `robloxUserId` is `number \| null`, so URL interpolation is safe. Interactive behaviour is human item 4. |
| 6 | Goal clause: uncommitted WIP (zoom, Dark Reader, subtitle) committed, and Dark Reader work does what it is meant to | ✗ FAILED (partial) | Commit ecaf6a4 `feat(desktop): zoom embedded documents, lock Dark Reader` exists, precedes all FIX commits, contains zoom (`EmbeddedDocument`), `suppressHydrationWarning`, and the removed empty-archive subtitle (the `<span>Новые записи появятся…</span>` is gone). Working tree for app/components/lib is clean. BUT the `darkreader-lock` meta never reaches the HTML (see gap). Literal "committed" is satisfied; the intent "Dark Reader locked" is not. Zoom portion: ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (below). |

**Score:** 5/6 truths verified (1 present, behavior-unverified: Ctrl+wheel zoom, tracked separately and not counted in the gap)

### Decision on CR-01 (orchestrator question)

CR-01 is confirmed independently, not taken from the review:
- Source: Next 16.3.4 `metadata.js` "Other" branch skips `content === ''`.
- Artifact: `.next/server/app/index.html` (mtime 00:38, after `layout.tsx` 00:26) has no `darkreader`; the string appears only in a server chunk (the metadata config object).

The phase goal's wording ("Dark Reader ... закоммичена") is met literally, but the stated purpose of the commit and of the code comment ("tells Dark Reader to leave it alone") is not. I treat it as a gap, not a pass: it is a one-line fix and the user explicitly named Dark Reader. If the maintainer decides the literal reading is enough, accept it with an override:

```yaml
overrides:
  - must_have: "Dark Reader is locked: the committed WIP darkreader-lock meta actually reaches the page"
    reason: "Goal only requires the WIP be committed; lock fix deferred"
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

### Deferred Items

None. Phases 2-5 (LOOK, EDIT, DESK, TEXT) do not cover Dark Reader or document zoom.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/layout.tsx` | IBM_Plex_Serif exposed as `--font-plex-serif`; darkreader-lock | ⚠️ PARTIAL | Font wiring OK; darkreader meta inert (CR-01) |
| `app/portia.css` | `--serif` token, absolute viewport, 34px-first grids, `.trash-app.is-viewing`, `a.personnel-portrait` | ✓ VERIFIED | all patterns present (lines 24, 407-409, 437, 587-589, 1106-1107, 344-347) |
| `components/portia-desktop.tsx` | `EmbeddedDocument`, `is-viewing`, portrait link | ✓ VERIFIED | lines 922, 872, 1104 |
| `components/portia-editor.tsx` | `OrderDragHandle` only ≡ and aria-label, first in rows | ✓ VERIFIED | lines 115-152 and 4 call sites |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| layout.tsx plexSerif.variable | portia.css `--serif` | `--font-plex-serif` on `<html>` / `:root` (same element) | WIRED | |
| `.formatted-rich-input` / `.scientist-rich-text` / `.archive-document-section p` | `--serif` | `font: … var(--serif)` | WIRED | |
| OrderDragHandle call sites | `.editor-record-row` / `.recommendation-order-row` | first grid child, 34px first column | WIRED | |
| activeTrashFile/Virus | `.trash-app.is-viewing` | className toggle | WIRED | |
| `selectedEmployee.robloxUserId` | roblox.com profile URL | href on `a.personnel-portrait` | WIRED | |
| layout.tsx `other["darkreader-lock"]` | rendered `<meta>` | Next metadata | NOT_WIRED | empty content dropped |

### Data-Flow Trace (Level 4)

Not applicable beyond the above: changes are layout/CSS/font/link wiring. Portrait `href` derives from real employee data (`robloxUserId`).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck | `npx tsc --noEmit` | no output | ✓ PASS |
| Unit tests | `npm test` | 13/13 pass | ✓ PASS (none cover the UI changes) |
| Dark Reader meta in built HTML | `grep darkreader .next/server/app/index.html` | 0 matches | ✗ FAIL |
| No Georgia left | `grep -rI -i georgia` (excl. node_modules/.next/.planning) | none | ✓ PASS |

Build exit 0 reported by orchestrator; not re-run (the existing .next output is newer than the last source edit and was inspected).

### Probe Execution

SKIPPED, no probes declared by either plan.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-01 | 01-02 | Drag handle stays inside row | ✓ SATISFIED (rendered check pending) | truth 1 |
| FIX-02 | 01-01 | Устав fills window | ✓ SATISFIED (rendered check pending) | truth 2 |
| FIX-03 | 01-01 | Site font instead of Georgia | ✓ SATISFIED | truth 3 |
| FIX-04 | 01-02 | Trash file full window | ✓ SATISFIED (rendered check pending) | truth 4 |
| FIX-05 | 01-02 | Roblox via portrait click | ✓ SATISFIED (interactive check pending) | truth 5 |

All five IDs appear in PLAN frontmatter, in REQUIREMENTS.md (checked `[x]`, "Phase 1 / Complete"), and no other ID is mapped to Phase 1, so there are no orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| app/layout.tsx | 21 | empty-content meta silently dropped | 🛑 Blocker | Dark Reader lock does nothing (CR-01) |
| components/portia-desktop.tsx | 1109-1119, 1128 | zoom modifier driven by parent-window key events; `metaKey` counted | ⚠️ Warning | WR-01/02/03: Ctrl+wheel zoom lost when iframe focused; overlay can stick |
| components/portia-desktop.tsx | 872 | unlabelled portrait link, no `title` | ℹ️ Info | IN-01 (deliberate per D-05: no tooltip) |
| components/portia-editor.tsx | 131-152 | no hint for 170 ms hold-to-drag | ℹ️ Info | IN-02 (deliberate per D-01) |
| components/portia-desktop.tsx | 1148 | aria-label hides zoom value | ℹ️ Info | IN-03 |

No TBD/FIXME/XXX/TODO markers in the phase diff (39c56f8..HEAD). The «РЕВИЗИЯ N» footer is untouched. 01-REVIEW-DISPOSITION.md still lists all 7 findings as `open`.

### Human Verification Required

These are mostly executor-flagged items; the code is present and wired but rendering/interaction is not observable here.

1. **Устав / Таблица zoom fill and Ctrl+wheel**
   - **Test:** Open each, step 50/100/200 % with − / + and Ctrl+wheel, windowed, maximized, 375px. Also click into the document first and then Ctrl+wheel.
   - **Expected:** Page covers the whole area under the title bar at every step; bar stays a bottom-right pill; Ctrl+wheel zooms the document, not the tab, even with iframe focus.
   - **Why human:** cross-origin iframe under transform, key/wheel routing (WR-01).
2. **Editor drag handle (owner login)**
   - **Test:** Log in at /owner-login; check virus list, «Информация» sections, «Корзина», «Рекомендации» at desktop and 375px: handle rect inside row rect; long-press (about 170 ms) and drag to reorder.
   - **Expected:** Only ≡ at row start, no label or tooltip, reorder works.
   - **Why human:** owner session required; containment is a rendered property.
3. **Корзина viewer geometry**
   - **Test:** Open a text file, an image and a recycled virus, windowed/maximized/375px; press ×.
   - **Expected:** Heading hidden, viewer meets title bar and window edges, virus record keeps its header, × restores list.
   - **Why human:** rendered geometry.
4. **Roblox portrait**
   - **Test:** «Сотрудники»: employee with and without Roblox id; hover, Tab, click.
   - **Expected:** No «Профиль Roblox» text; hover ring and hand cursor; click opens roblox.com/users/{id}/profile in a new tab; no link without id.
   - **Why human:** hover/focus/new-tab behaviour.
5. **IBM Plex Serif rendering**
   - **Test:** DevTools Computed/Rendered Fonts on rich-text field, scientist log, archive paragraph; compare «ЖИРНЫЙ» vs «СРЕДНИЙ».
   - **Expected:** Plex Serif with Cyrillic, no change on focus, visible weight difference (400/600/700 vs editor's 800 option).
   - **Why human:** glyph and weight rendering.

### Gaps Summary

All five roadmap success criteria (FIX-01 to FIX-05) are implemented, wired and committed as separate, atomic commits, with requirement traceability complete. The single real gap is the Dark Reader lock: the WIP was committed as the goal asks, but the meta is never emitted, so the committed feature is inert (CR-01). One line fixes it. Separately, the committed Ctrl+wheel zoom has a focus-dependent hole (WR-01/02/03) that is a behavior question for a human, not a roadmap success criterion. After fixing CR-01 and completing the human checks above, the phase should be re-verified.

---

_Verified: 2026-10-13_
_Verifier: Claude (gsd-verifier)_
