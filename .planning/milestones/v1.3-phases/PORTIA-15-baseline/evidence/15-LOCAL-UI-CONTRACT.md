# Phase 15 Local UI Contract

**Status:** CURRENT EVIDENCE COMPLETE — OWNER VERDICT PENDING
**Candidate set:** `phase15-current-efbc1401080d`
**Source commit:** `efbc1401080d6b65ba1f4916ad0343b783c62bb8`
**Stable inventory:** 84 rows — 51 `CAPTURED`, 33 typed `BLOCKED`
**Authority:** tracked Markdown, stable row inventory and immutable repository PNG bytes
**Digest binding:** the SHA-256 of this tracked file in canonical LF form is recorded and verified in `15-FRAME-TEST-MAP.md`.

This contract replaces mutable external design authority for the active plan. It does not replace owner judgment: no new candidate is approved until the approval ledger contains one explicit verdict for its exact hash.

## 00 Evidence

| Field | CURRENT value |
|---|---|
| Candidate manifest | `evidence/15-VISUAL-CANDIDATES.md` |
| Stable inventory | `evidence/15-STABLE-ROW-INVENTORY.json` |
| Exact row map | `evidence/15-FRAME-TEST-MAP.md` |
| Candidate storage | `tests/e2e/visual-candidates/.runs/phase15-current-efbc1401080d/` |
| Dirty ledger | Preserved per candidate JSON; no excluded user-owned path is absorbed into authority |
| Fixture | Recorded per candidate JSON |
| Clock/seed | Recorded per candidate JSON; captures use fixed time and deterministic seed |
| Environment | Project, browser, OS, viewport, DPR, locale, timezone, color scheme and resolved settings are recorded per row |

Evidence states are disjoint:

- `CAPTURED` means the PNG exists and its SHA-256 matches its candidate JSON.
- `BLOCKED` means no PNG/hash exists and the row carries one allowed blocker code plus its recovery phase.
- `APPROVED` or `REJECTED` is an owner verdict stored only in `15-VISUAL-APPROVAL.md`.

## 01 Foundations CURRENT

- Identity: PORTIA OS remains a Russian laboratory desktop/archive, not a generic dashboard.
- Palette: near-black teal ground and panels; cyan/teal for focus and live state; paper only for dossier/document surfaces; amber for pending; red for destructive/error.
- Typography: IBM Plex Mono for system chrome and codes, Golos Text for long-form documents, IBM Plex Serif for scientist records.
- Geometry: existing compact chrome and historical spacing exceptions remain authoritative; Phase 15 performs no normalization.
- Assets: current line icons, PNG spider/Vivian and repository wallpaper art remain incumbent.
- Focus: current shared `:focus-visible` outline and semantic control names remain part of the baseline contract.

## 02 Desktop CURRENT

- Top system bar, desktop icon grid, Start panel, taskbar, active item and window chrome define the shell.
- Desktop captures cover clean/Start-open states across Chromium desktop, DPR 1.25, Firefox, Chromium phone and WebKit phone.
- Restored windows are captured across all five projects; minimize/maximize are desktop-only controls.
- Phone minimize/maximize rows remain `BLOCKED` with `PHONE_WINDOW_CONTRACT` and recover in Phase 18; they must not be represented as missing PNGs.
- Settings retain accent, wallpaper, icon size, motion and spider controls. CURRENT motion is `on|off`.

## 03 Applications CURRENT

- Safe public captures exist for Virus Archive, Search, Information, Trash, Settings, Broadcasts, Employees, Guide, Table and Charter.
- The captures preserve current transitional/blank behavior where present; “captured” does not mean “defect-free.”
- Empty, loading, stale/degraded, permission-denied and fatal-error rows remain `PUBLIC_STATE_FIXTURE_REQUIRED`, recovering in Phase 20.
- Unstable third-party/private pixels remain masked or excluded from authority.

## 04 Editor CURRENT

- Captured: signed-out owner/editor login and visitor denial through Settings.
- Blocked: authenticated clean/closed roles, dirty-saving-saved, conflict/error, long list/dialog, WYSIWYG, owner access, reviewer editor and phone keyboard/touch.
- All authenticated editor rows use `ISOLATED_AUTH_REQUIRED` and recover in Phase 16. No production identity or credential is part of this contract.

## 05 Promotion CURRENT

- Captured: unbound safe participant lookup with no nickname or private projection.
- All mutation/reviewer/question/result/error variants remain `ISOLATED_PROMOTION_DATA_REQUIRED` and recover in Phase 19.
- Private questions, answers, reviewer notes, live employee data and credentials are excluded from captures.

## 06 Motion CURRENT

| Surface | Start | Key | End/rest | Interruption | Reduced/off equivalent |
|---|---|---|---|---|---|
| Shortcut | Fixed clock 0ms | Fixed clock 260ms | 760ms plus stable rest | Pointer exit at 260ms continues without moving shortcut geometry | Static icon remains usable; keyframe motion suppressed |
| Spider gait | Seeded spawn | Front-leg hunt and route state | Seeded stable placement | No arbitrary timer capture | Spider hidden/static according to current settings |
| Web | Drawn rest | Footfall wave | Stable web | No infinite evidence wait | Fully drawn static web, pulses suppressed |
| Vivian | Idle | Activity and offended | Recovery | Click/cooldown state is explicit | Advice remains understandable with soft/reduced transition |
| Boot | `BLOCKED` | `BLOCKED` | `BLOCKED` | Dedicated once-per-session context required | Immediate safe desktop is the expected equivalent |
| Wallpaper switch | `BLOCKED` | `BLOCKED` | `BLOCKED` | Each wallpaper needs its own clock boundary | Static complete wallpaper, no blank layer |

The CURRENT product behavior resolves “Анимации: Выключены” to a reduced/soft mode. A `system|on|off` model is not CURRENT.

## 07 PROPOSED — NOT CURRENT, NOT APPROVED

- Add semantic capture readiness for Search and Employees before generating replacement candidates.
- Measure and, only if needed, adjust small muted labels and the Vivian bubble in a later implementation phase.
- Evaluate denser phone vertical rhythm without changing app identity or the full-screen phone window contract.
- A three-state motion preference remains an owner decision; it cannot enter CURRENT through this contract.
- Owner-directed Phase 18 change: preserve the PORTIA OS idea while rebuilding shortcut icon art and its motion system so playback completes without container displacement or a visible animated-to-static quality jump.
- Owner-directed Phase 18 change: replace the offset-route workaround with continuous spider interpolation across neighboring web sectors; footfall waves must follow actual steps and leave no one-sided trail or teleport.
- Owner-directed Phase 18 change: window contents must reflow inside bounded geometry so important information moves responsively without breaking the composition.

### Owner-rejected CURRENT motion

Physical UAT by Qloxz on 2026-10-31 rejects the current spider route/gait, web-wave and shortcut-cycle behavior. Static PNGs remain immutable evidence of what was tested, but they do not establish smooth playback. Exact hash verdicts belong only in `15-VISUAL-APPROVAL.md`; all other captured hashes remain pending until explicitly decided.

## 08 APPROVED FOR BASELINE

For candidate set `phase15-current-efbc1401080d`: **zero Task 1 approvals**. Task 1 records evidence only.

The prior 23-hash approved baseline remains historical exact-byte authority in `15-VISUAL-APPROVAL.md`. It does not bulk-approve the 51 hashes in this set. At the next checkpoint, Qloxz must record exactly one `APPROVED` or `REJECTED` verdict per captured hash; every rejection requires a reason. The 33 `BLOCKED` rows are never presented as captured and receive no verdict.
