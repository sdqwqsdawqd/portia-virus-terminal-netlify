---
phase: 15
slug: baseline
status: verified-pending-owner
shadcn_initialized: false
preset: none
created: 2026-10-30
source_commit: 640aba9437f5c3e81a87e2a3f887ac1d3bd530a3
---

# Phase 15 — UI Design Contract

> Контракт фиксации существующего PORTIA OS. Он определяет, что и как сравнивать; он не разрешает редизайн и не объявляет candidate-снимки эталонами без подписи владельца.

## Contract Status

| Gate | Status | Authority |
|---|---|---|
| Contract completeness | VERIFIED | GSD UI six-dimension review |
| Repository-native CURRENT review | PENDING | GSD/Impeccable review plus immutable capture map |
| Visual candidate set | PENDING | Deterministic Playwright capture |
| Baseline promotion | BLOCKED | Named owner approval of exact hashes |
| Motion `system` mode | UNRESOLVED / PROPOSED ONLY | Separate owner product decision |
| Representative physical phone | PENDING | Owner device selection |

`CAPTURED`, `AUTOMATED-PASS` and `MANUAL-APPROVED` are different states. Neither a green test nor an existing PNG may be reported as owner approval.

## Preservation Principles

1. PORTIA OS remains the same Russian desktop-metaphor product. Phase 15 records current behavior and identity; it does not fix known bugs.
2. Preserve app IDs, Russian labels, data shapes, storage keys, window chrome, current fonts, accent model, PNG spider, web, Vivian and accepted iframe limitations.
3. Every local review row is labelled `CURRENT`, `PROPOSED` or `REJECTED`. Only owner-signed `CURRENT` hashes may map to approved snapshots.
4. The repository and running product are authoritative for current behavior. Older Impeccable proposals are historical when they conflict with validated project decisions.
5. Visual snapshots are produced in a candidate lane first. Bulk `--update-snapshots` is prohibited.

### Explicit non-goals

- No new component library, shadcn preset, generic app shell, font, icon family or motion library.
- No CSS cleanup, spacing normalization, new animation, bug fix or content rewrite.
- No SVG replacement for the PNG spider.
- No automatic acceptance of first-run screenshots.
- No visual comparison of unstable third-party iframe/video pixels.

## Design System

| Property | Current contract |
|---|---|
| Tool | Existing custom CSS in `app/portia.css`; no shadcn |
| Component library | Existing PORTIA-specific React components; no external registry |
| Icons | Existing inline/currentColor SVG icons and approved raster assets |
| Interface/display font | IBM Plex Mono through current layout variables |
| Long-form document font | Golos Text |
| Scientist/log font | IBM Plex Serif |
| Visual language | Dark teal electrophoresis / laboratory desktop |
| Primary accent source | Current CSS variables and `data-accent`; custom accent remains supported |
| Motion source | Current CSS/rAF behavior; no Motion/Framer Motion |

Registry safety is satisfied by using no registry blocks. Introducing a third-party component requires a separate phase decision and diff review.

## Color Contract

The baseline stores computed colors and relevant CSS variables in its manifest. It must not convert OKLCH values to hand-picked replacement hex colors.

| Role | Current source/value | Contract |
|---|---|---|
| Desktop base | `#07100f` | Preserve the near-black teal field |
| Desktop deep | `#0c1715` | Preserve layered dark surfaces |
| Background/surfaces | `--bg`, `--panel`, `--panel-2` OKLCH values | Hue follows current accent variables |
| Lines | `--line`, `--line-bright` | Preserve low-contrast laboratory grid/chrome |
| Default teal | `#00bca6` | Primary focus/selection/accent, not universal fill |
| Dim teal | `#12897a` | Secondary accent and selected-state support |
| Paper | `#f3f0e6`, `#e6e2d5` | Virus/document paper surfaces only |
| Warning | `#efb84e` | Pending/dirty/time-sensitive state |
| Destructive | `#d55449` and existing darker variants | Destructive/error actions only |
| Accent presets | teal, ice `#7ec8e3`, amber `#e8953f`, red `#d94f6e`, custom | Preserve current setting and contrast behavior |

Accent is reserved for focus, active selection, status highlights, interactive borders and controlled motion details. Error, warning and destructive semantics retain their dedicated colors.

## Typography Contract

Phase 15 records computed styles per surface rather than forcing a new universal scale.

| Role | Current pattern | Baseline rule |
|---|---|---|
| System chrome | 11–14px, medium/bold IBM Plex Mono | Preserve compact uppercase/letter-spaced labels |
| Window/app body | Mostly 12–15px | Preserve current per-app hierarchy |
| Major headings | Responsive `clamp()` around 27–46px | Capture desktop and phone computed values |
| Document body | Golos Text with existing line-height | Do not replace with monospace |
| Scientist records | IBM Plex Serif | Preserve serif semantic distinction |
| Codes, timestamps, counters | IBM Plex Mono with tabular numbers where present | Preserve alignment and code-like meaning |

Font readiness (`document.fonts.ready`) is mandatory before candidate capture. Missing or fallback fonts invalidate the candidate set.

