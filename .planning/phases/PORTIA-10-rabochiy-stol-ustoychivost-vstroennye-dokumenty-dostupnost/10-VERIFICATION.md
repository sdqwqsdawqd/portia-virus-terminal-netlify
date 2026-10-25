---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
verified: 2026-10-26T12:00:00Z
status: human_needed
score: 5/6 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-01-PLAN.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-01-SUMMARY.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-02-PLAN.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-02-SUMMARY.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-03-PLAN.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-03-SUMMARY.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-04-PLAN.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-04-SUMMARY.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-05-PLAN.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-05-SUMMARY.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-06-PLAN.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-06-SUMMARY.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-07-PLAN.md"
  - ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-07-SUMMARY.md"
  - "app/portia.css"
  - "components/custom-color-picker.tsx"
  - "components/portia-desktop.tsx"
  - "components/portia-editor.tsx"
  - "lib/accent-boot.ts"
  - "lib/accent-custom.ts"
  - "lib/accent-theme.test.ts"
  - "lib/portia-desktop.test.ts"
covered_digest: "v3:sha256:7b48f2a1d9997d6b63ea75217a04d8e85aafee64483ccef23d03fe4e03882474"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open an Info page that has a YouTube video block (live content currently has none) on PC and on a phone and press play"
    expected: "The video plays inside the shared sandbox (allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox); if it does not, add only the one allow-* flag it needs"
    why_human: "ROADMAP criterion 2 says 'видео играет' was checked by the owner. 10-07-SUMMARY records step 3 (YouTube) as headless only, because live content has no video block. Headless proves the frame renders with the shared sandbox and allowfullscreen, not that playback works"
  - test: "Settings -> Цвет интерфейса -> Свой: look at the × button in the picker header on PC and phone"
    expected: "A clean 24x24 close button with a visible ×"
    why_human: "Code review WR-01 (open): .setting-options button (min-height 54px, padding 10px) also matches the picker's close button, so it is probably drawn about 24x54 with a clipped glyph. This is a visual check; Escape and a second click on «Свой» still close the picker"
gaps: []
---

# Phase 10: Рабочий стол: устойчивость, встроенные документы, доступность Verification Report

**Phase Goal:** Рабочий стол не падает на пустых данных, встроенные страницы изолированы и удобны в масштабе, а подсказки, роли и константы настроек приведены в порядок; в настройках можно выбрать свой цвет акцента
**Verified:** 2026-10-26
**Status:** human_needed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria, the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Assistant with an empty or vanished tip does not crash the desktop; a window with missing text opens | VERIFIED | `portia-desktop.tsx:1112-1137` takes `content.assistantAdvice ?? []`, `shuffledUniqueIndices` (:181) skips non-string and blank entries, no usable tip sets index -1 and hides the bubble. `assistantSpeaking` (:1203) is derived from `typeof text === "string" && text.trim() !== ""`, so a tip removed by the 10 s poll closes the bubble on the next render. `FormattedText` (:1906) takes `text?: string` and uses `text ?? ""`. Independent run: `10-desktop-check.mjs --check assistant` -> ok:true (fixtures with a tip, an empty list and whitespace-only tips; desktop stays mounted; no non-GET to /api/content) |
| 2 | Таблица, Устав and YouTube run in a shared `sandbox`; pages load, tabs switch, links open in a new tab, video plays; owner checked on PC and phone | UNCERTAIN (partly verified) | `embedSandbox` (:31) is used by both `<iframe>` tags (:1333, :1633); no `allow-top-navigation`; YouTube keeps `allowFullScreen`. Test "every embedded frame is sandboxed" passes. `--check embeds` -> ok:true (both document frames finish loading, video frame renders with the shared sandbox). Owner device check "verified" for sheet and charter. YouTube playback was headless only (no video block in live content), see Human Verification 1 |
| 3 | Zoom follows Ctrl (and Cmd on a Mac), not the Windows key; overlay does not stick or block clicks and scrolling; reset button speaks the percent | VERIFIED | `zoomModifier` (:1588) is the only `metaKey` use and requires a Mac platform. The layer exists only while `ctrlHeld`; it clears on keyup, blur, visibilitychange and the first unmodified pointer move or press (:1603-1636). Reset button has no aria-label/title, so its name is the percent. Tests (ZOOM-01, ZOOM-02) pass. `--check zoom` -> ok:true, covering: frame centre is the IFRAME without modifier, layer on top with Ctrl, Ctrl+wheel -> 110%, Meta on non-Mac ignored, Cmd on a Mac raises the layer |
| 4 | Quest notice closes with Escape without focus; roles correct in the notice and virus list; Roblox portrait has a tooltip; ≡ handle has none | VERIFIED | `QuestToast` (:1870-1887): document-level keydown listener that skips defaultPrevented, input/textarea/select/contenteditable and open dialogs; the `aside` has no role; hidden `role="status"` line "Новый квест: …". Virus list is a listbox only when rows exist, rows are `role="option"` with `aria-selected`. Roblox link has `title` equal to its `aria-label` (:1283); the plain portrait has none; the ≡ handle has no `title` (test D-18). `--check toast` -> ok:true (no-focus Escape closes; Escape in the search field does not; listbox/option counts; empty list has no role) |
| 5 | Settings key is one constant, a launch test catches drift; localStorage writes and `setWindows` are not inside state updaters | VERIFIED | `desktopSettingsStorageKey` exported from `lib/accent-boot.ts:7`; the desktop has no `portia-desktop-settings-v1` literal (grep: only the constant definition); tests at `accent-theme.test.ts:347-358` pin both the boot script and the desktop. My own scan of all 27 `set*(…=>…)` updaters (block and expression bodies) found none touching storage, another setter, `setTimeout` or `requestAnimationFrame`; `focusApp` (:796) takes z from `topZ` ref and calls `setWindows` outside any updater. The updater-purity test is a source scan for block bodies only, and my wider scan agrees |
| 6 | Settings has «Свой» with the editor's colour picker; it recolours everything that takes the accent (spider, icons, frames) and persists | VERIFIED | `lib/accent-custom.ts` derives all 10 tokens from one strict `#rrggbb` (null otherwise; OKLCH clamp L .62-.80, C .08-.17; filter search for spider/Vivian). `accent-boot.ts` embeds it into the head script and applies it before hydration. The desktop applies `customTokens` to `html` (:690-712), previews a draft live and stores only on release/blur/close (:745-766), restores through a strict check (:563-573), and a preset or factory reset clears inline tokens. `custom-color-picker.tsx` is the editor's picker (editor imports it back). CSS: 5 columns on PC, 2 columns with «Свой» spanning on the phone (`portia.css:292-299, 1198-1199`). Independent runs: `10-boot-check.mjs` against `next start` -> ok (valid custom, hostile, preset; 10 props); `--check accent` -> ok:true (a-l: boot before body parse, restore, live drag, save on release, reload, tampered colour ignored, preset switch, toggle, Escape, factory reset, no label overflow at 1920 and 520 px, phone layout) |