## Spacing and Geometry Contract

The current UI contains deliberate and historical values beyond a strict 4px scale. Phase 15 must preserve them rather than normalize them.

| Token for documentation | Reference | Typical usage |
|---|---:|---|
| xs | 4px | Tiny gaps, badges, compact states |
| sm | 8px | Control gaps and compact padding |
| md | 16px | Card/panel spacing |
| lg | 24px | App shell and section padding |
| xl | 32px | Large content separation |
| 2xl | 48px | Major page rhythm |

Recorded exceptions include existing 3/5/6/7/9/10/11/12/13/14/15/17/18/22/25/28/30/34/46/58px values and responsive `clamp()` rules. An exception is not technical debt to repair in Phase 15. Window geometry, title-bar height, controls, insets, minimum sizes and phone full-screen behavior are captured as computed measurements.

## Viewport, Device and DPR Matrix

| Project | Viewport / DPR | Purpose | Authoritative pixels |
|---|---|---|---|
| `chromium-desktop` | 1440×900 / 1 | Canonical desktop behavior and still visuals | Yes, after owner approval |
| `chromium-dpr125` | 1440×900 / 1.25 | Owner-PC geometry, shortcuts, spider/web/Vivian | Yes, separate suffix after approval |
| `firefox-desktop` | 1440×900 / 1 | Behavior, console and accessibility smoke | No pixel golden |
| `webkit-phone` | Owner-approved iPhone descriptor | Primary phone/touch/layout behavior | Candidate only until device approval |
| `chromium-phone` | Owner-recorded Android viewport/DPR | Mobile browser-difference smoke | Candidate only |

Common context: `ru-RU`, Moscow timezone, dark scheme, fixed instant, deterministic seed, explicit accent/wallpaper/motion/spider settings. Actors are fixtures, not multiplied blindly across every browser project.

## Surface and State Inventory

### Desktop and window shell

- Clean desktop; boot complete; taskbar/start/search closed and open.
- Every shortcut at rest, hover/focus cycle key states and static handoff.
- Window opening, active/inactive, restored, minimized, maximized, minimum size and edge geometry.
- Settings combinations for accent, custom accent, wallpaper, icon size/position, motion and spider.
- PNG spider, web, Vivian and wallpaper in deterministic rest/key states.

### Public applications

- Virus archive, Employees, Broadcasts, Information, Guide, Trash, Settings, Search, Table and Charter.
- For applicable surfaces: loading, empty, populated, stale/degraded, permission denied and fatal error.
- Third-party embeds use stable shell/fallback evidence; their remote pixels are masked or excluded.

### Editor

- Signed-out, editor, promo reviewer and owner access states.
- Tab available/closed/revoked; loading, clean, dirty, saving, saved, conflict and error.
- Long list/internal scroll, dialogs, WYSIWYG selection/format panel, phone keyboard/touch.

### Promotion

- Safe participant lookup, eligible action, cooldown, active request, assigned task/test, result and safe error.
- Reviewer queue, claimed/unclaimed, bank list/editor, count controls, preview and save states.
- Active qualification lock, question types, deadline and phone/desktop variants without capturing secrets.

## Motion Contract

| Surface | Required evidence | Interruption/rest rule | Motion off |
|---|---|---|---|
| Boot | Start, transition, complete | Runs at most once per session under current behavior | Immediate safe desktop state |
| Shortcut | Rest, start, key, final, handoff | Pointer exit must be documented; final visual equals static geometry | Static icon remains fully usable |
| PNG spider gait | Spawn/rest, front-leg step, hunting signal, route key states | No arbitrary capture; fixed clock and seed | Spider behavior follows current setting; no hidden content |
| Web/waves | Rest and wave response | No infinite evidence wait | Fully rendered static web |
| Vivian | Idle, click/activity/offended and bubble | Accent and readability remain stable | Message remains understandable |
| Wallpaper | Stable frame and representative movement | Switching must not flash blank layer | Complete static wallpaper |
| Window/qualification | Drag/resize and locked state | Locked test interaction cannot be bypassed | Lock remains understandable without animation |

The current product contract is `on|off`. A three-state `system|on|off` model may appear only under `PROPOSED`; Phase 15 does not implement or silently approve it.

## Copywriting Contract

- UI remains Russian-only. Technical English may exist in evidence filenames and test IDs, not user-facing messages.
- Buttons use concrete actions already present in the product; tests locate them by accessible Russian name.
- Empty state states what is absent and, when possible, the safe next action.
- Error state identifies the failed layer without exposing secrets and offers a retry/recovery path.
- Disabled controls have a visible reason where the user might otherwise expect action.
- Destructive confirmation names the record and irreversible result.
- No doubled punctuation, joke placeholder, raw stack trace or untranslated database error enters an approved frame.

## Accessibility and Focus Contract

- Interactive controls expose name, role and state; focus is visible against every approved accent.
- Dialogs trap focus and restore it to the invoker; window/app changes have deterministic focus destinations.
- Keyboard and touch paths are represented separately when interaction differs.
- Touch controls remain reachable without hover and are not obscured by sticky chrome or the phone keyboard.
- Motion-off evidence proves that information and feedback do not depend on movement.
- Axe output is stored as a fingerprint inventory. Existing findings are not silently fixed or declared compliant; new/unapproved fingerprints fail the gate.

## Repository-native UI Artifact Contract

The repository records the source commit, candidate-set ID, local-contract digest, named signer and verdict in `evidence/15-LOCAL-UI-CONTRACT.md` and `evidence/15-VISUAL-APPROVAL.md`. Immutable PNG hashes and tracked Markdown form the portable authority; no external mutable design file is required.

Required sections:

1. `00 Evidence` — source commit, dirty-ledger ID, candidate hashes and environment.
2. `01 Foundations CURRENT` — colors, typography, spacing exceptions, icons and raster assets.
3. `02 Desktop CURRENT` — desktop, taskbar, shortcuts, settings and window shell.
4. `03 Applications CURRENT` — normal and system states for public applications.
5. `04 Editor CURRENT` — role/access/save/conflict/phone states.
6. `05 Promotion CURRENT` — participant and reviewer states with secrets removed.
7. `06 Motion CURRENT` — start/key/end/rest, duration/easing, interruption and off equivalent.
8. `07 PROPOSED` — optional future ideas, excluded from current baseline.
9. `08 APPROVED FOR BASELINE` — owner-signed frames linked to exact candidate hashes.

The local contract is reviewed with `gsd-ui-review` and Impeccable, then bound to Playwright captures by SHA-256. Proposed content stays separate from CURRENT and cannot become approved through a bulk snapshot update.

## Candidate Capture and Promotion Protocol

1. Capture with `page.screenshot()` into `evidence/visual-candidates/<candidate-set-id>/`, never directly into the golden directory.
2. Wait through semantic/web-first conditions for fonts, local images, fixture completion and the requested state; `waitForTimeout` is forbidden.
3. Manifest each PNG with requirement, commit, dirty-ledger ID, actor/state, fixture revision, seed/time, tool/browser/OS, viewport/DPR, locale/timezone, settings and SHA-256.
4. Record `APPROVED`, `REJECTED` or `PENDING` per exact hash in `evidence/15-VISUAL-APPROVAL.md`, including signer, timestamp and local review row.
5. Copy only approved bytes to snapshot destinations. Do not recapture during promotion.
6. Run `toHaveScreenshot` from the pinned clean environment and verify that approved bytes remain unchanged.

## Playwright Mapping

| Requirement | Contract evidence | Browser evidence |
|---|---|---|
| STAB-BASE-01 | Surface inventory, locked identity, local CURRENT sections | Before/current-state behavior and candidate set |
| STAB-BASE-02 | Device/actor/state matrix | Committed project, fixture and page-object suite |
| STAB-BASE-03 | Candidate/promotion protocol | Approved Chromium desktop/DPR1.25/phone snapshots |
| STAB-BASE-04 | Repository UI artifact and motion contract | Row-to-test mapping and signed contract digest |
| STAB-BASE-05 | Copy/error and accessibility contracts | Automatic console/network/hydration/CSP fixture |
| STAB-BASE-06 | Gate/status definitions | `15-TRACEABILITY.md`, summaries and verification |

## Security and Privacy Boundaries

- Candidate images, traces and reports contain no auth headers, cookies, private answers, internal notes, future questions or reviewer identity.
- PORTIA `/api/**` remains real in contract E2E. Only Google/Roblox/media boundaries may be stabilized.
- Mutation-capable tests fail closed unless the target is a dedicated non-production Supabase project.
- Test-only randomness/storage/clock hooks remain under `tests/e2e` and must not enter production imports or bundles.
- Snapshot approval requires a named owner and hash ledger to prevent baseline tampering or accidental first-run approval.

## Owner Checkpoints

The following remain deliberately unresolved and block Phase 15 completion, not plan creation:

1. Disposition and owner of the existing uncommitted `motion` package patch.
2. Dedicated non-production Supabase target and role accounts.
3. Representative phone/device descriptor and physical phone UAT target.
4. Authoritative local UI contract digest and named signing owner.
5. Exact disposition/expiry for any diagnostic or accessibility allowlist entry.
6. Approval or rejection of every candidate-set hash before baseline promotion.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — Russian state/error/disabled/destructive rules are explicit.
- [x] Dimension 2 Visuals: PASS — surfaces, states, devices and candidate approval are enumerated without redesign.
- [x] Dimension 3 Color: PASS — current token sources and semantic exceptions are locked.
- [x] Dimension 4 Typography: PASS — all three current Cyrillic font roles and readiness are locked.
- [x] Dimension 5 Spacing: PASS — current rhythm and non-4px exceptions are preserved rather than normalized.
- [x] Dimension 6 Registry Safety: PASS — no registry/library addition is permitted.

**Contract verification:** PASS, 2026-10-30.  
**Owner/local-baseline approval:** PENDING; execution plans must preserve terminal checkpoints.