**Score:** 5/6 truths verified (criterion 2 is partly verified, one device item open)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/accent-custom.ts` | `deriveAccentTokens`, `accentTokenNames` | VERIFIED | 107 lines, self-contained, strict hex check, wired into boot script and desktop |
| `lib/accent-boot.ts` | settings key constant, boot script | VERIFIED | imported by desktop and layout; production HTML output exercised by the boot check |
| `components/custom-color-picker.tsx` | picker extracted from the editor | VERIFIED | imported by editor (:5) and desktop (:11) |
| `components/portia-desktop.tsx` | all desktop behaviours | VERIFIED | substantive, data flows from `content` / `localStorage` into rendered output |
| `lib/accent-theme.test.ts`, `lib/portia-desktop.test.ts` | regression tests | VERIFIED | `npm test` 302/302 pass |
| `10-boot-check.mjs`, `10-desktop-check.mjs` | harnesses | VERIFIED | not vacuous: they assert concrete DOM/storage facts (see criteria above) |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| portia-desktop | accent-boot | `desktopSettingsStorageKey`, `accentIds`, `motionModes` | WIRED |
| portia-desktop | accent-custom | `deriveAccentTokens`, `accentTokenNames` on restore, draft and apply | WIRED |
| accent-boot | accent-custom | `deriveAccentTokens.toString()` embedded; survives the production minifier (boot check) | WIRED |
| portia-desktop | custom-color-picker | `<CustomColorPicker group="accent" …>` in Settings | WIRED |
| QuestToast | picker Escape | picker calls `preventDefault`, toast listener honours `defaultPrevented` | WIRED (harness h) |

### Behavioral Spot-Checks and Probes

Server: `next start -p 3126` on the existing `.next` build (built after the last source edit). Stopped afterwards (PID 11880 terminated; port 3123 belongs to another process and was not touched).

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Boot script | `node 10-boot-check.mjs --url http://localhost:3126` | `{"ok":true,"cases":{"custom":true,"hostile":true,"preset":true,"customProps":10}}` | PASS |
| assistant, accent, embeds, zoom, toast | `node 10-desktop-check.mjs --check <name> --url http://localhost:3126` | all `ok:true`, `reasons: []` | PASS |
| Regression gate | `npm test` | 302 pass, 0 fail | PASS |
| Data rule | harness blocks any non-GET to /api/content | no write reason raised | PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| ROB-01 | 10-02 | SATISFIED | Criterion 1 |
| ROB-03 | 10-02 | SATISFIED | Criterion 5 |
| SEC-03 | 10-05 | SATISFIED in code and headless; YouTube playback on device open (Human item 1) | Criterion 2 |
| ZOOM-01 | 10-05 | SATISFIED | Criterion 3 (owner decision D-21 recorded in REQUIREMENTS.md) |
| ZOOM-02 | 10-05 | SATISFIED | Criterion 3 |
| A11Y-01 | 10-06 | SATISFIED | Criterion 4 |
| A11Y-02 | 10-06 | SATISFIED | Criterion 4 (D-18 recorded) |
| TEST-01 | 10-01, 10-03 | SATISFIED | Criterion 5 |
| THEME-01 | 10-01, 10-03, 10-04 | SATISFIED | Criterion 6 |

All nine IDs in ROADMAP Phase 10 appear in plan frontmatter (10-01: THEME-01, TEST-01; 10-02: ROB-01, ROB-03; 10-03: THEME-01, TEST-01; 10-04: THEME-01; 10-05: SEC-03, ZOOM-01, ZOOM-02; 10-06: A11Y-01, A11Y-02; 10-07: all nine) and in REQUIREMENTS.md (traceability table maps each to Phase 10, marked Complete). No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/portia.css` | 294, 297-298 vs 678 | `.setting-options button` leaks into the picker's close button (review WR-01, open) | Warning | Close button probably distorted (min-height 54px, padding 10px over 24x24). Picker still closes through Escape or a second click on «Свой». Does not break any must-have; see Human item 2 |
| `components/portia-desktop.tsx` | 1244-1248 | `role="listbox"/"option"` without roving tabindex or arrow keys (WR-02, open) | Warning | Plan 10-06 explicitly requires rows to stay buttons in the Tab order, so the truth holds; the ARIA pattern is half-implemented. Candidate follow-up |
| `components/custom-color-picker.tsx` | 66-73 | Colour board is pointer-only (WR-03, open) | Warning | Decision D-07 says the editor's picker is moved unchanged and no control is added. Keyboard users have the hue slider and the hex field. Follow-up, not a goal blocker |
| `components/portia-desktop.tsx` | 758-766 | Clicking «Свой» saves the current preset colour at once (IN-01, open) | Info | Preset choice replaced by an equivalent custom colour; no must-have broken |
| `components/portia-desktop.tsx` | 1409 | Blur with null relatedTarget commits again (IN-02, open) | Info | Duplicate "saved" flash only |
| `components/portia-desktop.tsx` | 31 | `allow-scripts allow-same-origin` safe only while embed sources stay cross-origin (IN-03) | Info | Current sources (docs.google.com, github.io, youtube-nocookie) are cross-origin; contract-accepted |
| `lib/*.test.ts` | various | Source-grep tests; `navigator.platform` deprecated (IN-04) | Info | Behaviour is covered by the headless harnesses I re-ran |

Debt-marker grep (TBD/FIXME/XXX) over the phase's files: none. UI review (18/24, no pillar at 1): its top item, the zoom layer lacking `pointer-events: none`, is by design. A layer that ignores pointer events cannot take the wheel over a cross-origin iframe, and the layer is absent whenever no modifier is held (harness (a), (c)). Its remaining items are style or copy warnings.

### Human Verification Required

1. **YouTube playback inside the sandbox.** Test: open an Info page with a YouTube video block on PC and on a phone, press play. Expected: it plays. If it does not, add only the one allow-* flag it needs. Why human: criterion 2 names playback; the owner's check recorded step 3 as headless only because live content has no video block.
2. **Picker close button.** Test: Settings -> «Свой», look at the × on PC and phone. Expected: a clean 24x24 button. Why human: visual; review WR-01 predicts distortion.

### Gaps Summary

No must-have FAILED. Nothing in the code review or UI review breaks a ROADMAP criterion: WR-01 is a visual defect with working alternatives to close the picker, WR-02 and WR-03 are ARIA/keyboard polish outside the plans' stated contracts (rows stay Tab-order buttons; picker unchanged by D-07). The phase stays at `human_needed` only because the contract's "видео играет" claim has no device evidence, and because WR-01 is worth a visual look before closing. All seven review findings are still `open` in 10-REVIEW-DISPOSITION.md, and the phase can close with them recorded as follow-ups.

---

_Verified: 2026-10-26_
_Verifier: Claude (gsd-verifier)_
